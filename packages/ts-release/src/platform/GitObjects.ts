import { checkedText, nativeText as text } from "./GitProcess.js"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { createHash } from "node:crypto"
import { canonical, decodeOwned, parseCanonical } from "../internal/Identity.js"
import { attempt } from "../internal/Error.js"
import { readVerifiedContent, type ReadContent } from "../internal/Content.js"
import {
  CommitInput,
  FileEdit,
  invalid,
  objectFormat,
  validateFiles,
} from "../internal/GitCatalog.js"
import { checked, type GitCommand, type GitEnvironment } from "./GitProcess.js"

class EncodedObject extends Schema.Class<EncodedObject>("GitEncodedObject")({
  type: Schema.Literals(["blob", "tree", "commit", "tag"]),
  bytesBase64: Schema.String,
}) {}
class ObjectSet extends Schema.Class<ObjectSet>("GitObjectSet")({
  schemaVersion: Schema.Literal("core-git-object-set/v1"),
  objects: Schema.Array(EncodedObject),
}) {}
const encode = (value: unknown) => new TextEncoder().encode(canonical(value))
const ordered = (objects: readonly EncodedObject[]) =>
  [...objects].sort((left, right) => {
    const a = `${left.type}:${left.bytesBase64}`,
      b = `${right.type}:${right.bytesBase64}`
    return a < b ? -1 : a > b ? 1 : 0
  })
const oidOf = (type: string, bytes: Uint8Array, format: "sha1" | "sha256") =>
  createHash(format).update(`${type} ${bytes.length}\0`).update(bytes).digest("hex")
const reachable = Effect.fn("git.reachableObjects")(function* (run: GitCommand, commit: string) {
  const format = objectFormat(commit),
    value = (yield* checkedText(run, ["rev-list", "--objects", "--no-object-names", commit, "--"]))
      .trim()
      .split("\n")
  return yield* attempt(() => {
    if (!value.length || value.some((oid) => objectFormat(oid) !== format)) invalid()
    return [...new Set(value)].sort()
  })
})
export const importObjects = Effect.fn("git.importObjects")(function* (
  run: GitCommand,
  input: Uint8Array,
  format: "sha1" | "sha256",
  limit: number,
) {
  const objects = yield* attempt(() => {
    if (input.length > limit) invalid()
    const value = decodeOwned(ObjectSet, parseCanonical(text(new Uint8Array(input))))
    if (
      !value.objects.length ||
      value.objects.length > 100000 ||
      canonical(value.objects) !== canonical(ordered(value.objects))
    )
      invalid()
    const seen = new Set<string>()
    return value.objects.map((object) => {
      const bytes = Buffer.from(object.bytesBase64, "base64"),
        oid = oidOf(object.type, bytes, format)
      if (bytes.toString("base64") !== object.bytesBase64 || seen.has(oid)) invalid()
      seen.add(oid)
      return { type: object.type, bytes, oid }
    })
  })
  for (const object of objects) {
    const oid = (yield* checkedText(
      run,
      ["hash-object", "-t", object.type, "-w", "--stdin"],
      object.bytes,
    )).trim()
    if (oid !== object.oid) return yield* attempt(invalid)
  }
  return objects.map((object) => object.oid).sort()
})
export const verifyGraph = Effect.fn("git.verifyGraph")(function* (
  run: GitCommand,
  commit: string,
  objects: readonly string[],
) {
  if (canonical(yield* reachable(run, commit)) !== canonical(objects))
    return yield* attempt(invalid)
  yield* checked(run, ["fsck", "--strict", "--no-dangling", "--no-reflogs", commit])
})
export const exportObjects = Effect.fn("git.exportObjects")(function* (
  run: GitCommand,
  commit: string,
  limit: number,
) {
  const ids = yield* reachable(run, commit),
    objects: EncodedObject[] = []
  if (ids.length > 100000) return yield* attempt(invalid)
  let total = 64
  for (const oid of ids) {
    const type = (yield* checkedText(run, ["cat-file", "-t", oid])).trim()
    const size = Number((yield* checkedText(run, ["cat-file", "-s", oid])).trim())
    if (!Number.isSafeInteger(size) || size < 0 || size > limit) return yield* attempt(invalid)
    const bytes = yield* checked(run, ["cat-file", type, oid])
    const object = yield* attempt(() => {
      if (bytes.length !== size || oidOf(type, bytes, objectFormat(commit)) !== oid) invalid()
      return decodeOwned(EncodedObject, {
        type,
        bytesBase64: Buffer.from(bytes).toString("base64"),
      })
    })
    total += canonical(object).length + 1
    if (total > limit) return yield* attempt(invalid)
    objects.push(object)
  }
  return encode(
    new ObjectSet({ schemaVersion: "core-git-object-set/v1", objects: ordered(objects) }),
  )
})
const identityEnvironment = (input: CommitInput): GitEnvironment => {
  const identity: Record<string, string> = {}
  for (const [prefix, value] of [
    ["AUTHOR", input.author],
    ["COMMITTER", input.committer],
  ] as const) {
    const zone = /^([+-])(\d\d)(\d\d)$/u.exec(value.timezone)
    if (
      !value.name ||
      /[<>\u0000-\u001f\u007f]/u.test(value.name) ||
      !/^[^<>\s@]+@[^<>\s@]+$/u.test(value.email) ||
      !/^(0|[1-9][0-9]*)$/u.test(value.timestamp) ||
      !Number.isSafeInteger(Number(value.timestamp)) ||
      !zone ||
      Number(zone[2]) > 14 ||
      Number(zone[3]) > 59
    )
      invalid()
    identity[`GIT_${prefix}_NAME`] = value.name
    identity[`GIT_${prefix}_EMAIL`] = value.email
    identity[`GIT_${prefix}_DATE`] = `@${value.timestamp} ${value.timezone}`
  }
  return { identity }
}
// Include tree entries: recursive leaf-only projections silently omit empty trees.
const treeEntries = Effect.fn("git.treeEntries")(function* (run: GitCommand, tree: string) {
  const output = yield* checkedText(run, ["ls-tree", "-r", "-t", "-z", tree, "--"])
  return yield* attempt(() => {
    const entries = new Map<string, string>()
    for (const row of output.split("\0").filter(Boolean)) {
      const tab = row.indexOf("\t"),
        header = row.slice(0, tab),
        path = row.slice(tab + 1)
      if (
        tab < 0 ||
        !path ||
        entries.has(path) ||
        !/^(?:040000 tree|100644 blob|100755 blob|120000 blob|160000 commit) [0-9a-f]{40}(?:[0-9a-f]{24})?$/u.test(
          header,
        )
      )
        invalid()
      entries.set(path, header)
    }
    return entries
  })
})
const ancestorPaths = (paths: readonly string[]): Set<string> => {
  const ancestors = new Set<string>()
  for (const path of paths) {
    const parts = path.split("/")
    for (let index = 1; index < parts.length; index++)
      ancestors.add(parts.slice(0, index).join("/"))
  }
  return ancestors
}
const graftTrees = Effect.fn("git.graftTrees")(function* (
  run: GitCommand,
  entries: Map<string, string>,
  paths: readonly string[],
) {
  const ancestors = ancestorPaths(paths)
  for (const path of ancestors) {
    if (entries.has(path) && !entries.get(path)!.startsWith("040000 tree "))
      return yield* attempt(invalid)
  }
  const directories = [...ancestors].sort((a, b) => b.split("/").length - a.split("/").length)
  directories.push("")
  let root = ""
  for (const directory of directories) {
    const rows: string[] = []
    for (const [path, header] of entries) {
      const slash = path.lastIndexOf("/"),
        parent = slash < 0 ? "" : path.slice(0, slash)
      if (parent === directory) rows.push(header + "\t" + path.slice(slash + 1) + "\0")
    }
    root = (yield* checkedText(run, ["mktree", "-z"], Buffer.from(rows.join("")))).trim()
    if (directory) entries.set(directory, "040000 tree " + root)
  }
  return root
})
export const verifyManagedCommit = Effect.fn("git.verifyManagedCommit")(function* (
  run: GitCommand,
  read: ReadContent,
  expectedOld: string,
  desiredNew: string,
  input: readonly FileEdit[],
  limit: number,
) {
  const files = yield* attempt(() => {
    const files = decodeOwned(Schema.Array(FileEdit), input)
    validateFiles(files)
    if (objectFormat(expectedOld) !== objectFormat(desiredNew)) invalid()
    return files
  })
  const parents = (yield* checkedText(run, ["rev-list", "--parents", "-n", "1", desiredNew, "--"]))
    .trim()
    .split(" ")
  if (canonical(parents) !== canonical([desiredNew, expectedOld])) return yield* attempt(invalid)
  const before = yield* treeEntries(run, expectedOld),
    after = yield* treeEntries(run, desiredNew)
  const managed = new Set(files.map((file) => file.path)),
    ancestors = ancestorPaths(files.map((file) => file.path))
  for (const path of new Set([...before.keys(), ...after.keys()])) {
    if (managed.has(path)) continue
    if (ancestors.has(path)) {
      if (
        (before.has(path) && !before.get(path)!.startsWith("040000 tree ")) ||
        !after.get(path)?.startsWith("040000 tree ")
      )
        return yield* attempt(invalid)
    } else if (before.get(path) !== after.get(path)) return yield* attempt(invalid)
  }
  for (const path of [...managed, ...ancestors]) {
    if (
      [...after.keys()].some(
        (other) => other !== path && other.toLowerCase() === path.toLowerCase(),
      )
    )
      return yield* attempt(invalid)
  }
  for (const file of files) {
    const bytes = yield* readVerifiedContent(read, file.content, limit)
    if (
      after.get(file.path) !==
      file.mode + " blob " + oidOf("blob", bytes, objectFormat(desiredNew))
    )
      return yield* attempt(invalid)
  }
})
export const construct = Effect.fn("git.constructCommit")(function* (
  run: GitCommand,
  read: ReadContent,
  input: CommitInput,
  limit: number,
) {
  const selected = yield* attempt(() => {
    const value = decodeOwned(CommitInput, input)
    validateFiles(value.files)
    if (!value.message || /[\0\r]/u.test(value.message)) invalid()
    return {
      value,
      environment: identityEnvironment(value),
      format: objectFormat(value.expectedOld),
    }
  })
  const value = selected.value
  const ids = yield* importObjects(
    run,
    yield* readVerifiedContent(read, value.baseObjects, limit),
    selected.format,
    limit,
  )
  yield* verifyGraph(run, value.expectedOld, ids)
  if ((yield* checkedText(run, ["cat-file", "-t", value.expectedOld])).trim() !== "commit")
    return yield* attempt(invalid)
  const entries = yield* treeEntries(run, value.expectedOld)
  for (const file of value.files) {
    const bytes = yield* readVerifiedContent(read, file.content, limit)
    const oid = (yield* checkedText(
      run,
      ["hash-object", "-t", "blob", "-w", "--stdin"],
      bytes,
    )).trim()
    if (oid !== oidOf("blob", bytes, selected.format)) return yield* attempt(invalid)
    if (entries.get(file.path)?.startsWith("040000 tree ")) return yield* attempt(invalid)
    entries.set(file.path, file.mode + " blob " + oid)
  }
  const tree = yield* graftTrees(
    run,
    entries,
    value.files.map((file) => file.path),
  )
  const desiredNew = (yield* checkedText(
    run,
    ["commit-tree", tree, "-p", value.expectedOld],
    new TextEncoder().encode(value.message),
    selected.environment,
  )).trim()
  yield* verifyManagedCommit(run, read, value.expectedOld, desiredNew, value.files, limit)
  const objectSetBytes = yield* exportObjects(run, desiredNew, limit)
  return { desiredNew, objectFormat: selected.format, objectSetBytes }
})
