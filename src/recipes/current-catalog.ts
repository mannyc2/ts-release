import { ContentHole, OutputDeclaration, Write, type ContentValue } from "../model/operation.js"
import type { CandidateCatalog, CandidateConfig } from "./config.js"
import {
  basename, compactName, operationId, outputId,
  path, recordOutput, render, selectedOutputs, type LegacyStageRows
} from "./current-shared.js"
import { ConfigValueError } from "../model/errors.js"

interface CatalogRow {
  readonly id: string
  readonly repository: string
  readonly file: string
  readonly content: ContentValue
  readonly inputs: ReadonlyArray<OutputDeclaration>
}
const className = (value: string): string => value.split(/[^A-Za-z0-9]+/u).filter(Boolean)
  .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join("")
  || "GeneratedFormula"
// The release asset URL is DERIVED, so a config states it once (as a
// repository) instead of three times. With neither repository source present
// there is nothing to derive from, and the answer is a refusal — this used to
// interpolate the literal string "undefined" into a published formula.
const downloadUrl = (
  config: CandidateConfig, output: OutputDeclaration, explicit?: string
): string => {
  if (explicit !== undefined) return explicit
  const repository = config.publish?.github?.repository ?? config.project.repository
  if (repository === undefined) {
    throw ConfigValueError.make({
      reason:
        "Catalog download URLs need publish.github.repository, project.repository, or an explicit url."
    })
  }
  return `https://github.com/${repository}/releases/download/${config.project.tag}/${
    basename(output.path)
  }`
}
const formulaTail = (name: string, installPath: string | undefined): string => [
  "", "  def install",
  installPath === undefined
    ? `    bin.install Dir["*"].find { |path| File.file?(path) } => ${JSON.stringify(name)}`
    : `    bin.install ${JSON.stringify(installPath)} => ${JSON.stringify(name)}`,
  `    chmod 0755, bin/${JSON.stringify(name)}`, "  end", "", "  test do",
  `    assert File.exist?(bin/${JSON.stringify(name)})`,
  `    assert File.executable?(bin/${JSON.stringify(name)})`, "  end", "end", ""
].join("\n")
const formulaContent = (
  config: CandidateConfig, selected: ReadonlyArray<OutputDeclaration>,
  name: string, explicitUrl: string | undefined, installPath: string | undefined
): ContentValue => {
  const common = [
    `class ${className(name)} < Formula`,
    `  desc ${JSON.stringify(config.project.description)}`,
    `  homepage ${JSON.stringify(config.project.homepage)}`
  ]
  if (selected.length === 1) {
    const artifact = selected[0]!
    return [
      `${[...common, `  url ${JSON.stringify(downloadUrl(config, artifact, explicitUrl))}`,
        "  sha256 \""].join("\n")}`,
      ContentHole.make({ fact: "sha256", outputId: artifact.id }),
      `"\n  version ${JSON.stringify(config.project.version)}\n${formulaTail(name, installPath)}`
    ]
  }
  return [
    `${[...common, `  version ${JSON.stringify(config.project.version)}`, "",
      "  on_macos do", ""].join("\n")}`,
    ...selected.flatMap((artifact) => [
      `${artifact.platform?.arch === "arm64" ? "    on_arm do" : "    on_intel do"}\n` +
        `      url ${JSON.stringify(downloadUrl(config, artifact, explicitUrl))}\n` +
        "      sha256 \"",
      ContentHole.make({ fact: "sha256", outputId: artifact.id }),
      "\"\n    end\n\n"
    ]),
    `  end\n${formulaTail(name, installPath)}`
  ]
}
const homebrewRow = (config: CandidateConfig, rows: LegacyStageRows): CatalogRow | undefined => {
  const section = config.publish?.homebrew
  if (section === undefined) return undefined
  const name = section.formulaName ?? compactName(config.project.packageName ?? config.project.name)
  const selected = selectedOutputs(rows, section.ids, (item) =>
    item.kind === "executable" && item.platform?.os === "darwin")
  if (
    selected.length === 0 ||
    config.project.description === undefined ||
    config.project.homepage === undefined
  ) throw ConfigValueError.make({ reason: "Homebrew requires artifacts, project description, and homepage." })
  return {
    id: "homebrew", repository: section.repository,
    file: section.formulaPath ?? `.release/generated/${name}.rb`,
    content: formulaContent(config, selected, name, section.url, section.installPath),
    inputs: selected
  }
}
const scoopRow = (config: CandidateConfig, rows: LegacyStageRows): CatalogRow | undefined => {
  const section = config.publish?.scoop
  if (section === undefined) return undefined
  const name = section.manifestName ?? compactName(config.project.packageName ?? config.project.name)
  const selected = selectedOutputs(rows, section.ids, (item) =>
    item.kind === "executable" && item.platform?.os === "windows")
  if (
    selected.length !== 1 ||
    config.project.description === undefined ||
    config.project.homepage === undefined
  ) throw ConfigValueError.make({ reason: "Scoop requires one artifact, project description, and homepage." })
  const artifact = selected[0]!
  const prefix = JSON.stringify({
    version: config.project.version, description: config.project.description,
    homepage: config.project.homepage,
    ...(config.project.license === undefined ? {} : { license: config.project.license }),
    url: downloadUrl(config, artifact, section.url)
  }, null, 2).slice(0, -2)
  const bin = section.bin ?? (artifact.platform?.binaryName === undefined
    ? undefined
    : [[basename(artifact.path), artifact.platform.binaryName]])
  const suffix = bin === undefined ? "\"\n}\n" : `",\n${JSON.stringify({ bin }, null, 2).slice(2, -2)}\n}\n`
  return {
    id: "scoop", repository: section.repository,
    file: section.manifestPath ?? `.release/generated/${name}.json`,
    content: [
      `${prefix},\n  "hash": "`, ContentHole.make({ fact: "sha256", outputId: artifact.id }), suffix
    ],
    inputs: selected
  }
}
const requireOutput = (
  rows: LegacyStageRows, catalogId: string, id: string
): OutputDeclaration => {
  const output = rows.outputs.get(id)
  if (output === undefined) {
    throw ConfigValueError.make({ reason: `Catalog ${catalogId} references missing output ${id}.` })
  }
  return output
}
const genericRow = (
  config: CandidateConfig, rows: LegacyStageRows, entry: CandidateCatalog
): CatalogRow => {
  const content: ContentValue = typeof entry.content === "string"
    ? render(entry.content, config)
    : entry.content.map((part) => typeof part === "string"
      ? render(part, config)
      // A downloadUrl is knowable at PLAN time, so it is resolved here and the
      // lowered plan carries no such hole. sha256 and assetName stay holes:
      // those bytes do not exist yet.
      : part.fact === "downloadUrl"
      ? downloadUrl(config, requireOutput(rows, entry.id, part.artifact))
      : ContentHole.make({ fact: part.fact, outputId: part.artifact }))
  const ids = typeof content === "string" ? [] : content.flatMap((part) =>
    typeof part === "string" ? [] : [part.outputId])
  return {
    id: entry.id, repository: entry.repository, file: entry.file,
    content,
    inputs: ids.map((id) => requireOutput(rows, entry.id, id))
  }
}
export const lowerLegacyCatalogs = (config: CandidateConfig, rows: LegacyStageRows): LegacyStageRows => {
  const candidates = [
    ...(config.catalogs ?? []).map((entry) => genericRow(config, rows, entry)),
    homebrewRow(config, rows), scoopRow(config, rows)
  ].filter((row): row is CatalogRow => row !== undefined)
  let next = rows
  for (const row of candidates) {
    const location = row.file
    let declared: OutputDeclaration
    ;[next, declared] = recordOutput(next, OutputDeclaration.make({
      id: outputId(`catalog-file-${row.id}`), path: path(location),
      kind: "catalog-file", provenance: "catalog"
    }))
    next = { ...next, catalog: [...next.catalog, Write.make({
      id: operationId(`catalog:${row.id}:render`), inputs: row.inputs.map((item) => item.id),
      outputs: [declared], description: `Render ${row.id} catalog file ${location}.`,
      path: declared.path, content: row.content
    })] }
  }
  return next
}
