import { createHash } from "node:crypto"
import { Schema } from "effect"
import type * as Artifact from "effect-build/Artifact"
import { Tree } from "../../../packages/ts-release/src/Bundle.js"

export const producedBy = { name: "fixture-producer", version: "0.0.0" }

/**
 * effect-build's persisted directory identity: SHA-256 over JSON tuples in this
 * exact field order. `adoption.test.ts` checks this against a real
 * `Artifact.directory` observation so the fixture cannot drift from upstream.
 */
export const manifestSha256 = (entries: readonly Artifact.Entry[]): string =>
  createHash("sha256")
    .update(
      `[${entries
        .map((entry) =>
          JSON.stringify([
            entry.kind,
            entry.mode,
            entry.bytes,
            entry.sha256,
            entry.linkTarget,
            entry.path,
          ]),
        )
        .join(",")}]`,
    )
    .digest("hex")

export const treeEntries = {
  file: (path: string, content: { bytes: number; sha256: string }, mode = 0o644) =>
    ({ kind: "file", path, mode, bytes: content.bytes, sha256: content.sha256 }) as const,
  directory: (path: string, mode = 0o755) => ({ kind: "directory", path, mode, bytes: 0 }) as const,
  symlink: (path: string, linkTarget: string) =>
    ({ kind: "symlink", path, mode: 0o777, bytes: 0, linkTarget }) as const,
}

/** An owned tree whose identity is derived from its entries, sorted the way effect-build sorts. */
export const ownedTree = (
  logicalName: string,
  entries: readonly Artifact.Entry[],
  rootMode = 0o755,
): Tree => {
  const sorted = [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  return Schema.decodeUnknownSync(Tree)({
    _tag: "OwnedTree",
    logicalName,
    bytes: sorted.reduce((total, entry) => total + entry.bytes, 0),
    sha256: manifestSha256(sorted),
    rootMode,
    entries: sorted,
    producedBy,
  })
}
