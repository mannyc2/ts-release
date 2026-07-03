import * as Effect from "effect/Effect"
import { appendArtifacts } from "./catalog.js"
import { PlanError } from "./errors.js"
import type { Pipe } from "./pipe.js"
import { PipeNotice, ReleaseState } from "./state.js"
import type { ReleaseConfig } from "../config/schema.js"

export type * from "../types/effect-internal.js"

const assertUniqueArtifactPaths = (
  pipeId: string,
  state: ReleaseState,
  paths: ReadonlyArray<string>
): Effect.Effect<void, PlanError> =>
  Effect.sync(() => {
    const seen = new Set(state.artifacts.artifacts.map((artifact) => artifact.path))
    const duplicates = new Set<string>()
    for (const path of paths) {
      if (seen.has(path)) {
        duplicates.add(path)
      }
      seen.add(path)
    }
    return [...duplicates].sort()
  }).pipe(
    Effect.flatMap((duplicates) =>
      duplicates.length === 0
        ? Effect.void
        : Effect.fail(PlanError.make({
          pipeId,
          field: "artifacts.path",
          reason: `Duplicate artifact paths: ${duplicates.join(", ")}`
        }))
    )
  )

const runPipe = Effect.fn("pipeline.runPipe")(function*<Section>(
  state: ReleaseState,
  config: ReleaseConfig,
  pipe: Pipe<Section>
) {
  const rawSection = pipe.section(config)
  if (rawSection === undefined) {
    return ReleaseState.make({
      ...state,
      notices: [
        ...state.notices,
        PipeNotice.make({
          pipeId: pipe.id,
          severity: "info",
          reason: "Config section is absent; pipe skipped."
        })
      ]
    })
  }

  const section = pipe.defaults === undefined
    ? rawSection
    : pipe.defaults(rawSection, state.identity)
  const contribution = yield* pipe.plan(section, state)
  yield* assertUniqueArtifactPaths(pipe.id, state, contribution.artifacts.map((artifact) => artifact.path))

  return ReleaseState.make({
    identity: state.identity,
    strict: state.strict,
    artifacts: appendArtifacts(state.artifacts, contribution.artifacts),
    operations: [...state.operations, ...contribution.operations],
    notices: [...state.notices, ...contribution.notices]
  })
})

export const runPipeline = Effect.fn("pipeline.runPipeline")(function*(
  initialState: ReleaseState,
  config: ReleaseConfig,
  pipes: ReadonlyArray<Pipe<unknown>>
) {
  let state = initialState
  for (const pipe of pipes) {
    state = yield* runPipe(state, config, pipe)
  }
  return state
})
