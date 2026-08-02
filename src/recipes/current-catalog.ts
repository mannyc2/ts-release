import {
  ContentHole, Exec, OpaquePublish, OutputDeclaration, PublishCredential, Write,
  type ContentValue
} from "../model/operation.js"
import type { CandidateCatalog, CandidateConfig } from "./config.js"
import {
  basename, command, compactName, credentialName, nonEmptyCommand, operationId, outputId,
  path, recordOutput, render, selectedOutputs, type CurrentRows
} from "./current-shared.js"
import { ConfigValueError } from "../model/errors.js"

interface CatalogRow {
  readonly id: string
  readonly repository: string
  readonly file: string
  readonly directory?: string | undefined
  readonly content: ContentValue
  readonly inputs: ReadonlyArray<OutputDeclaration>
  readonly commitMessage: string
  readonly submit: "push" | "pull-request"
  readonly validate?: string | ReadonlyArray<string> | undefined
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
  const repository = config.publish.github?.repository ?? config.project.repository
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
const homebrewRow = (config: CandidateConfig, rows: CurrentRows): CatalogRow | undefined => {
  const section = config.publish.homebrew
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
    ...(section.tapDirectory === undefined || section.tapDirectory === "."
      ? {} : { directory: section.tapDirectory }),
    content: formulaContent(config, selected, name, section.url, section.installPath),
    inputs: selected, commitMessage: `Update ${name} to ${config.project.version}`,
    submit: section.submit ?? "push",
    ...(section.validate === undefined ? {} : { validate: section.validate })
  }
}
const scoopRow = (config: CandidateConfig, rows: CurrentRows): CatalogRow | undefined => {
  const section = config.publish.scoop
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
    ...(section.bucketDirectory === undefined || section.bucketDirectory === "."
      ? {} : { directory: section.bucketDirectory }),
    content: [
      `${prefix},\n  "hash": "`, ContentHole.make({ fact: "sha256", outputId: artifact.id }), suffix
    ],
    inputs: selected, commitMessage: `Update ${name} to ${config.project.version}`,
    submit: section.submit ?? "push",
    ...(section.validate === undefined ? {} : { validate: section.validate })
  }
}
const requireOutput = (
  rows: CurrentRows, catalogId: string, id: string
): OutputDeclaration => {
  const output = rows.outputs.get(id)
  if (output === undefined) {
    throw ConfigValueError.make({ reason: `Catalog ${catalogId} references missing output ${id}.` })
  }
  return output
}
const genericRow = (
  config: CandidateConfig, rows: CurrentRows, entry: CandidateCatalog
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
    ...(entry.directory === undefined ? {} : { directory: entry.directory }),
    content,
    inputs: ids.map((id) => requireOutput(rows, entry.id, id)),
    commitMessage: render(entry.commitMessage ?? "Update {name} to {version}", config),
    submit: entry.submit ?? "push",
    ...(entry.validate === undefined ? {} : { validate: entry.validate })
  }
}
const local = (
  id: string, description: string, argv: ReadonlyArray<string>, cwd = "."
): Exec => Exec.make({
  id: operationId(id), inputs: [], outputs: [], description,
  contractFixtureId: "catalog.git-publish/v1", argv: nonEmptyCommand(argv),
  cwd: path(cwd), environmentNames: []
})
const remote = (
  row: CatalogRow, id: string, description: string, argv: ReadonlyArray<string>, cwd = "."
): OpaquePublish => OpaquePublish.make({
  id: operationId(id), inputs: row.inputs.map((item) => item.id), outputs: [], description,
  argv: nonEmptyCommand(argv), cwd: path(cwd), environmentNames: [],
  credential: PublishCredential.make({ name: credentialName("GIT_CREDENTIALS") }),
  contractFixtureId: "catalog.git-publish/v1", reconciliation: "manual-only", irreversible: false
})
const lowerPublish = (row: CatalogRow, config: CandidateConfig, rows: CurrentRows): void => {
  const directory = row.directory ?? "."
  const writePath = row.directory === undefined ? row.file : `${row.directory}/${row.file}`
  if (row.validate !== undefined) rows.publish.push(local(
    `catalog:${row.id}:validate`, `Validate ${row.id} catalog update.`,
    command(row.validate).map((part) => render(part, config))))
  const branch = `ts-release/${compactName(config.project.name)}-${config.project.version}`
  if (row.submit === "pull-request") rows.publish.push(local(
    `catalog:${row.id}:checkout`, `Create ${branch}.`,
    ["git", "-C", directory, "checkout", "-B", branch]))
  rows.publish.push(
    local(`catalog:${row.id}:push:add`, `Stage ${basename(writePath)} for catalog.`,
      ["git", "-C", directory, "add", row.file]),
    local(`catalog:${row.id}:push:commit`, `Commit ${basename(writePath)} for catalog.`,
      ["git", "-C", directory, "commit", "-m", row.commitMessage])
  )
  const description = `Push ${row.id} catalog update for ${config.project.name}@${config.project.version}.`
  rows.publish.push(remote(row, `catalog:${row.id}:push`, description,
    row.submit === "push"
      ? ["git", "-C", directory, "push"]
      : ["git", "-C", directory, "push", "-u", "origin", branch]))
  if (row.submit === "pull-request") rows.publish.push(remote(
    row, `catalog:${row.id}:pull-request`, `Open ${row.id} catalog pull request.`,
    ["gh", "pr", "create", "--repo", row.repository, "--title", row.commitMessage,
      "--body", description, "--head", branch], directory))
}
export const lowerCurrentCatalogs = (config: CandidateConfig, rows: CurrentRows): void => {
  const candidates = [
    ...(config.catalogs ?? []).map((entry) => genericRow(config, rows, entry)),
    homebrewRow(config, rows), scoopRow(config, rows)
  ].filter((row): row is CatalogRow => row !== undefined)
  for (const row of candidates) {
    const location = row.directory === undefined ? row.file : `${row.directory}/${row.file}`
    const declared = recordOutput(rows, OutputDeclaration.make({
      id: outputId(`catalog-file-${row.id}`), path: path(location),
      kind: "catalog-file", provenance: "catalog"
    }))
    rows.catalog.push(Write.make({
      id: operationId(`catalog:${row.id}:render`), inputs: row.inputs.map((item) => item.id),
      outputs: [declared], description: `Render ${row.id} catalog file ${location}.`,
      path: declared.path, content: row.content
    }))
    lowerPublish(row, config, rows)
  }
}
