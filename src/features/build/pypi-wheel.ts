// Invariant: one wheel family emits exactly one wheel artifact and one staging intent per entry; package metadata comes from project facts resolved before planning.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { Artifact, PyPiWheelBinaryArtifact, SafeRelativePath, WheelExtra } from "../../grammar/artifact.js"
import { StageAction } from "../../grammar/operation.js"
import { PyPiWheelIntent } from "../../grammar/intent.js"
import { PlanError } from "../../grammar/errors.js"
import { featureOperation, featurePlanner } from "../../grammar/planner.js"
import { renderArtifactNameEffect } from "../../grammar/template.js"

export class ReleaseConfigPyPiWheel extends Schema.Class<ReleaseConfigPyPiWheel>(
  "ReleaseConfigPyPiWheel"
)({
  id: Schema.NonEmptyString,
  path: SafeRelativePath,
  wheelTag: Schema.String,
  binaries: Schema.Array(PyPiWheelBinaryArtifact)
}) {}

export class ReleaseConfigPyPiWheelBuild extends Schema.Class<ReleaseConfigPyPiWheelBuild>(
  "ReleaseConfigPyPiWheelBuild"
)({
  packageName: Schema.String,
  moduleName: Schema.String,
  consoleScript: Schema.String,
  requiresPython: Schema.String,
  wheels: Schema.NonEmptyArray(ReleaseConfigPyPiWheel)
}) {}

export type PyPiWheelBuild =
  & ReleaseConfigPyPiWheel
  & Omit<ReleaseConfigPyPiWheelBuild, "wheels">
  & {
    readonly summary?: string | undefined
    readonly homepage?: string | undefined
    readonly license?: string | undefined
  }

const requireProjectFact = (
  value: string | undefined,
  field: string,
  reason: string
): Effect.Effect<string, PlanError> => value === undefined
  ? Effect.fail(PlanError.make({ pipeId: "build:pypi-wheel", field, reason }))
  : Effect.succeed(value)

export const pypiWheelPlanner = featurePlanner<ReadonlyArray<PyPiWheelBuild>>(
  "build:pypi-wheel", (wheels, state) => Effect.forEach(wheels, (wheel) => Effect.gen(function*() {
    const path = yield* renderArtifactNameEffect(wheel.path, { identity: state.identity }, {
      pipeId: "build:pypi-wheel", field: `pypiWheel.wheels.${wheel.id}.path`
    })
    const summary = yield* requireProjectFact(wheel.summary, "project.summary",
      "PyPI wheels require project.summary or project.description.")
    const homepage = yield* requireProjectFact(wheel.homepage, "project.homepage",
      "PyPI wheels require project.homepage or publish.github.repository.")
    const license = yield* requireProjectFact(wheel.license, "project.license",
      "PyPI wheels require project.license.")
    return {
      artifact: Artifact.make({
        id: wheel.id,
        path,
        producedBy: "build:pypi-wheel",
        extra: WheelExtra.make({
          packageName: wheel.packageName,
          wheelTag: wheel.wheelTag,
          binaries: wheel.binaries.map(({ wheelPath }) => wheelPath)
        })
      }),
      operation: featureOperation({
        id: `build:pypi-wheel:${wheel.id}`,
        phase: "build",
        description: `Assemble PyPI wheel ${wheel.id}.`,
        risk: "writes-local",
        action: StageAction.make({
          intent: PyPiWheelIntent.make({
            ...wheel, summary, homepage, license, outfile: path, binaries: [...wheel.binaries]
          }),
          producesArtifactIds: [wheel.id]
        })
      })
    }
  })).pipe(Effect.map((planned) => ({
    artifacts: planned.map(({ artifact }) => artifact),
    operations: planned.map(({ operation }) => operation)
  }))))
