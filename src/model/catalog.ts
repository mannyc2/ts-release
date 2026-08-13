import * as Schema from "effect/Schema"
import * as Semver from "semver"
import { encodeCanonicalJson, parseStrictJson } from "./canonical.js"
import { Sha256Digest } from "./digest.js"
import { NonEmptyName, OutputId, SafeRelativePath, Version } from "./primitives.js"

const optional = Schema.optionalKey

export const GitHubRepositoryCoordinate = Schema.NonEmptyString.check(Schema.makeFilter(
  (value: string) => /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/u.test(value)
    ? undefined
    : "Catalog repository must be an owner/repository coordinate."
)).pipe(Schema.brand("GitHubRepositoryCoordinate"))
export type GitHubRepositoryCoordinate = typeof GitHubRepositoryCoordinate.Type

export const GitBranchName = Schema.NonEmptyString.check(Schema.makeFilter((value: string) =>
  !value.startsWith("-") && !value.startsWith("/") && !value.endsWith("/") && !value.endsWith(".") &&
  !value.endsWith(".lock") && !value.includes("..") && !value.includes("//") && !value.includes("@{") &&
  !/[~^:?*[\\\u0000-\u001f\u007f]/u.test(value)
    ? undefined
    : "Catalog branch must be one canonical Git branch name."))
  .pipe(Schema.brand("GitBranchName"))
export type GitBranchName = typeof GitBranchName.Type

export const CatalogRepositoryPath = SafeRelativePath.check(Schema.makeFilter((value) =>
  value.toString() !== "." ? undefined : "Catalog repository paths must identify files."))
  .pipe(Schema.brand("CatalogRepositoryPath"))
export type CatalogRepositoryPath = typeof CatalogRepositoryPath.Type

export const CatalogArchitecture = Schema.Literals(["x64", "arm64"])
export type CatalogArchitecture = typeof CatalogArchitecture.Type

export class CatalogRenderSource extends Schema.Class<CatalogRenderSource>("CatalogRenderSource")({
  artifactId: OutputId,
  architecture: CatalogArchitecture,
  url: Schema.NonEmptyString,
  filename: NonEmptyName
}) {}

export class PreparedCatalogDownload extends Schema.Class<PreparedCatalogDownload>("PreparedCatalogDownload")({
  architecture: CatalogArchitecture,
  url: Schema.NonEmptyString,
  filename: NonEmptyName,
  sha256: Sha256Digest
}) {}

const rendererFields = {
  name: NonEmptyName,
  description: Schema.NonEmptyString,
  homepage: Schema.NonEmptyString,
  license: optional(Schema.NonEmptyString)
}

export class HomebrewRenderer extends Schema.TaggedClass<HomebrewRenderer>()("homebrew", {
  ...rendererFields,
  installPath: NonEmptyName
}) {}

export class ScoopRenderer extends Schema.TaggedClass<ScoopRenderer>()("scoop", {
  ...rendererFields,
  bin: NonEmptyName
}) {}

export const CatalogRenderer = Schema.Union([HomebrewRenderer, ScoopRenderer])
export type CatalogRenderer = typeof CatalogRenderer.Type

export class PreparedCatalogRenderer
  extends Schema.Class<PreparedCatalogRenderer>("PreparedCatalogRenderer")({
    renderer: CatalogRenderer,
    downloads: Schema.NonEmptyArray(PreparedCatalogDownload)
  }) {}

export const CatalogManagedStatus = Schema.Literals(["active", "corrected", "superseded"])

export class CatalogManagedState extends Schema.Class<CatalogManagedState>("CatalogManagedState")({
  schemaVersion: Schema.Literal("ts-release/catalog-state/v2"),
  catalogId: NonEmptyName,
  renderer: Schema.Literals(["homebrew", "scoop"]),
  generation: Version,
  status: CatalogManagedStatus,
  targetDigest: Sha256Digest,
  sourceRepository: GitHubRepositoryCoordinate,
  sourceTag: NonEmptyName,
  correctionId: optional(Sha256Digest),
  reason: optional(Schema.NonEmptyString),
  replacementVersion: optional(Version)
}) {}

export const encodeCatalogManagedState = (value: CatalogManagedState): Uint8Array =>
  new TextEncoder().encode(encodeCanonicalJson(Schema.encodeSync(CatalogManagedState)(value)))

export const decodeCatalogManagedState = (bytes: Uint8Array): CatalogManagedState | undefined => {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    const value = Schema.decodeUnknownSync(CatalogManagedState, { onExcessProperty: "error" })(parseStrictJson(text))
    if (Semver.valid(value.generation.toString()) !== value.generation.toString()) return undefined
    const canonical = encodeCatalogManagedState(value)
    return canonical.length === bytes.length && canonical.every((byte, index) => byte === bytes[index])
      ? value
      : undefined
  } catch {
    return undefined
  }
}

export const canonicalCatalogVersion = (value: string): Version => {
  const parsed = Semver.valid(value)
  if (parsed === null || parsed !== value) throw new Error(`Catalog generation requires a canonical semantic version, got ${JSON.stringify(value)}.`)
  return Version.make(value)
}

export const compareCatalogVersions = (left: string, right: string): number => {
  canonicalCatalogVersion(left)
  canonicalCatalogVersion(right)
  return Semver.compare(left, right)
}

const assertDownloads = (downloads: ReadonlyArray<PreparedCatalogDownload>): void => {
  if (downloads.length === 0) throw new Error("Catalog renderer requires at least one download.")
  const architectures = downloads.map((download) => download.architecture)
  if (new Set(architectures).size !== architectures.length) {
    throw new Error("Catalog renderer repeats an architecture.")
  }
  for (const download of downloads) {
    const url = new URL(download.url)
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.hash !== "") {
      throw new Error("Catalog download URLs must be credential-free HTTPS URLs.")
    }
  }
}

const rubyString = (value: string): string => JSON.stringify(value)
const formulaClass = (value: string): string => value.split(/[^A-Za-z0-9]+/u).filter(Boolean)
  .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join("") || "GeneratedFormula"

const homebrewDownload = (download: PreparedCatalogDownload, indent: string): ReadonlyArray<string> => [
  `${indent}url ${rubyString(download.url)}`,
  `${indent}sha256 ${rubyString(download.sha256.hex)}`
]

const renderHomebrew = (
  version: Version,
  renderer: HomebrewRenderer,
  downloads: ReadonlyArray<PreparedCatalogDownload>
): string => {
  const lines = [
    `class ${formulaClass(renderer.name)} < Formula`,
    `  desc ${rubyString(renderer.description)}`,
    `  homepage ${rubyString(renderer.homepage)}`,
    ...(renderer.license === undefined ? [] : [`  license ${rubyString(renderer.license)}`]),
    `  version ${rubyString(version.toString())}`
  ]
  if (downloads.length === 1) {
    lines.push(...homebrewDownload(downloads[0]!, "  "))
  } else {
    lines.push("", "  on_macos do")
    for (const architecture of ["arm64", "x64"] as const) {
      const download = downloads.find((candidate) => candidate.architecture === architecture)
      if (download === undefined) continue
      lines.push(`    ${architecture === "arm64" ? "on_arm" : "on_intel"} do`)
      lines.push(...homebrewDownload(download, "      "))
      lines.push("    end")
    }
    lines.push("  end")
  }
  lines.push(
    "",
    "  def install",
    `    bin.install ${rubyString(renderer.installPath)} => ${rubyString(renderer.name)}`,
    "  end",
    "",
    "  test do",
    `    assert_predicate bin/${rubyString(renderer.name)}, :executable?`,
    "  end",
    "end",
    ""
  )
  return lines.join("\n")
}

const scoopDownload = (download: PreparedCatalogDownload): Readonly<Record<string, string>> => ({
  url: download.url,
  hash: download.sha256.hex
})

const renderScoop = (
  version: Version,
  renderer: ScoopRenderer,
  downloads: ReadonlyArray<PreparedCatalogDownload>
): string => {
  const common: Record<string, unknown> = {
    version: version.toString(),
    description: renderer.description,
    homepage: renderer.homepage,
    ...(renderer.license === undefined ? {} : { license: renderer.license })
  }
  const value = downloads.length === 1
    ? { ...common, ...scoopDownload(downloads[0]!), bin: renderer.bin.toString() }
    : {
      ...common,
      architecture: Object.fromEntries(downloads
        .slice()
        .sort((left, right) => left.architecture < right.architecture ? -1 : 1)
        .map((download) => [download.architecture === "x64" ? "64bit" : "arm64", scoopDownload(download)])),
      bin: renderer.bin.toString()
    }
  return `${JSON.stringify(value, null, 2)}\n`
}

export const renderCatalog = (
  version: Version,
  renderer: CatalogRenderer,
  downloads: ReadonlyArray<PreparedCatalogDownload>
): Uint8Array => {
  canonicalCatalogVersion(version.toString())
  assertDownloads(downloads)
  return new TextEncoder().encode(renderer._tag === "homebrew"
    ? renderHomebrew(version, renderer, downloads)
    : renderScoop(version, renderer, downloads))
}
