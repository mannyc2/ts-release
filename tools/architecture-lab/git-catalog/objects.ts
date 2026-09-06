/** Bounded research alternative: native Git owns tree/commit/graph parsing.
 * Native process, credentials and scoped repository lifetime remain host-owned. */
import { createHash } from "node:crypto"
import { Effect, Schema } from "effect"
import { canonical, LabError } from "../machine/src/index.js"

export interface Content { readonly bytes: string; readonly sha256: string }
export interface Identity { readonly name: string; readonly email: string; readonly timestamp: string; readonly timezone: string }
export interface FileEdit { readonly path: string; readonly mode: "100644" | "100755"; readonly content: Content }
export interface CommitInput {
  readonly expectedOld: string; readonly baseObjects: Content; readonly files: readonly FileEdit[]
  readonly message: string; readonly author: Identity; readonly committer: Identity
}
export type ReadContent = (content: Content) => Effect.Effect<Uint8Array, LabError>
export type GitCommand = (args: readonly string[], input?: Uint8Array, identity?: Readonly<Record<string, string>>) => Effect.Effect<Uint8Array, LabError>
export class EncodedObject extends Schema.Class<EncodedObject>("GitEncodedObject")({
  type: Schema.Literals(["blob", "tree", "commit", "tag"]), bytesBase64: Schema.String
}) {}
export class ObjectSet extends Schema.Class<ObjectSet>("GitObjectSet")({
  schemaVersion: Schema.Literal("core-git-object-set/v1"), objects: Schema.Array(EncodedObject)
}) {}
const attempt = <A>(body: () => A) => Effect.try({ try: body, catch: error => new LabError({ code: "git-objects", message: String(error) }) })
const text = (bytes: Uint8Array) => new TextDecoder("utf-8", { fatal: true }).decode(bytes)
const encoding = new TextEncoder()
const reject = (message: string): never => { throw new Error(message) }
const format = (oid: string) => /^[0-9a-f]{40}$/.test(oid) ? "sha1" : /^[0-9a-f]{64}$/.test(oid) ? "sha256" : reject("Full native OID required")
const oidOf = (kind: string, bytes: Uint8Array, algorithm: "sha1" | "sha256") => createHash(algorithm).update(`${kind} ${bytes.length}\0`).update(bytes).digest("hex")
const readVerified = Effect.fn(function*(read: ReadContent, content: Content) {
  const bytes = yield* read(content)
  yield* attempt(() => {
    if (!/^(0|[1-9][0-9]*)$/.test(content.bytes) || String(bytes.length) !== content.bytes || createHash("sha256").update(bytes).digest("hex") !== content.sha256) reject("Owned content changed")
  })
  return bytes
})
const ordered = (objects: readonly EncodedObject[]) => [...objects].sort((a, b) => a.type < b.type ? -1 : a.type > b.type ? 1 : a.bytesBase64 < b.bytesBase64 ? -1 : a.bytesBase64 > b.bytesBase64 ? 1 : 0)
export const importObjects = Effect.fn(function*(run: GitCommand, bytes: Uint8Array, objectFormat: "sha1" | "sha256") {
  const objects = yield* attempt(() => {
    const value = Schema.decodeUnknownSync(ObjectSet, { onExcessProperty: "error" })(JSON.parse(text(bytes)))
    if (canonical(value) !== text(bytes) || canonical(value.objects) !== canonical(ordered(value.objects)) || !value.objects.length) reject("Noncanonical object-set")
    const seen = new Set<string>()
    return value.objects.map(object => {
      const payload = Buffer.from(object.bytesBase64, "base64"), oid = oidOf(object.type, payload, objectFormat)
      if (payload.toString("base64") !== object.bytesBase64 || seen.has(oid)) reject("Duplicate or noncanonical object bytes")
      seen.add(oid)
      return { ...object, payload, oid }
    })
  })
  for (const object of objects) {
    const inserted = text(yield* run(["hash-object", "-t", object.type, "-w", "--stdin"], object.payload)).trim()
    if (inserted !== object.oid) return yield* new LabError({ code: "git-native-hash", message: "Git native object ID differs" })
  }
})
export const exportObjects = Effect.fn(function*(run: GitCommand, commit: string) {
  yield* attempt(() => format(commit))
  const identities = text(yield* run(["rev-list", "--objects", "--no-object-names", commit, "--"])).trim().split("\n")
  const objects: EncodedObject[] = []
  for (const oid of [...new Set(identities)]) {
    const type = text(yield* run(["cat-file", "-t", oid])).trim()
    const payload = yield* run(["cat-file", type, oid])
    const object = yield* attempt(() => {
      if (oidOf(type, payload, format(commit)) !== oid) reject("Native read changed identity")
      return Schema.decodeUnknownSync(EncodedObject)({ type, bytesBase64: Buffer.from(payload).toString("base64") })
    })
    objects.push(object)
  }
  return encoding.encode(canonical(new ObjectSet({ schemaVersion: "core-git-object-set/v1", objects: ordered(objects) })))
})
const identityEnvironment = (input: CommitInput) => {
  const result: Record<string, string> = {}
  for (const [prefix, identity] of [["AUTHOR", input.author], ["COMMITTER", input.committer]] as const) {
    if (!identity.name || identity.name !== identity.name.normalize("NFC") || /[<>\u0000-\u001f\u007f]/.test(identity.name) || !/^[^<>\s@]+@[^<>\s@]+$/.test(identity.email)) reject("Unsafe commit identity")
    const timezone = /^([+-])(\d\d)(\d\d)$/.exec(identity.timezone)
    if (!/^(0|[1-9][0-9]*)$/.test(identity.timestamp) || !timezone || Number(timezone[2]) > 14 || Number(timezone[3]) > 59) reject("Invalid native commit time")
    result[`GIT_${prefix}_NAME`] = identity.name
    result[`GIT_${prefix}_EMAIL`] = identity.email
    result[`GIT_${prefix}_DATE`] = `@${identity.timestamp} ${identity.timezone}`
  }
  return result
}
const validateFiles = (files: readonly FileEdit[]) => {
  const names = new Set<string>()
  if (!files.length) reject("At least one managed file required")
  for (const file of files) {
    if (file.mode !== "100644" && file.mode !== "100755") reject("Invalid managed file mode")
    if (file.path !== file.path.normalize("NFC") || /[\\\u0000-\u001f\u007f]/.test(file.path) || file.path.split("/").some(part => !part || part === "." || part === ".." || part.toLowerCase() === ".git")) reject("Invalid managed path")
    if (names.has(file.path) || [...names].some(name => name.startsWith(file.path + "/") || file.path.startsWith(name + "/"))) reject("Duplicate or nested managed paths")
    names.add(file.path)
  }
}
export const verifyManagedCommit = Effect.fn(function*(run: GitCommand, read: ReadContent, expectedOld: string, desiredNew: string, files: readonly FileEdit[]) {
  yield* attempt(() => { if (format(expectedOld) !== format(desiredNew)) reject("Mixed object formats"); validateFiles(files) })
  const parents = text(yield* run(["rev-list", "--parents", "-n", "1", desiredNew, "--"])).trim().split(" ")
  if (canonical(parents) !== canonical([desiredNew, expectedOld])) return yield* new LabError({ code: "git-parent", message: "Desired commit must have exactly the expected parent" })
  const changed = text(yield* run(["diff-tree", "--no-commit-id", "--no-renames", "--name-only", "-r", "-z", expectedOld, desiredNew, "--"])).split("\0").filter(Boolean)
  if (changed.some(path => !files.some(file => file.path === path))) return yield* new LabError({ code: "git-unmanaged", message: "Desired commit changes an unmanaged path" })
  for (const file of files) {
    const bytes = yield* readVerified(read, file.content)
    const entry = text(yield* run(["--literal-pathspecs", "ls-tree", "-z", desiredNew, "--", file.path]))
    const expected = `${file.mode} blob ${oidOf("blob", bytes, format(desiredNew))}\t${file.path}\0`
    if (entry !== expected) return yield* new LabError({ code: "git-managed", message: "Managed native blob/mode differs from owned content" })
  }
  yield* run(["fsck", "--strict", "--no-dangling", desiredNew])
})
/** Caller provides a new empty, private native repository in this object format. */
export const construct = Effect.fn(function*(run: GitCommand, read: ReadContent, input: CommitInput) {
  const objectFormat = yield* attempt(() => { validateFiles(input.files); return format(input.expectedOld) })
  const identity = yield* attempt(() => identityEnvironment(input))
  yield* attempt(() => { if (!input.message || input.message !== input.message.normalize("NFC") || /[\0\r]/.test(input.message)) reject("Invalid commit message") })
  yield* importObjects(run, yield* readVerified(read, input.baseObjects), objectFormat)
  if (text(yield* run(["cat-file", "-t", input.expectedOld])).trim() !== "commit") return yield* new LabError({ code: "git-base", message: "Expected old must be a native commit" })
  yield* run(["read-tree", input.expectedOld])
  for (const file of input.files) {
    const bytes = yield* readVerified(read, file.content)
    const oid = text(yield* run(["hash-object", "-t", "blob", "-w", "--stdin"], bytes)).trim()
    if (oid !== oidOf("blob", bytes, objectFormat)) return yield* new LabError({ code: "git-blob", message: "Inserted native blob differs" })
    yield* run(["update-index", "--add", "--cacheinfo", file.mode, oid, file.path])
  }
  const tree = text(yield* run(["write-tree"])).trim()
  const desiredNew = text(yield* run(["commit-tree", tree, "-p", input.expectedOld], encoding.encode(input.message), identity)).trim()
  yield* verifyManagedCommit(run, read, input.expectedOld, desiredNew, input.files)
  return { desiredNew, objectFormat, objectSetBytes: yield* exportObjects(run, desiredNew) }
})
