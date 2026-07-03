import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { parseReleaseIntent } from "../src/config/load.js"
import { buildPipe } from "../src/pipes/build.js"
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

describe("Bun build pipe", () => {
  it.effect("emits a Bun compile staging operation", () =>
    Effect.gen(function*() {
      const config = yield* parseReleaseIntent(JSON.stringify({
        project: {
          name: "release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
        builds: [{
          builder: "bun",
          entry: "src/cli.ts",
          targets: ["linux-x64"],
          cpu: "baseline"
        }],
        publish: {}
      }))
      const section = buildPipe.section(config)
      expect(section).toBeDefined()
      if (section === undefined) {
        return
      }

      const contribution = yield* buildPipe.plan(buildPipe.defaults?.(section, identity) ?? section, emptyReleaseState(identity, true))
      const operation = contribution.operations.find(isStageArtifactOperation)

      expect(operation?.intent).toMatchObject({
        _tag: "bun-compile",
        target: "linux-x64",
        compileTarget: "bun-linux-x64-baseline"
      })
    }))
})
