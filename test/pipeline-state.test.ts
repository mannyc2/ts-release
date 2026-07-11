import { describe, expect, test } from "@effect/bun-test"
import * as Schema from "effect/Schema"
import { Artifact, ExecutableExtra } from "../src/pipeline/artifact.js"
import { ArtifactCatalog } from "../src/pipeline/catalog.js"
import { emptyReleaseState, ReleaseState } from "../src/pipeline/state.js"
import { makePipelineIdentity } from "./helpers.js"

const identity = makePipelineIdentity()

describe("pipeline state", () => {
  test("round-trips release state through its schema", () => {
    const state = emptyReleaseState(identity)
    const encoded = Schema.encodeSync(ReleaseState)(state)
    const decoded = Schema.decodeUnknownSync(ReleaseState)(encoded)

    expect(decoded.identity.name).toBe("release")
    expect(decoded.artifacts.artifacts).toEqual([])
  })

  test("filters catalog artifacts by kind and platform facts", () => {
    const linux = Artifact.make({
      id: "cli-linux",
      kind: "executable",
      path: "dist/release-linux",
      producedBy: "build:bun",
      platform: {
        os: "linux",
        arch: "x64",
        libc: "glibc",
        targetTriple: "bun-linux-x64"
      },
      extra: ExecutableExtra.make({
        binary: "release",
        extension: "",
        builderId: "bun"
      })
    })
    const catalog = ArtifactCatalog.make({
      artifacts: [
        linux,
        Artifact.make({
          id: "package",
          kind: "package",
          path: ".",
          producedBy: "build:npm-pack"
        })
      ]
    })

    const filtered = catalog.artifacts.filter((artifact) =>
      artifact.kind === "executable" && artifact.platform?.os === "linux" && artifact.platform.arch === "x64"
    )
    expect(filtered).toEqual([linux])
  })
})
