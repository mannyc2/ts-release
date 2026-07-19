// Invariant: deferred content holes resolve only from canonical artifact facts and never invent another artifact representation.
import type { DeferredFileContent } from "../grammar/operation.js"

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

const hashFor = (hashes: ReadonlyMap<string, string>, artifactId: string): string => {
  const hash = hashes.get(artifactId)
  if (hash === undefined) throw new Error(`Missing resolved hash for artifact ${artifactId}.`)
  return hash
}

export const deferredContentArtifactIds = (content: DeferredFileContent): ReadonlyArray<string> =>
  content.parts.flatMap((part) => typeof part === "string" ? [] : [part.artifactId])

export const renderDeferredContent = (
  content: DeferredFileContent,
  hashes: ReadonlyMap<string, string>
): ResolvedDeferredContent => {
  // Pipes resolve every predictable value; only measured holes reach this fold.
  const holes = content.parts.filter((part) => typeof part !== "string")
  return {
    contents: content.parts.map((part) =>
      typeof part === "string" ? part : hashFor(hashes, part.artifactId)
    ).join(""),
    values: holes.map((hole) => ({ artifactId: hole.artifactId, sha256: hashFor(hashes, hole.artifactId) }))
  }
}
