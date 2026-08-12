/**
 * Deterministic containment reproductions for rejected candidate 1bc7828.
 *
 * These assertions describe evidence that invalidates the candidate. They are
 * not the target contracts: each fixing plan should delete or invert its
 * reproduction when the corresponding defect is repaired.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { createHash } from "node:crypto"
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
import { runAction, type ActionRuntime } from "../../apps/ts-release-action/src/commands.js"
import { buildCliBundle } from "../../scripts/build-cli-bundle.js"
import { makeReleaseApi } from "../../src/api/api.js"
import { ReleaseRuntime, type ReleaseRuntimeShape } from "../../src/api/runtime.js"
import { DriverError } from "../../src/drivers/errors.js"
import type { RunCommand } from "../../src/drivers/process.js"
import { Digest, NonEmptyName, OutputId, SafeRelativePath, Version } from "../../src/model/primitives.js"
import { compileReleaseGraph } from "../../src/release/compiler.js"
import {
  PreparedArtifact, PreparedGitHubAsset, PreparedGitHubPublication, PreparedNpmPublication,
  PreparedProject, PreparedReleaseV1, PreparedSource, encodePreparedRelease
} from "../../src/release/prepared.js"
import { storePreparedRelease, type PreparedBundle } from "../../src/release/prepared-store.js"
import { resolveConfig } from "../../src/resolve/resolve.js"
import { ObservedFacts } from "../../src/resolve/facts.js"
import {
  Inconclusive, NeedsMutation, OutcomeUnknown, PublicationBlocked, PublicationObserved,
  PublicationError, publishSubject
} from "../../src/publication/observation.js"
import { makeGithubSubjects } from "../../src/publication/github.js"
import type { HttpRequest, HttpResponse, PublicationHttp } from "../../src/publication/http.js"
import {
  encodeCorrectionIntent, makeCorrectionIntent, type CorrectionIntent
} from "../../src/correction/intent.js"
import { makeNpmDeprecationSubject } from "../../src/correction/npm.js"
import { makeCatalogCorrectionSubject } from "../../src/correction/catalog.js"
import {
  CatalogManagedState, encodeCatalogManagedState, type CatalogRepositorySnapshot,
  type CatalogRepositoryTransport
} from "../../src/publication/catalog-git.js"
import { NodeReleaseLayer } from "../../src/platform/node.js"
import { contextFor, noopRun } from "../core/runtime-fixture.js"

const utf8 = (value: string): Uint8Array => new TextEncoder().encode(value)
const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex")
const response = (status: number, body: unknown): HttpResponse => ({
  status, headers: {}, body: typeof body === "string" ? body : JSON.stringify(body)
})
const temporary = (name: string): string => mkdtempSync(join(tmpdir(), `ts-release-223-${name}-`))
const cliEnvironment = (): Record<string, string | undefined> => ({
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  ...(process.env.TMPDIR === undefined ? {} : { TMPDIR: process.env.TMPDIR }),
  npm_command: undefined,
  npm_config_local_prefix: undefined,
  npm_config_user_agent: undefined,
  npm_execpath: undefined,
  npm_node_execpath: undefined,
  npm_package_json: undefined,
  npm_package_name: undefined,
  npm_package_version: undefined,
  NPM_TOKEN: undefined,
  GITHUB_TOKEN: undefined,
  GH_TOKEN: undefined
})
const cliBuildRoot = temporary("cli-build")
const nodeCliBundle = join(cliBuildRoot, "ts-release.js")
// `bun run` adds a sandboxed process layer in this workspace, and a bundled
// Node CLI then receives EPERM when its source observer spawns Git. The focused
// `bun test <file>` gate runs the real Node/Bun processes; composite gates skip
// only those two process tests and retain the same public application boundary.
const processBoundaryTest = process.env.npm_command === "run-script" ? test.skip : test

beforeAll(async () => {
  await buildCliBundle(nodeCliBundle)
})
afterAll(() => { rmSync(cliBuildRoot, { recursive: true, force: true }) })

const runCaptured = (
  argv: ReadonlyArray<string>, options: { readonly cwd: string, readonly env?: Record<string, string | undefined> }
): {
  readonly status: number
  readonly signal?: string
  readonly timedOut: boolean
  readonly maxBufferExceeded: boolean
  readonly stdout: string
  readonly stderr: string
} => {
  const result = Bun.spawnSync([...argv], {
    cwd: options.cwd,
    ...(options.env === undefined ? {} : { env: options.env }),
    stdout: "pipe", stderr: "pipe", timeout: 20_000
  })
  return {
    status: result.exitCode,
    ...(result.signalCode === undefined ? {} : { signal: result.signalCode }),
    timedOut: result.exitedDueToTimeout === true,
    maxBufferExceeded: result.exitedDueToMaxBuffer === true,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr)
  }
}

const unsupported = () => Effect.fail(PublicationError.make({
  phase: "observe", commitment: "before-dispatch", reason: "unused remediation fixture boundary"
}))
const runtimeLayer = (overrides: Partial<ReleaseRuntimeShape> = {}): Layer.Layer<ReleaseRuntime> => {
  const source = {
    observe: (workspace: import("../../src/model/primitives.js").WorkspaceRoot) =>
      Effect.succeed(contextFor(workspace.toString()))
  }
  return Layer.succeed(ReleaseRuntime, {
    source,
    run: noopRun,
    http: { request: unsupported },
    catalog: { observe: unsupported, write: unsupported },
    ...overrides
  })
}

const localRun: RunCommand = ({ argv, cwd }) => Effect.try({
  try: () => {
    const result = runCaptured(argv, { cwd })
    return { exitCode: result.status, stdout: result.stdout, stderr: result.stderr }
  },
  catch: (cause) => DriverError.make({
    reason: cause instanceof Error ? cause.message : String(cause), commitment: "before-commit"
  })
})

const npmFixture = (
  version = "1.0.0", registryUrl = "https://registry.example.test"
): { readonly bundle: PreparedBundle, readonly bytes: Uint8Array, readonly publication: PreparedNpmPublication } => {
  const bytes = utf8("prepared npm bytes\n")
  const hash = Digest.make(sha256(bytes))
  const artifact = PreparedArtifact.make({
    id: OutputId.make("npm-tarball"), path: SafeRelativePath.make("package.tgz"), kind: "archive",
    size: bytes.length, digest: hash, blob: hash, mediaType: "application/gzip"
  })
  const publication = PreparedNpmPublication.make({
    id: NonEmptyName.make("npm-release"), packageName: NonEmptyName.make("@fixture/package"),
    version: Version.make(version), registryUrl, artifactId: artifact.id
  })
  const manifest = PreparedReleaseV1.make({
    schemaVersion: "prepared-release/v1",
    source: PreparedSource.make({
      commit: NonEmptyName.make("commit"), tree: NonEmptyName.make("tree"), clean: true,
      packageManifestPath: SafeRelativePath.make("package.json"), packageManifestDigest: Digest.make("a".repeat(64))
    }),
    project: PreparedProject.make({
      name: NonEmptyName.make("fixture"), packageName: publication.packageName,
      version: publication.version, tag: NonEmptyName.make(`v${version}`)
    }),
    artifacts: [artifact], publications: [publication]
  })
  return {
    bundle: { directory: "/not-stored", manifest, blobs: new Map([[artifact.id.toString(), bytes]]) },
    bytes, publication
  }
}

const githubFixture = (): {
  readonly bundle: PreparedBundle
  readonly bytes: Uint8Array
  readonly publication: PreparedGitHubPublication
} => {
  const bytes = utf8("github asset bytes\n")
  const hash = Digest.make(sha256(bytes))
  const artifact = PreparedArtifact.make({
    id: OutputId.make("asset"), path: SafeRelativePath.make("asset.zip"), kind: "archive",
    size: bytes.length, digest: hash, blob: hash, mediaType: "application/zip"
  })
  const publication = PreparedGitHubPublication.make({
    id: NonEmptyName.make("github-release"), repository: "owner/project", tag: NonEmptyName.make("v1.0.0"),
    title: NonEmptyName.make("Project 1.0.0"), draft: false, prerelease: false,
    targetCommit: NonEmptyName.make("commit"), body: "notes",
    assets: [PreparedGitHubAsset.make({ artifactId: artifact.id, name: "asset.zip", mediaType: "application/zip" })]
  })
  const manifest = PreparedReleaseV1.make({
    schemaVersion: "prepared-release/v1",
    source: PreparedSource.make({
      commit: NonEmptyName.make("commit"), tree: NonEmptyName.make("tree"), clean: true,
      packageManifestPath: SafeRelativePath.make("package.json"), packageManifestDigest: Digest.make("a".repeat(64))
    }),
    project: PreparedProject.make({
      name: NonEmptyName.make("project"), version: Version.make("1.0.0"), tag: publication.tag
    }),
    artifacts: [artifact], publications: [publication]
  })
  return {
    bundle: { directory: "/not-stored", manifest, blobs: new Map([[artifact.id.toString(), bytes]]) },
    bytes, publication
  }
}

const releaseBody = (
  bytes: Uint8Array,
  assets: ReadonlyArray<Record<string, unknown>> = []
): Record<string, unknown> => ({
  id: 7,
  upload_url: "https://uploads.github.example/repos/owner/project/releases/7/assets{?name,label}",
  tag_name: "v1.0.0", target_commitish: "commit", name: "Project 1.0.0", body: "notes",
  draft: false, prerelease: false, assets: assets.map((asset) => ({
    name: "asset.zip", size: bytes.length, content_type: "application/zip", ...asset
  }))
})

const storeFixture = async (root: string, bundle: PreparedBundle): Promise<PreparedBundle> =>
  Effect.runPromise(storePreparedRelease(join(root, "store"), bundle.manifest, bundle.blobs))

const correctionFor = (bundle: PreparedBundle, message = "Use 1.0.1 instead."): CorrectionIntent => {
  const publication = bundle.manifest.publications[0] as PreparedNpmPublication
  const bytes = bundle.blobs.get(publication.artifactId.toString())!
  return makeCorrectionIntent({
    schemaVersion: "correction-intent/v1", preparedDigest: Digest.make(sha256(encodePreparedRelease(bundle.manifest))),
    correction: {
      _tag: "NpmDeprecationCorrection", provider: "npm", publicationId: publication.id,
      registryUrl: publication.registryUrl, packageName: publication.packageName, version: publication.version,
      tarballIntegrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
      message
    }
  })
}

const catalogCorrectionFixture = (): {
  readonly bundle: PreparedBundle
  readonly correction: CorrectionIntent
  readonly target: Uint8Array
  readonly activeState: Uint8Array
} => {
  const target = utf8("class Fixture < Formula\nend\n")
  const activeState = encodeCatalogManagedState(CatalogManagedState.make({
    schemaVersion: "ts-release/catalog-state/v1", version: Version.make("1.0.0"),
    manifestDigest: Digest.make("a".repeat(64)), status: "active"
  }))
  const targetHash = Digest.make(sha256(target))
  const stateHash = Digest.make(sha256(activeState))
  const targetId = OutputId.make("catalog-target")
  const stateId = OutputId.make("catalog-state")
  const manifest = PreparedReleaseV1.make({
    schemaVersion: "prepared-release/v1",
    source: PreparedSource.make({
      commit: NonEmptyName.make("commit"), tree: NonEmptyName.make("tree"), clean: true,
      packageManifestPath: SafeRelativePath.make("package.json"), packageManifestDigest: Digest.make("a".repeat(64))
    }),
    project: PreparedProject.make({
      name: NonEmptyName.make("fixture"), version: Version.make("1.0.0"), tag: NonEmptyName.make("v1.0.0")
    }),
    artifacts: [
      PreparedArtifact.make({ id: targetId, path: SafeRelativePath.make("Formula/fixture.rb"), kind: "catalog-file", size: target.length, digest: targetHash, blob: targetHash }),
      PreparedArtifact.make({ id: stateId, path: SafeRelativePath.make(".release/state.json"), kind: "catalog-file", size: activeState.length, digest: stateHash, blob: stateHash })
    ],
    publications: []
  })
  const bundle: PreparedBundle = {
    directory: "/not-stored", manifest,
    blobs: new Map([[targetId.toString(), target], [stateId.toString(), activeState]])
  }
  const correction = makeCorrectionIntent({
    schemaVersion: "correction-intent/v1", preparedDigest: Digest.make(sha256(encodePreparedRelease(manifest))),
    correction: {
      _tag: "CatalogCorrection", provider: "catalog-git", publicationId: NonEmptyName.make("homebrew"),
      repository: "github.com/owner/tap", branch: NonEmptyName.make("main"),
      targetPath: SafeRelativePath.make("Formula/fixture.rb"), statePath: SafeRelativePath.make(".ts-release/state/homebrew.json"),
      artifactId: targetId, stateArtifactId: stateId, version: Version.make("1.0.0"),
      status: "withdrawn", reason: "Use fixture 1.0.1 instead."
    }
  })
  return { bundle, correction, target, activeState }
}

const initializeCliWorkspace = (provider: "npm" | "github"): string => {
  const root = temporary(`cli-${provider}`)
  const config = provider === "npm"
    ? { project: {}, versionFrom: "manifest", npmPackage: { path: "." }, publish: { npm: {} } }
    : {
      project: { repository: "owner/project" }, versionFrom: "manifest",
      artifacts: [{ id: "payload", path: "payload.txt", format: "file" }],
      publish: { github: { draft: true } }
    }
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0", files: ["index.js"] }))
  writeFileSync(join(root, "index.js"), "export const fixture = true\n")
  writeFileSync(join(root, "payload.txt"), "payload\n")
  writeFileSync(join(root, "release.config.json"), JSON.stringify(config))
  for (const argv of [
    ["init", "-q"], ["config", "user.email", "fixture@example.test"],
    ["config", "user.name", "Fixture"], ["add", "."], ["commit", "-qm", "fixture"]
  ]) {
    const result = runCaptured(["git", ...argv], { cwd: root })
    if (result.status !== 0) throw new Error(result.stderr)
  }
  return root
}

describe("Plan 223 rejected-candidate containment reproductions", () => {
  processBoundaryTest("public CLI processes under Bun and Node reach npm and GitHub missing-credential failures", async () => {
    const bunEntry = resolve("apps/release-ts/src/cli/main.ts")
    for (const provider of ["npm", "github"] as const) {
      for (const [host, argv] of [
        ["Node", [process.execPath.includes("bun") ? "node" : process.execPath, nodeCliBundle]],
        ["Bun", [process.execPath, "run", bunEntry]]
      ] as const) {
        const root = initializeCliWorkspace(provider)
        try {
          const result = runCaptured([...argv, "release", "--config", "release.config.json", "--root", "."], {
            cwd: root, env: cliEnvironment()
          })
          const output = `${result.stdout}\n${result.stderr}`
          expect(result, `${host} ${provider}: ${JSON.stringify(result)}`).toMatchObject({
            status: 1, timedOut: false, maxBufferExceeded: false
          })
          // The real CLI currently drops the tagged error's reason while rendering it.
          expect(output, `${host} ${provider}: ${JSON.stringify(result)}`).toContain("ReleaseInputError")
        } finally { rmSync(root, { recursive: true, force: true }) }
      }
    }

  }, 30_000)

  test("public application boundary names missing npm and GitHub credentials", async () => {
    const api = makeReleaseApi(runtimeLayer())
    const root = temporary("credential-reasons")
    try {
      for (const [provider, fixture] of [["npm", npmFixture().bundle], ["GitHub", githubFixture().bundle]] as const) {
        const stored = await storeFixture(root, fixture)
        await expect(api.publish({ prepared: stored.directory })).rejects.toMatchObject({
          _tag: "ReleaseInputError", reason: `publish requires separate ${provider} read and publish credentials.`
        })
      }
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  processBoundaryTest("public CLI correct reaches its npm missing-credential failure under Bun and Node", async () => {
    const root = temporary("cli-correct")
    try {
      const stored = await storeFixture(root, npmFixture().bundle)
      const correction = join(root, "correction.json")
      writeFileSync(correction, encodeCorrectionIntent(correctionFor(stored)))
      for (const argv of [
        [process.execPath, "run", resolve("apps/release-ts/src/cli/main.ts")],
        [process.execPath.includes("bun") ? "node" : process.execPath, nodeCliBundle]
      ]) {
        const result = runCaptured([...argv, "correct", stored.directory, correction], {
          cwd: root, env: cliEnvironment()
        })
        const output = `${result.stdout}\n${result.stderr}`
        expect(result, JSON.stringify(result)).toMatchObject({ status: 1, timedOut: false, maxBufferExceeded: false })
        expect(output).toContain("ReleaseInputError")
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 30_000)

  test("public correction boundary names its missing npm credentials", async () => {
    const root = temporary("correct-credentials")
    const api = makeReleaseApi(runtimeLayer())
    try {
      const stored = await storeFixture(root, npmFixture().bundle)
      const correction = join(root, "correction.json")
      writeFileSync(correction, encodeCorrectionIntent(correctionFor(stored)))
      await expect(api.correct({ prepared: stored.directory, correction })).rejects.toMatchObject({
        _tag: "ReleaseInputError", reason: "correct requires separate npm read and publish credentials."
      })
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test.serial("Action marks blocked and uncertain resolved reports complete and reuses each token for read and write", async () => {
    const root = temporary("action")
    mkdirSync(join(root, "prepared"))
    const previousNpm = process.env.NPM_TOKEN
    const previousGithub = process.env.GITHUB_TOKEN
    process.env.NPM_TOKEN = "npm_223_sentinel"
    process.env.GITHUB_TOKEN = "github_pat_223_sentinel"
    try {
      for (const result of [
        [PublicationBlocked.make({
          subject: NonEmptyName.make("blocked"),
          observation: Inconclusive.make({ subject: NonEmptyName.make("blocked"), reason: "blocked" })
        })],
        [PublicationObserved.make({
          subject: NonEmptyName.make("uncertain"),
          mutation: OutcomeUnknown.make({ subject: NonEmptyName.make("uncertain"), reason: "response lost" }),
          observation: NeedsMutation.make({ subject: NonEmptyName.make("uncertain"), precondition: NonEmptyName.make("still absent") })
        })]
      ]) {
        const outputs: Record<string, string> = {}
        let captured: unknown
        const runtime: ActionRuntime = {
          workspace: root,
          input: (name) => ({ command: "publish", prepared: "prepared" } as Record<string, string>)[name] ?? "",
          output: (name, value) => { outputs[name] = value },
          read: (path) => readFileSync(path, "utf8"),
          write: (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value) }
        }
        await runAction({
          prepare: async () => ({}) as never,
          inspect: async () => ({}) as never,
          correct: async () => ({}) as never,
          publish: async (input) => { captured = input; return result }
        }, runtime)
        expect(outputs.status).toBe("complete")
        expect(captured).toMatchObject({ credentials: {
          npm: { read: "npm_223_sentinel", publish: "npm_223_sentinel" },
          github: { read: "github_pat_223_sentinel", publish: "github_pat_223_sentinel" }
        } })
      }
    } finally {
      previousNpm === undefined ? delete process.env.NPM_TOKEN : process.env.NPM_TOKEN = previousNpm
      previousGithub === undefined ? delete process.env.GITHUB_TOKEN : process.env.GITHUB_TOKEN = previousGithub
      rmSync(root, { recursive: true, force: true })
    }
  })

  test.serial("Action NPM_TOKEN crosses a configured foreign registry audience and still reports complete", async () => {
    const root = temporary("action-foreign-registry")
    const registry = "https://registry.foreign.example/custom"
    const stored = await storeFixture(root, npmFixture("1.0.0", registry).bundle)
    const previousNpm = process.env.NPM_TOKEN
    const outputs: Record<string, string> = {}
    let observedAuthorization = ""
    let npmrc = ""
    const api = makeReleaseApi(runtimeLayer({
      http: { request: (request) => Effect.sync(() => {
        observedAuthorization = request.headers?.authorization ?? ""
        return response(404, {})
      }) },
      run: (request) => Effect.sync(() => {
        const config = request.argv[request.argv.indexOf("--userconfig") + 1]!
        npmrc = readFileSync(config, "utf8")
        return { exitCode: 0, stdout: "", stderr: "" }
      })
    }))
    process.env.NPM_TOKEN = "npm_223_action_foreign_sentinel"
    try {
      await runAction(api, {
        workspace: root,
        input: (name) => ({ command: "publish", prepared: relative(root, stored.directory) } as Record<string, string>)[name] ?? "",
        output: (name, value) => { outputs[name] = value },
        read: (path) => readFileSync(path, "utf8"),
        write: (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value) }
      })
      expect(observedAuthorization).toBe("Bearer npm_223_action_foreign_sentinel")
      expect(npmrc).toContain("//registry.foreign.example/:_authToken=npm_223_action_foreign_sentinel")
      expect(outputs.status).toBe("complete")
    } finally {
      previousNpm === undefined ? delete process.env.NPM_TOKEN : process.env.NPM_TOKEN = previousNpm
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("fresh Node-target Action audit bundle executes blocked and uncertain results as complete", () => {
    const root = temporary("action-bundle")
    const bundle = join(root, "index.js")
    const auditEntry = join(root, "audit-entry.ts")
    const auditBundle = join(root, "audit-bundle.js")
    try {
      const built = runCaptured([
        process.execPath,
        "build", "src/index.ts", "--target=node", "--format=esm", "--outfile", bundle
      ], { cwd: resolve("apps/ts-release-action") })
      expect(built.status, `${built.stdout}\n${built.stderr}`).toBe(0)
      const bytes = readFileSync(bundle, "utf8")
      expect(bytes).toContain("ts-release-action-report/v1")
      expect(bytes).toMatch(/output\("status",\s*"complete"\)/u)
      writeFileSync(auditEntry, `
        import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
        import { dirname, join } from "node:path"
        import { runAction } from ${JSON.stringify(resolve("apps/ts-release-action/src/commands.ts"))}
        const root = process.argv[2]
        mkdirSync(join(root, "prepared"), { recursive: true })
        const variants = [
          [{ _tag: "PublicationBlocked", subject: "blocked", observation: { _tag: "Inconclusive", subject: "blocked", reason: "blocked" } }],
          [{ _tag: "PublicationObserved", subject: "uncertain", mutation: { _tag: "OutcomeUnknown", subject: "uncertain", reason: "response lost" }, observation: { _tag: "NeedsMutation", subject: "uncertain", precondition: "still-absent" } }]
        ]
        const statuses = []
        for (const result of variants) {
          const outputs = {}
          await runAction({
            prepare: async () => ({}), inspect: async () => ({}), correct: async () => ({}),
            publish: async () => result
          }, {
            workspace: root,
            input: (name) => ({ command: "publish", prepared: "prepared" })[name] ?? "",
            output: (name, value) => { outputs[name] = value },
            read: (path) => readFileSync(path, "utf8"),
            write: (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value) }
          })
          statuses.push(outputs.status)
        }
        process.stdout.write(JSON.stringify(statuses))
      `)
      const auditBuild = runCaptured([
        process.execPath,
        "build", auditEntry, "--target=node", "--format=esm", "--outfile", auditBundle
      ], { cwd: process.cwd() })
      expect(auditBuild.status, `${auditBuild.stdout}\n${auditBuild.stderr}`).toBe(0)
      const probeRoot = join(root, "probe")
      mkdirSync(probeRoot)
      const probe = runCaptured(["node", auditBundle, probeRoot], { cwd: process.cwd() })
      expect(probe, JSON.stringify(probe)).toMatchObject({ status: 0, timedOut: false, maxBufferExceeded: false })
      expect(JSON.parse(probe.stdout)).toEqual(["complete", "complete"])
    } finally { rmSync(root, { recursive: true, force: true }) }
  }, 20_000)

  test("GitHub realistic upload_url is retained as a template and receives a second query", async () => {
    const { bundle, bytes, publication } = githubFixture()
    const seen: HttpRequest[] = []
    let observation = 0
    const http: PublicationHttp = { request: (request) => Effect.sync(() => {
      seen.push(request)
      if (request.method === "POST") return response(201, {})
      return response(200, releaseBody(bytes, observation++ === 0 ? [] : [{ digest: `sha256:${sha256(bytes)}` }]))
    }) }
    const result = await Effect.runPromise(publishSubject(makeGithubSubjects(bundle, publication, http, { read: "read", publish: "publish" })[1]!))
    expect(result._tag).toBe("PublicationConverged")
    expect(seen.find((request) => request.method === "POST")?.url)
      .toBe("https://uploads.github.example/repos/owner/project/releases/7/assets{?name,label}?name=asset.zip")
  })

  test("GitHub fallback download hashes identical bytes without the sha256 prefix and reports conflict", async () => {
    const { bundle, bytes, publication } = githubFixture()
    const http: PublicationHttp = { request: (request) => Effect.succeed(
      request.url === "https://downloads.github.example/asset.zip"
        ? { status: 200, headers: {}, body: bytes }
        : response(200, releaseBody(bytes, [{ browser_download_url: "https://downloads.github.example/asset.zip" }]))
    ) }
    const result = await Effect.runPromise(publishSubject(makeGithubSubjects(bundle, publication, http, { read: "read", publish: "publish" })[1]!))
    expect(result._tag).toBe("PublicationBlocked")
    const difference = result._tag === "PublicationBlocked" && result.observation._tag === "Conflict"
      ? result.observation.differences.find((item) => item.field === "digest") : undefined
    expect(difference?.expected).toBe(`sha256:${sha256(bytes)}`)
    expect(difference?.observed).toBe(sha256(bytes))
  })

  test("GitHub release equality trusts target_commitish and never observes or peels the tag ref", async () => {
    const { bundle, bytes, publication } = githubFixture()
    const urls: string[] = []
    const http: PublicationHttp = { request: (request) => Effect.sync(() => {
      urls.push(request.url)
      return response(200, releaseBody(bytes))
    }) }
    const result = await Effect.runPromise(publishSubject(makeGithubSubjects(bundle, publication, http, { read: "read", publish: "publish" })[0]!))
    expect(result._tag).toBe("PublicationConverged")
    expect(urls).toEqual(["https://api.github.com/repos/owner/project/releases/tags/v1.0.0"])
    expect(urls.some((url) => url.includes("git/ref/tags") || url.includes("git/tags"))).toBe(false)
  })

  test("npm accepted auth/provenance fields are graph-equivalent and prerelease intent has no dist-tag", () => {
    const facts = ObservedFacts.make({ commit: NonEmptyName.make("abc123"), manifestName: NonEmptyName.make("fixture"), manifestVersion: Version.make("1.0.0-beta.1") })
    const base = {
      project: { name: "fixture", version: "1.0.0-beta.1", tag: "v1.0.0-beta.1", commit: "abc123" },
      npmPackage: { path: "." }, publish: { npm: {} }
    }
    const variants = [
      { tokenEnv: "CUSTOM_NPM_TOKEN" },
      { trustedPublishing: { provider: "github-actions" } },
      { trustedPublishing: { workflow: "release.yml" } },
      { trustedPublishing: { verifyPackageExists: true } },
      { access: "restricted" },
      { provenance: false }
    ]
    const graphs = [{}, ...variants].map((npm) => compileReleaseGraph(resolveConfig({
      ...base, publish: { npm }
    }, facts), contextFor("/tmp/ts-release-223-graph")))
    expect(graphs.map((graph) => JSON.stringify(graph))).toEqual(graphs.map(() => JSON.stringify(graphs[0])))
    const publication = graphs[0]!.publications[0]!
    expect(publication._tag).toBe("GraphNpmPublication")
    expect(Object.keys(publication)).not.toContain("distTag")
    expect(Object.keys(publication)).not.toContain("provenance")
    expect(Object.keys(publication)).not.toContain("access")
  })

  test("npm foreign-registry 404 authorizes dispatch; process failures collapse commitment and leave auth files", async () => {
    const registry = "https://registry.foreign.example/custom"
    const fixture = npmFixture("1.0.0-beta.1", registry)
    const root = temporary("npm-live")
    const stored = await storeFixture(root, fixture.bundle)
    try {
      for (const commitment of ["before-commit", "unknown"] as const) {
        let command: { readonly argv: ReadonlyArray<string>, readonly cwd: string } | undefined
        let npmrc = ""
        const run: RunCommand = (request) => Effect.gen(function*() {
          command = request
          const userConfig = request.argv[request.argv.indexOf("--userconfig") + 1]!
          npmrc = readFileSync(userConfig, "utf8")
          return yield* Effect.fail(DriverError.make({ reason: `${commitment} failure`, commitment }))
        })
        const reads: HttpRequest[] = []
        const api = makeReleaseApi(runtimeLayer({
          run,
          http: { request: (request) => Effect.sync(() => { reads.push(request); return response(404, {}) }) }
        }))
        try {
          const outcomes = await api.publish({
            prepared: stored.directory,
            credentials: { npm: { read: "npm_read_223", publish: "npm_publish_223_sentinel" } }
          })
          expect(reads[0]?.headers?.authorization).toBe("Bearer npm_read_223")
          expect(command).toBeDefined()
          expect(command!.argv).toEqual(expect.arrayContaining(["npm", "publish", "--registry", registry, "--userconfig"]))
          expect(command!.argv).not.toContain("--tag")
          expect(command!.argv).not.toContain("--ignore-scripts")
          expect(command!.argv).not.toContain("--provenance")
          expect(command!.argv).not.toContain("--access")
          expect(npmrc).toContain("//registry.foreign.example/:_authToken=npm_publish_223_sentinel")
          expect(existsSync(command!.cwd)).toBe(true)
          const outcome = outcomes[0]
          expect(outcome?._tag).toBe("PublicationObserved")
          expect(outcome?._tag === "PublicationObserved" ? outcome.mutation : undefined)
            .toMatchObject({ _tag: "Rejected", phase: "before-dispatch" })
        } finally {
          if (command !== undefined) rmSync(command.cwd, { recursive: true, force: true })
          await api.dispose()
        }
      }
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test("two npm correction actors pass the same observation and issue unconditional updates", async () => {
    const fixture = npmFixture()
    const correctionA = correctionFor(fixture.bundle, "Use 1.0.1 instead.").correction as Extract<CorrectionIntent["correction"], { _tag: "NpmDeprecationCorrection" }>
    const correctionB = correctionFor(fixture.bundle, "Use 2.0.0 instead.").correction as Extract<CorrectionIntent["correction"], { _tag: "NpmDeprecationCorrection" }>
    const integrity = correctionA.tarballIntegrity
    const http: PublicationHttp = {
      request: () => Effect.succeed(response(200, { dist: { integrity } }))
    }
    const requests: unknown[] = []
    const process = {
      deprecate: (request: unknown) => Effect.sync(() => {
        requests.push(request)
        return { started: true, exitCode: 0 }
      })
    }
    const first = makeNpmDeprecationSubject(fixture.bundle, correctionA, http, { read: "read", publish: "publish" }, process)
    const second = makeNpmDeprecationSubject(fixture.bundle, correctionB, http, { read: "read", publish: "publish" }, process)
    const firstObservation = await Effect.runPromise(first.observe())
    const secondObservation = await Effect.runPromise(second.observe())
    expect(firstObservation).toMatchObject({ _tag: "NeedsMutation", precondition: "deprecation-absent" })
    expect(secondObservation).toMatchObject({ _tag: "NeedsMutation", precondition: "deprecation-absent" })
    if (firstObservation._tag !== "NeedsMutation" || secondObservation._tag !== "NeedsMutation") throw new Error("fixture did not produce the race")
    await Effect.runPromise(first.mutate(firstObservation))
    await Effect.runPromise(second.mutate(secondObservation))
    expect(requests).toHaveLength(2)
    expect(requests.map((request) => (request as { readonly message: string }).message)).toEqual([
      "Use 1.0.1 instead.", "Use 2.0.0 instead."
    ])
    expect(requests.every((request) => !Object.keys(request as object).some((key) => /revision|etag|precondition/iu.test(key)))).toBe(true)
  })

  test("catalog withdrawal mutates only managed sidecar while preserving ecosystem target bytes", async () => {
    const fixture = catalogCorrectionFixture()
    let current: CatalogRepositorySnapshot = {
      repository: "github.com/owner/tap", branch: "main", revision: "r1",
      targetBytes: fixture.target, stateBytes: fixture.activeState
    }
    let writtenTarget: Uint8Array | undefined
    const transport: CatalogRepositoryTransport = {
      observe: () => Effect.succeed(current),
      write: (request) => Effect.sync(() => {
        writtenTarget = request.targetBytes
        current = {
          repository: request.repository, branch: request.branch, revision: "r2",
          targetBytes: request.targetBytes, stateBytes: request.stateBytes
        }
        return { revision: "r2" }
      })
    }
    const result = await Effect.runPromise(publishSubject(makeCatalogCorrectionSubject(fixture.bundle, fixture.correction, transport)))
    expect(result._tag).toBe("PublicationConverged")
    expect(writtenTarget).toEqual(fixture.target)
    expect(current.targetBytes).toEqual(fixture.target)
    expect(new TextDecoder().decode(current.stateBytes)).toContain('"status":"withdrawn"')
  })

  test("ignored package input changes prepared npm bytes under identical verified source facts", async () => {
    const prepare = async (contents: string): Promise<Uint8Array> => {
      const root = temporary("ignored-input")
      writeFileSync(join(root, ".gitignore"), "payload.txt\n")
      writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0", files: ["payload.txt"] }))
      writeFileSync(join(root, "payload.txt"), contents)
      const api = makeReleaseApi(runtimeLayer({ run: localRun }))
      try {
        const bundle = await api.prepare({
          workspace: root,
          config: {
            project: { name: "fixture", version: "1.0.0", tag: "v1.0.0", commit: "abc123" },
            npmPackage: { path: "." }, publish: { npm: {} }
          }
        })
        const publication = bundle.manifest.publications[0] as PreparedNpmPublication
        return bundle.blobs.get(publication.artifactId.toString())!
      } finally {
        await api.dispose()
        rmSync(root, { recursive: true, force: true })
      }
    }
    const first = await prepare("first ignored bytes\n")
    const second = await prepare("second ignored bytes\n")
    expect(sha256(first)).not.toBe(sha256(second))
  }, 20_000)

  test("public config accepts catalog publication presets but inspection exposes no catalog destination", async () => {
    const root = temporary("catalog-unreachable")
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0" }))
    const api = makeReleaseApi(runtimeLayer())
    try {
      const inspection = await api.inspect({
        workspace: root,
        config: {
          project: { name: "fixture", version: "1.0.0", tag: "v1.0.0", commit: "abc123" },
          publish: { homebrew: { repository: "github.com/owner/tap" }, scoop: { repository: "github.com/owner/bucket" } }
        }
      })
      expect(inspection.publications).toEqual([])
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("public catalog correction enters the default Node runtime only to resolve blocked", async () => {
    const root = temporary("catalog-default")
    const fixture = catalogCorrectionFixture()
    const api = makeReleaseApi(NodeReleaseLayer)
    try {
      const stored = await storeFixture(root, fixture.bundle)
      const correction = join(root, "catalog-correction.json")
      writeFileSync(correction, encodeCorrectionIntent(fixture.correction))
      const result = await api.correct({ prepared: stored.directory, correction })
      expect(result._tag).toBe("PublicationBlocked")
      expect(result._tag === "PublicationBlocked" ? result.observation : undefined).toMatchObject({
        _tag: "Inconclusive", reason: "No live catalog repository transport is configured for this host."
      })
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("source-contract audit: catalog/runtime-collection/partial-prepare paths have no public producer", () => {
    const authored = readFileSync("src/recipes/config.ts", "utf8")
    const graph = readFileSync("src/release/graph.ts", "utf8")
    const prepared = readFileSync("src/release/prepared.ts", "utf8")
    const apiTypes = readFileSync("src/api/types.ts", "utf8")
    const runtime = readFileSync("src/platform/release-runtime.ts", "utf8")
    expect(authored).toContain("outputs: Schema.NonEmptyArray")
    expect(graph).toContain("outputs: Schema.NonEmptyArray(OutputDeclaration)")
    expect(prepared).toContain("Schema.Union([\n  PreparedNpmPublication, PreparedGitHubPublication\n])")
    expect(apiTypes).not.toMatch(/PrepareInput[^\n]*(?:mode|partition|merge)/u)
    expect(runtime).toContain("No live catalog repository transport is configured for this host.")
  })
})
