import { strict as assert } from "node:assert"
import { execFileSync } from "node:child_process"
import { chmodSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { Effect, FileSystem } from "effect"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Artifact from "effect-build/Artifact"
import * as File from "effect-build/Author/File"
import { adoptFile, finalize, OwnedFile, OwnedBundle, type OwnedTree } from "../apple/adoption.js"
import { fileContentOwner } from "../apple/content-owner.js"
import { renderSha256Sums, verifySha256Sums, type ChecksumInput } from "./checksums.js"

export const runChecksumFixture = async () => {
  const directory = mkdtempSync(join(tmpdir(), "checksum-native-")), checks: string[] = []
  const owner = fileContentOwner(join(directory, "objects"))
  const run = <A,E,R>(effect: Effect.Effect<A,E,R>) => Effect.runPromise(effect.pipe(Effect.provide(NodeServices.layer)) as Effect.Effect<A,E>)
  const reject = async (name: string, operation: Promise<unknown>) => { await assert.rejects(operation); checks.push(name) }
  try {
    const make = async (name: string, payload: string) => {
      const produced = await run(File.publish({ destination: join(directory, name), observation: "hashed", provenance: Artifact.intrinsicProvenance("checksum-research/source") }, path => Effect.gen(function*() {
        const fs = yield* FileSystem.FileSystem; yield* fs.writeFileString(path, payload)
      })))
      return run(adoptFile(owner, name, produced))
    }
    const a = await make("a.bin", "alpha\n"), b = await make("b.bin", "beta\n"), c = await make("c.bin", "gamma\n")
    const bundle = await run(finalize([a, b, c]))
    const entries: ChecksumInput[] = [{ publicName: "🚀.bin", file: b }, { publicName: "space name.bin", file: c }, { publicName: "\ue000.bin", file: a }]
    const bytes = await run(renderSha256Sums(bundle, entries))
    const lines = new TextDecoder().decode(bytes).split("\n")
    assert.equal(lines[0], `${c.content.sha256}  space name.bin`)
    assert.equal(lines[1], `${a.content.sha256}  \ue000.bin`)
    assert.equal(lines[2], `${b.content.sha256}  🚀.bin`)
    assert.equal(lines[3], ""); checks.push("two-space-LF-unicode-code-point-order")
    assert.deepEqual(await run(renderSha256Sums(bundle, [...entries].reverse())), bytes); checks.push("caller-order-does-not-change-bytes")
    await run(verifySha256Sums(bundle, entries, bytes, owner.verify)); checks.push("owned-content-verified")
    const native = join(directory, "native"); mkdirSync(native)
    for (const entry of entries) writeFileSync(join(native, entry.publicName), await run(owner.read(entry.file.content)))
    writeFileSync(join(native, "SHA256SUMS"), bytes)
    execFileSync("sha256sum", ["--check", "--strict", "SHA256SUMS"], { cwd: native, stdio: "pipe" }); checks.push("native-sha256sum-check")
    await reject("duplicate-public-name", run(renderSha256Sums(bundle, [{ publicName: "same", file: a }, { publicName: "same", file: b }])))
    await reject("case-colliding-public-name", run(renderSha256Sums(bundle, [{ publicName: "Same", file: a }, { publicName: "same", file: b }])))
    await reject("artifact-alias", run(renderSha256Sums(bundle, [{ publicName: "one", file: a }, { publicName: "two", file: a }])))
    await reject("traversal-name", run(renderSha256Sums(bundle, [{ publicName: "../escape", file: a }])))
    await reject("newline-name", run(renderSha256Sums(bundle, [{ publicName: "line\nname", file: a }])))
    await reject("non-NFC-name", run(renderSha256Sums(bundle, [{ publicName: "e\u0301.bin", file: a }])))
    await reject("checksum-self-reference", run(renderSha256Sums(bundle, [{ publicName: "SHA256SUMS", file: a }])))
    await reject("changed-file-mode", run(renderSha256Sums(bundle, [{ publicName: "a", file: new OwnedFile({ ...a, deliveryMode: Artifact.fileMode(0o755) }) }])))
    await reject("foreign-bundle-member", run(renderSha256Sums(await run(finalize([b])), [{ publicName: "a", file: a }])))
    await reject("invalid-bundle-collision", run(renderSha256Sums(new OwnedBundle({ format: "lab/owned-bundle/1", artifacts: [a, a] }), [{ publicName: "a", file: a }])))
    const tree = { ...a, _tag: "OwnedTree" } as unknown as OwnedTree
    await reject("Tree-is-not-a-file-digest", run(renderSha256Sums(bundle, [{ publicName: "tree", file: tree as unknown as OwnedFile }])))
    await reject("CRLF-is-not-native-exact-view", run(verifySha256Sums(bundle, entries, new TextEncoder().encode(new TextDecoder().decode(bytes).replaceAll("\n", "\r\n")), owner.verify)))
    const changed = bytes.slice(); changed[0] = changed[0] === 48 ? 49 : 48
    await reject("tampered-checksum-bytes", run(verifySha256Sums(bundle, entries, changed, owner.verify)))
    const contentPath = join(directory, "objects", a.content.sha256), content = readFileSync(contentPath); content[0] = content[0]! ^ 1; chmodSync(contentPath, 0o600); writeFileSync(contentPath, content)
    await reject("tampered-owned-file", run(verifySha256Sums(bundle, entries, bytes, owner.verify)))
    writeFileSync(join(native, "\ue000.bin"), content)
    assert.throws(() => execFileSync("sha256sum", ["--check", "--strict", "SHA256SUMS"], { cwd: native, stdio: "pipe" })); checks.push("native-rejects-tampered-file")
    return { checks, checksPassed: checks.length, native: execFileSync("sha256sum", ["--version"], { encoding: "utf8" }).split("\n")[0], upstream: "effect-build@0.6.3", livePublication: false }
  } finally { rmSync(directory, { recursive: true, force: true }) }
}
if (import.meta.main) console.log(JSON.stringify(await runChecksumFixture()))
