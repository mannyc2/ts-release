import { describe, expect, test } from "bun:test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Command from "effect/unstable/cli/Command"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { cli } from "../src/cli/command.js"
import {
  PlanReleaseConfigOptions,
  planReleaseConfig,
  ReleaseCliOptions,
  runReleaseCli
} from "../src/cli/programmatic.js"
import { makeTestReleaseHostLayer } from "../src/host/test.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"
import { minimalConfig } from "./helpers.js"

describe("cli command", () => {
  test("exports the root release command", () => {
    expect(cli.name).toBe("release")
    expect(cli.subcommands.flatMap((group) => group.commands.map((command) => command.name)).sort()).toEqual([
      "execute",
      "plan",
      "print",
      "render",
      "validate",
      "verify"
    ])
  })

  test("parses plan command with a config path", async () => {
    const layer = Layer.mergeAll(
      makeTestReleaseHostLayer({
        files: new Map([["release.config.json", minimalConfig]]),
        directories: new Set(["."])
      }),
      LiveTargetRegistryLayer,
      BunServices.layer
    )

    await Effect.runPromise(
      Command.runWith(cli, { version: "0.0.0" })([
        "plan",
        "--config",
        "release.config.json",
        "--out",
        "release-plan.json"
      ]).pipe(Effect.provide(layer))
    )
  })

  test("runs programmatically against a scoped Bun host root", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-cli-root-"))
    try {
      await writeFile(join(root, "release.config.json"), minimalConfig)

      await Effect.runPromise(
        runReleaseCli([
          "plan",
          "--config",
          "release.config.json",
          "--format",
          "text",
          "--out",
          "plan.txt"
        ], ReleaseCliOptions.make({ root }))
      )

      const output = await readFile(join(root, "plan.txt"), "utf8")
      expect(output).toContain("release@0.1.0")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("plans release configs programmatically", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-plan-root-"))
    try {
      await writeFile(join(root, "release.config.json"), minimalConfig)

      const plan = await Effect.runPromise(
        planReleaseConfig(PlanReleaseConfigOptions.make({ root }))
      )

      expect(plan.identity.name).toBe("release")
      expect(plan.source.root).toBe(root)
      expect(plan.source.configPath).toBe("release.config.json")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("execute command fails without execute approval", async () => {
    const layer = Layer.mergeAll(
      makeTestReleaseHostLayer({
        files: new Map([["release.config.json", minimalConfig]]),
        directories: new Set(["."]),
        env: new Map([
          ["NPM_TOKEN", "npm_secret"],
          ["GH_TOKEN", "gh_secret"]
        ])
      }),
      LiveTargetRegistryLayer,
      BunServices.layer
    )

    const exit = await Effect.runPromiseExit(
      Command.runWith(cli, { version: "0.0.0" })([
        "execute",
        "--config",
        "release.config.json"
      ]).pipe(Effect.provide(layer))
    )
    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("ExecutionApprovalError")
    }
  })

  test("render command succeeds without approval when there is nothing to render", async () => {
    const layer = Layer.mergeAll(
      makeTestReleaseHostLayer({
        files: new Map([["release.config.json", minimalConfig]]),
        directories: new Set(["."])
      }),
      LiveTargetRegistryLayer,
      BunServices.layer
    )

    await Effect.runPromise(
      Command.runWith(cli, { version: "0.0.0" })([
        "render",
        "--config",
        "release.config.json"
      ]).pipe(Effect.provide(layer))
    )
  })
})
