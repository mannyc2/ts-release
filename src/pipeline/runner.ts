import * as Effect from "effect/Effect"
import { artifactPathBaseName, type Artifact } from "./artifact.js"
import { appendArtifacts } from "./catalog.js"
import { PlanError } from "./errors.js"
import type { Pipe } from "./pipe.js"
import { PipeNotice, ReleaseState } from "./state.js"
import type { ReleaseConfig } from "../config/schema.js"

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

const assertUniqueArtifactIds = (
  pipeId: string,
  state: ReleaseState,
  artifacts: ReadonlyArray<Artifact>
): Effect.Effect<void, PlanError> =>
  Effect.sync(() => {
    const seen = new Set(state.artifacts.artifacts.map((artifact) => artifact.id))
    const duplicates = new Set<string>()
    for (const artifact of artifacts) {
      if (seen.has(artifact.id)) {
        duplicates.add(artifact.id)
      }
      seen.add(artifact.id)
    }
    return [...duplicates].sort()
  }).pipe(
    Effect.flatMap((duplicates) =>
      duplicates.length === 0
        ? Effect.void
        : Effect.fail(PlanError.make({
          pipeId,
          field: "artifacts.id",
          reason: `Duplicate artifact ids: ${duplicates.join(", ")}`
        }))
    )
  )

interface ArtifactNameCollision {
  readonly name: string
  readonly firstId: string
  readonly nextId: string
}

const assertUniqueArtifactNames = (
  pipeId: string,
  state: ReleaseState,
  artifacts: ReadonlyArray<Artifact>
): Effect.Effect<void, PlanError> =>
  Effect.sync(() => {
    const seen = new Map<string, string>()
    const collisions: Array<ArtifactNameCollision> = []
    for (const artifact of state.artifacts.artifacts) {
      seen.set(artifactPathBaseName(artifact.path), artifact.id)
    }
    for (const artifact of artifacts) {
      const name = artifactPathBaseName(artifact.path)
      const firstId = seen.get(name)
      if (firstId !== undefined) {
        collisions.push({ name, firstId, nextId: artifact.id })
      } else {
        seen.set(name, artifact.id)
      }
    }
    return collisions
  }).pipe(
    Effect.flatMap((collisions) =>
      collisions.length === 0
        ? Effect.void
        : Effect.fail(PlanError.make({
          pipeId,
          field: "artifacts.name",
          reason: `Duplicate artifact names: ${collisions
            .map((collision) =>
              `${collision.name} (${collision.firstId}, ${collision.nextId})`
            )
            .join(", ")}`
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
  yield* assertUniqueArtifactIds(pipe.id, state, contribution.artifacts)
  yield* assertUniqueArtifactPaths(pipe.id, state, contribution.artifacts.map((artifact) => artifact.path))
  yield* assertUniqueArtifactNames(pipe.id, state, contribution.artifacts)

  return ReleaseState.make({
    identity: state.identity,
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
