import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as ManagedRuntime from "effect/ManagedRuntime"
import { decodeConfig } from "../config/config.js"
import { secretPatterns } from "../model/secret-patterns.js"
import { bindAuthoredCorrection, correctPreparedRelease } from "../correction/coordinator.js"
import { NonEmptyName, SafeRelativePath, Version, WorkspaceRoot } from "../model/primitives.js"
import {
  observePreparedRelease,
  publishPreparedRelease
} from "../publication/adapter.js"
import { SafeReason } from "../publication/report.js"
import { compileReleaseGraph } from "../release/compiler.js"
import type { VerifiedReleaseContext } from "../release/context.js"
import { inspectPreparedRelease, inspectRelease } from "../release/inspect.js"
import { prepareRelease } from "../release/prepare.js"
import { PreparationError } from "../release/prepare.js"
import type { CompletePreparedReleaseRef } from "../release/prepared-ref.js"
import {
  PreparedReleaseStore,
  type CommittedPreparedRelease
} from "../release/prepared-store.js"
import { ObservedFacts } from "../resolve/facts.js"
import { resolveConfig } from "../resolve/resolve.js"
import {
  PreparationModeUnsupported,
  ReleaseAbortedError,
  ReleaseInputError,
  ReleasePreparationError
} from "./errors.js"
import {
  decodeCorrectInput,
  decodeInspectInput,
  decodeObserveInput,
  decodePrepareInput,
  decodePublishInput,
  decodeReleaseInput,
  workspaceRoot
} from "./input.js"
import { ReleaseRuntime } from "./runtime.js"
import {
  CorrectionReport,
  type CorrectInput,
  type InspectInput,
  type ObserveInput,
  type PrepareInput,
  type PublishInput,
  type ReleaseApi,
  type ReleaseApiLayer,
  type ReleaseApiServices,
  type ReleaseInput
} from "./types.js"

export type {
  CorrectInput,
  InspectInput,
  ObserveInput,
  PrepareInput,
  PublishInput,
  ReleaseApi,
  ReleaseApiLayer,
  ReleaseInput
} from "./types.js"
export { CorrectionReport } from "./types.js"
export { ReleaseInputError } from "./errors.js"
export { ReleaseRuntime } from "./runtime.js"

const safeFailure = (failure: unknown, fallback: string): string => {
  const value = typeof failure === "object" && failure !== null &&
      "reason" in failure && typeof failure.reason === "string"
    ? failure.reason
    : failure instanceof Error
    ? failure.message
    : typeof failure === "string"
    ? failure
    : fallback
  const normalized = [...value]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint === 9 || codePoint === 10 || codePoint === 13 || codePoint >= 0x20
        ? character
        : "?"
    })
    .slice(0, 2048)
    .join("")
  return normalized.length === 0 || secretPatterns.some((pattern) => pattern.test(normalized))
    ? fallback
    : normalized
}

const inputFailure = (cause: unknown): ReleaseInputError => new ReleaseInputError({
  reason: safeFailure(cause, "Release input is invalid.")
})

const manifestPath = (config: {
  readonly project: { readonly packagePath?: SafeRelativePath }
  readonly npmPackage?: { readonly path?: SafeRelativePath }
}): SafeRelativePath => {
  const directory = String(config.project.packagePath ?? config.npmPackage?.path ?? ".")
  return SafeRelativePath.make(directory === "." ? "package.json" : `${directory}/package.json`)
}

const releaseTagVersion = (
  tags: ReadonlyArray<{ toString(): string }>
): string | undefined => {
  const values = tags
    .map((tag) => /^v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/u.exec(tag.toString())?.[1])
    .filter((value): value is string => value !== undefined)
  return values.length === 1 ? values[0] : undefined
}

const observeAndCompile = Effect.fn("observeAndCompileRelease")(function*(input: {
  readonly config: unknown
  readonly workspace: string
}) {
  const runtime = yield* ReleaseRuntime
  const authored = yield* decodeConfig(input.config).pipe(Effect.mapError(inputFailure))
  const root = yield* Effect.try({
    try: () => workspaceRoot(input.workspace),
    catch: inputFailure
  })
  const context = yield* runtime.source.observe(
    WorkspaceRoot.make(root),
    manifestPath(authored),
    authored.project.commit === undefined
      ? undefined
      : NonEmptyName.make(authored.project.commit)
  )
  const observedTagVersion = releaseTagVersion(context.source.headTags)
  const facts = ObservedFacts.make({
    commit: context.source.commit,
    manifestName: context.package.name,
    manifestVersion: context.package.version,
    ...(observedTagVersion === undefined
      ? {}
      : { headTagVersion: Version.make(observedTagVersion) }),
    ...(context.source.repository === undefined
      ? {}
      : { repository: context.source.repository })
  })
  const resolved = yield* Effect.try({
    try: () => resolveConfig(input.config, facts),
    catch: inputFailure
  })
  const graph = yield* Effect.try({
    try: () => compileReleaseGraph(resolved, context),
    catch: inputFailure
  })
  return {
    context,
    config: resolved,
    graph
  }
})

const prepareProgram = Effect.fn("prepareProgram")(function*(
  input: PrepareInput,
  options: { readonly allowEmpty: boolean }
) {
  const compiled = yield* observeAndCompile({
    config: input.config,
    workspace: input.workspace
  })
  if (!options.allowEmpty &&
      compiled.graph.artifacts.length === 0 &&
      compiled.graph.publications.length === 0) {
    return yield* new ReleaseInputError({
      reason: "release resolved to no artifacts and no publication subjects; use allowEmpty only for an explicit diagnostic run."
    })
  }
  const runtime = yield* ReleaseRuntime
  const store = yield* PreparedReleaseStore
  const sourceWorkspace = compiled.context.workspace
  const sourceManifest = compiled.context.source.packageManifestPath
  const sourceCommit = compiled.context.source.commit
  return yield* prepareRelease({
    context: compiled.context,
    graph: compiled.graph,
    store,
    run: runtime.run,
    verifySource: (_context: VerifiedReleaseContext) => runtime.source.observe(
      sourceWorkspace,
      sourceManifest,
      sourceCommit
    )
  })
})

const loadPrepared = Effect.fn("loadPreparedForApi")(function*(
  prepared: CompletePreparedReleaseRef
) {
  const store = yield* PreparedReleaseStore
  return yield* store.load(prepared)
})

const safeCause = <E>(cause: Cause.Cause<E>, fallback: string): string => {
  return safeFailure(Cause.squash(cause), fallback)
}

const preparationFailure = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, ReleaseInputError | ReleasePreparationError | ReleaseAbortedError, R> => effect.pipe(
  Effect.catchCause((cause): Effect.Effect<
    A,
    ReleaseInputError | ReleasePreparationError | ReleaseAbortedError
  > => {
    const failure = Cause.squash(cause)
    if (failure instanceof ReleaseInputError) {
      return Effect.fail<ReleaseInputError | ReleasePreparationError | ReleaseAbortedError>(failure)
    }
    if (failure instanceof PreparationError && failure.prepared !== undefined) {
      return Effect.fail(new ReleaseAbortedError({
        prepared: failure.prepared,
        cause: safeCause(cause, "The durable prepared reference could not be handed to the host.")
      }))
    }
    return Effect.fail(new ReleasePreparationError({
      cause: safeCause(cause, "Release preparation failed before a durable prepared reference was committed.")
    }))
  })
)

const afterCommitFailure = <A, E, R>(
  prepared: CompletePreparedReleaseRef,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, ReleaseAbortedError, R> => effect.pipe(
  Effect.catchCause((cause) => Effect.fail(new ReleaseAbortedError({
    prepared,
    cause: safeCause(cause, "The release operation stopped before a total report was available.")
  })))
)

const observeProgram = (prepared: CompletePreparedReleaseRef) => afterCommitFailure(
  prepared,
  loadPrepared(prepared).pipe(Effect.flatMap(observePreparedRelease))
)

const publishCommitted = Effect.fn("publishCommittedRelease")(function*(
  committed: CommittedPreparedRelease
) {
  const report = yield* publishPreparedRelease(committed.bundle)
  return { prepared: committed.ref, report }
})

const publishProgram = Effect.fn("publishProgram")(function*(
  prepared: CompletePreparedReleaseRef
) {
  const result = yield* afterCommitFailure(
    prepared,
    loadPrepared(prepared).pipe(
      Effect.flatMap((bundle) => publishCommitted({ ref: prepared, bundle }))
    )
  )
  return result.report
})

const releaseProgram = Effect.fn("releaseProgram")(function*(input: ReleaseInput) {
  const committed = yield* preparationFailure(prepareProgram(input, {
    allowEmpty: input.allowEmpty === true
  }))
  return yield* afterCommitFailure(committed.ref, publishCommitted(committed))
})

const correctProgram = Effect.fn("correctProgram")(function*(input: CorrectInput) {
  const bundle = yield* loadPrepared(input.prepared)
  const outcome = yield* Effect.try({
    try: () => bindAuthoredCorrection(bundle, input.correction),
    catch: inputFailure
  }).pipe(Effect.flatMap((intent) => correctPreparedRelease({ bundle, intent })))
  return new CorrectionReport({
    prepared: input.prepared,
    status: "unsupported",
    provider: outcome.provider,
    reason: SafeReason.make(outcome.reason),
    proposal: outcome.proposal ?? ""
  })
})

export const makeReleaseApi = (layer: ReleaseApiLayer): ReleaseApi => {
  const runtime = ManagedRuntime.make(layer)
  const run = <A, E>(effect: Effect.Effect<A, E, ReleaseApiServices>): Promise<A> =>
    runtime.runPromise(effect)

  const inspect = async (value: InspectInput) => {
    const input = decodeInspectInput(value)
    if ("prepared" in input) {
      return inspectPreparedRelease(await run(afterCommitFailure(
        input.prepared,
        loadPrepared(input.prepared)
      )))
    }
    const compiled = await run(observeAndCompile({
      config: input.config,
      workspace: input.workspace
    }))
    return inspectRelease(compiled.context, compiled.graph)
  }

  const prepare = async (value: PrepareInput) => {
    const input = decodePrepareInput(value)
    const committed = await run(preparationFailure(prepareProgram(input, { allowEmpty: true })))
    return committed.ref
  }

  const observe = async (value: ObserveInput) => {
    const input = decodeObserveInput(value)
    return run(observeProgram(input.prepared))
  }

  const publish = async (value: PublishInput) => {
    const input = decodePublishInput(value)
    return run(publishProgram(input.prepared))
  }

  const release = async (value: ReleaseInput) => {
    const input = decodeReleaseInput(value)
    return run(releaseProgram(input))
  }

  const correct = async (value: CorrectInput) => {
    const input = decodeCorrectInput(value)
    return run(afterCommitFailure(input.prepared, correctProgram(input)))
  }

  return Object.freeze({
    inspect,
    prepare,
    observe,
    publish,
    release,
    correct,
    dispose: () => runtime.dispose()
  })
}

export const makeDefaultReleaseApi = (layer: ReleaseApiLayer): ReleaseApi =>
  makeReleaseApi(layer)

import { NodeReleaseLayer } from "../platform/node.js"
const defaultApi = makeReleaseApi(NodeReleaseLayer)
export const inspect = defaultApi.inspect
export const prepare = defaultApi.prepare
export const observe = defaultApi.observe
export const publish = defaultApi.publish
export const release = defaultApi.release
export const correct = defaultApi.correct
