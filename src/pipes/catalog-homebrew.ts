import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  Artifact,
  artifactPathBaseName,
  CatalogFileExtra,
  SafeRelativePath
} from "../pipeline/artifact.js"
import { PlanError } from "../pipeline/errors.js"
import {
  HomebrewFormulaContent,
  HomebrewFormulaEntry,
  Operation,
  WriteFileAction
} from "../pipeline/operation.js"
import {
  catalogPathBaseName
} from "../pipeline/operation-helpers.js"
import { optionalField } from "../pipeline/optional-field.js"
import type { Pipe } from "../pipeline/pipe.js"
import { emptyContribution } from "../pipeline/pipe.js"
import type { ReleaseIdentity } from "../pipeline/state.js"

export class ReleaseConfigHomebrewPublish extends Schema.Class<ReleaseConfigHomebrewPublish>(
  "ReleaseConfigHomebrewPublish"
)({
  repository: Schema.String,
  formulaName: Schema.optionalKey(Schema.String),
  formulaPath: Schema.optionalKey(SafeRelativePath),
  artifactId: Schema.optionalKey(Schema.String),
  artifactIds: Schema.optionalKey(Schema.Array(Schema.String)),
  homepage: Schema.optionalKey(Schema.String),
  description: Schema.optionalKey(Schema.String),
  url: Schema.optionalKey(Schema.String),
  tapDirectory: Schema.optionalKey(SafeRelativePath),
  installPath: Schema.optionalKey(Schema.String),
  tokenEnv: Schema.optionalKey(Schema.String)
}) {}

export interface HomebrewSection {
  readonly repository: string
  readonly formulaName?: string | undefined
  readonly formulaPath?: string | undefined
  readonly artifactIds?: ReadonlyArray<string> | undefined
  readonly homepage?: string | undefined
  readonly description?: string | undefined
  readonly url?: string | undefined
  readonly tapDirectory?: string | undefined
  readonly installPath?: string | undefined
  readonly tokenEnv?: string | undefined
  readonly githubRepository?: string | undefined
}

const compactPackageShortName = (packageName: string): string => {
  const withoutScope = packageName.includes("/") ? packageName.split("/").at(-1) ?? packageName : packageName
  const normalized = withoutScope.replace(/^@/, "").replace(/[^A-Za-z0-9-]+/g, "-")
  return normalized.length === 0 ? "release" : normalized
}

const projectPackageName = (project: {
  readonly name?: string | undefined
  readonly package?: string | undefined
  readonly packageName?: string | undefined
}): string | undefined =>
  project.packageName ?? project.package ?? project.name

const githubRepository = (config: {
  readonly project: { readonly repository?: string | undefined }
  readonly publish: { readonly github?: boolean | { readonly repository?: string | undefined } | undefined }
}): string | undefined => {
  const github = config.publish.github
  if (github === undefined || github === false) {
    return undefined
  }
  return github === true ? config.project.repository : github.repository ?? config.project.repository
}

export const homebrewSectionFromConfig = (config: {
  readonly project: {
    readonly name?: string | undefined
    readonly package?: string | undefined
    readonly packageName?: string | undefined
    readonly repository?: string | undefined
  }
  readonly publish: {
    readonly github?: boolean | { readonly repository?: string | undefined } | undefined
    readonly homebrew?: ReleaseConfigHomebrewPublish | undefined
  }
}): HomebrewSection | undefined => {
  const publish = config.publish.homebrew
  if (publish === undefined) {
    return undefined
  }
  const formulaName = publish.formulaName ?? compactPackageShortName(projectPackageName(config.project) ?? "release")
  const repository = githubRepository(config)
  return {
    repository: publish.repository,
    formulaName,
    formulaPath: publish.formulaPath ?? `.release/generated/${formulaName}.rb`,
    artifactIds: publish.artifactIds ?? (publish.artifactId === undefined ? undefined : [publish.artifactId]),
    ...optionalField(publish.homepage, (homepage) => ({ homepage })),
    ...optionalField(publish.description, (description) => ({ description })),
    ...optionalField(publish.url, (url) => ({ url })),
    ...optionalField(publish.tapDirectory, (tapDirectory) => ({ tapDirectory })),
    ...optionalField(publish.installPath, (installPath) => ({ installPath })),
    ...optionalField(publish.tokenEnv, (tokenEnv) => ({ tokenEnv })),
    ...optionalField(repository, (githubRepository) => ({ githubRepository }))
  }
}

export const defaultHomebrewSection = (
  section: HomebrewSection,
  identity: ReleaseIdentity
): HomebrewSection => {
  const formulaName = section.formulaName ?? compactPackageShortName(identity.normalizedName)
  return {
    ...section,
    formulaName,
    formulaPath: section.formulaPath ?? `.release/generated/${formulaName}.rb`
  }
}

const formulaClassName = (formulaName: string): string => {
  const parts = formulaName.split(/[^A-Za-z0-9]+/).filter((part) => part.length > 0)
  const className = parts.map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join("")
  return className.length === 0 ? "GeneratedFormula" : className
}

const rubyString = (value: string): string =>
  JSON.stringify(value)

const artifactUrl = (
  section: HomebrewSection,
  identity: ReleaseIdentity,
  artifact: Artifact
): string =>
  section.url ??
    (section.githubRepository === undefined
      ? artifact.path
      : `https://github.com/${section.githubRepository}/releases/download/${identity.tag}/${artifactPathBaseName(artifact.path)}`)

const findArtifact = (
  section: HomebrewSection,
  artifacts: ReadonlyArray<Artifact>,
  artifactId: string
): Effect.Effect<Artifact, PlanError> => {
  const artifact = artifacts.find((candidate) => candidate.id === artifactId)
  if (artifact !== undefined) {
    return Effect.succeed(artifact)
  }
  return Effect.fail(PlanError.make({
    pipeId: "catalog:homebrew",
    field: "publish.homebrew.ids",
    reason: `Homebrew target references missing artifact ${artifactId}.`
  }))
}

const selectArtifacts = Effect.fn("catalog.homebrew.selectArtifacts")(function*(
  section: HomebrewSection,
  artifacts: ReadonlyArray<Artifact>
) {
  if (section.artifactIds !== undefined) {
    if (section.artifactIds.length === 0) {
      return yield* Effect.fail(PlanError.make({
        pipeId: "catalog:homebrew",
        field: "publish.homebrew.ids",
        reason: "Homebrew artifact ids must not be empty."
      }))
    }
    return yield* Effect.forEach(section.artifactIds, (artifactId) =>
      findArtifact(section, artifacts, artifactId)
    )
  }
  const selected = artifacts.filter((artifact) =>
    artifact.kind === "executable" && artifact.platform?.os === "darwin"
  )
  if (selected.length > 0) {
    return selected
  }
  return yield* Effect.fail(PlanError.make({
    pipeId: "catalog:homebrew",
    field: "publish.homebrew.ids",
    reason: "Homebrew publishing requires artifact ids or darwin executable artifacts."
  }))
})

const homebrewArchOrder = (left: Artifact, right: Artifact): number => {
  const priority = (arch: string | undefined) => arch === "arm64" ? 0 : 1
  return priority(left.platform?.arch) - priority(right.platform?.arch)
}

const validateVariantArtifacts = Effect.fn("catalog.homebrew.validateVariantArtifacts")(function*(
  artifacts: ReadonlyArray<Artifact>
) {
  const seen = new Set<string>()
  for (const artifact of artifacts) {
    const variant = artifact.platform
    if (variant === undefined || variant.os !== "darwin") {
      return yield* Effect.fail(PlanError.make({
        pipeId: "catalog:homebrew",
        field: "publish.homebrew.ids",
        reason: `Homebrew artifact ${artifact.id} must declare a darwin installable variant.`
      }))
    }
    if (seen.has(variant.arch)) {
      return yield* Effect.fail(PlanError.make({
        pipeId: "catalog:homebrew",
        field: "publish.homebrew.ids",
        reason: `Homebrew target has multiple ${variant.arch} artifacts.`
      }))
    }
    seen.add(variant.arch)
  }
  return [...artifacts].sort(homebrewArchOrder)
})

const rejectInvalidHomebrewArtifact = (artifact: Artifact): Effect.Effect<void, PlanError> => {
  if (artifact.kind === "package" || (artifact.extra?._tag === "file" && artifact.extra.format === "directory")) {
    return Effect.fail(PlanError.make({
      pipeId: "catalog:homebrew",
      field: "publish.homebrew.ids",
      reason: "Homebrew formula artifacts must be file-like, not directories."
    }))
  }
  if (artifact.checksum !== undefined && artifact.checksum.algorithm !== "sha256") {
    return Effect.fail(PlanError.make({
      pipeId: "catalog:homebrew",
      field: `artifacts.${artifact.id}.checksum`,
      reason: "Homebrew formula artifacts require sha256 checksums."
    }))
  }
  return Effect.void
}

const singleArtifactBinaryName = (
  section: HomebrewSection,
  artifact: Artifact
): string | undefined =>
  section.installPath !== undefined ? section.formulaName : artifact.platform?.binaryName

const multiArtifactBinaryName = (
  section: HomebrewSection,
  artifacts: ReadonlyArray<Artifact>
): string =>
  section.installPath !== undefined
    ? section.formulaName ?? "release"
    : artifacts.find((entry) => entry.platform?.binaryName !== undefined)?.platform?.binaryName ??
      section.formulaName ?? "release"

const singleArtifactInstallLines = (
  section: HomebrewSection,
  artifact: Artifact
): ReadonlyArray<string> => {
  const formulaName = section.formulaName ?? "release"
  if (section.installPath !== undefined) {
    return [
      `    bin.install ${rubyString(section.installPath)} => ${rubyString(formulaName)}`,
      `    chmod 0755, bin/${rubyString(formulaName)}`
    ]
  }
  const binaryName = artifact.platform?.binaryName
  return binaryName === undefined
    ? ["    prefix.install Dir[\"*\"]"]
    : [
      `    bin.install ${rubyString(catalogPathBaseName(artifact.path))} => ${rubyString(binaryName)}`,
      `    chmod 0755, bin/${rubyString(binaryName)}`
    ]
}

const multiArtifactInstallLines = (
  section: HomebrewSection,
  artifacts: ReadonlyArray<Artifact>
): ReadonlyArray<string> => {
  const formulaName = section.formulaName ?? "release"
  if (section.installPath !== undefined) {
    return [
      `    bin.install ${rubyString(section.installPath)} => ${rubyString(formulaName)}`,
      `    chmod 0755, bin/${rubyString(formulaName)}`
    ]
  }
  const binaryName = multiArtifactBinaryName(section, artifacts)
  return [
    `    bin.install Dir["*"].find { |path| File.file?(path) } => ${rubyString(binaryName)}`,
    `    chmod 0755, bin/${rubyString(binaryName)}`
  ]
}

const formulaTestLines = (binaryName: string | undefined): ReadonlyArray<string> =>
  binaryName === undefined
    ? []
    : [
      "",
      "  test do",
      `    assert File.exist?(bin/${rubyString(binaryName)})`,
      `    assert File.executable?(bin/${rubyString(binaryName)})`,
      "  end"
    ]

const formulaContent = Effect.fn("catalog.homebrew.formulaContent")(function*(
  section: HomebrewSection,
  identity: ReleaseIdentity,
  artifacts: ReadonlyArray<Artifact>
) {
  const selected = yield* selectArtifacts(section, artifacts)
  yield* Effect.forEach(selected, rejectInvalidHomebrewArtifact)
  const formulaName = section.formulaName ?? "release"
  const homepage = section.homepage ?? `https://github.com/${section.repository}`
  const description = section.description ?? `${identity.name} ${identity.version} release artifact`
  if (selected.length === 1) {
    const artifact = selected[0]
    if (artifact === undefined) {
      return yield* Effect.fail(PlanError.make({
        pipeId: "catalog:homebrew",
        field: "publish.homebrew.ids",
        reason: "Homebrew publishing requires at least one artifact."
      }))
    }
    return HomebrewFormulaContent.make({
      formulaName,
      className: formulaClassName(formulaName),
      description,
      homepage,
      version: identity.version,
      installLines: [...singleArtifactInstallLines(section, artifact)],
      testLines: [...formulaTestLines(singleArtifactBinaryName(section, artifact))],
      entries: [
        HomebrewFormulaEntry.make({
          artifactId: artifact.id,
          url: artifactUrl(section, identity, artifact),
          os: artifact.platform?.os === "linux" ? "linux" : "darwin",
          arch: artifact.platform?.arch ?? "arm64"
        })
      ]
    })
  }
  const variants = yield* validateVariantArtifacts(selected)
  return HomebrewFormulaContent.make({
    formulaName,
    className: formulaClassName(formulaName),
    description,
    homepage,
    version: identity.version,
    installLines: [...multiArtifactInstallLines(section, variants)],
    testLines: [...formulaTestLines(multiArtifactBinaryName(section, variants))],
    entries: variants.map((artifact) =>
      HomebrewFormulaEntry.make({
        artifactId: artifact.id,
        url: artifactUrl(section, identity, artifact),
        os: "darwin",
        arch: artifact.platform?.arch ?? "arm64"
      })
    )
  })
})

export const catalogHomebrewPipe: Pipe<HomebrewSection> = {
  id: "catalog:homebrew",
  phase: "catalog",
  section: homebrewSectionFromConfig,
  defaults: defaultHomebrewSection,
  plan: (section, state) =>
    Effect.gen(function*() {
      const formulaPath = section.formulaPath ?? `.release/generated/${section.formulaName ?? "release"}.rb`
      const content = yield* formulaContent(section, state.identity, state.artifacts.artifacts)
      return {
        ...emptyContribution,
        artifacts: [
          Artifact.make({
            id: "homebrew-formula",
            kind: "catalog-file",
            path: formulaPath,
            producedBy: "catalog:homebrew",
            extra: CatalogFileExtra.make({
              catalog: "homebrew",
              repository: section.repository
            })
          })
        ],
        operations: [
          Operation.make({
            id: "homebrew:homebrew-render-formula",
            pipeId: "catalog:homebrew",
            phase: "catalog",
            risk: "writes-local",
            description: `Render Homebrew formula ${catalogPathBaseName(formulaPath)}.`,
            action: WriteFileAction.make({
              path: formulaPath,
              contents: content
            })
          })
        ]
      }
    })
}
