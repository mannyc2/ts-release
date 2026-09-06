import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as Scope from "effect/Scope"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { Host, runRelease, type HostShape, type RunOptions, type LabError } from "@lab/kernel"

export interface Application {
  readonly host: HostShape
  readonly options: RunOptions
}
export type ApplicationFactory = (input: unknown) => Effect.Effect<Application, LabError, Scope.Scope>

/** The user selects executable application code; plan data never installs it. */
export async function runApplication(applicationPath: string, input: unknown) {
  const loaded: unknown = await import(pathToFileURL(resolve(applicationPath)).href)
  if (typeof loaded !== "object" || loaded === null || !("createApplication" in loaded) ||
    typeof loaded.createApplication !== "function") {
    throw new Error("Application module must export createApplication(input)")
  }
  const application: unknown = loaded.createApplication(input)
  if (!Effect.isEffect(application)) throw new Error("createApplication must return a scoped Effect")
  return Effect.runPromise(Effect.scoped(Effect.gen(function*() {
    const app = yield* application as Effect.Effect<Application, LabError, Scope.Scope>
    return yield* runRelease(app.options).pipe(Effect.provide(Layer.succeed(Host, app.host)))
  })))
}

/** Actual Action adapter: invokes the same core entry using declared inputs. */
export async function runAction(inputs: { readonly application: string; readonly input: unknown }) {
  const report = await runApplication(inputs.application, inputs.input)
  return { report, outputs: { planId: report.planId, journalRevision: String(report.revision) } }
}
