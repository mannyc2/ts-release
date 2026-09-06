/** Research host for retained core-git-object-set/v1, not a production Git host. */
import { createHash } from "node:crypto"
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { GitCas, GitReceipt, LabError, canonical, makeRequest, type CoreGitOptions, type ProviderDefinition } from "../src/index.js"

export const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
export const nativeOid = (type: string, bytes: Uint8Array) => createHash("sha1").update(`${type} ${bytes.length}\0`).update(bytes).digest("hex")
export const git = (args: readonly string[], input?: Uint8Array) => {
  const result = Bun.spawnSync(["git", ...args], { stdout: "pipe", stderr: "pipe", ...(input ? { stdin: input } : {}) })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString())
  return result.stdout
}
export class CatalogIntent extends Schema.Class<CatalogIntent>("CatalogIntent")({
  remote: Schema.String, ref: Schema.String, expectedOld: Schema.String, desiredNew: Schema.String,
  principal: Schema.String, scope: Schema.String, objects: Schema.Struct({ bytes: Schema.String, sha256: Schema.String })
}) {}
export const decodeIntent = Schema.decodeUnknownSync(CatalogIntent, { onExcessProperty: "error" })
export const catalog: ProviderDefinition = {
  definitionId: "fixture.git-catalog", intentVersion: "1", intentCodec: CatalogIntent,
  receiptVersion: "git-push/1", receiptCodec: GitReceipt, classifyReceipt: () => "Satisfied",
  receiptCorresponds: (operation, request, native) => {
    const intent = decodeIntent(operation.intent), receipt = native as GitReceipt
    return request.endpoint === intent.remote && receipt.ref === intent.ref && receipt.desiredNew === intent.desiredNew
  },
  prepare: operation => {
    const input = decodeIntent(operation.intent)
    return makeRequest({ transport: "core.git/1", endpoint: input.remote, method: "update-ref", headers: [], body: new Uint8Array(),
      principal: input.principal, scope: input.scope, replay: new GitCas({ ref: input.ref, expectedOld: input.expectedOld, desiredNew: input.desiredNew }) })
  }
}
const ObjectSet = Schema.Struct({ schemaVersion: Schema.Literal("core-git-object-set/v1"), objects: Schema.Array(Schema.Struct({ type: Schema.Literals(["commit", "tree", "blob", "tag"]), bytesBase64: Schema.String })) })
export const binding = (input: CatalogIntent, root: string, loseResponse = false): CoreGitOptions => ({
  principal: input.principal, scope: input.scope,
  execute: args => Effect.try({ try: () => {
    const expected = ["push", "--porcelain", `--force-with-lease=${input.ref}:${input.expectedOld}`, "--", input.remote, `${input.desiredNew}:${input.ref}`]
    if (canonical(args) !== canonical(expected)) throw new Error("Captured native request tuple changed")
    const bytes = readFileSync(join(root, "content", input.objects.sha256))
    if (String(bytes.length) !== input.objects.bytes || digest(bytes) !== input.objects.sha256) throw new Error("Owned object-set content changed")
    const set = Schema.decodeUnknownSync(ObjectSet, { onExcessProperty: "error" })(JSON.parse(bytes.toString()))
    if (canonical(set) !== bytes.toString() || !set.objects.length) throw new Error("Object-set codec is not canonical")
    const normalized = [...set.objects].sort((a,b) => a.type < b.type ? -1 : a.type > b.type ? 1 : a.bytesBase64 < b.bytesBase64 ? -1 : a.bytesBase64 > b.bytesBase64 ? 1 : 0)
    if (canonical(normalized) !== canonical(set.objects) || new Set(set.objects.map(x => canonical(x))).size !== set.objects.length) throw new Error("Object-set order/uniqueness changed")
    const repository = mkdtempSync(join(root, "fresh-git-"))
    try {
      git(["init", "--quiet", "--bare", repository])
      for (const object of set.objects) {
        const payload = Buffer.from(object.bytesBase64, "base64")
        if (payload.toString("base64") !== object.bytesBase64) throw new Error("Noncanonical object bytes")
        if (git(["--git-dir", repository, "hash-object", "-t", object.type, "-w", "--stdin"], payload).toString().trim() !== nativeOid(object.type, payload)) throw new Error("Native Git object identity changed")
      }
      git(["--git-dir", repository, "cat-file", "-e", `${input.desiredNew}^{commit}`])
      git(["--git-dir", repository, "fsck", "--connectivity-only", "--no-dangling", input.desiredNew])
      appendFileSync(join(root, "pushes.jsonl"), JSON.stringify({ principal: input.principal, scope: input.scope, args }) + "\n")
      const result = Bun.spawnSync(["git", "--git-dir", repository, ...args], { stdout: "pipe", stderr: "pipe" })
      return loseResponse ? { exitCode: 1, stdout: "" } : { exitCode: result.exitCode, stdout: result.stdout.toString() }
    } finally { rmSync(repository, { recursive: true, force: true }) }
  }, catch: cause => new LabError({ code: "git-object-admission", message: String(cause) }) })
})
