import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { parseReleaseIntent } from "../src/config/load.js"
import { pypiWheelPipe } from "../src/pipes/pypi-wheel.js"
import { StageArtifactOperation } from "../src/pipeline/operation.js"
import { emptyReleaseState, ReleaseIdentity } from "../src/pipeline/state.js"

const identity = ReleaseIdentity.make({
  name: "release",
  normalizedName: "release",
  version: "0.1.0",
  commit: "abc123",
  shortCommit: "abc123",
  tag: "v0.1.0",
  versionSource: "config",
  snapshot: false
})

const isStageArtifactOperation = (operation: unknown): operation is StageArtifactOperation =>
  typeof operation === "object"
  && operation !== null
  && "_tag" in operation
  && operation._tag === "StageArtifactOperation"

describe("PyPI wheel build pipe", () => {
  it.effect("emits wheel artifacts and staging operations", () =>
    Effect.gen(function*() {
      const config = yield* parseReleaseIntent(JSON.stringify({
        project: {
          name: "release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
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
        },
        publish: {}
      }))
      const section = pypiWheelPipe.section(config)
      expect(section).toBeDefined()
      if (section === undefined) {
        return
      }

      const contribution = yield* pypiWheelPipe.plan(section, emptyReleaseState(identity, true))
      const operation = contribution.operations.find(isStageArtifactOperation)

      expect(contribution.artifacts[0]).toMatchObject({
        id: "wheel-linux",
        kind: "wheel",
        path: "dist/release-0.1.0.whl"
      })
      expect(operation?.intent).toMatchObject({
        _tag: "pypi-wheel",
        outfile: "dist/release-0.1.0.whl"
      })
    }))
})
