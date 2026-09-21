import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { Effect, Schema } from "effect"
import { ReleaseError, loadPlan } from "@mannyc1/ts-release"
import { loadBundle } from "@mannyc1/ts-release/bundle"
import { fileContentOwner } from "@mannyc1/ts-release/node"
import * as Npm from "@mannyc1/ts-release-npm"
import * as GitHub from "@mannyc1/ts-release-github"

// Repository policy only: build/pack and author a retained public Bundle/Plan.
// Publication belongs to the application, providers and durable journal.
export const owners = ["catalog", "github", "mcp", "npm", "openai", "pypi", "ts-release"] as const
export const repository = "mannyc2/ts-release"
export const packageName = (owner: string) =>
  `@mannyc1/${owner === "ts-release" ? owner : `ts-release-${owner}`}`
const root = resolve(import.meta.dir, "..")
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
const unavailable = () =>
  Effect.fail(
    new ReleaseError({
      code: "preparation-network",
      message: "Candidate inspection cannot perform network I/O",
    }),
  )
const execute = async (argv: string[], cwd = root) => {
  const child = Bun.spawn(argv, { cwd, stdout: "pipe", stderr: "pipe", stdin: "ignore" })
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  assert.equal(code, 0, `${argv[0]} ${argv[1]} failed\n${stdout}\n${stderr}`)
  return stdout.trim()
}

export async function readCandidate(directory: string) {
  const identity = JSON.parse(await readFile(join(directory, "identity.json"), "utf8"))
  const bytes = await readFile(join(directory, "bundle.json"))
  assert.equal(digest(bytes), identity.bundleSha256, "Retained Bundle identity differs")
  const owner = fileContentOwner(join(directory, "content"))
  const bundle = await Effect.runPromise(loadBundle(owner, bytes))
  const readContent = (content: Parameters<typeof owner.read>[0]) =>
    owner
      .read(content)
      .pipe(
        Effect.mapError(
          () =>
            new ReleaseError({ code: "candidate-content", message: "Retained content differs" }),
        ),
      )
  const providers = [
    ...Npm.definitions({ bundle, readContent, read: unavailable, verifyProvenance: unavailable }),
    ...GitHub.definitions({ bundle, readContent, read: unavailable }),
  ]
  const plan = await Effect.runPromise(
    loadPlan(JSON.parse(await readFile(join(directory, "plan.json"), "utf8")), providers),
  )
  assert.equal(plan.planId, identity.planId, "Retained Plan identity differs")
  assert.equal(plan.bundleId, identity.bundleSha256, "Plan targets another Bundle")
  const packages = plan.operations
    .filter((operation) => operation.definitionId === "npm.publish")
    .map((operation) => Schema.decodeUnknownSync(Npm.PublishIntent)(operation.intent))
  assert.deepEqual(
    packages.map((entry) => entry.name).sort(),
    owners.map(packageName).sort(),
    "Exactly the seven repository packages are required",
  )
  const artifact = (name: string) => {
    const file = bundle.artifacts.find((item) => item.logicalName === name)
    assert.ok(file?._tag === "OwnedFile", `Missing owned ${name}`)
    return file
  }
  const source = JSON.parse(
    new TextDecoder().decode(await Effect.runPromise(readContent(artifact("source.json").content))),
  )
  assert.equal(`${source.repository.owner}/${source.repository.name}`, repository)
  for (const entry of packages) {
    const metadata = await Effect.runPromise(
      Npm.inspectTarball(entry.tarball, { bundle, readContent }),
    )
    assert.equal(entry.version, source.version)
    assert.equal(metadata.name, entry.name)
    assert.equal(metadata.version, entry.version)
    assert.equal(metadata.integrity, entry.integrity)
    assert.equal(metadata.shasum, entry.shasum)
    assert.equal(metadata.private, false)
  }
  // Every owned artifact must survive restoration, including signed provenance.
  for (const file of bundle.artifacts)
    if (file._tag === "OwnedFile") await Effect.runPromise(owner.verify(file.content))
  return { identity, bundle, plan, owner, readContent, packages, source, artifact }
}

async function prepare(directory: string, original?: string) {
  assert.equal(
    await execute(["git", "status", "--porcelain"]),
    "",
    "Commit the reviewed candidate before preparation",
  )
  const workspace = JSON.parse(await readFile(join(root, "package.json"), "utf8"))
  assert.equal(Bun.version, workspace.packageManager.replace("bun@", ""))
  await execute([process.execPath, "run", "build:delivery"])
  assert.equal(
    await execute(["git", "status", "--porcelain"]),
    "",
    "Generated Action and starter must equal the reviewed commit",
  )
  const commit = await execute(["git", "rev-parse", "HEAD"])
  const tree = await execute(["git", "rev-parse", "HEAD^{tree}"])
  const staging = await mkdtemp(join(tmpdir(), "ts-release-preparation-"))
  try {
    const packages: { archiveFile: string; publicName: string }[] = []
    const notesFile = join(staging, "release-notes.md")
    let npm: Record<string, unknown> = {
      authorization: { _tag: "TokenAuthorization", principal: "npm-publisher" },
      initialTag: "latest",
    }
    if (original) {
      const retained = await readCandidate(original)
      assert.equal(retained.source.commit, commit, "Original source commit differs")
      assert.equal(retained.source.tree, tree, "Original source tree differs")
      assert.equal(retained.source.version, workspace.version)
      for (const entry of retained.packages) {
        const publicName = entry.tarball.logicalName
        assert.ok(/^[A-Za-z0-9._-]+\.tgz$/u.test(publicName))
        const archiveFile = join(staging, publicName)
        await writeFile(
          archiveFile,
          await Effect.runPromise(retained.readContent(entry.tarball.content)),
          { flag: "wx" },
        )
        packages.push({ archiveFile, publicName })
      }
      await writeFile(
        notesFile,
        await Effect.runPromise(
          retained.readContent(retained.artifact("release-notes.md").content),
        ),
      )
      const env = (name: string) => {
        const value = process.env[name]
        assert.ok(value, `${name} is required for hosted provenance`)
        return value
      }
      assert.equal(env("GITHUB_REPOSITORY"), repository)
      assert.equal(env("GITHUB_SHA"), commit)
      assert.equal(env("GITHUB_REF"), "refs/heads/main")
      assert.equal(
        env("GITHUB_WORKFLOW_REF"),
        `${repository}/.github/workflows/release.yml@refs/heads/main`,
      )
      const seeds = JSON.parse(
        await readFile(join(root, "node_modules/@sigstore/tuf/seeds.json"), "utf8"),
      )
      const tufRootPath = join(staging, "trust-root.json")
      await writeFile(
        tufRootPath,
        Buffer.from(seeds["https://tuf-repo-cdn.sigstore.dev"]["root.json"], "base64"),
      )
      npm = {
        authorization: {
          _tag: "TrustedAuthorization",
          principal: "npm-publisher",
          repository,
          workflow: ".github/workflows/release.yml",
          workflowRef: "refs/heads/main",
          issuer: "https://token.actions.githubusercontent.com",
          audience: "npm:registry.npmjs.org",
        },
        initialTag: "latest",
        provenance: {
          authorize: true,
          trust: { tufRootPath, tufCachePath: join(staging, "tuf"), timeoutMilliseconds: 30000 },
          source: {
            format: "npm-github-actions-provenance-source/v1",
            serverUrl: "https://github.com",
            repository,
            workflow: ".github/workflows/release.yml",
            workflowRef: "refs/heads/main",
            sourceRef: env("GITHUB_REF"),
            sourceCommit: commit,
            eventName: env("GITHUB_EVENT_NAME"),
            repositoryId: env("GITHUB_REPOSITORY_ID"),
            repositoryOwnerId: env("GITHUB_REPOSITORY_OWNER_ID"),
            runnerEnvironment: env("RUNNER_ENVIRONMENT"),
            runId: env("GITHUB_RUN_ID"),
            runAttempt: env("GITHUB_RUN_ATTEMPT"),
            repositoryVisibility: "public",
          },
        },
      }
    } else {
      assert.match(workspace.version, /^\d+\.\d+\.\d+$/u)
      for (const owner of owners) {
        const cwd = join(root, "packages", owner)
        const manifest = JSON.parse(await readFile(join(cwd, "package.json"), "utf8"))
        assert.equal(manifest.name, packageName(owner))
        assert.equal(manifest.version, workspace.version)
        const publicName = `${owner}-${workspace.version}.tgz`,
          archiveFile = join(staging, publicName)
        await execute(
          [process.execPath, "pm", "pack", "--ignore-scripts", "--filename", archiveFile],
          cwd,
        )
        packages.push({ archiveFile, publicName })
      }
      await writeFile(
        notesFile,
        `# ts-release ${workspace.version}\n\nAll seven packages are aligned at ${workspace.version}.\n\n[Migration guide](https://github.com/${repository}/blob/${commit}/docs/migration-0.4.md) · [Runnable npm/GitHub starter](https://github.com/${repository}/tree/${commit}/templates/npm-github)\n\nPin the Node Action to \`${repository}/apps/action@${commit}\`. This release uses the same public application, providers, retained Bundle/Plan and durable journal as the starter.\n`,
      )
    }
    const input = {
      candidateDirectory: directory,
      repository: { owner: "mannyc2", name: "ts-release" },
      source: { commit, tree },
      version: workspace.version,
      title: `ts-release ${workspace.version}`,
      notesFile,
      packages,
      corePackage: "@mannyc1/ts-release",
      npm,
    }
    const config = join(staging, "prepare.json")
    await writeFile(config, JSON.stringify(input))
    await mkdir(dirname(directory), { recursive: true })
    console.log(
      await execute([
        process.env.TS_RELEASE_ACCEPTANCE_NODE ?? "node",
        "templates/npm-github/prepare.mjs",
        config,
      ]),
    )
    await readCandidate(directory)
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  const [command, source, target, approval] = process.argv.slice(2)
  assert.ok(source, "Choose an explicit retained candidate directory")
  if (command === "prepare") {
    assert.equal(target, undefined)
    await prepare(resolve(source))
  } else if (command === "attest") {
    assert.ok(target, "Choose a new signed candidate directory")
    assert.equal(approval, "--execute", "Provenance signing requires explicit --execute approval")
    await prepare(resolve(target), resolve(source))
  } else if (command === "check") {
    const candidate = await readCandidate(resolve(source))
    console.log(
      JSON.stringify({
        ...candidate.identity,
        packages: candidate.packages.length,
        version: candidate.source.version,
        status: "retained-candidate-verified",
      }),
    )
  } else
    assert.fail(
      "Usage: bun scripts/prepare-release.ts <prepare|check> <directory> | attest <original> <new-directory> --execute",
    )
}
