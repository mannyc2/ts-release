import { test, expect } from "bun:test"
import { execFileSync } from "node:child_process"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createHash } from "node:crypto"
import { Effect } from "effect"
import { canonical, LabError } from "../machine/src/index.js"
import { construct, exportObjects, importObjects, verifyManagedCommit, type Content, type GitCommand, type ReadContent } from "./objects.js"

const env = { PATH: process.env.PATH!, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_TERMINAL_PROMPT: "0", GIT_NO_REPLACE_OBJECTS: "1", GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.test", GIT_COMMITTER_NAME: "Fixture", GIT_COMMITTER_EMAIL: "fixture@example.test", GIT_AUTHOR_DATE: "@1700000000 +0000", GIT_COMMITTER_DATE: "@1700000000 +0000", LC_ALL: "C" }
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
const command = (directory: string): GitCommand => (args, input, identity) => Effect.try({
  try: () => execFileSync("git", ["--git-dir", directory, ...args], { env: { ...env, ...identity }, ...(input ? { input } : {}), timeout: 10000, maxBuffer: 4 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] }),
  catch: error => new LabError({ code: "fixture-git", message: String(error) })
})
for (const objectFormat of ["sha1", "sha256"] as const) test(`native ${objectFormat} tree graft and full owned graph reload`, async () => {
  const root = mkdtempSync(join(tmpdir(), "native-git-objects-"))
  const stored = new Map<string, Uint8Array>()
  const put = (value: string | Uint8Array): Content => {
    const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value.slice(), content = { bytes: String(bytes.length), sha256: hash(bytes) }
    stored.set(content.sha256, bytes); return content
  }
  const read: ReadContent = content => Effect.succeed(stored.get(content.sha256)!.slice())
  const makeRepo = (name: string) => {
    const path = join(root, name)
    execFileSync("git", ["init", "--quiet", "--bare", `--object-format=${objectFormat}`, "--template=", path], { env })
    return command(path)
  }
  try {
    const original = makeRepo("original"), build = makeRepo("builder"), restart = makeRepo("restart")
    const initialBlob = Buffer.from("keep this unrelated content\n")
    const oid = Buffer.from(await Effect.runPromise(original(["hash-object", "-t", "blob", "-w", "--stdin"], initialBlob))).toString().trim()
    const tree = Buffer.from(await Effect.runPromise(original(["mktree"], Buffer.from(`100644 blob ${oid}\tREADME.md\n`)))).toString().trim()
    const expectedOld = Buffer.from(await Effect.runPromise(original(["commit-tree", tree], Buffer.from("Initial\n")))).toString().trim()
    const baseObjects = put(await Effect.runPromise(exportObjects(original, expectedOld)))
    const files = [{ path: "Formula/tool.rb", mode: "100644" as const, content: put("class Tool < Formula\nend\n") }, { path: "bin/check", mode: "100755" as const, content: put("#!/bin/sh\nexit 0\n") }]
    const identity = { name: "Fixture", email: "fixture@example.test", timestamp: "1700000001", timezone: "+0000" }
    const input = { expectedOld, baseObjects, files, message: "Release catalog\n", author: identity, committer: identity }
    const result = await Effect.runPromise(construct(build, read, input))
    expect(result.objectFormat).toBe(objectFormat)
    expect(result.desiredNew).toHaveLength(objectFormat === "sha1" ? 40 : 64)
    expect(Buffer.from(await Effect.runPromise(build(["show", `${result.desiredNew}:README.md`]))).equals(initialBlob)).toBe(true)
    const copy = await Effect.runPromise(construct(makeRepo("deterministic"), read, input))
    expect(copy.desiredNew).toBe(result.desiredNew)
    expect(Buffer.from(copy.objectSetBytes).equals(Buffer.from(result.objectSetBytes))).toBe(true)
    rmSync(join(root, "original"), { recursive: true })
    rmSync(join(root, "builder"), { recursive: true })
    await Effect.runPromise(importObjects(restart, result.objectSetBytes, objectFormat))
    await Effect.runPromise(verifyManagedCommit(restart, read, expectedOld, result.desiredNew, files))
    expect(Buffer.from(await Effect.runPromise(restart(["show", `${result.desiredNew}:bin/check`]))).toString()).toBe("#!/bin/sh\nexit 0\n")
    await expect(Effect.runPromise(verifyManagedCommit(restart, read, expectedOld, result.desiredNew, [files[0]!]))).rejects.toThrow("unmanaged")
    await expect(Effect.runPromise(verifyManagedCommit(restart, read, expectedOld, result.desiredNew, [{ ...files[1]!, mode: "100644" }, files[0]!]))).rejects.toThrow("blob/mode")
    await expect(Effect.runPromise(construct(makeRepo("bad-path"), read, { ...input, files: [{ ...files[0]!, path: "../escape" }] }))).rejects.toThrow("Invalid managed path")
    await expect(Effect.runPromise(construct(makeRepo("duplicate"), read, { ...input, files: [files[0]!, files[0]!] }))).rejects.toThrow("Duplicate")
    await expect(Effect.runPromise(construct(makeRepo("nested"), read, { ...input, files: [{ ...files[0]!, path: "Formula" }, files[0]!] }))).rejects.toThrow("nested")
    await expect(Effect.runPromise(construct(makeRepo("bad-time"), read, { ...input, author: { ...identity, timezone: "+9900" } }))).rejects.toThrow("commit time")
    const duplicateSet = JSON.parse(Buffer.from(result.objectSetBytes).toString())
    duplicateSet.objects.push(duplicateSet.objects.at(-1))
    await expect(Effect.runPromise(importObjects(makeRepo("duplicate-objects"), Buffer.from(canonical(duplicateSet)), objectFormat))).rejects.toThrow("Duplicate")
    const bytes = stored.get(files[0]!.content.sha256)!
    bytes[0] = bytes[0]! ^ 1
    await expect(Effect.runPromise(verifyManagedCommit(restart, read, expectedOld, result.desiredNew, files))).rejects.toThrow("Owned content changed")
  } finally { rmSync(root, { recursive: true, force: true }) }
})
