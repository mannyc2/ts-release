import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { parseReleaseIntent } from "../src/config/load.js"
import { npmPackPipe } from "../src/pipes/npm-pack.js"
import { emptyReleaseState, ReleaseIdentity } from "../src/pipeline/state.js"

const identity = ReleaseIdentity.make({
  name: "@scope/release",
  normalizedName: "scope-release",
  version: "0.1.0",
  commit: "abc123",
  shortCommit: "abc123",
  tag: "v0.1.0",
  versionSource: "config",
  snapshot: false
})

describe("npm pack build pipe", () => {
  it.effect("emits a package artifact for npm pack inputs", () =>
    Effect.gen(function*() {
      const config = yield* parseReleaseIntent(JSON.stringify({
        project: {
          name: "@scope/release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
        npmPackage: {
          path: "packages/cli"
        },
        publish: {}
      }))
      const section = npmPackPipe.section(config)
      expect(section).toBeDefined()
      if (section === undefined) {
        return
      }

      const contribution = yield* npmPackPipe.plan(section, emptyReleaseState(identity))

      expect(contribution.artifacts[0]).toMatchObject({
        id: "npm-package",
        kind: "package",
        path: "packages/cli",
        producedBy: "build:npm-pack"
      })
    }))
})
