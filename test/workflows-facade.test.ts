import { describe, expect, test } from "bun:test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Layer from "effect/Layer"
import { makeTestCommandRunnerLayer } from "../src/host/test.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"
import { Config, Diagnostics, Init, Live } from "../src/workflows/index.js"
import { minimalConfig, runEffect } from "./helpers.js"

const TestLayer = Layer.mergeAll(
  makeTestCommandRunnerLayer({
    directories: new Set(["."]),
    files: new Map([["release.config.json", minimalConfig]])
  }),
  LiveTargetRegistryLayer
)

describe("workflows facade", () => {
  test("Config aliases accept plain object inputs", async () => {
    const plan = await runEffect(
      Config.plan({
        root: ".",
        configPath: "release.config.json"
      }),
      TestLayer
    )
    const text = await runEffect(
      Config.renderPlan({
        root: ".",
        configPath: "release.config.json",
        format: "text"
      }),
      TestLayer
    )

    expect(plan.identity.name).toBe("release")
    expect(plan.identity.version).toBe("0.1.0")
    expect(text).toContain("release@0.1.0")
    expect(text).toContain("npm:npm-publish")
  })

  test("Config long names still accept schema class options", async () => {
    const plan = await runEffect(
      Config.planReleaseConfig(Config.PlanReleaseConfigOptions.make({
        root: ".",
        configPath: "release.config.json"
      })),
      TestLayer
    )

    expect(plan.identity.name).toBe("release")
    expect(plan.targets.map((target) => target.id).sort()).toEqual(["github", "npm"])
  })

  test("Init aliases accept plain object inputs without writing", async () => {
    const plan = await runEffect(
      Init.plan({
        template: "npm-github",
        package: "@scope/pkg",
        repo: "owner/repo"
      }),
      BunServices.layer
    )

    expect(plan.template).toBe("npm-github")
    expect(plan.files.map((file) => file.path)).toEqual(["release.config.json"])
    expect(Init.renderPlan(plan)).toContain("template: npm-github")
  })

  test("diagnostics and live aliases are exported", () => {
    expect(Diagnostics.checkAuth).toBe(Diagnostics.checkAuthReleaseConfig)
    expect(Diagnostics.checkCi).toBe(Diagnostics.checkCiReleaseConfig)
    expect(Diagnostics.doctor).toBe(Diagnostics.doctorReleaseConfig)
    expect(Diagnostics.render).toBe(Diagnostics.renderReleaseDiagnostics)
    expect(typeof Live.makeLayer).toBe("function")
    expect(Live.makeLayer({ root: "." })).toBeDefined()
  })
})
