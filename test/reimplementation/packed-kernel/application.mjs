import { Effect } from "effect"

export const createApplication = ({ application, lifecycle }) =>
  Effect.gen(function* () {
    yield* Effect.acquireRelease(
      Effect.sync(() => lifecycle.push("acquire")),
      () =>
        Effect.sync(() => {
          lifecycle.push("release")
        }),
    )
    return application
  })
