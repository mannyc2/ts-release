import { describe, expect, test } from "@effect/bun-test"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import {
  CommandAction,
  CommandSpec,
  GitHubReleaseCreateAction,
  NoteAction,
  Operation,
  trustedPublishingAuthEnvNames
} from "../src/grammar/operation.js"
import { diagnoseRelease, type DoctorReleasePlan } from "../src/doctor/doctor.js"

const commandOperation = (options: {
  readonly id: string
  readonly pipeId: string
  readonly executable: string
  readonly requiredEnv?: ReadonlyArray<string> | undefined
}) => Operation.make({
  id: options.id,
  pipeId: options.pipeId,
  phase: "publish",
  risk: "writes-local",
  description: options.id,
  action: CommandAction.make({
    command: CommandSpec.make({
      executable: options.executable,
      args: [],
      requiredEnv: options.requiredEnv ?? [],
      redactedEnv: options.requiredEnv ?? []
    })
  })
})

const diagnose = (operations: ReadonlyArray<Operation>) =>
  diagnoseRelease(
    {},
    "inline config",
    Effect.succeed({
      identity: { name: "release", version: "1.0.0" },
      operations,
      evidenceDirectory: ".release/evidence"
    } satisfies DoctorReleasePlan)
  ).pipe(
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: {} }))),
    Effect.runPromise
  )

describe("doctor plan derivation", () => {
  test("derives command environment requirements", async () => {
    const report = await diagnose([
      commandOperation({ id: "npm:publish", pipeId: "publish:npm", executable: "npm", requiredEnv: ["NPM_TOKEN"] })
    ])

    expect(report.checks.some((check) => check.id === "npm:env:NPM_TOKEN")).toBe(true)
    expect(report.checks.some((check) => check.id === "npm:trusted-publishing")).toBe(false)
  })

  test("recognizes trusted publishing and hides its transport environment", async () => {
    const report = await diagnose([
      commandOperation({
        id: "npm:publish",
        pipeId: "publish:npm",
        executable: "npm",
        requiredEnv: trustedPublishingAuthEnvNames
      })
    ])

    expect(report.checks.some((check) => check.id === "npm:trusted-publishing")).toBe(true)
    expect(report.checks.some((check) => check.id.includes("ACTIONS_ID_TOKEN_REQUEST"))).toBe(false)
  })

  test("derives GitHub API token requirements", async () => {
    const report = await diagnose([
      Operation.make({
        id: "github:create",
        pipeId: "publish:github",
        phase: "publish",
        risk: "externally-visible",
        description: "Create release.",
        action: GitHubReleaseCreateAction.make({
          repository: "owner/repo",
          tokenEnv: "GH_TOKEN",
          tag: "v1.0.0",
          title: "v1.0.0",
          draft: false,
          prerelease: false,
          assets: []
        })
      })
    ])

    expect(report.checks.some((check) => check.id === "github:env:GH_TOKEN")).toBe(true)
  })

  test("groups generic catalog render and publish operations", async () => {
    const report = await diagnose([
      commandOperation({ id: "catalog:render", pipeId: "catalog:file", executable: "render" }),
      commandOperation({ id: "catalog:push", pipeId: "publish:catalog", executable: "git" })
    ])

    expect(report.checks.filter((check) => check.id === "catalog:operations")).toHaveLength(1)
    expect(report.checks.find((check) => check.id === "catalog:cli-auth")?.message).toContain("git, render")
  })

  test("ignores operations outside publish surfaces", async () => {
    const report = await diagnose([
      Operation.make({
        id: "build:note",
        pipeId: "build:bun",
        phase: "build",
        risk: "read-only",
        description: "Build note.",
        action: NoteAction.make({ message: "Build note.", severity: "info", skipped: false })
      })
    ])

    expect(report.checks.some((check) => check.id === "auth:no-targets")).toBe(true)
    expect(report.checks.some((check) => check.id === "plan:operations" && check.targetId === undefined)).toBe(true)
  })
})
