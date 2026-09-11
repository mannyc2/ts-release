import { Schema } from "effect"
import * as Artifact from "effect-build/Artifact"
import * as Layout from "effect-build/Layout"
import { AdoptionError, type OwnedTree } from "./ArtifactModel.js"

function invalid(reason: string): never {
  throw new AdoptionError({ reason })
}
/** The upstream directory record an owned tree stands for once it has a path. */
export const directoryRecord = (tree: OwnedTree, path: string): Artifact.Directory => ({
  kind: "directory",
  path,
  bytes: tree.bytes,
  sha256: tree.sha256,
  producedBy: tree.producedBy,
  rootMode: tree.rootMode,
  entries: tree.entries,
})
/** Follow a symbolic link through the recorded entries; every hop must stay inside the tree. */
const resolveLink = (
  entries: ReadonlyMap<string, Artifact.Entry>,
  parts: readonly string[],
  base: readonly string[],
  active: ReadonlySet<string>,
): string[] => {
  let current = [...base]
  for (const part of parts) {
    if (current.length && entries.get(current.join("/"))?.kind !== "directory")
      invalid("Symbolic link traverses a regular file")
    if (part === "" || part === ".") continue
    if (part === "..") {
      if (!current.length) invalid("Symbolic link escapes tree")
      current.pop()
      continue
    }
    const name = [...current, part].join("/")
    const entry = entries.get(name)
    if (!entry) invalid("Symbolic link points to an absent entry")
    if (entry.kind !== "symlink") {
      current.push(part)
      continue
    }
    if (active.has(name)) invalid("Symbolic link cycle")
    if (/^[A-Za-z]:|^\/|\\|\0/u.test(entry.linkTarget)) invalid("Nonportable symbolic link")
    // Expand the link before consuming the rest of the path, including any '..'.
    current = resolveLink(entries, entry.linkTarget.split("/"), current, new Set(active).add(name))
  }
  return current
}
/**
 * The laws an owned tree must satisfy before restoration. effect-build's own
 * schema checks entry order, parent directories, the byte total and the manifest
 * digest; the tree's path plays no part in those laws. Portable layout rules and
 * link resolution are release requirements for restoring on any host.
 */
export const checkTree = (tree: OwnedTree): void => {
  if (!Schema.is(Artifact.Directory)(directoryRecord(tree, "/")))
    invalid("Tree entries do not reproduce the recorded tree identity")
  const issue = Layout.validate(tree.entries)
  if (issue !== undefined) invalid(`Tree entry ${JSON.stringify(issue.path)}: ${issue.reason}`)
  const entries = new Map(tree.entries.map((entry) => [entry.path, entry]))
  for (const entry of tree.entries)
    if (entry.kind === "symlink") resolveLink(entries, entry.path.split("/"), [], new Set())
}
