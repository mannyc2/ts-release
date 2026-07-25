import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  Artifact,
  ArchiveExtra,
  artifactIsDirectoryLike,
  ExecutableExtra,
  ImportedFileExtra,
  PackageExtra
} from "../src/grammar/artifact.js"

describe("artifact discriminant", () => {
  it("derives kind from each artifact extra tag", () => {
    const executable = Artifact.make({
      id: "cli",
      path: "dist/cli",
      producedBy: "build:bun",
      extra: ExecutableExtra.make({ binary: "cli", extension: "", builderId: "bun" })
    })
    const archive = Artifact.make({
      id: "archive",
      path: "dist/cli.zip",
      producedBy: "archive",
      extra: ArchiveExtra.make({ format: "zip", binaries: ["cli"], files: [] })
    })

    expect([executable.kind, archive.kind]).toEqual(["executable", "archive"])
    expect([executable.kind, archive.kind]).toEqual([executable.extra._tag, archive.extra._tag])
  })

  it.effect("rejects encoded artifacts without the required extra", () =>
    Effect.gen(function*() {
      const error = yield* Schema.decodeUnknownEffect(Artifact)({
        id: "file",
        kind: "file",
        path: "dist/file",
        producedBy: "import-artifacts"
      }).pipe(Effect.flip)

      expect(String(error)).toContain("extra")
    }))

  it("classifies only package and imported-directory artifacts as directory-like", () => {
    const packageArtifact = Artifact.make({
      id: "package",
      path: "package",
      producedBy: "build:npm-pack",
      extra: PackageExtra.make({ packageManager: "npm", packageName: "pkg" })
    })
    const directory = Artifact.make({
      id: "directory",
      path: "dist/directory",
      producedBy: "import-artifacts",
      extra: ImportedFileExtra.make({ format: "directory" })
    })
    const file = Artifact.make({
      id: "file",
      path: "dist/file",
      producedBy: "import-artifacts",
      extra: ImportedFileExtra.make({ format: "file" })
    })
    const executable = Artifact.make({
      id: "executable",
      path: "dist/executable",
      producedBy: "build:bun",
      extra: ExecutableExtra.make({ binary: "executable", extension: "", builderId: "bun" })
    })

    expect([packageArtifact, directory, file, executable].map(artifactIsDirectoryLike))
      .toEqual([true, true, false, false])
  })
})
