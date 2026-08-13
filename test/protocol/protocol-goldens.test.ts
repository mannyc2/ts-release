import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  encodeProtocolJsonLines,
  httpExchange,
  processSpawn,
  streamFailure
} from "./events.js"

const goldenRoots = [
  join(import.meta.dir, "github", "golden"),
  join(import.meta.dir, "npm", "golden")
]

const goldenFiles = (): ReadonlyArray<string> => goldenRoots.flatMap((root) =>
  readdirSync(root).filter((name) => name.endsWith(".jsonl")).map((name) => join(root, name)))

const forbidden = [
  /authorization\s*[:=]\s*(?!["']?<redacted>)/iu,
  /(?:bearer|basic)\s+(?!<redacted>)[A-Za-z0-9._~+\/-]+/iu,
  /(?:gh[pousr]_|npm_)[A-Za-z0-9_]{8,}/u,
  /(?:NPM_TOKEN|NODE_AUTH_TOKEN|ACTIONS_ID_TOKEN_REQUEST_TOKEN)\s*[:=]\s*[^,}\s]+/u,
  /(?:_authToken|password|secret)\s*[:=]\s*(?!["']?<redacted>)[^,}\s]+/iu,
  /sentinel-(?:token|secret|authority)/iu
]

describe("persisted provider protocol transcripts", () => {
  test("all GitHub and npm goldens are JSONL and pass the global credential denylist", () => {
    const files = goldenFiles()
    expect(files).toHaveLength(6)
    for (const file of files) {
      const contents = readFileSync(file, "utf8")
      expect(contents.endsWith("\n")).toBe(true)
      for (const line of contents.trim().split("\n")) expect(() => JSON.parse(line)).not.toThrow()
      for (const pattern of forbidden) expect(contents).not.toMatch(pattern)
    }
  })

  test("the persistence sanitizer removes header, URL, argv, cwd, and stream sentinels", () => {
    const sentinel = "sentinel-token-global-denylist"
    const transcript = encodeProtocolJsonLines([
      httpExchange({
        provider: "npm",
        phase: "observe",
        method: "GET",
        url: `https://registry.example.test/pkg?token=${sentinel}`,
        requestHeaders: { authorization: `Bearer ${sentinel}`, "x-note": `Bearer ${sentinel}` }
      }),
      processSpawn({
        provider: "npm",
        phase: "mutate",
        argv: ["npm", "publish", "fixture.tgz", "--userconfig", `/tmp/${sentinel}`],
        cwd: `/workspace/${sentinel}`,
        environmentNames: []
      }),
      streamFailure({
        provider: "npm",
        phase: "mutate",
        stream: "stderr",
        reason: `Bearer ${sentinel}`
      })
    ])
    expect(transcript).not.toContain(sentinel)
    expect(transcript).toContain("<redacted>")
    expect(transcript).toContain("<redacted-userconfig>")
  })
})
