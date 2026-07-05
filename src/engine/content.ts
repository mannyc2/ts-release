import type {
  ChecksumFileContent,
  DeferredFileContent,
  HomebrewFormulaContent,
  ScoopManifestContent
} from "../pipeline/operation.js"

export interface ResolvedArtifactHash {
  readonly artifactId: string
  readonly sha256?: string
  readonly algorithm?: "sha256" | "sha512"
  readonly value?: string
}

export interface ResolvedDeferredContent {
  readonly contents: string
  readonly values: ReadonlyArray<ResolvedArtifactHash>
}

const rubyString = (value: string): string =>
  JSON.stringify(value)

const homebrewArchBlock = (arch: "x64" | "arm64"): string =>
  arch === "arm64" ? "on_arm" : "on_intel"

const hashFor = (
  hashes: ReadonlyMap<string, string>,
  artifactId: string
): string => {
  const hash = hashes.get(artifactId)
  if (hash === undefined) {
    throw new Error(`Missing resolved hash for artifact ${artifactId}.`)
  }
  return hash
}

export const deferredContentArtifactIds = (content: DeferredFileContent): ReadonlyArray<string> => {
  switch (content._tag) {
    case "homebrew-formula":
      return content.entries.map((entry) => entry.artifactId)
    case "scoop-manifest":
      return [content.artifactId]
    case "checksum-file":
      return content.entries.map((entry) => entry.artifactId)
  }
}

export const deferredContentDigestAlgorithm = (content: DeferredFileContent): "sha256" | "sha512" =>
  content._tag === "checksum-file" ? content.algorithm : "sha256"

export const renderHomebrewFormulaContent = (
  content: HomebrewFormulaContent,
  hashes: ReadonlyMap<string, string>
): string => {
  const common = [
    `class ${content.className} < Formula`,
    `  desc ${rubyString(content.description)}`,
    `  homepage ${rubyString(content.homepage)}`
  ]
  if (content.entries.length === 1) {
    const entry = content.entries[0]
    if (entry === undefined) {
      throw new Error("Homebrew formula content requires at least one entry.")
    }
    return [
      ...common,
      `  url ${rubyString(entry.url)}`,
      `  sha256 ${rubyString(hashFor(hashes, entry.artifactId))}`,
      `  version ${rubyString(content.version)}`,
      "",
      "  def install",
      ...content.installLines,
      "  end",
      ...content.testLines,
      "end",
      ""
    ].join("\n")
  }

  const variantLines = content.entries.flatMap((entry) => [
    `    ${homebrewArchBlock(entry.arch)} do`,
    `      url ${rubyString(entry.url)}`,
    `      sha256 ${rubyString(hashFor(hashes, entry.artifactId))}`,
    "    end",
    ""
  ])
  return [
    ...common,
    `  version ${rubyString(content.version)}`,
    "",
    "  on_macos do",
    ...variantLines,
    "  end",
    "",
    "  def install",
    ...content.installLines,
    "  end",
    ...content.testLines,
    "end",
    ""
  ].join("\n")
}

export const renderScoopManifestContent = (
  content: ScoopManifestContent,
  hashes: ReadonlyMap<string, string>
): string => {
  const manifest = {
    version: content.version,
    description: content.description,
    homepage: content.homepage,
    ...(content.license === undefined ? {} : { license: content.license }),
    url: content.url,
    hash: hashFor(hashes, content.artifactId),
    ...(content.bin === undefined ? {} : { bin: content.bin })
  }
  return `${JSON.stringify(manifest, null, 2)}\n`
}

export const renderChecksumFileContent = (
  content: ChecksumFileContent,
  hashes: ReadonlyMap<string, string>
): string =>
  content.entries
    .map((entry) => `${hashFor(hashes, entry.artifactId)}  ${entry.baseName}\n`)
    .join("")

export const renderDeferredContent = (
  content: DeferredFileContent,
  hashes: ReadonlyMap<string, string>
): ResolvedDeferredContent => {
  if (content._tag === "homebrew-formula") {
    return {
      contents: renderHomebrewFormulaContent(content, hashes),
      values: content.entries.map((entry) => ({
        artifactId: entry.artifactId,
        sha256: hashFor(hashes, entry.artifactId)
      }))
    }
  }
  if (content._tag === "scoop-manifest") {
    return {
      contents: renderScoopManifestContent(content, hashes),
      values: [{
        artifactId: content.artifactId,
        sha256: hashFor(hashes, content.artifactId)
      }]
    }
  }
  return {
    contents: renderChecksumFileContent(content, hashes),
    values: content.entries.map((entry) => ({
      artifactId: entry.artifactId,
      algorithm: content.algorithm,
      value: hashFor(hashes, entry.artifactId)
    }))
  }
}
