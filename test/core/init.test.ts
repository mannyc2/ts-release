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
  const inspected: Array<unknown> = []
  const io = ioFor()
  await runInit(cliApi({ inspect: async (input) => {
    inspected.push(input.config)
    return inspected.length === 1
      ? {
        source: { repository: "owner/fixture" },
        package: {}
      } as typeof emptyInspection
      : emptyInspection
  } }), {
    config: "release.config.json", root: ".", dryRun: false, force: false,
    preset: "bun-npm-github", prepareOnly: false
  }, root, io)
  const generated = {
    project: { repository: "owner/fixture" },
    versionFrom: "manifest",
    npmPackage: { path: "." },
    publish: {
      npm: {
        registry: "https://registry.npmjs.org/",
        authentication: {
          strategy: "trusted-publishing",
          attestation: {
            provider: "github-actions",
            runner: "github-hosted",
            repository: "owner/fixture",
            workflow: "release.yml",
            workflowRef: "refs/heads/main",
            allowedAction: "npm-publish-direct"
          }
        },
        access: "public",
        provenance: "automatic"
      },
      github: {
        repository: "owner/fixture",
        tokenEnv: "GITHUB_TOKEN",
        draft: true,
        prerelease: false
      }
    }
  }
  expect(inspected).toEqual([
    { project: {}, versionFrom: "manifest", publish: {} },
    generated
  ])
  expect(JSON.parse(io.read(configPath))).toEqual(generated)
})

test("publishing preset refuses to guess a missing repository coordinate", async () => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-init-"))
  await expect(runInit(cliApi({ inspect: async () => ({
    source: {},
    package: {}
  } as typeof emptyInspection) }), {
    config: "release.config.json", root: ".", dryRun: false, force: false,
    preset: "bun-npm-github", prepareOnly: false
  }, root, ioFor())).rejects.toThrow(/requires a GitHub owner\/repository coordinate/u)
})
