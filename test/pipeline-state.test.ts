import { describe, expect, it, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as A from "../src/grammar/artifact.js"
import * as O from "../src/grammar/operation.js"
import * as Content from "../src/grammar/content.js"
import * as Intent from "../src/grammar/intent.js"
import { decodeReleasePlan, decodeReleasePlanSync, ReleasePlan, SourceMetadata } from "../src/grammar/plan.js"
import { makePipelineIdentity } from "./helpers.js"

const extraArtifact = (id: string, kind: A.ArtifactKind, path: string, extra: A.ArtifactExtra): A.Artifact =>
  A.Artifact.make({ id, kind, path, producedBy: "test", extra })
const artifacts = [
  A.Artifact.make({
    id: "executable", kind: "executable", path: "dist/tool", producedBy: "build:bun",
    platform: { os: "linux", arch: "x64", libc: "glibc", binaryName: "tool" },
    checksum: { algorithm: "sha256", value: "abc" },
    extra: A.ExecutableExtra.make({ binary: "tool", extension: "", builderId: "bun" })
  }),
  extraArtifact("archive", "archive", "dist/tool.tar.gz", A.ArchiveExtra.make({ format: "tar.gz", binaries: ["tool"], files: ["README.md"] })),
  extraArtifact("checksums", "checksum-file", "dist/checksums.txt", A.ChecksumFileExtra.make({ algorithm: "sha256", coversArtifactIds: ["archive"] })),
  extraArtifact("catalog", "catalog-file", "dist/tool.rb", A.CatalogFileExtra.make({ catalog: "claude-marketplace", repository: "owner/tap" })),
  extraArtifact("package", "package", "packages/tool", A.PackageExtra.make({ packageManager: "jsr", packageName: "tool" })),
  extraArtifact("wheel", "wheel", "dist/tool.whl", A.WheelExtra.make({ packageName: "tool", wheelTag: "py3-none-any", binaries: [] })),
  extraArtifact("imported", "file", "dist/imported.bin", A.ImportedFileExtra.make({ format: "file" }))
]
const op = (id: string, action: O.Action, phase: O.OperationPhase = "verify",
  risk: O.OperationRisk = "read-only", retry?: O.RetryPolicy): O.Operation => O.Operation.make({
  id, pipeId: "test", phase, risk, description: id,
  action, ...(retry === undefined ? {} : { retry })
})
const operations = [
  op("command", O.CommandAction.make({ command: O.CommandSpec.make(
    { executable: "bun", args: ["build"], requiredEnv: [], redactedEnv: [] }
  ) }), "build", "writes-local", O.RetryPolicy.make({ attempts: 2, delayMillis: 1 })),
  op("check-file", O.CheckFileAction.make({ path: "dist/tool" })),
  op("write-file", O.WriteFileAction.make({ path: "dist/catalog", contents: Content.FilePartsContent.make({
    parts: ["sha256=", Content.Sha256Hole.make({ artifactId: "archive" })]
  }) }),
    "catalog", "writes-local"),
  op("github-create", O.GitHubReleaseCreateAction.make({ repository: "owner/repo", tag: "v0.1.0",
    title: "v0.1.0", draft: true, prerelease: false, assets: [] }), "publish", "irreversible"),
  op("github-verify", O.GitHubReleaseVerifyAction.make({ repository: "owner/repo", tag: "v0.1.0",
    title: "v0.1.0", draft: true, prerelease: false, assetNames: [] })),
  op("note", O.NoteAction.make({ message: "note", severity: "info", skipped: false }), "publish"),
  op("stage", O.StageAction.make({ intent: Intent.BunCompileIntent.make({ entry: "src/cli.ts",
    target: "linux-x64", compileTarget: "bun-linux-x64", outfile: "dist/tool" }),
  producesArtifactIds: ["executable"] }), "build", "writes-local")
]
const plan = ReleasePlan.make({ schemaVersion: "release-plan/v3",
  identity: makePipelineIdentity(), artifacts, operations,
  notices: [{ pipeId: "test", severity: "info", reason: "planned" }],
  source: SourceMetadata.make({ root: ".", configPath: "release.config.json" }),
  evidenceDirectory: ".release/evidence"
})

describe("release plan", () => {
  test("round-trips every canonical artifact extra and operation action through v3", () => {
    const encoded = Schema.encodeSync(ReleasePlan)(plan)
    const decoded = decodeReleasePlanSync(encoded)
    expect(Schema.encodeSync(ReleasePlan)(decoded)).toEqual(encoded)
    expect(decoded.artifacts.map((artifact) => artifact.extra?._tag)).toEqual([
      "executable", "archive", "checksum-file", "catalog-file", "package", "wheel", "file"
    ])
    expect(decoded.operations.map((operation) => operation.action._tag)).toEqual([
      "command", "check-file", "write-file", "github-release-create", "github-release-verify", "note", "stage"
    ])
    expect(encoded).not.toHaveProperty("state")
    for (const field of ["consumers", "sizeBytes", "downloadUrl", "variant"])
      expect(encoded.artifacts[0]).not.toHaveProperty(field)
  })

  it.effect("uses the same strict v3 Schema for the effect decoder", () =>
    Effect.gen(function*() {
      const decoded = yield* decodeReleasePlan(Schema.encodeSync(ReleasePlan)(plan))
      expect(decoded.schemaVersion).toBe("release-plan/v3")
      expect(decoded.operations).toHaveLength(7)
    }))

  test("rejects v2, excess fields, removed grammar, and unsafe artifact paths", () => {
    const encoded = Schema.encodeSync(ReleasePlan)(plan)
    for (const invalid of [
      { ...encoded, schemaVersion: "release-plan/v2" },
      { ...encoded, legacy: true },
      { ...encoded, operations: [{ ...encoded.operations[0], action: { _tag: "http-check" } }] },
      { ...encoded, artifacts: [{ ...encoded.artifacts[0], kind: "signature" }] },
      ...["../outside", "\\outside"].map((path) => ({
        ...encoded,
        artifacts: [{ ...encoded.artifacts[0], path }, ...encoded.artifacts.slice(1)]
      }))
    ]) expect(() => decodeReleasePlanSync(invalid)).toThrow()
    expect(() => decodeReleasePlanSync({ ...encoded, schemaVersion: "release-plan/v2" }))
      .toThrow(/release-plan\/v3/)
  })
})
