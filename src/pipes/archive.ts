import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import {
  Artifact,
  artifactPathBaseName,
  ArchiveExtra,
  type InstallableArtifactVariant
} from "../pipeline/artifact.js"
import { PlanError } from "../pipeline/errors.js"
import {
  ArchiveArtifactEntry,
  ArchiveFormat,
  ArchiveIntent,
  Operation,
  StageAction
} from "../pipeline/operation.js"
import type { FeaturePlanner } from "../pipeline/pipe.js"
import { emptyContribution } from "../pipeline/pipe.js"
import { distributionArchToken, renderArtifactNameEffect } from "../pipeline/template.js"

export class ReleaseConfigArchiveFormatOverrides extends Schema.Class<ReleaseConfigArchiveFormatOverrides>(
  "ReleaseConfigArchiveFormatOverrides"
)({
  linux: Schema.optionalKey(Schema.Array(ArchiveFormat)),
  darwin: Schema.optionalKey(Schema.Array(ArchiveFormat)),
  windows: Schema.optionalKey(Schema.Array(ArchiveFormat))
}) {}

export class ReleaseConfigArchive extends Schema.Class<ReleaseConfigArchive>("ReleaseConfigArchive")({
  id: Schema.optionalKey(Schema.NonEmptyString),
  ids: Schema.optionalKey(Schema.Array(Schema.NonEmptyString)),
  nameTemplate: Schema.optionalKey(Schema.NonEmptyString),
  formats: Schema.optionalKey(Schema.Array(ArchiveFormat)),
  formatOverrides: Schema.optionalKey(ReleaseConfigArchiveFormatOverrides),
  files: Schema.optionalKey(Schema.Array(Schema.NonEmptyString)),
  wrapInDirectory: Schema.optionalKey(Schema.Union([Schema.Boolean, Schema.String]))
}) {}

const defaultFormats: ReadonlyArray<ArchiveFormat> = ["tar.gz"]
const defaultFileGlobs = ["license*", "LICENSE*", "readme*", "README*", "changelog*", "CHANGELOG*"]

export interface ResolvedArchive {
  readonly id: string
  readonly ids?: ReadonlyArray<string>
  readonly nameTemplate?: string
  readonly formats: ReadonlyArray<ArchiveFormat>
  readonly formatOverrides?: ReleaseConfigArchiveFormatOverrides
  readonly files: ReadonlyArray<string>
  readonly wrapInDirectory?: boolean | string
}

export const resolveArchives = (
  raw: ReadonlyArray<ReleaseConfigArchive> | undefined
): Option.Option<ReadonlyArray<ResolvedArchive>> =>
  raw === undefined
    ? Option.none()
    : Option.some(raw.map((archive) => ({
      ...archive,
      id: archive.id ?? "archive",
      formats: archive.formats ?? defaultFormats,
      files: archive.files ?? defaultFileGlobs
    })))

const platformKey = (platform: InstallableArtifactVariant): string =>
  `${platform.os}-${platform.arch}${platform.libc === "musl" ? "-musl" : ""}`

const archiveBaseName = (
  name: string,
  platform: InstallableArtifactVariant
): string => {
  const libcSuffix = platform.libc === "musl" ? "_musl" : ""
  return `${name}_{version}_${platform.os}_${distributionArchToken(platform.arch)}${libcSuffix}`
}

const formatExtension = (format: ArchiveFormat): string =>
  format === "tar.gz" ? ".tar.gz" : ".zip"

const formatId = (format: ArchiveFormat): string =>
  format.replaceAll(".", "-")

const groupedByPlatform = (artifacts: ReadonlyArray<Artifact>): ReadonlyArray<{
  readonly platform: InstallableArtifactVariant
  readonly artifacts: ReadonlyArray<Artifact>
}> => {
  const groups = new Map<string, { readonly platform: InstallableArtifactVariant; readonly artifacts: Array<Artifact> }>()
  for (const artifact of artifacts) {
    const platform = artifact.platform
    if (platform === undefined) {
      continue
    }
    const key = platformKey(platform)
    const group = groups.get(key)
    if (group === undefined) {
      groups.set(key, { platform, artifacts: [artifact] })
    } else {
      group.artifacts.push(artifact)
    }
  }
  return [...groups.values()]
    .map((group) => ({
      platform: group.platform,
      artifacts: [...group.artifacts].sort((left, right) => left.id.localeCompare(right.id))
    }))
    .sort((left, right) => platformKey(left.platform).localeCompare(platformKey(right.platform)))
}

const formatsForPlatform = (
  section: ResolvedArchive,
  platform: InstallableArtifactVariant
): ReadonlyArray<ArchiveFormat> =>
  section.formatOverrides?.[platform.os] ?? section.formats

const wrappedDirectory = (
  wrapInDirectory: boolean | string | undefined,
  archiveName: string
): string | undefined =>
  wrapInDirectory === true
    ? archiveName
    : typeof wrapInDirectory === "string" && wrapInDirectory.length > 0
    ? wrapInDirectory
    : undefined

const archivePathForArtifact = (artifact: Artifact): string => {
  const extension = artifact.platform?.executableExtension ??
    (artifact.extra?._tag === "executable" ? artifact.extra.extension : "")
  return `${artifact.platform?.binaryName ?? artifactPathBaseName(artifact.path)}${extension}`
}

const archiveArtifactEntries = (artifacts: ReadonlyArray<Artifact>): ReadonlyArray<ArchiveArtifactEntry> =>
  artifacts.map((artifact) =>
    ArchiveArtifactEntry.make({
      artifactId: artifact.id,
      sourcePath: artifact.path,
      archivePath: archivePathForArtifact(artifact)
    })
  )

export const archivePlanner: FeaturePlanner<ReadonlyArray<ResolvedArchive>> = {
  id: "archive",
  plan: (sections, state) =>
    Effect.gen(function*() {
      const artifacts: Array<Artifact> = []
      const operations: Array<Operation> = []
      for (const section of sections) {
        const archiveId = section.id
        const selected = state.artifacts.filter((artifact) => section.ids === undefined || section.ids.includes(artifact.id))
        const platformArtifacts = selected.filter((artifact) => artifact.platform !== undefined)
        const neutralArtifacts = selected.filter((artifact) => artifact.platform === undefined)
        if (platformArtifacts.length > 0 && neutralArtifacts.length > 0) {
          return yield* Effect.fail(PlanError.make({ pipeId: "archive", field: `archives.${archiveId}`,
            reason: `Archive entry ${archiveId} selects both platform and platform-neutral artifacts; split it into two entries.` }))
        }
        const neutral = platformArtifacts.length === 0 && (neutralArtifacts.length > 0 || section.files.length > 0)
        if (neutral && section.formatOverrides !== undefined) {
          return yield* Effect.fail(PlanError.make({ pipeId: "archive", field: `archives.${archiveId}.formatOverrides`,
            reason: `Archive entry ${archiveId} is platform-neutral; formatOverrides only applies to platform archives.` }))
        }
        const groups = neutral
          ? [{ artifacts: neutralArtifacts }]
          : groupedByPlatform(platformArtifacts)
        for (const group of groups) {
          const platform = "platform" in group ? group.platform : undefined
          const formats = platform === undefined ? section.formats : formatsForPlatform(section, platform)
          for (const format of formats) {
            const archiveNameTemplate = section.nameTemplate ?? (platform === undefined
              ? `${state.identity.normalizedName}_{version}`
              : archiveBaseName(state.identity.normalizedName, platform))
            const archiveName = yield* renderArtifactNameEffect(archiveNameTemplate,
              platform === undefined
                ? { identity: state.identity }
                : { identity: state.identity, platform, targetTriple: platform.targetTriple },
              { pipeId: "archive", field: `archives.${archiveId}.nameTemplate` }
            )
            const fileName = `${archiveName}${formatExtension(format)}`
            const id = `${archiveId}${platform === undefined ? "" : `-${platformKey(platform)}`}${formats.length > 1 ? `-${formatId(format)}` : ""}`
            const path = `.release/artifacts/${fileName}`
            const wrapDirectory = wrappedDirectory(section.wrapInDirectory, archiveName)
            const archiveEntries = archiveArtifactEntries(group.artifacts)
            const files = section.files
            artifacts.push(Artifact.make({
              id,
              kind: "archive",
              path,
              producedBy: "archive",
              ...(platform === undefined ? {} : { platform }),
              extra: ArchiveExtra.make({
                format,
                wrappedIn: wrapDirectory,
                binaries: archiveEntries.map((entry) => entry.archivePath),
                files
              })
            }))
            operations.push(Operation.make({
              id: `archive:${id}`,
              pipeId: "archive",
              phase: "process",
              risk: "writes-local",
              description: `Create ${format} archive ${fileName}.`,
              action: StageAction.make({
                intent: ArchiveIntent.make({
                  outfile: path,
                  format,
                  wrapDirectory,
                  artifacts: archiveEntries,
                  files
                }),
                producesArtifactIds: [id]
              })
            }))
          }
        }
      }
      return {
        ...emptyContribution,
        artifacts,
        operations
      }
    })
}
