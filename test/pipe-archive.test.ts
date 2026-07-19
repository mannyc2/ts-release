import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { makePipelineIdentity, makeTempDirectorySync, releaseConfig, runEffect, stageArtifactOperations } from "./helpers.js"
import { join } from "node:path"
import { describe, expect, it } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { parseReleaseIntent } from "../src/config/load.js"
import { archivePlanner } from "../src/features/archive.js"
import { checksumPlanner } from "../src/features/checksum.js"
import { Artifact, ExecutableExtra } from "../src/grammar/artifact.js"
import type { Operation, StageAction } from "../src/grammar/operation.js"
import { schedule } from "../src/grammar/pipe.js"
import { emptyPlanAccumulator, runPipeline, type PlanAccumulator } from "../src/grammar/runner.js"
import { platformTargetVariant } from "../src/grammar/platform.js"
import { makeArtifactStagerLayer } from "../src/pack/stager.js"
const identity = makePipelineIdentity()
const executable = (id: string, path: string, target: Parameters<typeof platformTargetVariant>[0]) => {
  const platform = platformTargetVariant(target)
  return Artifact.make({
    id, kind: "executable", path, producedBy: "build:bun",
    platform: { ...platform, binaryName: "release" },
    extra: ExecutableExtra.make({ binary: "release", extension: platform.executableExtension ?? "", builderId: "bun" })
  })
}
const linuxMusl = executable("cli-linux-x64-musl", "dist/release-linux-musl", "linux-x64-musl")
const windows = executable("cli-windows-x64", "dist/release.exe", "windows-x64")
const neutral = Artifact.make({ id: "docs", kind: "file", path: "dist/docs.txt", producedBy: "import-artifacts" })
const stateWith = (artifacts: ReadonlyArray<Artifact>) =>
  ({ ...emptyPlanAccumulator(identity), artifacts } satisfies PlanAccumulator)
type StageOperation = Operation & { readonly action: StageAction }
const stageOperations = (operations: ReadonlyArray<Operation>): ReadonlyArray<StageOperation> =>
  operations.filter((operation): operation is StageOperation => operation.action._tag === "stage")
const planArchives = (archives: ReadonlyArray<Record<string, unknown>>, state: PlanAccumulator) =>
  Effect.gen(function*() {
    const intent = yield* parseReleaseIntent(releaseConfig({ artifacts: [], archives }))
    return yield* Option.match(Option.fromUndefinedOr(intent.archives), {
      onNone: () => Effect.die("Expected a resolved archive section."),
      onSome: (section) => archivePlanner(section, state)
    })
  })
describe("archive pipe", () => {
  it.effect("records a skip notice when the archives section is absent", () =>
    Effect.gen(function*() {
      const config = yield* parseReleaseIntent(releaseConfig({ artifacts: [] }))
      const state = yield* runPipeline(emptyPlanAccumulator(identity), [
        schedule(archivePlanner, Option.fromUndefinedOr(config.archives))
      ])
      expect(state.operations).toHaveLength(0)
      expect(state.notices).toEqual([{ pipeId: "archive", severity: "info", reason: "Config section is absent; pipe skipped." }])
    }))
  it.effect("groups executables by platform and renders GoReleaser-style default tarball names", () =>
    Effect.gen(function*() {
      const contribution = yield* planArchives([{}], stateWith([linuxMusl]))
      expect(contribution.artifacts[0]).toMatchObject({
        id: "archive-linux-x64-musl", kind: "archive",
        path: ".release/artifacts/release_0.1.0_linux_amd64_musl.tar.gz",
        extra: { _tag: "archive", format: "tar.gz", binaries: ["release"],
          files: ["license*", "LICENSE*", "readme*", "README*", "changelog*", "CHANGELOG*"] }
      })
      expect(stageOperations(contribution.operations)[0]?.action.intent).toMatchObject({
        _tag: "archive", format: "tar.gz",
        outfile: ".release/artifacts/release_0.1.0_linux_amd64_musl.tar.gz",
        artifacts: [{ artifactId: "cli-linux-x64-musl", sourcePath: "dist/release-linux-musl", archivePath: "release" }]
      })
    }))
  it.effect("uses per-OS format overrides", () =>
    Effect.gen(function*() {
      const contribution = yield* planArchives([{ formatOverrides: { windows: ["zip"] } }], stateWith([windows]))
      expect(contribution.artifacts[0]).toMatchObject({
        id: "archive-windows-x64",
        path: ".release/artifacts/release_0.1.0_windows_amd64.zip",
        extra: { _tag: "archive", format: "zip", binaries: ["release.exe"] }
      })
    }))
  it.effect("rejects traversal introduced by an archive name template", () =>
    Effect.gen(function*() {
      const error = yield* planArchives([{ nameTemplate: "../escape" }], stateWith([linuxMusl]))
        .pipe(Effect.flip)
      expect(error).toMatchObject({ _tag: "PlanError", field: "archives.archive.nameTemplate" })
    }))
  it.effect("plans files-only neutral tar and zip archives without a platform", () =>
    Effect.gen(function*() {
      for (const [section, extension] of [[{ files: ["docs/**"] }, "tar.gz"], [{ files: ["docs/**"], formats: ["zip"] }, "zip"]] as const) {
        const contribution = yield* planArchives([section], stateWith([]))
        expect(contribution.artifacts).toHaveLength(1)
        expect(contribution.artifacts[0]).toMatchObject({
          id: "archive", kind: "archive", path: `.release/artifacts/release_0.1.0.${extension}`,
          extra: { _tag: "archive", format: extension }
        })
        expect(contribution.artifacts[0]).not.toHaveProperty("platform")
        expect(contribution.operations).toEqual([expect.objectContaining({ id: "archive:archive", risk: "writes-local" })])
      }
      const empty = yield* planArchives([{ files: [] }], stateWith([]))
      expect([empty.artifacts, empty.operations]).toEqual([[], []])
    }))
  it.effect("rejects mixed, neutral overrides, and unresolved neutral platform tokens", () =>
    Effect.gen(function*() {
      const cases = [
        [{ id: "mixed", ids: [linuxMusl.id, windows.id, neutral.id], files: [] }, stateWith([linuxMusl, windows, neutral]), "archives.mixed", "split it into two entries"],
        [{ id: "neutral", ids: [neutral.id], files: [], formatOverrides: { linux: ["zip"] } }, stateWith([neutral]), "archives.neutral.formatOverrides", "platform-neutral"],
        [{ id: "neutral", ids: [neutral.id], files: [], nameTemplate: "{name}_{version}_{os}" }, stateWith([neutral]), "archives.neutral.nameTemplate", "{os}"]
      ] as const
      for (const [section, state, field, reason] of cases) {
        const error = yield* planArchives([section], state).pipe(Effect.flip)
        expect(error).toMatchObject({ _tag: "PlanError", field, reason: expect.stringContaining(reason) })
      }
    }))
  it.effect("allows separate platform and neutral entries over the same catalog", () =>
    Effect.gen(function*() {
      const contribution = yield* planArchives([
        { id: "bins", ids: [linuxMusl.id, windows.id], files: [] },
        { id: "docs", ids: [neutral.id], files: [] }
      ], stateWith([linuxMusl, windows, neutral]))
      expect(contribution.artifacts.map(({ id }) => id)).toEqual(["bins-linux-x64-musl", "bins-windows-x64", "docs"])
      expect(contribution.operations).toHaveLength(3)
    }))
  it("stages nested files-only zip archives recursively", async () => {
    const root = makeTempDirectorySync("ts-release-neutral-archive-")
    mkdirSync(join(root, "plugin/skills"), { recursive: true })
    writeFileSync(join(root, "plugin/plugin.json"), '{"name":"release"}\n')
    writeFileSync(join(root, "plugin/skills/SKILL.md"), "# Release skill\n")
    const contribution = await runEffect(
      planArchives([{ files: ["plugin/**"], formats: ["zip"] }], stateWith([])),
      Layer.empty
    )
    const staged = await runEffect(
      stageArtifactOperations(stageOperations(contribution.operations), { root, identity }),
      makeArtifactStagerLayer().pipe(Layer.provideMerge(BunServices.layer))
    )
    expect(staged[0]?.artifacts[0]?.path).toBe(".release/artifacts/release_0.1.0.zip")
    const archive = readFileSync(join(root, ".release/artifacts/release_0.1.0.zip"))
    expect(archive.includes("plugin/plugin.json")).toBe(true)
    expect(archive.includes("plugin/skills/SKILL.md")).toBe(true)
    expect(archive.includes("# Release skill\n")).toBe(true)
  })
  it("stages tar.gz archives with wrapped binaries and quiet default files", async () => {
    const root = makeTempDirectorySync("ts-release-archive-")
    writeFileSync(join(root, "release"), "hello")
    writeFileSync(join(root, "LICENSE"), "license")
    const contribution = await runEffect(planArchives([{ wrapInDirectory: true }],
      stateWith([executable("cli-linux-x64", "release", "linux-x64")])), Layer.empty)
    const staged = await runEffect(
      stageArtifactOperations(stageOperations(contribution.operations), { root, identity }),
      makeArtifactStagerLayer().pipe(Layer.provideMerge(BunServices.layer))
    )
    expect(staged[0]?.artifacts[0]).toMatchObject({ id: "archive-linux-x64",
      path: ".release/artifacts/release_0.1.0_linux_amd64.tar.gz" })
    const bytes = readFileSync(join(root, ".release/artifacts/release_0.1.0_linux_amd64.tar.gz"))
    expect(bytes[0]).toBe(0x1f)
    expect(bytes[1]).toBe(0x8b)
  })
  it.effect("lets checksum cover generated archives when both sections are present", () =>
    Effect.gen(function*() {
      const config = yield* parseReleaseIntent(releaseConfig({ artifacts: [], archives: [{}], checksum: {} }))
      const state = yield* runPipeline(stateWith([linuxMusl]), [
        schedule(archivePlanner, Option.fromUndefinedOr(config.archives)),
        schedule(checksumPlanner, Option.fromUndefinedOr(config.checksum))
      ])
      const checksum = state.artifacts.find((artifact) => artifact.kind === "checksum-file")
      expect(checksum?.extra).toMatchObject({ _tag: "checksum-file",
        coversArtifactIds: ["archive-linux-x64-musl", "cli-linux-x64-musl"] })
    }))
})
