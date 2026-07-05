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

describe("prebuilt build pipe", () => {
  it.effect("emits read-only existence checks", () =>
    Effect.gen(function*() {
      const config = yield* parseReleaseIntent(JSON.stringify({
        project: {
          name: "release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
        builds: [{
          builder: "prebuilt",
          targets: ["windows-x64"],
          output: "dist/{binary}-{targetTriple}.exe",
          binary: "release"
        }],
        publish: {}
      }))
      const section = buildPipe.section(config)
      expect(section).toBeDefined()
      if (section === undefined) {
        return
      }

      const contribution = yield* buildPipe.plan(buildPipe.defaults?.(section, identity) ?? section, emptyReleaseState(identity))

      expect(contribution.artifacts[0]?.path).toBe("dist/release-windows-x64.exe")
      expect(contribution.operations[0]).toMatchObject({
        pipeId: "build",
        phase: "build",
        risk: "read-only",
        action: {
          _tag: "check-file",
          path: "dist/release-windows-x64.exe"
        }
      })
    }))
})
