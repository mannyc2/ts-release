// Invariant: selected artifacts determine one byte-stable Homebrew formula; single and multi-arch forms stay explicit.
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { Artifact, CatalogFileExtra, SafeRelativePath } from "../../grammar/artifact.js"
import { PlanError } from "../../grammar/errors.js"
import { Operation, WriteFileAction } from "../../grammar/operation.js"
import { FilePartsContent, Sha256Hole } from "../../grammar/content.js"
import { featurePlanner } from "../../grammar/planner.js"
import type { ReleaseIdentity } from "../../grammar/state.js"
import {
  catalogArtifactUrl,
  catalogPathBaseName,
  compactPackageShortName,
  type CatalogResolutionConfig,
  findCatalogArtifact,
  githubRepository,
  projectPackageName,
  rejectInvalidCatalogArtifact
} from "./shared.js"
import { defaulted } from "../../grammar/defaulted.js"

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
  tapDirectory: defaulted(SafeRelativePath, "."),
  installPath: Schema.optionalKey(Schema.String),
  tokenEnv: Schema.optionalKey(Schema.String)
}) {}

export const resolveHomebrew = (section: ReleaseConfigHomebrewPublish | undefined, config: CatalogResolutionConfig) => {
  if (section === undefined) return undefined
  const formulaName = section.formulaName ?? compactPackageShortName(projectPackageName(config.project) ?? "release")
  return {
    ...section,
    formulaName, formulaPath: section.formulaPath ?? `.release/generated/${formulaName}.rb`,
    tapDirectory: section.tapDirectory,
    githubRepository: githubRepository(config)
  }
}
export type HomebrewSection = NonNullable<ReturnType<typeof resolveHomebrew>>

const source = {
  pipeId: "catalog:homebrew", field: "publish.homebrew.ids", target: "Homebrew", label: "Homebrew formula"
}
const ruby = JSON.stringify

const formulaClassName = (name: string): string => {
  const result = name.split(/[^A-Za-z0-9]+/).filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join("")
  return result || "GeneratedFormula"
}

const selectArtifacts = Effect.fn("catalog.homebrew.selectArtifacts")(function*(
  section: HomebrewSection,
  available: ReadonlyArray<Artifact>
) {
  if (section.artifactIds !== undefined) return yield* Effect.forEach(
    section.artifactIds,
    (id) => findCatalogArtifact(source, available, id)
  )
  const selected = available.filter(({ kind, platform }) => kind === "executable" && platform?.os === "darwin")
  return selected.length > 0 ? selected : yield* Effect.fail(PlanError.make({
    pipeId: source.pipeId,
    field: source.field,
    reason: "Homebrew publishing requires artifact ids or darwin executable artifacts."
  }))
})

const variantArtifacts = Effect.fn("catalog.homebrew.variantArtifacts")(function*(artifacts: ReadonlyArray<Artifact>) {
  const seen = new Set<string>()
  for (const artifact of artifacts) {
    const variant = artifact.platform
    if (variant === undefined || variant.os !== "darwin") return yield* Effect.fail(PlanError.make({
      pipeId: source.pipeId,
      field: source.field,
      reason: `Homebrew artifact ${artifact.id} must declare a darwin installable variant.`
    }))
    if (seen.has(variant.arch)) return yield* Effect.fail(PlanError.make({
      pipeId: source.pipeId,
      field: source.field,
      reason: `Homebrew target has multiple ${variant.arch} artifacts.`
    }))
    seen.add(variant.arch)
  }
  return [...artifacts].sort((left, right) =>
    (left.platform?.arch === "arm64" ? 0 : 1) - (right.platform?.arch === "arm64" ? 0 : 1))
})

const installLines = (
  section: HomebrewSection,
  artifacts: ReadonlyArray<Artifact>
): { readonly binary: string | undefined; readonly lines: ReadonlyArray<string> } => {
  if (section.installPath !== undefined) return {
    binary: section.formulaName,
    lines: [
      `    bin.install ${ruby(section.installPath)} => ${ruby(section.formulaName)}`,
      `    chmod 0755, bin/${ruby(section.formulaName)}`
    ]
  }
  const artifact = artifacts[0]
  const binary = artifacts.find(({ platform }) => platform?.binaryName !== undefined)?.platform?.binaryName
    ?? section.formulaName
  if (artifacts.length > 1) return {
    binary,
    lines: [
      `    bin.install Dir["*"].find { |path| File.file?(path) } => ${ruby(binary)}`,
      `    chmod 0755, bin/${ruby(binary)}`
    ]
  }
  const singleBinary = artifact?.platform?.binaryName
  return {
    binary: singleBinary,
    lines: singleBinary === undefined
      ? ["    prefix.install Dir[\"*\"]"]
      : [
        `    bin.install ${ruby(catalogPathBaseName(artifact!.path))} => ${ruby(singleBinary)}`,
        `    chmod 0755, bin/${ruby(singleBinary)}`
      ]
  }
}

const testLines = (binary: string | undefined): ReadonlyArray<string> => binary === undefined ? [] : [
  "", "  test do", `    assert File.exist?(bin/${ruby(binary)})`,
  `    assert File.executable?(bin/${ruby(binary)})`, "  end"
]

const formulaContent = Effect.fn("catalog.homebrew.formulaContent")(function*(
  section: HomebrewSection,
  identity: ReleaseIdentity,
  available: ReadonlyArray<Artifact>
) {
  const selected = yield* selectArtifacts(section, available)
  yield* Effect.forEach(selected, (artifact) => rejectInvalidCatalogArtifact(source, artifact))
  const common = [
    `class ${formulaClassName(section.formulaName)} < Formula`,
    `  desc ${ruby(section.description ?? `${identity.name} ${identity.version} release artifact`)}`,
    `  homepage ${ruby(section.homepage ?? `https://github.com/${section.repository}`)}`
  ]
  if (selected.length === 1) {
    const artifact = selected[0]!
    const install = installLines(section, selected)
    return FilePartsContent.make({ parts: [
      [...common, `  url ${ruby(catalogArtifactUrl(section, identity, artifact))}`, "  sha256 \""].join("\n"),
      Sha256Hole.make({ artifactId: artifact.id }),
      ["\"", `  version ${ruby(identity.version)}`, "", "  def install", ...install.lines, "  end",
        ...testLines(install.binary), "end", ""].join("\n")
    ] })
  }
  const variants = yield* variantArtifacts(selected)
  const variantParts = variants.flatMap((artifact): Array<string | Sha256Hole> => [
    [`    ${artifact.platform?.arch === "arm64" ? "on_arm" : "on_intel"} do`,
      `      url ${ruby(catalogArtifactUrl(section, identity, artifact))}`, "      sha256 \""].join("\n"),
    Sha256Hole.make({ artifactId: artifact.id }),
    ["\"", "    end", "", ""].join("\n")
  ])
  const install = installLines(section, variants)
  return FilePartsContent.make({ parts: [
    [...common, `  version ${ruby(identity.version)}`, "", "  on_macos do", ""].join("\n"),
    ...variantParts,
    ["  end", "", "  def install", ...install.lines, "  end", ...testLines(install.binary), "end", ""].join("\n")
  ] })
})

export const catalogHomebrewPlanner = featurePlanner<HomebrewSection>("catalog:homebrew", (section, state) => Effect.gen(function*() {
    const path = section.formulaPath
    const contents = yield* formulaContent(section, state.identity, state.artifacts)
    return {
      artifacts: [Artifact.make({
        id: "homebrew-formula", kind: "catalog-file", path, producedBy: "catalog:homebrew",
        extra: CatalogFileExtra.make({ catalog: "homebrew", repository: section.repository })
      })],
      operations: [Operation.make({
        id: "homebrew:homebrew-render-formula",
        pipeId: "catalog:homebrew",
        phase: "catalog",
        risk: "writes-local",
        description: `Render Homebrew formula ${catalogPathBaseName(path)}.`,
        action: WriteFileAction.make({ path, contents })
      })]
    }
  }))
