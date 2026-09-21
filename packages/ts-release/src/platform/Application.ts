import * as Effect from "effect/Effect"
import * as Logger from "effect/Logger"
import type * as Scope from "effect/Scope"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { Host, captureHost, type HostShape } from "../internal/Host.js"
import type { OwnedBundle } from "../internal/ArtifactModel.js"
import { attempt, fail, failure, type ReleaseError } from "../internal/Error.js"
import type { Operation, RunOptions } from "../internal/ReleaseModel.js"
import { FinalizedReport, reportFinalizedRelease } from "../internal/FinalizedReport.js"
import { observeRelease, runRelease } from "../Release.js"

export { FinalizedReport }
export interface Application {
  readonly bundle: OwnedBundle
  readonly host: HostShape
  readonly options: RunOptions
  /** Complete live authentication only after a provider's terminal noncommit
   * proof is durable. The kernel alone authorizes any subsequent dispatch.
   * Called at most once per operation per invocation, never in observe mode. */
  readonly onRejected?: (operation: Operation) => Effect.Effect<boolean, ReleaseError>
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
  mode: "run" | "observe" = "run",
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
        const onRejected = yield* attempt(() => {
          if (app.onRejected !== undefined && typeof app.onRejected !== "function")
            fail("application-rejection", "Application rejection handler must be callable")
          return app.onRejected?.bind(app)
        })
        const host = yield* attempt(() => captureHost(app.host))
        return yield* Effect.gen(function* () {
          // Admit the complete Bundle/Plan/Journal binding before dispatch, then keep
          // these owned inputs across the run. Reports never grant dispatch authority.
          const admitted = yield* reportFinalizedRelease(app.bundle, options.plan)
          if (mode === "observe") yield* observeRelease({ plan: admitted.plan })
          else yield* runRelease({ ...options, plan: admitted.plan })
          let report = yield* reportFinalizedRelease(admitted.bundle, admitted.plan)
          const initialDispatches = admitted.operations.reduce(
            (sum, item) => sum + item.dispatches,
            0,
          )
          const handled = new Set<string>()
          while (mode === "run" && options.authorize && onRejected) {
            const used =
              report.operations.reduce((sum, item) => sum + item.dispatches, 0) - initialDispatches
            const remaining =
              options.maxDispatches === undefined ? undefined : options.maxDispatches - used
            if (remaining !== undefined && remaining <= 0) break
            const rejected = report.operations.filter((item) => item.status === "Rejected")
            if (rejected.length === 0 || rejected.some((item) => handled.has(item.operationId)))
              break
            let ready = true
            for (const item of rejected) {
              handled.add(item.operationId)
              const operation = admitted.plan.operations.find(
                (operation) => operation.operationId === item.operationId,
              )!
              if (!(yield* Effect.suspend(() => onRejected(operation)))) {
                ready = false
                break
              }
            }
            if (!ready) break
            // Re-enter the public interpreter with the original Plan and journal.
            // The hook supplies live credentials, never a send permit or replay.
            yield* runRelease({
              ...options,
              plan: admitted.plan,
              ...(remaining === undefined ? {} : { maxDispatches: remaining }),
            })
            report = yield* reportFinalizedRelease(admitted.bundle, admitted.plan)
          }
          return report
        }).pipe(Effect.provideService(Host, host))
      }),
    ).pipe(Effect.provideService(Logger.LogToStderr, true)),
    { signal },
  )
