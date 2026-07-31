import { readFileSync, statSync } from "node:fs"
import { hashFramed } from "./canonical-json.js"

const excluded = (path: string): boolean =>
  path.startsWith("contracts/rewrite/reports/") || path.startsWith("plans/")

const git = (root: string, args: ReadonlyArray<string>): string => {
  const result = Bun.spawnSync(["git", ...args], {
    cwd: root,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe"
  })
  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString().trim()}`)
  }
  return result.stdout.toString()
}

const currentEntries = (
  root: string
): ReadonlyArray<{ readonly path: string; readonly mode: string; readonly bytes: Uint8Array }> =>
  git(root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
    .split("\0")
    .filter((path) => path.length > 0 && !excluded(path))
    .sort()
    .map((path) => {
      const absolute = `${root}/${path}`
      const mode = (statSync(absolute).mode & 0o111) === 0 ? "100644" : "100755"
      return { path, mode, bytes: readFileSync(absolute) }
    })

const treeEntries = (
  root: string,
  revision: string
): ReadonlyArray<{ readonly path: string; readonly mode: string; readonly bytes: Uint8Array }> => {
  const records = git(root, ["ls-tree", "-rz", "-r", revision])
    .split("\0")
    .filter((record) => record.length > 0)
  return records.flatMap((record) => {
    const match = /^([0-7]{6}) [^ ]+ ([a-f0-9]+)\t(.+)$/u.exec(record)
    if (match === null) throw new Error(`Invalid git ls-tree record: ${record}`)
    const [, mode, object, path] = match
    if (path === undefined || object === undefined || mode === undefined || excluded(path)) return []
    const result = Bun.spawnSync(["git", "cat-file", "blob", object], {
      cwd: root,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe"
    })
    if (result.exitCode !== 0) throw new Error(`Unable to read git blob ${object}.`)
    return [{ path, mode, bytes: result.stdout }]
  })
}

export const repositorySnapshotHash = (
  root: string,
  revision?: string
): string => {
  const entries = revision === undefined ? currentEntries(root) : treeEntries(root, revision)
  const parts: Array<Uint8Array | string> = []
  for (const entry of entries) parts.push(entry.path, entry.mode, entry.bytes)
  return hashFramed("ts-release/repository-snapshot/v1", parts)
}
