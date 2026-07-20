// Invariant: each archive section is either neutral or platform-grouped, never both, with deterministic group/id order.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { Artifact, artifactPathBaseName, ArchiveExtra, makeArtifact, type InstallableArtifactVariant } from "../../grammar/artifact.js"
import { PlanError } from "../../grammar/errors.js"
import { Operation, StageAction } from "../../grammar/operation.js"
import { ArchiveArtifactEntry, ArchiveFormat, ArchiveIntent } from "../../grammar/intent.js"
import { featureOperation, featurePlanner } from "../../grammar/planner.js"
import { defaultArtifactBaseName, renderArtifactNameEffect } from "../../grammar/template.js"
import { defaulted } from "../../grammar/defaulted.js"

export class ReleaseConfigArchiveFormatOverrides extends Schema.Class<ReleaseConfigArchiveFormatOverrides>(
  "ReleaseConfigArchiveFormatOverrides"
)({
  linux: Schema.optionalKey(Schema.Array(ArchiveFormat)),
  darwin: Schema.optionalKey(Schema.Array(ArchiveFormat)),
  windows: Schema.optionalKey(Schema.Array(ArchiveFormat))
}) {}
export class ReleaseConfigArchive extends Schema.Class<ReleaseConfigArchive>("ReleaseConfigArchive")({
  id: defaulted(Schema.NonEmptyString, "archive"),
  ids: Schema.optionalKey(Schema.Array(Schema.NonEmptyString)),
  nameTemplate: Schema.optionalKey(Schema.NonEmptyString),
  formats: defaulted(Schema.Array(ArchiveFormat), ["tar.gz"]),
  formatOverrides: Schema.optionalKey(ReleaseConfigArchiveFormatOverrides),
  files: defaulted(Schema.Array(Schema.NonEmptyString), [
    "license*", "LICENSE*", "readme*", "README*", "changelog*", "CHANGELOG*"
  ]),
  wrapInDirectory: Schema.optionalKey(Schema.Union([Schema.Boolean, Schema.String]))
}) {}

const platformKey = (platform: InstallableArtifactVariant): string =>
  `${platform.os}-${platform.arch}${platform.libc === "musl" ? "-musl" : ""}`

const platformGroups = (artifacts: ReadonlyArray<Artifact>) => {
  const grouped = new Map<string, { readonly platform: InstallableArtifactVariant; artifacts: Array<Artifact> }>()
  for (const artifact of artifacts) {
    const platform = artifact.platform
    if (platform === undefined) continue
    const key = platformKey(platform)
    const group = grouped.get(key)
    if (group === undefined) grouped.set(key, { platform, artifacts: [artifact] })
    else group.artifacts.push(artifact)
  }
  return [...grouped.values()]
    .map(({ platform, artifacts }) => ({
      platform, artifacts: artifacts.sort((left, right) => left.id.localeCompare(right.id))
    }))
    .sort((left, right) => platformKey(left.platform).localeCompare(platformKey(right.platform)))
}

const entries = (artifacts: ReadonlyArray<Artifact>) => artifacts.map((artifact) =>
  ArchiveArtifactEntry.make({
    artifactId: artifact.id,
    sourcePath: artifact.path,
    archivePath: `${artifact.platform?.binaryName ?? artifactPathBaseName(artifact.path)}${
      artifact.platform?.executableExtension ?? (artifact.extra._tag === "executable" ? artifact.extra.extension : "")
    }`
  }))

export const archivePlanner = featurePlanner<ReadonlyArray<ReleaseConfigArchive>>("archive", (sections, state) => Effect.gen(function*() {
    const artifacts: Array<Artifact> = []
    const operations: Array<Operation> = []
    for (const section of sections) {
      const selected = state.artifacts.filter(({ id }) => section.ids === undefined || section.ids.includes(id))
      const platform = selected.filter((artifact) => artifact.platform !== undefined)
      const neutral = selected.filter((artifact) => artifact.platform === undefined)
      if (platform.length > 0 && neutral.length > 0) return yield* Effect.fail(PlanError.make({
        pipeId: "archive",
        field: `archives.${section.id}`,
        reason: `Archive entry ${section.id} selects both platform and platform-neutral artifacts; split it into two entries.`
      }))
      const isNeutral = platform.length === 0 && (neutral.length > 0 || section.files.length > 0)
      if (isNeutral && section.formatOverrides !== undefined) return yield* Effect.fail(PlanError.make({
        pipeId: "archive",
        field: `archives.${section.id}.formatOverrides`,
        reason: `Archive entry ${section.id} is platform-neutral; formatOverrides only applies to platform archives.`
      }))
      const groups: ReadonlyArray<{
        readonly artifacts: ReadonlyArray<Artifact>
        readonly platform?: InstallableArtifactVariant | undefined
      }> = isNeutral ? [{ artifacts: neutral }] : platformGroups(platform)
      for (const group of groups) {
        const formats = group.platform === undefined
          ? section.formats
          : section.formatOverrides?.[group.platform.os] ?? section.formats
        for (const format of formats) {
          const template = section.nameTemplate ?? (group.platform === undefined
            ? `${state.identity.normalizedName}_{version}`
            : defaultArtifactBaseName(state.identity.normalizedName, {
              ...group.platform, executableExtension: ""
            }))
          const name = yield* renderArtifactNameEffect(template, group.platform === undefined
            ? { identity: state.identity }
            : { identity: state.identity, platform: group.platform, targetTriple: group.platform.targetTriple }, {
            pipeId: "archive", field: `archives.${section.id}.nameTemplate`
          })
          const fileName = `${name}${format === "tar.gz" ? ".tar.gz" : ".zip"}`
          const id = `${section.id}${group.platform === undefined ? "" : `-${platformKey(group.platform)}`}${
            formats.length > 1 ? `-${format.replaceAll(".", "-")}` : ""
          }`
          const path = `.release/artifacts/${fileName}`
          const wrapDirectory = section.wrapInDirectory === true
            ? name
            : typeof section.wrapInDirectory === "string" && section.wrapInDirectory.length > 0
            ? section.wrapInDirectory
            : undefined
          const archiveEntries = entries(group.artifacts)
          artifacts.push(makeArtifact({
            id,
            path,
            producedBy: "archive",
            ...(group.platform === undefined ? {} : { platform: group.platform }),
            extra: ArchiveExtra.make({
              format, wrappedIn: wrapDirectory,
              binaries: archiveEntries.map(({ archivePath }) => archivePath), files: section.files
            })
          }))
          operations.push(featureOperation({
            id: `archive:${id}`,
            phase: "process",
            risk: "writes-local",
            description: `Create ${format} archive ${fileName}.`,
            action: StageAction.make({
              intent: ArchiveIntent.make({
                outfile: path, format, wrapDirectory, artifacts: archiveEntries, files: section.files
              }),
              producesArtifactIds: [id]
            })
          }))
        }
      }
    }
    return { artifacts, operations }
  }))
