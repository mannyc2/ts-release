import { beforeAll, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { chmod, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { Effect, Schema } from "effect"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Artifact from "effect-build/Artifact"
import { ReleaseError, createPlan, type Operation } from "@mannyc1/ts-release"
import * as Git from "@mannyc1/ts-release/git"
import {
  Bundle,
  encodeBundle,
  finalize,
  type Artifact as OwnedArtifact,
  type File,
  type PutContent,
  type ReadContent,
} from "@mannyc1/ts-release/bundle"
import { adoptFile, adoptTree } from "@mannyc1/ts-release/effect-build"
import { fileContentOwner, makeGitCatalogHost } from "@mannyc1/ts-release/node"
import * as Npm from "@mannyc1/ts-release-npm"
import * as PyPi from "@mannyc1/ts-release-pypi"
import * as GitHub from "@mannyc1/ts-release-github"
import * as Homebrew from "@mannyc1/ts-release-catalog/homebrew"
import * as Scoop from "@mannyc1/ts-release-catalog/scoop"
import * as Mcp from "@mannyc1/ts-release-mcp"
import * as OpenAi from "@mannyc1/ts-release-openai"
import { prepareSelfRelease } from "../../../apps/self-release/src/application.js"
import { identity, native, nativeGit, processOptions, seed } from "../transports/git-fixture.js"
import { wheels } from "./wheel.js"

const root = resolve(import.meta.dir, "../../..")
const node =
  process.env.TS_RELEASE_HTTP_PEER_NODE ??
  "/home/cjpher/.local/share/fnm/node-versions/v22.22.2/installation/bin/node"
const cli = join(root, "packages/ts-release/dist/bin/ts-release.js")
const application = join(root, "apps/self-release/dist/application.js")
const packageOwners = ["ts-release", "catalog", "github", "mcp", "npm", "openai", "pypi"]
const producedBy = { name: "ts-release/self-release-input", version: "fixture" }
const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex")
const runNode = <A, E, R>(effect: Effect.Effect<A, E, R>): Promise<A> =>
  Effect.runPromise(effect.pipe(Effect.provide(NodeServices.layer)) as Effect.Effect<A, E, never>)

beforeAll(async () => {
  const child = Bun.spawn([process.execPath, "run", "build:delivery"], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exit, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])
  expect(exit, stderr).toBe(0)
}, 60_000)

const command = async (cwd: string, argv: string[], input?: Uint8Array) => {
  const child = Bun.spawn(argv, {
    cwd,
    stdin: input ? new Blob([Uint8Array.from(input)]) : undefined,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exit, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  if (exit !== 0) throw new Error(stdout + stderr)
  return stdout
}
const bare = async (directory: string) => {
  await command(root, [nativeGit, "init", "--bare", "--initial-branch=main", directory])
}
const normalizeTreeModes = async (directory: string): Promise<void> => {
  await chmod(directory, 0o755)
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await normalizeTreeModes(path)
    else await chmod(path, 0o644)
  }
}

test("real producers assemble one non-mutating seven-package self-release plan", async () => {
  const work = await mkdtemp(join(tmpdir(), "ts-release-self-release-"))
  const contentDirectory = join(work, "content")
  const producerDirectory = join(work, "producer")
  const packs = join(work, "packs")
  await mkdir(producerDirectory)
  await mkdir(packs)
  const owner = fileContentOwner(contentDirectory)
  const contentFailure = () =>
    new ReleaseError({
      code: "self-release-content",
      message: "Owned self-release content operation failed",
    })
  const readContent: ReadContent = (content) =>
    owner.read(content).pipe(Effect.mapError(contentFailure))
  const putContent: PutContent = (bytes) =>
    owner.putOwned(bytes).pipe(Effect.mapError(contentFailure))
  const producers: Array<{
    logicalName: string
    artifact: Artifact.Regular
  }> = []
  const owned: OwnedArtifact[] = []
  const publishFile = async (logicalName: string, bytes: Uint8Array) => {
    const path = join(producerDirectory, logicalName)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, bytes)
    const artifact = await runNode(Artifact.file(path, producedBy))
    producers.push({ logicalName, artifact })
    const file = await runNode(adoptFile(owner, logicalName, artifact))
    owned.push(file)
    return file
  }

  const packageFiles = new Map<string, File>()
  for (const packageOwner of packageOwners) {
    const archive = join(packs, `${packageOwner}.tgz`)
    await command(join(root, "packages", packageOwner), [
      process.execPath,
      "pm",
      "pack",
      "--ignore-scripts",
      "--filename",
      archive,
    ])
    packageFiles.set(
      packageOwner,
      await publishFile(`${packageOwner}-0.4.0.tgz`, await readFile(archive)),
    )
  }
  const wheelFiles: File[] = []
  for (const wheel of wheels("0.4.0"))
    wheelFiles.push(await publishFile(wheel.filename, wheel.bytes))
  const action = await publishFile(
    "ts-release-action.cjs",
    await readFile(join(root, "apps/action/dist/launcher.cjs")),
  )
  const logo = await publishFile(
    "ts-release-logo.png",
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
  )
  const sourceCommit = (await command(root, [nativeGit, "rev-parse", "HEAD"])).trim()
  const sourceTree = (await command(root, [nativeGit, "rev-parse", "HEAD^{tree}"])).trim()
  const sourceFile = await publishFile(
    "source.json",
    new TextEncoder().encode(
      `${JSON.stringify({ commit: sourceCommit, repository: "mannyc2/ts-release", tree: sourceTree })}\n`,
    ),
  )

  const pluginDirectory = join(producerDirectory, "ts-release-openai")
  await cp(
    join(root, "apps/ts-release-agents/.codex-plugin"),
    join(pluginDirectory, ".codex-plugin"),
    {
      recursive: true,
    },
  )
  await cp(join(root, "apps/ts-release-agents/skills"), join(pluginDirectory, "skills"), {
    recursive: true,
  })
  await normalizeTreeModes(pluginDirectory)
  const producedTree = await runNode(Artifact.directory(pluginDirectory, producedBy))
  const plugin = await runNode(adoptTree(owner, "ts-release-openai", producedTree))
  owned.push(plugin)

  const initialBundle = await Effect.runPromise(finalize(owned))
  const initialAccess = { bundle: initialBundle, readContent }
  const marketplace = await Effect.runPromise(
    OpenAi.marketplace(
      {
        plugin,
        existing: null,
        marketplaceName: "ts-release",
        displayName: "ts-release",
        sourcePath: "./plugins/ts-release",
        category: "Developer Tools",
      },
      readContent,
    ),
  )
  const evals = await Bun.file(join(root, "apps/ts-release-agents/evals/cases.json")).json()
  const submission = new OpenAi.Submission({
    plugin,
    marketplace: marketplace.document,
    listing: new OpenAi.Listing({
      displayName: "ts-release",
      shortDescription: "Author and inspect durable release plans.",
      longDescription:
        "Author explicit release applications and inspect immutable evidence without inventing publication success.",
      developerName: "mannyc2",
      category: "Developer Tools",
      websiteUrl: "https://github.com/mannyc2/ts-release",
      supportUrl: "https://github.com/mannyc2/ts-release/issues",
      privacyPolicyUrl: "https://github.com/mannyc2/ts-release/blob/main/PRIVACY.md",
      termsOfServiceUrl: "https://github.com/mannyc2/ts-release/blob/main/TERMS.md",
      logo,
    }),
    starterPrompts: ["Rehearse this release without dispatching any operation."],
    positiveTests: evals.positiveTests.map(
      (row: OpenAi.PositiveTest) => new OpenAi.PositiveTest(row),
    ) as OpenAi.Submission["positiveTests"],
    negativeTests: evals.negativeTests.map(
      (row: OpenAi.NegativeTest) => new OpenAi.NegativeTest(row),
    ) as OpenAi.Submission["negativeTests"],
    releaseNotes: "Initial explicit application and durable journal release skill.",
    attestations: new OpenAi.Attestations({
      developerIdentityVerified: true,
      intellectualPropertyRightsConfirmed: true,
      listingAndTestsAccurate: true,
      privacyAndTermsPublished: true,
      pluginPoliciesReviewed: true,
      humanPortalReviewAndPublicationRequired: true,
    }),
  })
  const handoff = await Effect.runPromise(OpenAi.submission(submission, initialAccess))
  expect(handoff.status).toBe("validated-handoff-human-submission-required")
  const marketplaceFile = await publishFile(marketplace.path, marketplace.bytes)
  const handoffFile = await publishFile("openai-submission.json", handoff.bytes)

  const downloads = [
    packageFiles.get("ts-release")!,
    packageFiles.get("catalog")!,
    packageFiles.get("github")!,
    packageFiles.get("mcp")!,
    packageFiles.get("npm")!,
    packageFiles.get("openai")!,
  ].map((file) => ({
    file,
    url: `https://github.com/mannyc2/ts-release/releases/download/v0.4.0/${file.logicalName}`,
  }))
  const formula = new Homebrew.Formula({
    className: "TsRelease",
    description: "Deterministic TypeScript release automation",
    homepage: "https://github.com/mannyc2/ts-release",
    license: "MIT",
    version: "0.4.0",
    executable: "bin/ts-release",
    archives: {
      "darwin-x64": new Homebrew.Download(downloads[0]!),
      "darwin-arm64": new Homebrew.Download(downloads[1]!),
      "linux-x64": new Homebrew.Download(downloads[2]!),
      "linux-arm64": new Homebrew.Download(downloads[3]!),
    },
  })
  const scoop = new Scoop.Manifest({
    version: "0.4.0",
    homepage: "https://github.com/mannyc2/ts-release",
    license: "MIT",
    executable: "bin/ts-release.exe",
    archives: {
      "windows-x64": new Scoop.Download(downloads[4]!),
      "windows-arm64": new Scoop.Download(downloads[5]!),
    },
  })
  const downloadableBundle = await Effect.runPromise(finalize(owned))
  const formulaFile = await publishFile(
    "Formula/ts-release.rb",
    await Effect.runPromise(Homebrew.render(formula, downloadableBundle)),
  )
  const scoopFile = await publishFile(
    "bucket/ts-release.json",
    await Effect.runPromise(Scoop.render(scoop, downloadableBundle)),
  )

  const artifactBundle = await Effect.runPromise(finalize(owned))
  const access = { bundle: artifactBundle, readContent }
  const npmAuthorization = new Npm.TokenAuthorization({ principal: "npm:ts-release" })
  const candidates: Npm.PublicPackage[] = []
  const tagMoves: Npm.DistTagIntent[] = []
  for (const packageOwner of packageOwners) {
    const tarball = packageFiles.get(packageOwner)!
    const metadata = await Effect.runPromise(Npm.inspectTarball(tarball, access))
    const publication = new Npm.PublishIntent({
      registry: "https://registry.npmjs.org/",
      name: metadata.name,
      version: metadata.version,
      tarball,
      integrity: metadata.integrity,
      shasum: metadata.shasum,
      initialTag: "latest",
      access: "public",
      authorization: npmAuthorization,
      provenance: new Npm.NoProvenance({}),
    })
    candidates.push(new Npm.PublicPackage({ publication }))
    tagMoves.push(
      new Npm.DistTagIntent({
        registry: publication.registry,
        name: publication.name,
        version: publication.version,
        tag: "latest",
        authorization: npmAuthorization,
      }),
    )
  }
  const npm = await Effect.runPromise(Npm.author({ packages: candidates, tagMoves }))
  expect(npm.omittedPrivate).toEqual([])

  const pypiAuthorization = new PyPi.TrustedAuthorization({
    principal: "pypi:ts-release",
    projects: ["ts-release"],
    repository: "mannyc2/ts-release",
    workflow: ".github/workflows/pypi-release.yml",
    workflowRef: "refs/heads/main",
    issuer: "https://token.actions.githubusercontent.com",
    audience: "pypi",
  })
  const pypiIntents = []
  for (const distribution of wheelFiles) {
    const metadata = await Effect.runPromise(
      PyPi.inspectDistribution(distribution, distribution.logicalName, access),
    )
    pypiIntents.push(
      new PyPi.WheelUpload({
        endpoint: new PyPi.PyPi({
          uploadUrl: "https://upload.pypi.org/legacy/",
          simpleUrl: "https://pypi.org/simple/",
        }),
        project: metadata.project,
        version: metadata.version,
        metadataVersion: metadata.metadataVersion,
        distribution,
        filename: metadata.filename,
        authorization: pypiAuthorization,
        pythonTag: metadata.pythonTag,
      }),
    )
  }
  const pypi = await Effect.runPromise(PyPi.author(pypiIntents))

  const repository = new GitHub.Repository({
    apiUrl: "https://api.github.com",
    owner: "mannyc2",
    name: "ts-release",
  })
  const principal = "github:ts-release"
  const tag = await Effect.runPromise(
    GitHub.lightweightTag(
      new GitHub.LightweightTag({
        repository,
        tag: "v0.4.0",
        commit: sourceCommit,
        principal,
      }),
    ),
  )
  const draft = await Effect.runPromise(
    GitHub.draft(
      new GitHub.DraftIntent({
        repository,
        tag: "v0.4.0",
        tagSource: new GitHub.ManagedTag({ operationId: tag.operationId }),
        title: "ts-release v0.4.0",
        body: "Seven-package hard-cut candidate.",
        prerelease: false,
        principal,
      }),
    ),
  )
  const assets = await Promise.all(
    [action, formulaFile, handoffFile].map((file) =>
      Effect.runPromise(
        GitHub.uploadAsset(
          new GitHub.AssetIntent({
            repository,
            draftOperation: draft.operationId,
            file,
            publicName: file.logicalName.replaceAll("/", "-"),
            mediaType: file.logicalName.endsWith(".json")
              ? "application/json"
              : "application/octet-stream",
            principal,
          }),
        ),
      ),
    ),
  )
  const githubPublish = await Effect.runPromise(
    GitHub.publish(
      new GitHub.PublishIntent({
        repository,
        draftOperation: draft.operationId,
        assetOperations: assets.map((asset) => asset.operationId),
        principal,
      }),
    ),
  )

  const gitUpdate = async (name: string, path: string, file: File): Promise<Operation> => {
    const remote = join(work, `${name}.git`)
    await bare(remote)
    const expectedOld = seed(remote)
    native(remote, ["update-ref", "refs/heads/main", expectedOld])
    return runNode(
      Effect.scoped(
        Effect.gen(function* () {
          const coordinate = {
            remote: pathToFileURL(remote).href,
            ref: "refs/heads/main",
            principal: `${name}:publisher`,
            scope: `${name}:release`,
          }
          const host = yield* makeGitCatalogHost({
            ...processOptions,
            temporaryRoot: work,
            readContent,
            credentials: () => Effect.succeed({ _tag: "Anonymous" as const }),
          })
          const baseObjects = yield* owner.putOwned(
            yield* host.captureBase({ ...coordinate, expectedOld }),
          )
          const intent = yield* Git.prepare(
            new Git.CommitInput({
              ...coordinate,
              expectedOld,
              baseObjects,
              files: [new Git.FileEdit({ path, mode: "100644", content: file.content })],
              message: `Publish ${name} v0.4.0\n`,
              author: identity,
              committer: identity,
            }),
            { objects: host.objects, readContent, putContent },
          )
          return yield* Git.update(intent, [githubPublish.operationId])
        }),
      ),
    )
  }
  const git = await Promise.all([
    gitUpdate("homebrew", "Formula/ts-release.rb", formulaFile),
    gitUpdate("scoop", "bucket/ts-release.json", scoopFile),
    gitUpdate("openai", marketplace.path, marketplaceFile),
  ])
  const mcp = await Effect.runPromise(
    Mcp.publish(
      new Mcp.PublishIntent({
        registry: "https://registry.modelcontextprotocol.io",
        manifest: new Mcp.Manifest({
          $schema: Mcp.schemaUrl,
          name: "io.github.mannyc2/ts-release",
          description: "Durable release planning and evidence server.",
          version: "0.4.0",
          packages: [
            new Mcp.NpmPackage({
              registryType: "npm",
              registryBaseUrl: "https://registry.npmjs.org",
              identifier: "@mannyc1/ts-release",
              version: "0.4.0",
              transport: new Mcp.Stdio({ type: "stdio" }),
            }),
          ],
        }),
        authorization: new Mcp.OidcAuthorization({
          principal: "mcp:ts-release",
          issuer: "https://token.actions.githubusercontent.com",
          audience: "https://registry.modelcontextprotocol.io",
          repository: "mannyc2/ts-release",
          workflow: ".github/workflows/release.yml",
          workflowRef: "refs/heads/main",
        }),
      }),
      npm.operations.map((operation) => operation.operationId),
    ),
  )
  const operations = [...npm.operations, ...pypi, tag, draft, ...assets, githubPublish, ...git, mcp]
  const prepared = await runNode(
    prepareSelfRelease({ owner, producerFiles: producers, ownedArtifacts: [plugin], operations }),
  )
  expect(prepared.plan.operations).toHaveLength(28)
  expect(prepared.bundle.artifacts).toHaveLength(producers.length + 1)
  expect(sha256(prepared.bundleBytes)).toBe(prepared.plan.bundleId)
  expect(encodeBundle(prepared.bundle)).toEqual(prepared.bundleBytes)

  const bundleFile = join(work, "bundle.json")
  const planFile = join(work, "plan.json")
  await writeFile(bundleFile, prepared.bundleBytes)
  await writeFile(planFile, `${JSON.stringify(prepared.plan)}\n`)
  await rm(producerDirectory, { recursive: true })
  await rm(packs, { recursive: true })
  const journalRemote = join(work, "journal.git")
  await bare(journalRemote)
  const baseInput = {
    version: "0.4.0",
    contentDirectory,
    bundleFile,
    planFile,
    bundleSha256: prepared.plan.bundleId,
    planId: prepared.plan.planId,
    sourceCommit,
    sourceTree,
    sourceFile: sourceFile.logicalName,
    openAiPlugin: plugin,
    catalog: {
      homebrew: formula,
      homebrewFile: "Formula/ts-release.rb",
      scoop,
      scoopFile: "bucket/ts-release.json",
    },
    journal: {
      remote: pathToFileURL(journalRemote).href,
      principal: "self-release-journal",
      scope: "self-release",
      gitExecutable: nativeGit,
      timeoutMilliseconds: 5000,
      maximumOutputBytes: 8 * 1024 * 1024,
    },
  }
  const run = async (
    runtime: string,
    cache: string,
    change: Record<string, unknown> = {},
    selectedPlan = prepared.plan,
  ) => {
    const inputFile = join(work, `input-${crypto.randomUUID()}.json`)
    const selectedPlanFile =
      selectedPlan === prepared.plan ? planFile : join(work, `plan-${crypto.randomUUID()}.json`)
    if (selectedPlan !== prepared.plan)
      await writeFile(selectedPlanFile, `${JSON.stringify(selectedPlan)}\n`)
    await writeFile(
      inputFile,
      JSON.stringify({
        ...baseInput,
        planFile: selectedPlanFile,
        planId: selectedPlan.planId,
        ...change,
        journal: { ...baseInput.journal, cacheDirectory: cache },
      }),
    )
    const child = Bun.spawn([runtime, cli, application, inputFile], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
    })
    const [exit, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    return { exit, stdout, stderr }
  }
  const first = await run(node, join(work, "journal-cache-node"))
  expect(first.exit).toBe(2)
  expect(first.stderr).toContain("ts-release --observe")
  const report = JSON.parse(first.stdout)
  expect(report.plan.planId).toBe(prepared.plan.planId)
  expect(report.journal).toEqual({ journalId: prepared.plan.journalId, revision: 0, events: [] })
  expect(report.operations.map((operation: { status: string }) => operation.status)).toEqual(
    Array(28).fill("Unattempted"),
  )
  const second = await run(process.execPath, join(work, "journal-cache-bun"))
  expect(second.exit).toBe(2)
  expect(second.stderr).toContain("ts-release --observe")
  expect(JSON.parse(second.stdout)).toEqual(report)
  expect(native(journalRemote, ["for-each-ref", "--format=%(refname)"]).toString()).toBe("")

  const wrongCatalog = await gitUpdate("wrong-homebrew", baseInput.catalog.homebrewFile, action)
  const wrongPlan = await Effect.runPromise(
    createPlan(
      prepared.plan.bundleId,
      operations.map((operation) =>
        operation.operationId === git[0]!.operationId ? wrongCatalog : operation,
      ),
    ),
  )
  const wrongOutput = await run(node, join(work, "rejected-wrong-output"), {}, wrongPlan)
  expect({ exit: wrongOutput.exit, stdout: wrongOutput.stdout }).toEqual({ exit: 1, stdout: "" })

  for (const change of [
    { sourceTree: "0".repeat(40) },
    { planId: "0".repeat(64) },
    { catalog: { ...baseInput.catalog, scoopFile: baseInput.catalog.homebrewFile } },
    { authorize: true },
  ]) {
    const rejected = await run(node, join(work, `rejected-${crypto.randomUUID()}`), change)
    expect(rejected.exit).toBe(1)
    expect(rejected.stdout).toBe("")
    expect(rejected.stderr).toContain("ts-release --observe")
  }
  expect(native(journalRemote, ["for-each-ref", "--format=%(refname)"]).toString()).toBe("")
  expect(sha256(await readFile(bundleFile))).toBe(prepared.plan.bundleId)
}, 120_000)
