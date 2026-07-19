import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { parseReleaseIntent } from "../src/config/load.js"
import { pypiWheelPlanner, resolvePyPiWheels } from "../src/pipes/pypi-wheel.js"
import type { Operation, StageAction } from "../src/pipeline/operation.js"
import { emptyPlanAccumulator } from "../src/pipeline/runner.js"
import { makePipelineIdentity, releaseConfig } from "./helpers.js"

const identity = makePipelineIdentity()

type StageOperation = Operation & { readonly action: StageAction }

const isStageArtifactOperation = (operation: Operation): operation is StageOperation =>
  operation.action._tag === "stage"

describe("PyPI wheel build pipe", () => {
  it.effect("emits wheel artifacts and staging operations", () =>
    Effect.gen(function*() {
      const config = yield* parseReleaseIntent(releaseConfig({
        artifacts: [],
        pypiWheel: {
          id: "wheel-linux",
          path: "dist/release-{version}.whl",
          wheelTag: "py3-none-manylinux2014_x86_64",
          packageName: "release",
          moduleName: "release",
          consoleScript: "release",
          summary: "Release CLI.",
          homepage: "https://example.com",
          license: "MIT",
          requiresPython: ">=3.8",
          binaries: []
        }
      }))
      const contribution = yield* Option.match(resolvePyPiWheels(config.pypiWheel), {
        onNone: () => Effect.die("Expected a resolved PyPI wheel section."),
        onSome: (section) => pypiWheelPlanner(section, emptyPlanAccumulator(identity))
      })
      const operation = contribution.operations.find(isStageArtifactOperation)

      expect(contribution.artifacts[0]).toMatchObject({
        id: "wheel-linux",
        kind: "wheel",
        path: "dist/release-0.1.0.whl"
      })
      expect(operation?.action.intent).toMatchObject({
        _tag: "pypi-wheel",
        outfile: "dist/release-0.1.0.whl"
      })
    }))
})
