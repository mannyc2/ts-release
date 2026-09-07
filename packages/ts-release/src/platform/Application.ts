import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as Scope from "effect/Scope"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { Host, captureHost, type HostShape } from "../internal/Host.js"
import { type OwnedBundle } from "../internal/ArtifactModel.js"
import { ReleaseError, attempt, fail } from "../internal/Error.js"
import { type RunOptions } from "../internal/ReleaseModel.js"
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

/** This explicit path selects trusted application code. Neither Plan nor Journal
 * data can choose an import. The application supplies its complete host layers. */
export const runApplication = (applicationPath: string, input: unknown): Promise<FinalizedReport> =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const loaded: unknown = yield* Effect.tryPromise({
          try: () => import(pathToFileURL(resolve(applicationPath)).href),
          catch: () =>
            new ReleaseError({
              code: "application-load",
              message: "Application module could not be loaded",
            }),
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
        }).pipe(Effect.provide(Layer.succeed(Host, host)))
      }),
    ),
  )
