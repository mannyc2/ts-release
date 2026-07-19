// Invariant: the Promise API owns one module-scope runtime behind a single swap and exposes only plain-data summaries or ReleaseApiError.
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

// Layer.unwrap moves the dynamic imports inside the layer, so ManagedRuntime
// can be constructed synchronously at module scope; a failed import stays in
// the layer's unknown error channel (an error, not a defect).
const defaultLayer: ReleaseRuntimeLayer = Layer.unwrap(Effect.tryPromise(async () => {
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
}))

let currentLayer = defaultLayer
let runtime = ManagedRuntime.make(defaultLayer)

const swap = async (layer: ReleaseRuntimeLayer): Promise<void> => {
  const previous = runtime
  currentLayer = layer
  runtime = ManagedRuntime.make(layer)
  await previous.dispose()
}

const runApiEffect = <A, E>(
  phase: ReleaseApiPhase,
  effect: Effect.Effect<A, E, ReleaseRuntimeServices>
): Promise<A> =>
  runtime.runPromise(effect).catch((cause) => {
    throw ReleaseApiError.fromCause(phase, cause)
  })

export const disposeReleaseRuntime = async (): Promise<void> => {
  try {
    await swap(currentLayer)
  } catch (cause) {
    throw ReleaseApiError.fromCause("dispose", cause)
  }
}

export const setReleaseRuntimeLayerFactoryForTesting = (layer: ReleaseRuntimeLayer): Promise<void> =>
  swap(layer)

export const resetReleaseRuntimeLayerFactoryForTesting = (): Promise<void> =>
  swap(defaultLayer)

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
