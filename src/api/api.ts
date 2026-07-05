import * as Effect from "effect/Effect"
import type * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as ManagedRuntime from "effect/ManagedRuntime"
import type * as Path from "effect/Path"
import type { ArtifactStager } from "../engine/stager.js"
import type { GitHubApi } from "../engine/github.js"
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
    import("../engine/stager.js"),
    import("../engine/github.js")
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
    makeArtifactStagerLayer()
  )
}

let runtimeLayerFactory: ReleaseRuntimeLayerFactory = makeDefaultReleaseRuntimeLayer

let releaseRuntime: ManagedRuntime.ManagedRuntime<ReleaseRuntimeServices, unknown> | undefined
let releaseRuntimePromise:
  | Promise<ManagedRuntime.ManagedRuntime<ReleaseRuntimeServices, unknown>>
  | undefined

const getReleaseRuntime = async (): Promise<ManagedRuntime.ManagedRuntime<ReleaseRuntimeServices, unknown>> => {
  if (releaseRuntime !== undefined) {
    return releaseRuntime
  }
  if (releaseRuntimePromise !== undefined) {
    return releaseRuntimePromise
  }
  releaseRuntimePromise = Promise.resolve(runtimeLayerFactory()).then((layer) => {
    const runtime = ManagedRuntime.make(layer)
    releaseRuntime = runtime
    releaseRuntimePromise = undefined
    return runtime
  }, (error) => {
    releaseRuntimePromise = undefined
    throw error
  })
  return releaseRuntimePromise
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
  const runtime = releaseRuntime
  const pendingRuntime = releaseRuntimePromise
  releaseRuntime = undefined
  releaseRuntimePromise = undefined
  try {
    if (runtime !== undefined) {
      await runtime.dispose()
      return
    }
    if (pendingRuntime !== undefined) {
      const resolved = await pendingRuntime
      await resolved.dispose()
    }
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

export const plan = async (
  options: Engine.RunOptions = {}
): Promise<Engine.ReleasePlanSummary> => {
  const engine = await import("../engine/engine.js")
  return runApiEffect("plan", engine.plan(options))
}

export const build = async (
  options: Engine.RunOptions = {}
): Promise<Engine.BuildSummary> => {
  const engine = await import("../engine/engine.js")
  return runApiEffect("build", engine.build(options))
}

export const release = async (
  options: Engine.ReleaseRunOptions = {}
): Promise<Engine.ReleaseSummary> => {
  const engine = await import("../engine/engine.js")
  return runApiEffect("release", engine.release(options))
}

export const verify = async (
  options: Engine.RunOptions = {}
): Promise<Engine.VerifySummary> => {
  const engine = await import("../engine/engine.js")
  return runApiEffect("verify", engine.verify(options))
}
