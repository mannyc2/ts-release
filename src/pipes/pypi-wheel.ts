import * as Effect from "effect/Effect"
import {
  Artifact,
  WheelExtra
} from "../pipeline/artifact.js"
import { PyPiWheelIntent, StageArtifactOperation } from "../pipeline/operation.js"
import { renderTemplate } from "../pipeline/template.js"
import type { Pipe } from "../pipeline/pipe.js"
import { emptyContribution } from "../pipeline/pipe.js"
import type { ReleaseConfigPyPiWheelBuild } from "../domain/release.js"

export type PyPiWheelSection = ReleaseConfigPyPiWheelBuild | ReadonlyArray<ReleaseConfigPyPiWheelBuild>

const isWheelArray = (section: PyPiWheelSection): section is ReadonlyArray<ReleaseConfigPyPiWheelBuild> =>
  Array.isArray(section)

const wheels = (section: PyPiWheelSection): ReadonlyArray<ReleaseConfigPyPiWheelBuild> =>
  isWheelArray(section) ? section : [section]

const sectionFromConfig = (config: {
  readonly pypiWheel?: PyPiWheelSection | undefined
}): PyPiWheelSection | undefined =>
  config.pypiWheel

export const pypiWheelPipe: Pipe<PyPiWheelSection> = {
  id: "build:pypi-wheel",
  phase: "build",
  section: sectionFromConfig,
  defaults: (section) => section,
  plan: (section, state) =>
    Effect.sync(() => {
      const artifacts = []
      const operations = []
      for (const wheel of wheels(section)) {
        const path = renderTemplate(wheel.path, { identity: state.identity })
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
        operations.push(StageArtifactOperation.make({
          id: `build:pypi-wheel:${wheel.id}`,
          description: `Assemble PyPI wheel ${wheel.id}.`,
          risk: "writes-local",
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
        }))
      }
      return {
        ...emptyContribution,
        artifacts,
        operations
      }
    })
}
