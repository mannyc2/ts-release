import { Effect } from "effect"
import type { Application } from "../../../packages/ts-release/src/Bun.js"
import { ReleaseError } from "../../../packages/ts-release/src/index.js"

export const createApplication = (input: unknown) =>
  Effect.gen(function* () {
    const { application, lifecycle, outcome } = input as {
      application: Application
      lifecycle: string[]
      outcome?: "failure" | "interruption"
    }
    yield* Effect.acquireRelease(
      Effect.sync(() => lifecycle.push("acquire")),
      () =>
        Effect.sync(() => {
          lifecycle.push("release")
        }),
    )
    if (outcome === "failure")
      return yield* new ReleaseError({ code: "fixture", message: "Fixture failure" })
    if (outcome === "interruption") return yield* Effect.interrupt
    return application
  })
