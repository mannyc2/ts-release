import { describe, expect, test } from "bun:test"
import { mkdtempSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { runRelease } from "../../apps/release-ts/src/cli/commands.js"
import { cliApi, completeReport, ioFor, localPrepared } from "./cli-fixture.js"

test("release command invokes the automatic release API once", async () => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-cli-"))
  const configPath = join(root, "release.config.json")
  writeFileSync(configPath, JSON.stringify({ project: { name: "fixture", version: "1.0.0", tag: "v1.0.0", commit: "abc" } }))
  let calls = 0
  const io = ioFor({ [configPath]: "{}" })
  await runRelease(cliApi({
    release: async () => {
      calls += 1
      return { prepared: localPrepared, report: completeReport }
    }
  }),
    { config: configPath, root }, root, io)
  expect(calls).toBe(1)
  expect(io.logs[0]).toContain("prepared:local:sha256-")
})
