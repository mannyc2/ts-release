import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  Artifact,
  CatalogFileExtra,
  SafeRelativePath
} from "../pipeline/artifact.js"
import { PlanError } from "../pipeline/errors.js"
import {
  catalogArtifactUrl,
  compactPackageShortName,
  findCatalogArtifact,
  githubRepository,
  projectPackageName,
  rejectInvalidCatalogArtifact
} from "./shared.js"
import {
  FilePartsContent,
  Operation,
  Sha256Hole,
  WriteFileAction
} from "../pipeline/operation.js"
import {
  catalogPathBaseName
} from "../pipeline/operation-helpers.js"
import type { FeaturePlanner } from "../pipeline/pipe.js"
import { emptyContribution } from "../pipeline/pipe.js"
import type { ReleaseIdentity } from "../pipeline/state.js"
import { validateSafeRelativePathEffect } from "../pipeline/artifact.js"

export class ReleaseConfigHomebrewPublish extends Schema.Class<ReleaseConfigHomebrewPublish>(
  "ReleaseConfigHomebrewPublish"
)({
  repository: Schema.String,
  formulaName: Schema.optionalKey(Schema.String),
  formulaPath: Schema.optionalKey(SafeRelativePath),
  artifactIds: Schema.optionalKey(Schema.NonEmptyArray(Schema.NonEmptyString)),
  homepage: Schema.optionalKey(Schema.String),
  description: Schema.optionalKey(Schema.String),
  url: Schema.optionalKey(Schema.String),
  tapDirectory: Schema.optionalKey(SafeRelativePath),
  installPath: Schema.optionalKey(Schema.String),
  tokenEnv: Schema.optionalKey(Schema.String)
}) {}

export interface ResolvedHomebrew {
  readonly repository: string
  readonly formulaName: string
  readonly formulaPath: string
  readonly artifactIds?: readonly [string, ...Array<string>] | undefined
  readonly homepage?: string | undefined
  readonly description?: string | undefined
  readonly url?: string | undefined
  readonly tapDirectory: string
  readonly installPath?: string | undefined
  readonly tokenEnv?: string | undefined
  readonly githubRepository?: string | undefined
}

export const resolveHomebrew = (config: {
  readonly project: {
    readonly name?: string | undefined
    readonly packageName?: string | undefined
    readonly repository?: string | undefined
  }
  readonly publish: {
    readonly github?: boolean | { readonly repository?: string | undefined } | undefined
    readonly homebrew?: ReleaseConfigHomebrewPublish | undefined
  }
}): ResolvedHomebrew | undefined => {
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
    artifactIds: publish.artifactIds,
    homepage: publish.homepage,
    description: publish.description,
    url: publish.url,
    tapDirectory: publish.tapDirectory ?? ".",
    installPath: publish.installPath,
    tokenEnv: publish.tokenEnv,
    githubRepository: repository
  }
}

const formulaClassName = (formulaName: string): string => {
  const parts = formulaName.split(/[^A-Za-z0-9]+/).filter((part) => part.length > 0)
  const className = parts.map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join("")
  return className.length === 0 ? "GeneratedFormula" : className
}

const rubyString = (value: string): string =>
  JSON.stringify(value)

const errorSource = {
  pipeId: "catalog:homebrew",
  field: "publish.homebrew.ids",
  target: "Homebrew",
  label: "Homebrew formula"
}

const selectArtifacts = Effect.fn("catalog.homebrew.selectArtifacts")(function*(
  section: ResolvedHomebrew,
  artifacts: ReadonlyArray<Artifact>
) {
  if (section.artifactIds !== undefined) {
    return yield* Effect.forEach(section.artifactIds, (artifactId) =>
      findCatalogArtifact(errorSource, artifacts, artifactId)
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

const singleArtifactBinaryName = (
  section: ResolvedHomebrew,
  artifact: Artifact
): string | undefined =>
  section.installPath !== undefined ? section.formulaName : artifact.platform?.binaryName

const multiArtifactBinaryName = (
  section: ResolvedHomebrew,
  artifacts: ReadonlyArray<Artifact>
): string =>
  section.installPath !== undefined
    ? section.formulaName
    : artifacts.find((entry) => entry.platform?.binaryName !== undefined)?.platform?.binaryName ??
      section.formulaName

const singleArtifactInstallLines = (
  section: ResolvedHomebrew,
  artifact: Artifact
): ReadonlyArray<string> => {
  const formulaName = section.formulaName
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
  section: ResolvedHomebrew,
  artifacts: ReadonlyArray<Artifact>
): ReadonlyArray<string> => {
  const formulaName = section.formulaName
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
  section: ResolvedHomebrew,
  identity: ReleaseIdentity,
  artifacts: ReadonlyArray<Artifact>
) {
  const selected = yield* selectArtifacts(section, artifacts)
  yield* Effect.forEach(selected, (artifact) => rejectInvalidCatalogArtifact(errorSource, artifact))
  const formulaName = section.formulaName
  const homepage = section.homepage ?? `https://github.com/${section.repository}`
  const description = section.description ?? `${identity.name} ${identity.version} release artifact`
  const common = [
    `class ${formulaClassName(formulaName)} < Formula`,
    `  desc ${rubyString(description)}`,
    `  homepage ${rubyString(homepage)}`
  ]
  if (selected.length === 1) {
    const artifact = selected[0]
    if (artifact === undefined) {
      return yield* Effect.fail(PlanError.make({
        pipeId: "catalog:homebrew",
        field: "publish.homebrew.ids",
        reason: "Homebrew publishing requires at least one artifact."
      }))
    }
    return FilePartsContent.make({
      parts: [
        [...common, `  url ${rubyString(catalogArtifactUrl(section, identity, artifact))}`, "  sha256 \""].join("\n"),
        Sha256Hole.make({ artifactId: artifact.id }),
        [
          "\"",
          `  version ${rubyString(identity.version)}`,
          "",
          "  def install",
          ...singleArtifactInstallLines(section, artifact),
          "  end",
          ...formulaTestLines(singleArtifactBinaryName(section, artifact)),
          "end",
          ""
        ].join("\n")
      ]
    })
  }
  const variants = yield* validateVariantArtifacts(selected)
  const variantParts: Array<string | Sha256Hole> = variants.flatMap((artifact) => [
    [
      `    ${artifact.platform?.arch === "arm64" ? "on_arm" : "on_intel"} do`,
      `      url ${rubyString(catalogArtifactUrl(section, identity, artifact))}`,
      "      sha256 \""
    ].join("\n"),
    Sha256Hole.make({ artifactId: artifact.id }),
    ["\"", "    end", "", ""].join("\n")
  ])
  return FilePartsContent.make({
    parts: [
      [...common, `  version ${rubyString(identity.version)}`, "", "  on_macos do", ""].join("\n"),
      ...variantParts,
      [
        "  end",
        "",
        "  def install",
        ...multiArtifactInstallLines(section, variants),
        "  end",
        ...formulaTestLines(multiArtifactBinaryName(section, variants)),
        "end",
        ""
      ].join("\n")
    ]
  })
})

export const catalogHomebrewPlanner: FeaturePlanner<ResolvedHomebrew> = {
  id: "catalog:homebrew",
  plan: (section, state) =>
    Effect.gen(function*() {
      const formulaPath = yield* validateSafeRelativePathEffect(section.formulaPath, {
        pipeId: "catalog:homebrew",
        field: "publish.homebrew.formulaPath"
      })
      const content = yield* formulaContent(section, state.identity, state.artifacts)
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
