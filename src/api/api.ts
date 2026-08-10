import * as Effect from "effect/Effect"
import * as ManagedRuntime from "effect/ManagedRuntime"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { decodeConfig } from "../config/config.js"
import { correctPreparedRelease } from "../correction/coordinator.js"
import { makeCatalogCorrectionSubject } from "../correction/catalog.js"
import { makeNpmDeprecationSubject, type NpmDeprecationProcess } from "../correction/npm.js"
import { decodeCorrectionIntent } from "../correction/intent.js"
import { ReleaseInputError } from "./errors.js"
import {
  decodeCorrectInput, decodeInspectInput, decodePrepareInput, decodePublishInput,
  decodeReleaseInput, preparedPath, workspaceRoot
} from "./input.js"
import { ReleaseRuntime } from "./runtime.js"
import type { CorrectInput, InspectInput, PrepareInput, PublishInput, ReleaseApi, ReleaseApiLayer, ReleaseInput } from "./types.js"
import { NonEmptyName, SafeRelativePath, Version, WorkspaceRoot } from "../model/primitives.js"
import { ObservedFacts } from "../resolve/facts.js"
import { resolveConfig } from "../resolve/resolve.js"
import { compileReleaseGraph } from "../release/compiler.js"
import { inspectPreparedRelease, inspectRelease } from "../release/inspect.js"
import { prepareRelease } from "../release/prepare.js"
import { loadPreparedRelease, type PreparedBundle } from "../release/prepared-store.js"
import type { VerifiedReleaseContext } from "../release/context.js"
import { publishPreparedRelease } from "../publication/adapter.js"
import type { PublicationCredentials, PublicationError, PublicationOutcome } from "../publication/observation.js"
import type { NpmPublishProcess } from "../publication/npm.js"

export type {
  CorrectInput, InspectInput, PrepareInput, PublishInput, ReleaseApi, ReleaseApiLayer, ReleaseInput
} from "./types.js"
export { ReleaseInputError } from "./errors.js"
export { ReleaseRuntime } from "./runtime.js"

const manifestPath = (config: { readonly project: { readonly packagePath?: SafeRelativePath }, readonly npmPackage?: { readonly path?: SafeRelativePath } }): SafeRelativePath => {
  const directory = String(config.project.packagePath ?? config.npmPackage?.path ?? ".")
  return SafeRelativePath.make(directory === "." ? "package.json" : `${directory}/package.json`)
}

const releaseTagVersion = (tags: ReadonlyArray<{ toString(): string }>): string | undefined => {
  const values = tags.map((tag) => /^v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/u.exec(tag.toString())?.[1]).filter((value): value is string => value !== undefined)
  return values.length === 1 ? values[0] : undefined
}

const observeAndCompile = Effect.fn("observeAndCompileRelease")(function*(input: { readonly config: unknown, readonly workspace: string }) {
  const runtime = yield* ReleaseRuntime
  const authored = yield* decodeConfig(input.config)
  const root = workspaceRoot(input.workspace)
  const context = yield* runtime.source.observe(
    WorkspaceRoot.make(root), manifestPath(authored),
    authored.project.commit === undefined ? undefined : NonEmptyName.make(authored.project.commit)
  )
  const facts = ObservedFacts.make({
    commit: context.source.commit, manifestName: context.package.name, manifestVersion: context.package.version,
    ...(releaseTagVersion(context.source.headTags) === undefined ? {} : { headTagVersion: Version.make(releaseTagVersion(context.source.headTags)!) }),
    ...(context.source.repository === undefined ? {} : { repository: context.source.repository })
  })
  const resolved = yield* Effect.try({ try: () => resolveConfig(input.config, facts), catch: (cause) => new ReleaseInputError({ reason: cause instanceof Error ? cause.message : String(cause) }) })
  return { context, config: resolved, graph: compileReleaseGraph(resolved, context) }
})

const preparedDirectory = (workspace: string, value: string | undefined): string => {
  const root = workspaceRoot(workspace)
  return value === undefined ? join(root, ".release", "ts-release", "prepared") : value.startsWith("/") ? value : join(root, value)
}

const prepareProgram = Effect.fn("prepareProgram")(function*(input: PrepareInput) {
  const compiled = yield* observeAndCompile({ config: input.config, workspace: input.workspace })
  const runtime = yield* ReleaseRuntime
  return yield* prepareRelease({
    context: compiled.context, graph: compiled.graph, storeDirectory: preparedDirectory(input.workspace, input.preparedDirectory), run: runtime.run,
    verifySource: (context: VerifiedReleaseContext) => runtime.source.observe(context.workspace, context.source.packageManifestPath, context.source.commit)
  })
})

const credentialsFor = (bundle: PreparedBundle, credentials: PublishInput["credentials"] | undefined): { readonly npm?: PublicationCredentials, readonly github?: PublicationCredentials } => {
  const npm = bundle.manifest.publications.some((publication) => publication._tag === "PreparedNpmPublication")
  const github = bundle.manifest.publications.some((publication) => publication._tag === "PreparedGitHubPublication")
  if (npm && credentials?.npm === undefined) throw new ReleaseInputError({ reason: "publish requires separate npm read and publish credentials." })
  if (github && credentials?.github === undefined) throw new ReleaseInputError({ reason: "publish requires separate GitHub read and publish credentials." })
  return { ...(credentials?.npm === undefined ? {} : { npm: credentials.npm }), ...(credentials?.github === undefined ? {} : { github: credentials.github }) }
}

const npmProcess = (runtime: { readonly run: import("../drivers/process.js").RunCommand }): NpmPublishProcess => ({
  publish: (request) => Effect.try({
    try: () => {
      const directory = mkdtempSync(join(tmpdir(), "ts-release-publish-"))
      const tarball = join(directory, `${request.packageName.replace(/[^A-Za-z0-9._-]+/gu, "-")}-${request.version}.tgz`)
      const config = join(directory, ".npmrc")
      writeFileSync(tarball, request.bytes, { mode: 0o600 })
      writeFileSync(config, `//${new URL(request.registryUrl).host}/:_authToken=${request.credential}\n`, { mode: 0o600 })
      return { directory, tarball, config }
    }, catch: (cause) => new (class extends Error { readonly _tag = "PublicationError" as const; readonly phase = "mutate" as const; readonly commitment = "before-dispatch" as const; constructor(readonly reason: string) { super(reason) } })(cause instanceof Error ? cause.message : String(cause))
  }).pipe(Effect.flatMap(({ directory, tarball, config }) => runtime.run({ argv: ["npm", "publish", tarball, "--registry", request.registryUrl, "--userconfig", config], cwd: directory, environmentNames: [] }).pipe(
    Effect.map((result) => { rmSync(directory, { recursive: true, force: true }); return { started: true, exitCode: result.exitCode } }),
    Effect.mapError((cause) => new (class extends Error { readonly _tag = "PublicationError" as const; readonly phase = "mutate" as const; readonly commitment = "before-dispatch" as const; constructor(readonly reason: string) { super(reason) } })(cause instanceof Error ? cause.message : String(cause)))
  ))) as Effect.Effect<{ readonly started: boolean, readonly exitCode: number }, PublicationError>
})

const npmDeprecationProcess = (runtime: { readonly run: import("../drivers/process.js").RunCommand }): NpmDeprecationProcess => ({
  deprecate: (request) => Effect.gen(function*() {
    const directory = mkdtempSync(join(tmpdir(), "ts-release-correction-"))
    const config = join(directory, ".npmrc")
    try {
      writeFileSync(config, `//${new URL(request.registryUrl).host}/:_authToken=${request.credential}\n`, { mode: 0o600 })
      const result = yield* runtime.run({ argv: ["npm", "deprecate", `${request.packageName}@${request.version}`, request.message, "--registry", request.registryUrl, "--userconfig", config], cwd: directory, environmentNames: [] })
      return { started: true, exitCode: result.exitCode }
    } finally { rmSync(directory, { recursive: true, force: true }) }
  }).pipe(Effect.mapError((cause) => new (class extends Error { readonly _tag = "PublicationError" as const; readonly phase = "mutate" as const; readonly commitment = "before-dispatch" as const; constructor(readonly reason: string) { super(reason) } })(cause instanceof Error ? cause.message : String(cause)))) as Effect.Effect<{ readonly started: boolean, readonly exitCode: number }, PublicationError>
})

const publishProgram = Effect.fn("publishProgram")(function*(bundle: PreparedBundle, credentials: PublishInput["credentials"]) {
  const runtime = yield* ReleaseRuntime
  const selected = credentialsFor(bundle, credentials)
  return yield* publishPreparedRelease({ bundle, http: runtime.http, credentials: selected as { npm: PublicationCredentials, github: PublicationCredentials }, npmProcess: npmProcess(runtime) })
})

const correctProgram = Effect.fn("correctProgram")(function*(input: CorrectInput) {
  const runtime = yield* ReleaseRuntime
  const bundle = yield* loadPreparedRelease(preparedPath(input.prepared))
  const intent = yield* Effect.try({ try: () => decodeCorrectionIntent(new Uint8Array(readFileSync(input.correction))), catch: (cause) => new ReleaseInputError({ reason: cause instanceof Error ? cause.message : String(cause) }) })
  const credentials = input.credentials
  const subject = intent.correction._tag === "NpmDeprecationCorrection"
    ? credentials?.npm === undefined ? undefined : makeNpmDeprecationSubject(bundle, intent.correction, runtime.http, credentials.npm, npmDeprecationProcess(runtime))
    : intent.correction._tag === "CatalogCorrection" ? makeCatalogCorrectionSubject(bundle, intent, runtime.catalog) : undefined
  if (intent.correction._tag === "NpmDeprecationCorrection" && subject === undefined) return yield* Effect.fail(new ReleaseInputError({ reason: "correct requires separate npm read and publish credentials." }))
  return yield* correctPreparedRelease({ bundle, intent, ...(subject === undefined ? {} : { subject }) })
})

export const makeReleaseApi = (layer: ReleaseApiLayer): ReleaseApi => {
  const runtime = ManagedRuntime.make(layer)
  const run = <A, E>(effect: Effect.Effect<A, E, ReleaseRuntime>) => runtime.runPromise(effect)
  const inspect = async (value: InspectInput) => {
    const input = decodeInspectInput(value)
    if (input.prepared !== undefined) return inspectPreparedRelease(await run(loadPreparedRelease(preparedPath(input.prepared))))
    const compiled = await run(observeAndCompile({ config: input.config, workspace: input.workspace! }))
    return inspectRelease(compiled.context, compiled.graph)
  }
  const prepare = async (value: PrepareInput) => run(prepareProgram(decodePrepareInput(value)))
  const publish = async (value: PublishInput) => {
    const input = decodePublishInput(value)
    return run(Effect.flatMap(loadPreparedRelease(preparedPath(input.prepared)), (bundle) => publishProgram(bundle, input.credentials)))
  }
  const release = async (value: ReleaseInput) => {
    const input = decodeReleaseInput(value)
    const prepared = await run(prepareProgram(input))
    const publications = await run(publishProgram(prepared, input.credentials))
    return { prepared, publications }
  }
  const correct = async (value: CorrectInput) => run(correctProgram(decodeCorrectInput(value)))
  return Object.freeze({ inspect, prepare, publish, release, correct, dispose: () => runtime.dispose() })
}

export const makeDefaultReleaseApi = (layer: ReleaseApiLayer): ReleaseApi => makeReleaseApi(layer)

import { NodeReleaseLayer } from "../platform/node.js"
const defaultApi = makeReleaseApi(NodeReleaseLayer)
export const inspect = defaultApi.inspect
export const prepare = defaultApi.prepare
export const publish = defaultApi.publish
export const release = defaultApi.release
export const correct = defaultApi.correct
