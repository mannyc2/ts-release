// Invariant: the Promise API owns one lazily shared runtime and exposes only plain-data summaries or ReleaseApiError.
import * as Effect from "effect/Effect"
import type * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as ManagedRuntime from "effect/ManagedRuntime"
import type * as Path from "effect/Path"
import type { ArtifactStager } from "../pack/stager.js"
import type { GitHubApi } from "../github/github.js"
import type { ReleaseCommandRunner } from "../host/host.js"
import type { ReleaseHttp } from "../host/http.js"
import { ReleaseApiError, type ReleaseApiPhase } from "./errors.js"
import type * as Engine from "../engine/engine.js"

export type ReleaseRuntimeServices =
  | ReleaseCommandRunner
  | ReleaseHttp
  | GitHubApi
  | ArtifactStager
  | FileSystem.FileSystem
  | Path.Path

export type ReleaseRuntimeLayer = Layer.Layer<ReleaseRuntimeServices, unknown, never>

export type ReleaseRuntimeLayerFactory = () => ReleaseRuntimeLayer | Promise<ReleaseRuntimeLayer>

const makeDefaultReleaseRuntimeLayer = async (): Promise<ReleaseRuntimeLayer> => {
  const [
    BunHttpClient,
    BunServices,
    { LiveReleaseHttpLayer },
    { makePlatformCommandRunnerLayer },
    { makeArtifactStagerLayer },
    { GitHubApiLiveLayer }
  ] = await Promise.all([
    import("@effect/platform-bun/BunHttpClient"),
    import("@effect/platform-bun/BunServices"),
    import("../host/http-live.js"),
    import("../host/platform.js"),
    import("../pack/stager.js"),
    import("../github/github.js")
  ])

  const commandLayer = makePlatformCommandRunnerLayer().pipe(
    Layer.provideMerge(BunServices.layer)
  )

  return Layer.mergeAll(
    commandLayer,
    Layer.provideMerge(GitHubApiLiveLayer, LiveReleaseHttpLayer).pipe(
      Layer.provideMerge(BunHttpClient.layer),
      Layer.provideMerge(BunServices.layer)
    ),
    makeArtifactStagerLayer().pipe(
      Layer.provideMerge(BunServices.layer)
    )
  )
}

let runtimeLayerFactory: ReleaseRuntimeLayerFactory = makeDefaultReleaseRuntimeLayer

let runtimePromise:
  | Promise<ManagedRuntime.ManagedRuntime<ReleaseRuntimeServices, unknown>>
  | undefined

const getReleaseRuntime = (): Promise<ManagedRuntime.ManagedRuntime<ReleaseRuntimeServices, unknown>> => {
  runtimePromise ??= Promise.resolve(runtimeLayerFactory()).then(
    (layer) => ManagedRuntime.make(layer),
    (error) => {
      runtimePromise = undefined
      throw error
    }
  )
  return runtimePromise
}

const runApiEffect = async <A, E>(
  phase: ReleaseApiPhase,
  effect: Effect.Effect<A, E, ReleaseRuntimeServices>
): Promise<A> => {
  try {
    const runtime = await getReleaseRuntime()
    return await runtime.runPromise(effect)
  } catch (cause) {
    throw ReleaseApiError.fromCause(phase, cause)
  }
}

export const disposeReleaseRuntime = async (): Promise<void> => {
  const pending = runtimePromise
  runtimePromise = undefined
  if (pending === undefined) {
    return
  }
  try {
    await (await pending).dispose()
  } catch (cause) {
    throw ReleaseApiError.fromCause("dispose", cause)
  }
}

export const setReleaseRuntimeLayerFactoryForTesting = async (
  factory: ReleaseRuntimeLayerFactory
): Promise<void> => {
  await disposeReleaseRuntime()
  runtimeLayerFactory = factory
}

export const resetReleaseRuntimeLayerFactoryForTesting = async (): Promise<void> => {
  await disposeReleaseRuntime()
  runtimeLayerFactory = makeDefaultReleaseRuntimeLayer
}

const verb = <A, B>(
  phase: Exclude<ReleaseApiPhase, "dispose">,
  operation: (engine: typeof import("../engine/engine.js"), options: Engine.RunOptions) =>
    Effect.Effect<A, unknown, ReleaseRuntimeServices>,
  project: (value: A) => B
) => async (options: Engine.RunOptions = {}): Promise<B> => {
  const engine = await import("../engine/engine.js")
  return project(await runApiEffect(phase, operation(engine, options)))
}

const verbs = {
  plan: verb("plan", (engine, input) => engine.plan(input), (summary): Engine.ReleasePlanSummary => summary),
  build: verb("build", (engine, input) => engine.build(input),
    ({ plan: _plan, stagedOperations: _staged, ...summary }): Engine.BuildSummary => summary),
  release: verb("release", (engine, input) => engine.release(input),
    ({ plan: _plan, evidence: _evidence, ...summary }): Engine.ReleaseSummary => summary),
  verify: verb("verify", (engine, input) => engine.verify(input),
    ({ plan: _plan, evidence: _evidence, ...summary }): Engine.VerifySummary => summary)
}

export const { build, plan, release, verify } = verbs
