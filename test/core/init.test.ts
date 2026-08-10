import { expect, test } from "bun:test"
import { mkdtempSync } from "node:fs"
import { join } from "node:path"
import { runInit } from "../../apps/release-ts/src/cli/commands.js"
import { cliApi, emptyInspection, ioFor } from "./cli-fixture.js"

test("init asks the API to inspect once and writes minimal authored config", async () => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-init-"))
  let calls = 0
  const io = ioFor()
  await runInit(cliApi({ inspect: async () => { calls += 1; return emptyInspection } }),
    { config: "release.config.json", root: ".", dryRun: false, force: false }, root, io)
  expect(calls).toBe(1)
  expect(io.logs.join("\n")).toContain("release.config.json")
})

