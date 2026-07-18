import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import {
  Artifact,
  PyPiWheelBinaryArtifact,
  SafeRelativePath,
  WheelExtra
} from "../pipeline/artifact.js"
import { Operation, PyPiWheelIntent, StageAction } from "../pipeline/operation.js"
import { renderArtifactNameEffect } from "../pipeline/template.js"
import type { FeaturePlanner } from "../pipeline/pipe.js"
import { emptyContribution } from "../pipeline/pipe.js"

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
export type ResolvedPyPiWheel = ReleaseConfigPyPiWheelBuild

const isWheelArray = (section: PyPiWheelSection): section is ReadonlyArray<ReleaseConfigPyPiWheelBuild> =>
  Array.isArray(section)

const wheels = (section: PyPiWheelSection): ReadonlyArray<ReleaseConfigPyPiWheelBuild> =>
  isWheelArray(section) ? section : [section]

export const resolvePyPiWheels = (
  raw: PyPiWheelSection | undefined
): Option.Option<ReadonlyArray<ResolvedPyPiWheel>> =>
  raw === undefined ? Option.none() : Option.some(wheels(raw))

export const pypiWheelPlanner: FeaturePlanner<ReadonlyArray<ResolvedPyPiWheel>> = {
  id: "build:pypi-wheel",
  plan: (section, state) =>
    Effect.gen(function*() {
      const artifacts = []
      const operations = []
      for (const wheel of section) {
        const path = yield* renderArtifactNameEffect(wheel.path, { identity: state.identity }, { pipeId: "build:pypi-wheel", field: `pypiWheel.${wheel.id}.path` })
        artifacts.push(Artifact.make({
          id: wheel.id,
          kind: "wheel",
          path,
          producedBy: "build:pypi-wheel",
          extra: WheelExtra.make({
            packageName: wheel.packageName,
            wheelTag: wheel.wheelTag,
            binaries: wheel.binaries.map((binary) => binary.wheelPath)
          })
        }))
        operations.push(Operation.make({
          id: `build:pypi-wheel:${wheel.id}`,
          pipeId: "build:pypi-wheel",
          phase: "build",
          description: `Assemble PyPI wheel ${wheel.id}.`,
          risk: "writes-local",
          action: StageAction.make({
            intent: PyPiWheelIntent.make({
              outfile: path,
              wheelTag: wheel.wheelTag,
              packageName: wheel.packageName,
              moduleName: wheel.moduleName,
              consoleScript: wheel.consoleScript,
              summary: wheel.summary,
              homepage: wheel.homepage,
              license: wheel.license,
              requiresPython: wheel.requiresPython,
              binaries: [...wheel.binaries]
            }),
            producesArtifactIds: [wheel.id]
          })
        }))
      }
      return {
        ...emptyContribution,
        artifacts,
        operations
      }
    })
}
