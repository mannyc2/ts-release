import { expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as Effect from "effect/Effect"
import { GitCas, NoReplay, canonical, createOperation, createPlan, makeCoreGitTransport, makeRequest, type CoreGitOptions } from "../src/index.js"
import { CatalogIntent, binding, catalog, digest, git } from "./git-catalog-fixture.js"

const rootFixture = async () => {
  const root = mkdtempSync(join(tmpdir(), "catalog-objects-"))
  mkdirSync(join(root, "content"))
  const inputs: CatalogIntent[] = []
  for (const index of [1, 2]) {
    const source = join(root, `source-${index}`), remote = join(root, `remote-${index}.git`), ref = "refs/heads/catalog"
    git(["init", "--quiet", source]); git(["-C", source, "config", "user.name", "Catalog fixture"]); git(["-C", source, "config", "user.email", "fixture@example.invalid"])
    git(["init", "--quiet", "--bare", remote]); git(["--git-dir", remote, "config", "core.logAllRefUpdates", "true"])
    writeFileSync(join(source, "untouched"), "retain\n"); git(["-C", source, "add", "."]); git(["-C", source, "commit", "--quiet", "-m", "base"])
    const old = git(["-C", source, "rev-parse", "HEAD"]).toString().trim()
    git(["-C", source, "push", "--quiet", remote, `${old}:${ref}`])
    for (const name of ["one.rb", "two.json"]) writeFileSync(join(source, name), `catalog ${index} ${name}\n`)
    git(["-C", source, "add", "."]); git(["-C", source, "commit", "--quiet", "-m", "both paths atomically"])
    const desired = git(["-C", source, "rev-parse", "HEAD"]).toString().trim()
    const objects = git(["-C", source, "rev-list", "--objects", "--no-object-names", desired]).toString().trim().split("\n").map(oid => {
      const type = git(["-C", source, "cat-file", "-t", oid]).toString().trim()
      return { type, bytesBase64: git(["-C", source, "cat-file", type, oid]).toString("base64") }
    }).sort((a,b) => a.type < b.type ? -1 : a.type > b.type ? 1 : a.bytesBase64 < b.bytesBase64 ? -1 : a.bytesBase64 > b.bytesBase64 ? 1 : 0)
    const bytes = Buffer.from(canonical({ schemaVersion: "core-git-object-set/v1", objects })), hash = digest(bytes)
    writeFileSync(join(root, "content", hash), bytes)
    inputs.push(new CatalogIntent({ remote, ref, expectedOld: old, desiredNew: desired, principal: `principal-${index}`, scope: `catalog-${index}`, objects: { bytes: String(bytes.length), sha256: hash } }))
    rmSync(source, { recursive: true, force: true })
  }
  const operations = await Effect.runPromise(Effect.forEach(inputs, input => createOperation(catalog, input)))
  const plan = await Effect.runPromise(createPlan("owned-git-objects-fixture", operations))
  writeFileSync(join(root, "plan.json"), canonical(plan))
  return { root, inputs, plan }
}
const worker = (root: string, mode: string) => {
  const result = Bun.spawnSync([process.execPath, join(import.meta.dir, "git-catalog-worker.ts"), root, mode], { stdout: "pipe", stderr: "pipe" })
  expect(result.exitCode).toBe(0)
  if (result.exitCode !== 0) throw new Error(result.stderr.toString())
  return JSON.parse(result.stdout.toString()) as { operations: Array<{ status: string }> }
}

test("two Git authorities rehydrate owned native object sets in fresh processes and retain one multi-file CAS each", async () => {
  const { root, inputs } = await rootFixture()
  try {
    expect(worker(root, "lost").operations.filter(x => x.status === "Inconclusive")).toHaveLength(1)
    expect(worker(root, "resume").operations.every(x => x.status === "Satisfied")).toBe(true)
    for (const input of inputs) {
      expect(git(["--git-dir", input.remote, "rev-parse", input.ref]).toString().trim()).toBe(input.desiredNew)
      for (const path of ["one.rb", "two.json", "untouched"]) expect(git(["--git-dir", input.remote, "show", `${input.ref}:${path}`]).length).toBeGreaterThan(0)
      expect(readFileSync(join(input.remote, "logs", input.ref), "utf8").trim().split("\n")).toHaveLength(2)
    }
    const sends = readFileSync(join(root, "pushes.jsonl"), "utf8").trim().split("\n")
    expect(sends).toHaveLength(3)
    expect(worker(root, "again").operations.every(x => x.status === "Satisfied")).toBe(true)
    expect(readFileSync(join(root, "pushes.jsonl"), "utf8").trim().split("\n")).toHaveLength(3)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("owned object-set tampering is rejected before any native push", async () => {
  const { root, inputs } = await rootFixture()
  try {
    for (const input of inputs) writeFileSync(join(root, "content", input.objects.sha256), "tampered")
    expect(worker(root, "resume").operations.every(x => x.status === "Inconclusive")).toBe(true)
    for (const input of inputs) expect(git(["--git-dir", input.remote, "rev-parse", input.ref]).toString().trim()).toBe(input.expectedOld)
    expect(await Bun.file(join(root, "pushes.jsonl")).exists()).toBe(false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test("Git authority table is copied, rejects duplicate/missing authority and uses fallback only for non-Git", async () => {
  let calls = 0, fallbackCalls = 0
  const option: CoreGitOptions = { principal: "a", scope: "s", execute: () => Effect.sync(() => { calls++; return { exitCode: 1, stdout: "" } }) }
  expect(() => makeCoreGitTransport([option, option])).toThrow()
  const entries: [CoreGitOptions, ...CoreGitOptions[]] = [option]
  const transport = makeCoreGitTransport(entries, { send: () => Effect.sync(() => { fallbackCalls++; return { _tag: "Unknown" as const, reason: "non-Git fallback" } }) })
  entries[0] = { ...option, principal: "replaced" }
  const request = await Effect.runPromise(makeRequest({ transport: "core.git/1", endpoint: "/tmp/fixture.git", method: "update-ref", headers: [], body: new Uint8Array(), principal: "a", scope: "s", replay: new GitCas({ ref: "refs/heads/catalog", expectedOld: "1".repeat(40), desiredNew: "2".repeat(40) }) }))
  await Effect.runPromise(transport.send(request)); expect(calls).toBe(1)
  const unknown = await Effect.runPromise(makeRequest({ ...request.facts, body: request.body, principal: "missing" }))
  expect(await Effect.runPromise(transport.send(unknown).pipe(Effect.flip))).toMatchObject({ code: "transport-authority" })
  expect(calls).toBe(1); expect(fallbackCalls).toBe(0)
  const ordinary = await Effect.runPromise(makeRequest({ ...request.facts, body: request.body, transport: "opaque/1", replay: new NoReplay({}) }))
  await Effect.runPromise(transport.send(ordinary)); expect(fallbackCalls).toBe(1)
})
