import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import {
  makePipelineIdentity,
  makeTempDirectorySync,
  releaseConfig,
  releaseIdentity,
  runEffect,
  TestGitHubApiLayer
} from "./helpers.js"
import { join } from "node:path"
import { describe, expect, it } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { parseReleaseIntent } from "../src/config/load.js"
import { runOperations } from "../src/engine/executor.js"
import type { CommandResult } from "../src/host/host.js"
import { UnsupportedArtifactStagerLayer } from "../src/engine/stager.js"
import { checksumPlanner, resolveChecksum } from "../src/pipes/checksum.js"
import { Artifact, ChecksumFileExtra, ImportedFileExtra, PackageExtra } from "../src/pipeline/artifact.js"
import { ExecutionApproval, FilePartsContent, Operation, Sha256Hole, WriteFileAction } from "../src/pipeline/operation.js"
import { schedule } from "../src/pipeline/pipe.js"
import { emptyPlanAccumulator, runPipeline, type PlanAccumulator } from "../src/pipeline/runner.js"
import {
  makeTestCommandRunnerLayer,
  makeTestReleaseHttpLayer,
  ReleaseCommandRunnerTestLayer
} from "./host-fakes.js"
import { createTestPlan } from "./plan-helpers.js"
const identity = makePipelineIdentity()
const artifact = Artifact.make({
  id: "cli-linux-x64",
  kind: "executable",
  path: "dist/release",
  producedBy: "build:bun"
})
const stateWithArtifact = {
  ...emptyPlanAccumulator(identity),
  artifacts: [artifact]
} satisfies PlanAccumulator
const checksumFilterArtifacts = [
  Artifact.make({ id: "catalog", kind: "catalog-file", path: "out/e-catalog.rb", producedBy: "catalog-homebrew" }),
  Artifact.make({ id: "package", kind: "package", path: "package-dir", producedBy: "build:npm-pack",
    extra: PackageExtra.make({ packageManager: "npm", packageName: "release" }) }),
  Artifact.make({ id: "wheel", kind: "wheel", path: "out/d-wheel.whl", producedBy: "build:pypi-wheel" }),
  Artifact.make({ id: "executable", kind: "executable", path: "out/b-executable", producedBy: "build:bun" }),
  Artifact.make({ id: "archive", kind: "archive", path: "out/c-archive.tgz", producedBy: "archive" }),
  Artifact.make({ id: "file", kind: "file", path: "out/a-file", producedBy: "import-artifacts",
    extra: ImportedFileExtra.make({ format: "file" }) }),
  Artifact.make({ id: "directory", kind: "file", path: "import-dir", producedBy: "import-artifacts",
    extra: ImportedFileExtra.make({ format: "directory" }) }),
  Artifact.make({ id: "existing-checksum", kind: "checksum-file", path: "out/f-checksums", producedBy: "other" })
]
const expectedChecksumEntries = [
  { artifactId: "file", baseName: "a-file" },
  { artifactId: "executable", baseName: "b-executable" },
  { artifactId: "archive", baseName: "c-archive.tgz" },
  { artifactId: "wheel", baseName: "d-wheel.whl" },
  { artifactId: "catalog", baseName: "e-catalog.rb" }
]
const digest = (input: string, algorithm: "sha256" | "sha512"): string =>
  createHash(algorithm).update(input).digest("hex")
const ExecutorLayer = Layer.mergeAll(
  BunServices.layer,
  makeTestReleaseHttpLayer(),
  TestGitHubApiLayer,
  UnsupportedArtifactStagerLayer,
  ReleaseCommandRunnerTestLayer({
    runCommand: (command) =>
      Effect.succeed({
        command,
        exitCode: 0,
        stdout: "",
        stderr: "",
        startedAt: "2026-07-05T00:00:00.000Z",
        endedAt: "2026-07-05T00:00:00.000Z",
        durationMillis: 0
      } satisfies CommandResult)
  })
)
describe("checksum pipe", () => {
  it.effect("records a skip notice when the checksum section is absent", () =>
    Effect.gen(function*() {
      const config = yield* parseReleaseIntent(releaseConfig({ artifacts: [] }))
      const state = yield* runPipeline(emptyPlanAccumulator(identity), [
        schedule(checksumPlanner, resolveChecksum(config.checksum))
      ])
      expect(state.operations).toHaveLength(0)
      expect(state.notices).toEqual([
        {
          pipeId: "checksum",
          severity: "info",
          reason: "Config section is absent; pipe skipped."
        }
      ])
    }))
  it.effect("plans the default checksum artifact and deferred write operation", () =>
    Effect.gen(function*() {
      const config = yield* parseReleaseIntent(releaseConfig({
        artifacts: [],
        checksum: {},
      }))
      const contribution = yield* Option.match(resolveChecksum(config.checksum), {
        onNone: () => Effect.die("Expected a resolved checksum section."),
        onSome: (section) => checksumPlanner.plan(section, stateWithArtifact)
      })
      expect(contribution.artifacts[0]).toMatchObject({
        id: "checksum",
        kind: "checksum-file",
        path: ".release/artifacts/release_0.1.0_checksums.txt",
        producedBy: "checksum",
        extra: {
          _tag: "checksum-file",
          algorithm: "sha256",
          coversArtifactIds: ["cli-linux-x64"]
        }
      })
      expect(contribution.operations[0]).toMatchObject({
        id: "checksum:write",
        pipeId: "checksum",
        phase: "process",
        risk: "writes-local",
        action: {
          _tag: "write-file",
          path: ".release/artifacts/release_0.1.0_checksums.txt",
          contents: {
            _tag: "file-parts",
            parts: [{ artifactId: "cli-linux-x64" }, "  release\n"]
          }
        }
      })
    }))
  it.effect("excludes directory inputs while preserving eligible file-like order", () =>
    Effect.gen(function*() {
      const contribution = yield* checksumPlanner.plan(
        { algorithm: "sha256", nameTemplate: "checksums.txt" },
        { ...emptyPlanAccumulator(identity), artifacts: checksumFilterArtifacts }
      )
      expect(contribution.artifacts[0]?.extra).toMatchObject({
        _tag: "checksum-file",
        coversArtifactIds: expectedChecksumEntries.map((entry) => entry.artifactId)
      })
      expect(contribution.operations[0]?.action).toMatchObject({
        _tag: "write-file", contents: {
          _tag: "file-parts",
          parts: expectedChecksumEntries.flatMap((entry) => [
            { artifactId: entry.artifactId },
            `  ${entry.baseName}\n`
          ])
        }
      })
    }))
  it.effect("never reads package or imported directory paths for deferred checksums", () =>
    Effect.gen(function*() {
      const contribution = yield* checksumPlanner.plan(
        { algorithm: "sha256", nameTemplate: "checksums.txt" },
        { ...emptyPlanAccumulator(identity), artifacts: checksumFilterArtifacts }
      )
      const evidence = yield* runOperations(
        contribution.operations,
        ExecutionApproval.make({ execute: true, approveIrreversible: false }),
        { root: ".", identity, artifacts: checksumFilterArtifacts }
      ).pipe(Effect.provide(Layer.mergeAll(
        makeTestCommandRunnerLayer({
          files: new Map(expectedChecksumEntries.map((entry) => [`out/${entry.baseName}`, "hello"])),
          directories: new Set(["package-dir", "import-dir"])
        }),
        makeTestReleaseHttpLayer(),
        TestGitHubApiLayer,
        UnsupportedArtifactStagerLayer
      )))
      expect(evidence.records).toMatchObject([{ operationId: "checksum:write", status: "passed" }])
    }))
  it.effect("rejects traversal introduced by a checksum name template", () =>
    Effect.gen(function*() {
      const config = yield* parseReleaseIntent(releaseConfig({
        artifacts: [], checksum: { nameTemplate: "../escape" }
      }))
      const error = yield* Option.match(resolveChecksum(config.checksum), {
        onNone: () => Effect.die("Expected a resolved checksum section."),
        onSome: (section) => checksumPlanner.plan(section, stateWithArtifact)
      }).pipe(Effect.flip)
      expect(error).toMatchObject({ _tag: "PlanError", field: "checksum.nameTemplate" })
    }))
  it("preserves sha256/sha512 checksum bytes and resolvedValues evidence", async () => {
    const root = makeTempDirectorySync("ts-release-checksum-")
    writeFileSync(join(root, "release"), "hello")
    const input = Artifact.make({ id: "cli", kind: "executable", path: "release", producedBy: "build:bun" })
    for (const algorithm of ["sha256", "sha512"] as const) {
      const outputPath = `${algorithm}.txt`
      const output = Artifact.make({ id: `${algorithm}-checksums`, kind: "checksum-file",
        path: outputPath, producedBy: "checksum", extra: ChecksumFileExtra.make({
          algorithm, coversArtifactIds: ["cli"]
        }) })
      const operation = Operation.make({ id: `checksum:${algorithm}`, pipeId: "checksum", phase: "process",
        risk: "writes-local", description: "Write checksum file.", action: WriteFileAction.make({
          path: outputPath,
          contents: FilePartsContent.make({ parts: [
            Sha256Hole.make({ artifactId: "cli" }), "  release\n"
          ] })
        }) })
      const evidence = await runEffect(runOperations(
        [operation],
        ExecutionApproval.make({ execute: true, approveIrreversible: false }),
        { root, identity, artifacts: [input, output] }
      ), ExecutorLayer)
      const value = digest("hello", algorithm)
      expect(readFileSync(join(root, outputPath), "utf8")).toBe(`${value}  release\n`)
      expect(evidence.records[0]?.outcome).toMatchObject({ resolvedValues: [
        { artifactId: "cli", algorithm, value }
      ] })
    }
  })
  it("lets GitHub release assets include generated checksum files", async () => {
    const config = releaseConfig({
      identity: releaseIdentity(),
      artifacts: [
        {
          id: "cli",
          path: "artifacts/release",
          format: "executable"
        }
      ],
      checksum: {},
      publish: {
        github: {
          repository: "owner/repo",
          tokenEnv: "GH_TOKEN",
          draft: true,
          prerelease: false
        }
      }
    })
    const plan = await runEffect(
      createTestPlan(config),
      makeTestCommandRunnerLayer({
        files: new Map([["artifacts/release", "hello"]]),
        env: new Map([["GH_TOKEN", "secret"]])
      })
    )
    const publish = plan.operations.find((operation) => operation.id === "github:github-release-create")
    expect(publish?.action._tag).toBe("github-release-create")
    if (publish?.action._tag === "github-release-create") {
      expect(publish.action.assets.map((asset) => asset.name)).toContain("release_0.1.0_checksums.txt")
    }
  })
})
