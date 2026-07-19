// Invariant: each decoded wheel section emits exactly one wheel artifact and one staging intent.
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { Artifact, PyPiWheelBinaryArtifact, SafeRelativePath, WheelExtra } from "../pipeline/artifact.js"
import { Operation, PyPiWheelIntent, StageAction } from "../pipeline/operation.js"
import { featurePlanner } from "../pipeline/pipe.js"
import { renderArtifactNameEffect } from "../pipeline/template.js"

export class ReleaseConfigPyPiWheelBuild extends Schema.Class<ReleaseConfigPyPiWheelBuild>(
  "ReleaseConfigPyPiWheelBuild"
)({
  id: Schema.NonEmptyString,
  path: SafeRelativePath,
  wheelTag: Schema.String,
  packageName: Schema.String,
  moduleName: Schema.String,
  consoleScript: Schema.String,
  summary: Schema.String,
  homepage: Schema.String,
  license: Schema.String,
  requiresPython: Schema.String,
  binaries: Schema.Array(PyPiWheelBinaryArtifact)
}) {}

export type PyPiWheelSection = ReleaseConfigPyPiWheelBuild | ReadonlyArray<ReleaseConfigPyPiWheelBuild>
export const resolvePyPiWheels = (raw: PyPiWheelSection | undefined) => raw === undefined
  ? Option.none<ReadonlyArray<ReleaseConfigPyPiWheelBuild>>()
  : Option.some(Array.isArray(raw) ? raw : [raw as ReleaseConfigPyPiWheelBuild])

export const pypiWheelPlanner = featurePlanner<ReadonlyArray<ReleaseConfigPyPiWheelBuild>>(
  "build:pypi-wheel", (wheels, state) => Effect.forEach(wheels, (wheel) => Effect.gen(function*() {
    const path = yield* renderArtifactNameEffect(wheel.path, { identity: state.identity }, {
      pipeId: "build:pypi-wheel", field: `pypiWheel.${wheel.id}.path`
    })
    return {
      artifact: Artifact.make({
        id: wheel.id,
        kind: "wheel",
        path,
        producedBy: "build:pypi-wheel",
        extra: WheelExtra.make({
          packageName: wheel.packageName,
          wheelTag: wheel.wheelTag,
          binaries: wheel.binaries.map(({ wheelPath }) => wheelPath)
        })
      }),
      operation: Operation.make({
        id: `build:pypi-wheel:${wheel.id}`,
        pipeId: "build:pypi-wheel",
        phase: "build",
        description: `Assemble PyPI wheel ${wheel.id}.`,
        risk: "writes-local",
        action: StageAction.make({
          intent: PyPiWheelIntent.make({ ...wheel, outfile: path, binaries: [...wheel.binaries] }),
          producesArtifactIds: [wheel.id]
        })
      })
    }
  })).pipe(Effect.map((planned) => ({
    artifacts: planned.map(({ artifact }) => artifact),
    operations: planned.map(({ operation }) => operation)
  }))))
