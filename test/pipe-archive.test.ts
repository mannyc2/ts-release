import { readFileSync, writeFileSync } from "node:fs"
import { makeTempDirectorySync, makePipelineIdentity } from "./helpers.js"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { parseReleaseIntent } from "../src/config/load.js"
import { archivePipe } from "../src/pipes/archive.js"
import { checksumPipe } from "../src/pipes/checksum.js"
import { stageArtifactOperations } from "../src/engine/stager.js"
import { Artifact, ExecutableExtra } from "../src/pipeline/artifact.js"
import { ArtifactCatalog } from "../src/pipeline/catalog.js"
import type { Operation, StageAction } from "../src/pipeline/operation.js"
import { runPipeline } from "../src/pipeline/runner.js"
import { platformTargetVariant } from "../src/pipeline/platform.js"
import { emptyReleaseState, ReleaseState } from "../src/pipeline/state.js"
import { LiveArtifactStagerLayer } from "../src/engine/stager.js"
import { runEffect } from "./helpers.js"

const identity = makePipelineIdentity()

const executable = (
  id: string,
  path: string,
  target: Parameters<typeof platformTargetVariant>[0],
  binaryName = "release"
) => {
  const platform = platformTargetVariant(target)
  return Artifact.make({
    id,
    kind: "executable",
    path,
    producedBy: "build:bun",
    platform: {
      ...platform,
      binaryName
    },
    extra: ExecutableExtra.make({
      binary: binaryName,
      extension: platform.executableExtension ?? "",
      builderId: "bun"
    })
  })
}

const linuxMusl = executable("cli-linux-x64-musl", "dist/release-linux-musl", "linux-x64-musl")
const windows = executable("cli-windows-x64", "dist/release.exe", "windows-x64")

const stateWith = (artifacts: ReadonlyArray<Artifact>) =>
  ReleaseState.make({
    ...emptyReleaseState(identity),
    artifacts: ArtifactCatalog.make({ artifacts })
  })

type StageOperation = Operation & { readonly action: StageAction }

const stageOperations = (operations: ReadonlyArray<Operation>): ReadonlyArray<StageOperation> =>
  operations.filter((operation): operation is StageOperation => operation.action._tag === "stage")

describe("archive pipe", () => {
  it.effect("records a skip notice when the archives section is absent", () =>
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

      const state = yield* runPipeline(emptyReleaseState(identity), config, [archivePipe])

      expect(state.operations).toHaveLength(0)
      expect(state.notices).toEqual([
        {
          pipeId: "archive",
          severity: "info",
          reason: "Config section is absent; pipe skipped."
        }
      ])
    }))

  it.effect("groups executables by platform and renders GoReleaser-style default tarball names", () =>
    Effect.gen(function*() {
      const config = yield* parseReleaseIntent(JSON.stringify({
        project: {
          name: "release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
        archives: [{}],
        publish: {}
      }))
      const section = archivePipe.section(config)
      expect(section).toBeDefined()
      if (section === undefined) {
        return
      }

      const contribution = yield* archivePipe.plan(section, stateWith([linuxMusl]))

      expect(contribution.artifacts[0]).toMatchObject({
        id: "archive-linux-x64-musl",
        kind: "archive",
        path: ".release/artifacts/release_0.1.0_linux_amd64_musl.tar.gz",
        extra: {
          _tag: "archive",
          format: "tar.gz",
          binaries: ["release"],
          files: ["license*", "LICENSE*", "readme*", "README*", "changelog*", "CHANGELOG*"]
        }
      })
      expect(stageOperations(contribution.operations)[0]?.action.intent).toMatchObject({
        _tag: "archive",
        outfile: ".release/artifacts/release_0.1.0_linux_amd64_musl.tar.gz",
        format: "tar.gz",
        artifacts: [
          {
            artifactId: "cli-linux-x64-musl",
            sourcePath: "dist/release-linux-musl",
            archivePath: "release"
          }
        ]
      })
    }))

  it.effect("uses per-OS format overrides", () =>
    Effect.gen(function*() {
      const config = yield* parseReleaseIntent(JSON.stringify({
        project: {
          name: "release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
        archives: [
          {
            formatOverrides: {
              windows: ["zip"]
            }
          }
        ],
        publish: {}
      }))
      const section = archivePipe.section(config)
      expect(section).toBeDefined()
      if (section === undefined) {
        return
      }

      const contribution = yield* archivePipe.plan(section, stateWith([windows]))

      expect(contribution.artifacts[0]).toMatchObject({
        id: "archive-windows-x64",
        path: ".release/artifacts/release_0.1.0_windows_amd64.zip",
        extra: {
          _tag: "archive",
          format: "zip",
          binaries: ["release.exe"]
        }
      })
    }))

  it("stages tar.gz archives with wrapped binaries and quiet default files", async () => {
    const root = makeTempDirectorySync("ts-release-archive-")
    writeFileSync(join(root, "release"), "hello")
    writeFileSync(join(root, "LICENSE"), "license")
    const config = await runEffect(
      parseReleaseIntent(JSON.stringify({
        project: {
          name: "release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
        archives: [{ wrapInDirectory: true }],
        publish: {}
      })),
      Layer.empty
    )
    const section = archivePipe.section(config)
    expect(section).toBeDefined()
    if (section === undefined) {
      return
    }
    const contribution = await runEffect(archivePipe.plan(section, stateWith([
      executable("cli-linux-x64", "release", "linux-x64")
    ])), Layer.empty)
    const staged = await runEffect(
      stageArtifactOperations(stageOperations(contribution.operations), { root, identity }),
      Layer.mergeAll(BunServices.layer, LiveArtifactStagerLayer)
    )

    expect(staged[0]?.artifacts[0]).toMatchObject({
      id: "archive-linux-x64",
      path: ".release/artifacts/release_0.1.0_linux_amd64.tar.gz"
    })
    const bytes = readFileSync(join(root, ".release/artifacts/release_0.1.0_linux_amd64.tar.gz"))
    expect(bytes[0]).toBe(0x1f)
    expect(bytes[1]).toBe(0x8b)
  })

  it.effect("lets checksum cover generated archives when both sections are present", () =>
    Effect.gen(function*() {
      const config = yield* parseReleaseIntent(JSON.stringify({
        project: {
          name: "release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
        archives: [{}],
        checksum: {},
        publish: {}
      }))

      const state = yield* runPipeline(stateWith([linuxMusl]), config, [archivePipe, checksumPipe])
      const checksum = state.artifacts.artifacts.find((artifact) => artifact.kind === "checksum-file")

      expect(checksum?.extra).toMatchObject({
        _tag: "checksum-file",
        coversArtifactIds: ["archive-linux-x64-musl", "cli-linux-x64-musl"]
      })
    }))
})
