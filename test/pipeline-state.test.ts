import { describe, expect, test } from "@effect/bun-test"
import * as Schema from "effect/Schema"
import { Artifact, ExecutableExtra } from "../src/pipeline/artifact.js"
import {
  ArtifactCatalog,
  and,
  byArch,
  byKind,
  byOs,
  filterCatalog
} from "../src/pipeline/catalog.js"
import { emptyReleaseState, ReleaseIdentity, ReleaseState } from "../src/pipeline/state.js"

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

    expect(filterCatalog(catalog, and(byKind("executable"), byOs("linux"), byArch("x64")))).toEqual([linux])
  })
})
