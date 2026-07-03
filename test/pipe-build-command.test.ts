import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { parseReleaseIntent } from "../src/config/load.js"
import { buildPipe } from "../src/pipes/build.js"
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

describe("command build pipe", () => {
  it.effect("emits command operations with expanded templates", () =>
    Effect.gen(function*() {
      const config = yield* parseReleaseIntent(JSON.stringify({
        project: {
          name: "release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
        builds: [{
          builder: "command",
          targets: ["darwin-arm64"],
          run: ["make", "build-{os}-{arch}"],
          output: "dist/{binary}-{targetTriple}",
          binary: "release"
        }],
        publish: {}
      }))
      const section = buildPipe.section(config)
      expect(section).toBeDefined()
      if (section === undefined) {
        return
      }

      const contribution = yield* buildPipe.plan(buildPipe.defaults?.(section, identity) ?? section, emptyReleaseState(identity, true))

      expect(contribution.artifacts[0]?.path).toBe("dist/release-darwin-arm64")
      expect(contribution.operations[0]).toMatchObject({
        _tag: "ValidateCommandOperation",
        risk: "writes-local",
        command: {
          executable: "make",
          args: ["build-darwin-arm64"]
        }
      })
    }))
})
