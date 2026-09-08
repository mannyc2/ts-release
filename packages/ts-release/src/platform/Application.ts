import * as Effect from "effect/Effect"
import * as Logger from "effect/Logger"
import type * as Scope from "effect/Scope"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { Host, captureHost, type HostShape } from "../internal/Host.js"
import type { OwnedBundle } from "../internal/ArtifactModel.js"
import { attempt, fail, failure, type ReleaseError } from "../internal/Error.js"
import type { RunOptions } from "../internal/ReleaseModel.js"
import { FinalizedReport, reportFinalizedRelease } from "../internal/FinalizedReport.js"
import { runRelease } from "../Release.js"

export { FinalizedReport }
export interface Application {
  readonly bundle: OwnedBundle
  readonly host: HostShape
  readonly options: RunOptions
}
export type CreateApplication = (
  input: unknown,
) => Effect.Effect<Application, ReleaseError, Scope.Scope>
/** Own process signal listeners and liveness for exactly one asynchronous main. */
export const runInterruptibleProcess = async <A>(
  main: (signal: AbortSignal, exitCode: () => 0 | 130 | 143) => Promise<A>,
): Promise<A> => {
  const controller = new AbortController(),
    keepAlive = setInterval(() => {}, 2_147_483_647)
  let code: 0 | 130 | 143 = 0
  const stop = (exitCode: 130 | 143) => {
      code ||= exitCode
      controller.abort()
    },
    signals = { SIGINT: () => stop(130), SIGTERM: () => stop(143) } as const
  for (const [signal, listener] of Object.entries(signals)) process.on(signal, listener)
  try {
    return await main(controller.signal, () => code)
  } finally {
    clearInterval(keepAlive)
    for (const [signal, listener] of Object.entries(signals)) process.off(signal, listener)
  }
}

/** This explicit path selects trusted application code. Neither Plan nor Journal
 * data can choose an import. The application supplies its complete host layers. */
export const runApplication = (
  applicationPath: string,
  input: unknown,
  signal?: AbortSignal,
): Promise<FinalizedReport> =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const loaded: unknown = yield* Effect.tryPromise({
          try: () => import(pathToFileURL(resolve(applicationPath)).href),
          catch: () => failure("application-load", "Application module could not be loaded"),
        })
        const factory = yield* attempt(() => {
          if (
            typeof loaded !== "object" ||
            loaded === null ||
            !("createApplication" in loaded) ||
            typeof loaded.createApplication !== "function"
          )
            fail("application-export", "Application must export createApplication(input)")
          const effect: unknown = loaded.createApplication(input)
          if (!Effect.isEffect(effect))
            fail("application-effect", "createApplication must return a scoped Effect")
          return effect as ReturnType<CreateApplication>
        })
        const app = yield* factory
        const options = { ...app.options }
        const host = yield* attempt(() => captureHost(app.host))
        return yield* Effect.gen(function* () {
          // Admit the complete Bundle/Plan/Journal binding before dispatch, then keep
          // these owned inputs across the run. Reports never grant dispatch authority.
          const admitted = yield* reportFinalizedRelease(app.bundle, options.plan)
          yield* runRelease({ ...options, plan: admitted.plan })
          return yield* reportFinalizedRelease(admitted.bundle, admitted.plan)
        }).pipe(Effect.provideService(Host, host))
      }),
    ).pipe(Effect.provideService(Logger.LogToStderr, true)),
    { signal },
  )
