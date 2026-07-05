import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { parseReleaseIntent } from "../src/config/load.js"
import { runOperations } from "../src/engine/executor.js"
import { makeTestReleaseHttpLayer } from "./host-fakes.js"
import { CommandResult } from "../src/host/host.js"
import { ReleaseCommandRunnerTestLayer } from "./host-fakes.js"
import { UnsupportedArtifactStagerLayer } from "../src/engine/stager.js"
import { checksumPipe } from "../src/pipes/checksum.js"
import { Artifact } from "../src/pipeline/artifact.js"
import { ArtifactCatalog } from "../src/pipeline/catalog.js"
import { ChecksumFileContent, ExecutionApproval, Operation, WriteFileAction } from "../src/pipeline/operation.js"
import { runPipeline } from "../src/pipeline/runner.js"
import { emptyReleaseState, ReleaseIdentity, ReleaseState } from "../src/pipeline/state.js"
import { makeTestCommandRunnerLayer } from "./host-fakes.js"
import { releaseConfig, releaseIdentity, runEffect, TestGitHubApiLayer } from "./helpers.js"
import { createTestPlan } from "./plan-helpers.js"

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

const artifact = Artifact.make({
  id: "cli-linux-x64",
  kind: "executable",
  path: "dist/release",
  producedBy: "build:bun"
})

const stateWithArtifact = ReleaseState.make({
  ...emptyReleaseState(identity),
  artifacts: ArtifactCatalog.make({ artifacts: [artifact] })
})

const sha256 = (input: string): string =>
  createHash("sha256").update(input).digest("hex")

const ExecutorLayer = Layer.mergeAll(
  BunServices.layer,
  makeTestReleaseHttpLayer(),
  TestGitHubApiLayer,
  UnsupportedArtifactStagerLayer,
  ReleaseCommandRunnerTestLayer({
    runCommand: (command) =>
      Effect.succeed(CommandResult.make({
        command,
        exitCode: 0,
        stdout: "",
        stderr: "",
        startedAt: "2026-07-05T00:00:00.000Z",
        endedAt: "2026-07-05T00:00:00.000Z",
        durationMillis: 0
      }))
  })
)

describe("checksum pipe", () => {
  it.effect("records a skip notice when the checksum section is absent", () =>
    Effect.gen(function*() {
      const config = yield* parseReleaseIntent(JSON.stringify({
        project: {
          name: "release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
        publish: {}
      }))

      const state = yield* runPipeline(emptyReleaseState(identity), config, [checksumPipe])

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
      const config = yield* parseReleaseIntent(JSON.stringify({
        project: {
          name: "release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
        checksum: {},
        publish: {}
      }))
      const section = checksumPipe.section(config)
      expect(section).toBeDefined()
      if (section === undefined) {
        return
      }

      const defaulted = checksumPipe.defaults?.(section, identity) ?? section
      const contribution = yield* checksumPipe.plan(defaulted, stateWithArtifact)

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
            _tag: "checksum-file",
            algorithm: "sha256",
            entries: [{ artifactId: "cli-linux-x64", baseName: "release" }]
          }
        }
      })
    }))

  it("renders checksum files with sha256sum-compatible two-space lines", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-checksum-"))
    writeFileSync(join(root, "release"), "hello")
    const operation = Operation.make({
      id: "checksum:write",
      pipeId: "checksum",
      phase: "process",
      risk: "writes-local",
      description: "Write checksum file.",
      action: WriteFileAction.make({
        path: "checksums.txt",
        contents: ChecksumFileContent.make({
          algorithm: "sha256",
          entries: [{ artifactId: "cli", baseName: "release" }]
        })
      })
    })

    await runEffect(
      runOperations(
        [operation],
        ExecutionApproval.make({ execute: true, approveIrreversible: false }),
        {
          root,
          identity,
          artifacts: ArtifactCatalog.make({
            artifacts: [
              Artifact.make({
                id: "cli",
                kind: "executable",
                path: "release",
                producedBy: "build:bun"
              })
            ]
          })
        }
      ),
      ExecutorLayer
    )

    expect(readFileSync(join(root, "checksums.txt"), "utf8")).toBe(`${sha256("hello")}  release\n`)
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
