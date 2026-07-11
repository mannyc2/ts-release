import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  Artifact,
  artifactPathBaseName,
  ArchiveExtra,
  type InstallableArtifactVariant
} from "../pipeline/artifact.js"
import {
  ArchiveArtifactEntry,
  ArchiveFormat,
  ArchiveIntent,
  Operation,
  StageAction
} from "../pipeline/operation.js"
import type { Pipe } from "../pipeline/pipe.js"
import { emptyContribution } from "../pipeline/pipe.js"
import { distributionArchToken, renderTemplate } from "../pipeline/template.js"

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

type ArchiveSection = ReadonlyArray<ReleaseConfigArchive>

const defaultFormats: ReadonlyArray<ArchiveFormat> = ["tar.gz"]
const defaultFileGlobs = ["license*", "LICENSE*", "readme*", "README*", "changelog*", "CHANGELOG*"]

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

const executableArtifacts = (
  artifacts: ReadonlyArray<Artifact>,
  ids: ReadonlyArray<string> | undefined
): ReadonlyArray<Artifact> =>
  artifacts.filter((artifact) =>
    artifact.kind === "executable" &&
    artifact.platform !== undefined &&
    (ids === undefined || ids.includes(artifact.id))
  )

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
  section: ReleaseConfigArchive,
  platform: InstallableArtifactVariant
): ReadonlyArray<ArchiveFormat> =>
  section.formatOverrides?.[platform.os] ?? section.formats ?? defaultFormats

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

export const archivePipe: Pipe<ArchiveSection> = {
  id: "archive",
  phase: "process",
  section: (config) => config.archives,
  plan: (sections, state) =>
    Effect.sync(() => {
      const artifacts: Array<Artifact> = []
      const operations: Array<Operation> = []
      for (const section of sections) {
        const archiveId = section.id ?? "archive"
        for (const group of groupedByPlatform(executableArtifacts(state.artifacts.artifacts, section.ids))) {
          const formats = formatsForPlatform(section, group.platform)
          for (const format of formats) {
            const archiveNameTemplate = section.nameTemplate ?? archiveBaseName(state.identity.normalizedName, group.platform)
            const archiveName = renderTemplate(archiveNameTemplate, {
              identity: state.identity,
              platform: group.platform,
              targetTriple: group.platform.targetTriple
            })
            const fileName = `${archiveName}${formatExtension(format)}`
            const id = `${archiveId}-${platformKey(group.platform)}${formats.length > 1 ? `-${formatId(format)}` : ""}`
            const path = `.release/artifacts/${fileName}`
            const wrapDirectory = wrappedDirectory(section.wrapInDirectory, archiveName)
            const archiveEntries = archiveArtifactEntries(group.artifacts)
            const files = section.files ?? defaultFileGlobs
            artifacts.push(Artifact.make({
              id,
              kind: "archive",
              path,
              producedBy: "archive",
              platform: group.platform,
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
