import { Effect } from "effect"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import { Content } from "../../../packages/ts-release/src/Bundle.js"
import type { ReadContent } from "../../../packages/ts-release/src/internal/Content.js"

export const nativeGit = realpathSync(Bun.which("git")!)
export const processOptions = {
  gitExecutable: nativeGit,
  temporaryRoot: tmpdir(),
  timeoutMilliseconds: 5000,
  maximumOutputBytes: 4 * 1024 * 1024,
}
export const limit = processOptions.maximumOutputBytes
export const identity = {
  name: "Native fixture",
  email: "fixture@example.test",
  timestamp: "1700000001",
  timezone: "+0000",
}
export const native = (directory: string, args: string[], input?: Uint8Array) =>
  execFileSync(nativeGit, ["--git-dir", directory, ...args], {
    env: {
      PATH: "/usr/bin:/bin",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_NO_REPLACE_OBJECTS: "1",
      GIT_AUTHOR_NAME: identity.name,
      GIT_AUTHOR_EMAIL: identity.email,
      GIT_COMMITTER_NAME: identity.name,
      GIT_COMMITTER_EMAIL: identity.email,
      GIT_AUTHOR_DATE: "@1700000000 +0000",
      GIT_COMMITTER_DATE: "@1700000000 +0000",
      LC_ALL: "C",
    },
    ...(input === undefined ? {} : { input }),
    timeout: 5000,
    maxBuffer: limit,
    stdio: ["pipe", "pipe", "pipe"],
  })
export const seed = (directory: string) => {
  const blob = native(
    directory,
    ["hash-object", "-t", "blob", "-w", "--stdin"],
    Buffer.from("preserved unmanaged README\n"),
  )
    .toString()
    .trim()
  const empty = native(directory, ["mktree"], new Uint8Array()).toString().trim()
  const formula = native(directory, ["mktree"], Buffer.from(`040000 tree ${empty}\tempty\n`))
    .toString()
    .trim()
  const tree = native(
    directory,
    ["mktree"],
    Buffer.from(
      `100644 blob ${blob}\tREADME.md\n040000 tree ${empty}\tuntouched-empty\n040000 tree ${formula}\tFormula\n`,
    ),
  )
    .toString()
    .trim()
  return native(directory, ["commit-tree", tree], Buffer.from("Initial\n")).toString().trim()
}
export const contentFixture = () => {
  const stored = new Map<string, Uint8Array>()
  const put = (input: string | Uint8Array) => {
    const bytes =
      typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input)
    const content = new Content({
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    })
    stored.set(content.sha256, bytes)
    return content
  }
  const read: ReadContent = (content) =>
    Effect.sync(() => new Uint8Array(stored.get(content.sha256)!))
  return { stored, put, read }
}
