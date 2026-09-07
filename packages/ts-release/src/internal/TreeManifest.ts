import {
  AdoptionError,
  OwnedTree,
  MAX_BUFFERED_TREE_BYTES,
  MAX_TREE_ENTRIES,
} from "./ArtifactModel.js"
import { compareText } from "./Identity.js"

function invalid(reason: string): never {
  throw new AdoptionError({ reason })
}
/** Preserve the upstream ordered manifest preimage; canonical key sorting changes its ID. */
export const treeManifest = (tree: OwnedTree): string => {
  if (BigInt(tree.totalBytes) > MAX_BUFFERED_TREE_BYTES || tree.entries.length > MAX_TREE_ENTRIES)
    invalid("Tree exceeds admitted snapshot capacity")
  const names = new Map<string, (typeof tree.entries)[number]>()
  const folded = new Set<string>()
  let previous = "",
    total = 0n
  for (const entry of tree.entries) {
    if (
      compareText(entry.relativePath, previous) <= 0 ||
      folded.has(entry.relativePath.toLowerCase())
    )
      invalid("Tree paths are repeated, case-colliding or unsorted")
    previous = entry.relativePath
    folded.add(entry.relativePath.toLowerCase())
    names.set(entry.relativePath, entry)
    if (entry._tag === "TreeFile") total += BigInt(entry.content.bytes)
  }
  if (String(total) !== tree.totalBytes) invalid("Tree total differs from file identities")
  const resolve = (
    parts: readonly string[],
    base: readonly string[],
    active: ReadonlySet<string>,
  ): string[] => {
    let current = [...base]
    for (const part of parts) {
      if (current.length && names.get(current.join("/"))?._tag !== "TreeDirectory")
        invalid("Symbolic link traverses a regular file")
      if (part === "" || part === ".") continue
      if (part === "..") {
        if (!current.length) invalid("Symbolic link escapes tree")
        current.pop()
        continue
      }
      const name = [...current, part].join("/"),
        entry = names.get(name)
      if (!entry) invalid("Symbolic link points to an absent entry")
      if (entry._tag !== "TreeLink") {
        current.push(part)
        continue
      }
      if (active.has(name)) invalid("Symbolic link cycle")
      if (
        !entry.target ||
        entry.target.startsWith("/") ||
        entry.target.includes("\\") ||
        entry.target.includes("\0") ||
        /^[A-Za-z]:/.test(entry.target)
      )
        invalid("Nonportable symbolic link")
      // Expand the link before consuming the remaining path, including any '..'.
      current = resolve(entry.target.split("/"), current, new Set(active).add(name))
    }
    return current
  }
  for (const entry of tree.entries) {
    const parent = entry.relativePath.split("/").slice(0, -1).join("/")
    if (parent && names.get(parent)?._tag !== "TreeDirectory")
      invalid("Tree entry has no directory parent")
    if (entry._tag === "TreeLink") resolve(entry.relativePath.split("/"), [], new Set())
  }
  const entries = tree.entries.map((entry) =>
    entry._tag === "TreeFile"
      ? {
          kind: "file",
          relativePath: entry.relativePath,
          mode: entry.mode,
          bytes: entry.content.bytes,
          digest: { algorithm: "sha256", value: entry.content.sha256 },
        }
      : entry._tag === "TreeDirectory"
        ? { kind: "directory", relativePath: entry.relativePath, mode: entry.mode }
        : { kind: "symbolic-link", relativePath: entry.relativePath, target: entry.target },
  )
  return JSON.stringify({ rootMode: tree.rootMode, totalBytes: tree.totalBytes, entries })
}
