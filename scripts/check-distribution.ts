import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { Effect, Schema } from "effect"
import { ReleaseError } from "@mannyc1/ts-release"
import { loadBundle } from "@mannyc1/ts-release/bundle"
import { fileContentOwner, FinalizedReport } from "@mannyc1/ts-release/node"
import * as Npm from "@mannyc1/ts-release-npm"
import {
  startNativeReleasePeer,
  type NativeMutation,
} from "../test/reimplementation/self-release/native-peer.js"

const root = resolve(import.meta.dir, "..")
const directory = resolve(process.argv[2] ?? ".release/distribution")
const node = process.env.TS_RELEASE_ACCEPTANCE_NODE ?? Bun.which("node")
const git = Bun.which("git")
assert.ok(node, "Installed acceptance requires Node")
assert.ok(git, "Installed acceptance requires Git")
const work = await mkdtemp(join(tmpdir(), "ts-release-installed-"))
const consumer = join(work, "consumer")
await mkdir(join(consumer, "archives"), { recursive: true })
const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex")
const identity = JSON.parse(await readFile(join(directory, "identity.json"), "utf8"))
const retainedBytes = await readFile(join(directory, "bundle.json"))
assert.equal(sha256(retainedBytes), identity.bundleSha256)
const retainedPlan = JSON.parse(await readFile(join(directory, "plan.json"), "utf8"))
assert.equal(retainedPlan.planId, identity.planId)
assert.equal(retainedPlan.bundleId, identity.bundleSha256)
const owner = fileContentOwner(join(directory, "content"))
const bundle = await Effect.runPromise(loadBundle(owner, retainedBytes))
const packages: {
  name: string
  version: string
  publicName: string
  archiveFile: string
  sha256: string
}[] = []
for (const artifact of bundle.artifacts) {
  if (artifact._tag !== "OwnedFile" || !artifact.logicalName.endsWith(".tgz")) continue
  assert.equal(basename(artifact.logicalName), artifact.logicalName)
  const metadata = await Effect.runPromise(
    Npm.inspectTarball(artifact, {
      bundle,
      readContent: (content) =>
        owner.read(content).pipe(
          Effect.mapError(
            () =>
              new ReleaseError({
                code: "candidate-content",
                message: "Candidate content could not be read",
              }),
          ),
        ),
    }),
  )
  assert.equal(metadata.private, false)
  const archiveFile = join(consumer, "archives", artifact.logicalName)
  await writeFile(archiveFile, await Effect.runPromise(owner.read(artifact.content)))
  packages.push({
    name: metadata.name,
    version: metadata.version,
    publicName: artifact.logicalName,
    archiveFile,
    sha256: artifact.content.sha256,
  })
}
const expectedNames = [
  "ts-release",
  "ts-release-catalog",
  "ts-release-github",
  "ts-release-mcp",
  "ts-release-npm",
  "ts-release-openai",
  "ts-release-pypi",
].map((name) => `@mannyc1/${name}`)
assert.deepEqual(packages.map((entry) => entry.name).sort(), expectedNames.sort())
const version = packages[0]!.version
assert.ok(packages.every((entry) => entry.version === version))
const sourceFile = bundle.artifacts.find(
  (artifact) => artifact._tag === "OwnedFile" && artifact.logicalName === "source.json",
)
assert.ok(sourceFile?._tag === "OwnedFile")
const source = JSON.parse(
  new TextDecoder().decode(await Effect.runPromise(owner.read(sourceFile.content))),
)
assert.match(source.commit, /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u)
assert.match(source.tree, /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u)
assert.equal(source.version, version)

const run = async (argv: string[]) => {
  const child = Bun.spawn(argv, { cwd: consumer, stdout: "pipe", stderr: "pipe", timeout: 120_000 })
  const [exit, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  assert.equal(exit, 0, stdout + stderr)
  return stdout
}
const workspace = JSON.parse(await readFile(join(root, "package.json"), "utf8"))
await writeFile(
  join(consumer, "package.json"),
  JSON.stringify({
    private: true,
    type: "module",
    dependencies: {
      "@mannyc1/ts-release": `file:${packages.find((entry) => entry.name === "@mannyc1/ts-release")!.archiveFile}`,
      effect: workspace.devDependencies.effect,
      ...Object.fromEntries(packages.map((entry) => [entry.name, `file:${entry.archiveFile}`])),
    },
  }),
)
// Install before applying the fail-closed TLS routing environment to child processes.
await run([
  process.execPath,
  "install",
  "--ignore-scripts",
  "--cache-dir",
  join(consumer, ".bun-cache"),
])
const imports = []
for (const entry of packages) {
  assert.equal((await lstat(join(consumer, "node_modules", entry.name))).isSymbolicLink(), false)
  const installed = JSON.parse(
    await readFile(join(consumer, "node_modules", entry.name, "package.json"), "utf8"),
  )
  assert.equal(installed.version, version)
  const paths = Object.keys(installed.exports)
  for (const path of paths.includes(".") ? ["."] : paths) {
    imports.push(
      `await import(${JSON.stringify(entry.name + (path === "." ? "" : path.slice(1)))});`,
    )
  }
}
await writeFile(join(consumer, "imports.mjs"), imports.join("\n"))
await run([node, "imports.mjs"])
await run([process.execPath, "imports.mjs"])
assert.equal(
  (await run([process.execPath, "run", "ts-release", "--help"])).trim(),
  "Usage: ts-release [--observe] <application.mjs> <input.json>",
)

const applicationDirectory = join(consumer, "application")
await cp(join(root, "apps/self-release/dist"), applicationDirectory, {
  recursive: true,
  filter: (path) => !basename(path).startsWith("rehearsal."),
})
const applicationHashes: Record<string, string> = {}
for (const name of await readdir(applicationDirectory)) {
  if (!name.endsWith(".js")) continue
  const bytes = await readFile(join(applicationDirectory, name))
  assert.deepEqual(bytes, await readFile(join(root, "apps/self-release/dist", name)))
  applicationHashes[name] = sha256(bytes)
}
for (const name of ["application.js", "prepare.js", "Model.js"]) assert.ok(applicationHashes[name])
await cp(
  join(root, "test/reimplementation/self-release/native-prepare-installed.mjs"),
  join(consumer, "prepare-fixture.mjs"),
)
const launcher = join(consumer, "action-launcher.cjs")
await cp(join(root, "apps/action/dist/launcher.cjs"), launcher)
const launcherSha256 = sha256(await readFile(launcher))
assert.equal(launcherSha256, sha256(await readFile(join(root, "apps/action/dist/launcher.cjs"))))
const cli = join(consumer, "node_modules/@mannyc1/ts-release/dist/bin/ts-release.js")
const outcomes: {
  scenario: string
  planId: string
  operations: number
  mutations: number
  journalRevision: number
  interruptedSubject: string | undefined
  freshCaches: number
  visiblePublications: number
}[] = []
interface Running {
  child: Bun.Subprocess
  result: Promise<[number, string, string]>
  outputFile: string
  entrypoint: "cli" | "action"
}

for (const scenario of ["ordinary", "npm-response-loss", "github-response-loss"] as const) {
  const scenarioDirectory = join(consumer, scenario)
  await mkdir(scenarioDirectory)
  const notesFile = join(scenarioDirectory, "notes.md")
  await writeFile(notesFile, `Installed production application acceptance for ${version}.\n`)
  const candidateDirectory = join(scenarioDirectory, "candidate")
  const preparationFile = join(scenarioDirectory, "preparation.json")
  await writeFile(
    preparationFile,
    JSON.stringify({
      candidateDirectory,
      repository: { owner: "native-fixture", name: "retained-seven-packages" },
      source: { commit: source.commit, tree: source.tree },
      version,
      title: `ts-release ${version}`,
      notesFile,
      packages: packages.map(({ archiveFile, publicName }) => ({ archiveFile, publicName })),
      corePackage: "@mannyc1/ts-release",
    }),
  )
  // The real preparer constructs a token-mode fixture Plan; a Trusted Publisher
  // Plan is never given fixture tokens or rewritten after preparation.
  const prepared = JSON.parse(await run([node, "prepare-fixture.mjs", preparationFile]))
  const originalBundle = await readFile(join(candidateDirectory, "bundle.json"))
  const originalPlan = await readFile(join(candidateDirectory, "plan.json"))
  assert.equal(sha256(originalBundle), prepared.bundleSha256)
  const fixtureOwner = fileContentOwner(join(candidateDirectory, "content"))
  const fixtureBundle = await Effect.runPromise(loadBundle(fixtureOwner, originalBundle))
  const assets = new Map<string, Uint8Array>()
  for (const artifact of fixtureBundle.artifacts) {
    assert.equal(artifact._tag, "OwnedFile")
    if (artifact._tag === "OwnedFile")
      assets.set(artifact.logicalName, await Effect.runPromise(fixtureOwner.read(artifact.content)))
  }
  assert.equal(assets.size, 9)
  for (const entry of packages) assert.equal(sha256(assets.get(entry.publicName)!), entry.sha256)
  const expectedOperations = 7 + 1 + 1 + assets.size + 1
  const journal = join(scenarioDirectory, "journal.git")
  await run([git, "init", "--bare", "--initial-branch=main", journal])
  const peer = await startNativeReleasePeer()
  const active = new Set<Bun.Subprocess>()
  let attempt = 0
  const invoke = async (entrypoint: "cli" | "action", observe = false): Promise<Running> => {
    const input = {
      candidateDirectory,
      bundleSha256: prepared.bundleSha256,
      planId: prepared.planId,
      authorize: true,
      journal: {
        remote: pathToFileURL(journal).href,
        cacheDirectory: join(scenarioDirectory, `fresh-cache-${++attempt}`),
        gitExecutable: git,
        principal: "fixture-journal",
        scope: "release",
        timeoutMilliseconds: 10_000,
        maximumOutputBytes: 16 * 1024 * 1024,
      },
      authentication: {
        mode: "Token",
        npmTokenEnvironment: "NATIVE_FIXTURE_NPM_TOKEN",
        githubTokenEnvironment: "NATIVE_FIXTURE_GITHUB_TOKEN",
      },
      timeoutMilliseconds: 30_000,
    }
    const inputFile = join(scenarioDirectory, `input-${attempt}.json`)
    const outputFile = join(scenarioDirectory, `action-output-${attempt}`)
    await writeFile(inputFile, JSON.stringify(input))
    await writeFile(outputFile, "")
    const child = Bun.spawn(
      entrypoint === "cli"
        ? [
            node,
            cli,
            ...(observe ? ["--observe"] : []),
            join(applicationDirectory, "application.js"),
            inputFile,
          ]
        : [node, launcher],
      {
        cwd: consumer,
        env: {
          ...process.env,
          ...peer.environment,
          NATIVE_FIXTURE_NPM_TOKEN: "ephemeral-native-fixture",
          NATIVE_FIXTURE_GITHUB_TOKEN: "ephemeral-native-fixture",
          GITHUB_WORKSPACE: consumer,
          GITHUB_OUTPUT: outputFile,
          INPUT_APPLICATION: "application/application.js",
          INPUT_INPUT: JSON.stringify(input),
          INPUT_OBSERVE: String(observe),
        },
        stdout: "pipe",
        stderr: "pipe",
        timeout: 300_000,
      },
    )
    active.add(child)
    const result = Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]).finally(() => active.delete(child))
    return { child, result, outputFile, entrypoint }
  }
  const finish = async (running: Running, expectedExit: 0 | 2): Promise<FinalizedReport> => {
    const [exit, stdout, stderr] = await running.result
    assert.equal(exit, expectedExit, `${scenario}/${running.entrypoint}: ${stdout}${stderr}`)
    const report = Schema.decodeUnknownSync(FinalizedReport)(JSON.parse(stdout))
    assert.equal(report.plan.planId, prepared.planId)
    assert.equal(report.operations.length, expectedOperations)
    assert.equal(
      report.operations.every((operation) => operation.status === "Satisfied"),
      expectedExit === 0,
    )
    if (running.entrypoint === "action")
      assert.equal(
        await readFile(running.outputFile, "utf8"),
        `plan-id=${report.plan.planId}\njournal-revision=${report.journal.revision}\n`,
      )
    return report
  }
  try {
    await finish(await invoke("cli", true), 2)
    await finish(await invoke("action", true), 2)
    assert.equal(peer.mutations.length, 0, "Observe must never dispatch")
    let interrupted: NativeMutation | undefined
    let completed: FinalizedReport
    if (scenario === "ordinary") completed = await finish(await invoke("cli"), 0)
    else {
      const isNpm = scenario === "npm-response-loss"
      const paused = peer.pauseAfterCommit((mutation) =>
        isNpm
          ? mutation.host === "registry.npmjs.org" && mutation.method === "PUT"
          : mutation.host === "uploads.github.com" && mutation.method === "POST",
      )
      const first = await invoke(isNpm ? "cli" : "action")
      let deadline: ReturnType<typeof setTimeout> | undefined
      try {
        interrupted = await Promise.race([
          paused.committed,
          first.result.then(([exit, stdout, stderr]) => {
            throw new Error(`Child exited before held response (${exit}): ${stdout}${stderr}`)
          }),
          new Promise<never>((_, reject) => {
            deadline = setTimeout(() => reject(new Error("Native commit timeout")), 90_000)
          }),
        ])
      } finally {
        clearTimeout(deadline)
      }
      peer.hide(interrupted.subject)
      first.child.kill("SIGKILL")
      assert.notEqual((await first.result)[0], 0)
      paused.resume()
      const recoveredEntrypoint = isNpm ? "action" : "cli"
      await finish(await invoke(recoveredEntrypoint), 2)
      assert.equal(
        peer.mutations.filter((mutation) => mutation.subject === interrupted!.subject).length,
        1,
        "Hidden committed publication must not be resent",
      )
      peer.reveal(interrupted.subject)
      completed = await finish(await invoke(recoveredEntrypoint), 0)
    }
    const npmWrites = peer.mutations.filter((mutation) => mutation.host === "registry.npmjs.org")
    assert.equal(npmWrites.length, 7)
    const publishedNames = npmWrites.map(
      (mutation) => JSON.parse(new TextDecoder().decode(mutation.body)).name as string,
    )
    assert.deepEqual([...publishedNames].sort(), expectedNames)
    for (const mutation of npmWrites) {
      const document = JSON.parse(new TextDecoder().decode(mutation.body))
      const publication = packages.find((entry) => entry.name === document.name)!
      const attachments = Object.values(document._attachments) as { data: string }[]
      assert.equal(attachments.length, 1)
      assert.deepEqual(
        new Uint8Array(Buffer.from(attachments[0]!.data, "base64")),
        assets.get(publication.publicName),
        `Published ${publication.name} must equal its retained archive`,
      )
    }
    assert.equal(publishedNames.at(-1), "@mannyc1/ts-release")
    assert.ok(
      peer.mutations.slice(0, 7).every((mutation) => mutation.host === "registry.npmjs.org"),
    )
    const uploads = peer.mutations.filter((mutation) => mutation.host === "uploads.github.com")
    assert.equal(uploads.length, assets.size)
    assert.equal(
      new Set(
        uploads.map((upload) =>
          new URL(upload.path, "https://uploads.github.com").searchParams.get("name"),
        ),
      ).size,
      assets.size,
    )
    for (const upload of uploads) {
      const name = new URL(upload.path, "https://uploads.github.com").searchParams.get("name")!
      assert.ok(assets.has(name))
      assert.deepEqual(upload.body, assets.get(name), `Uploaded ${name} must equal retained bytes`)
    }
    assert.equal(peer.mutations.at(-1)!.method, "PATCH")
    assert.equal(JSON.parse(new TextDecoder().decode(peer.mutations.at(-1)!.body)).draft, false)
    assert.equal(peer.mutations.length, expectedOperations)
    assert.equal(
      completed.journal.events.filter((event) => event.body._tag === "DispatchStarted").length,
      expectedOperations,
    )
    assert.equal(
      completed.journal.events.filter((event) => event.body._tag === "ReceiptAccepted").length,
      expectedOperations - (interrupted ? 1 : 0),
    )
    const writes = peer.mutations.length
    await finish(await invoke("cli"), 0)
    const visible = await finish(await invoke("action"), 0)
    const observed = new Map<string, string>()
    for (const event of visible.journal.events) {
      if (
        event.planId === visible.plan.planId &&
        event.body._tag === "ObservationRecorded" &&
        event.body.evidenceKind === "Observation"
      )
        observed.set(event.body.operationId, event.body.status)
    }
    const publicOperations = visible.plan.operations.filter((operation) =>
      ["npm.publish", "github.publish"].includes(operation.definitionId),
    )
    assert.equal(publicOperations.length, 8)
    assert.ok(
      publicOperations.every((operation) => observed.get(operation.operationId) === "Satisfied"),
      "Native observations must confirm public visibility independently of receipts",
    )
    assert.equal(peer.mutations.length, writes, "Completed reruns must not dispatch")
    assert.deepEqual(await readFile(join(candidateDirectory, "bundle.json")), originalBundle)
    assert.deepEqual(await readFile(join(candidateDirectory, "plan.json")), originalPlan)
    assert.deepEqual(peer.failures, [])
    outcomes.push({
      scenario,
      planId: prepared.planId,
      operations: expectedOperations,
      mutations: writes,
      journalRevision: completed.journal.revision,
      interruptedSubject: interrupted?.subject,
      freshCaches: attempt,
      visiblePublications: publicOperations.length,
    })
  } finally {
    for (const child of active) child.kill("SIGKILL")
    await Promise.all([...active].map((child) => child.exited))
    await peer.close()
  }
}
const evidence = {
  format: "ts-release/installed-distribution/2",
  candidateDirectory: directory,
  candidateBundleSha256: identity.bundleSha256,
  candidatePlanId: identity.planId,
  consumer,
  version,
  packages: packages.map(({ name, sha256 }) => ({ name, sha256 })),
  node: (await run([node, "--version"])).trim(),
  applicationHashes,
  launcherSha256,
  outcomes,
  scope:
    "Installed production application, CLI and committed Action launcher with native HTTPS peers; public npm OIDC and GitHub services are not contacted.",
}
await mkdir(join(root, ".release/checks"), { recursive: true })
await writeFile(
  join(root, ".release/checks/installed-distribution.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
)
console.log(JSON.stringify(evidence))
