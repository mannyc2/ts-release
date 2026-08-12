import { expect, test } from "bun:test"
import { mkdtempSync } from "node:fs"
import { join } from "node:path"
import { runInit } from "../../apps/release-ts/src/cli/commands.js"
import { cliApi, emptyInspection, ioFor } from "./cli-fixture.js"

test("prepare-only init asks the API to inspect once and writes an explicit non-publishing config", async () => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-init-"))
  let calls = 0
  const io = ioFor()
  await runInit(cliApi({ inspect: async () => { calls += 1; return emptyInspection } }),
    { config: "release.config.json", root: ".", dryRun: false, force: false, prepareOnly: true }, root, io)
  expect(calls).toBe(1)
  expect(io.logs.join("\n")).toContain("release.config.json")
})

test("noninteractive init fails promptly without a preset or prepare-only choice", async () => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-init-"))
  await expect(runInit(cliApi(), {
    config: "release.config.json", root: ".", dryRun: false, force: false, prepareOnly: false
  }, root, ioFor())).rejects.toThrow(/--preset bun-npm-github or --prepare-only/u)
})

test("certified preset generates npm and GitHub publication intent", async () => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-init-"))
  const configPath = join(root, "release.config.json")
  let inspected: unknown
  const io = ioFor()
  await runInit(cliApi({ inspect: async (input) => { inspected = input.config; return emptyInspection } }), {
    config: "release.config.json", root: ".", dryRun: false, force: false,
    preset: "bun-npm-github", prepareOnly: false
  }, root, io)
  expect(inspected).toMatchObject({ npmPackage: { path: "." }, publish: { npm: {}, github: {} } })
  expect(JSON.parse(io.read(configPath))).toMatchObject({ publish: { npm: {}, github: {} } })
})
