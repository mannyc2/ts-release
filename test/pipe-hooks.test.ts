import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { parseReleaseIntent } from "../src/config/load.js"
import { ExecutionApproval } from "../src/grammar/approval.js"
import { makeTestCommandRunnerLayer } from "./host-fakes.js"
import { runEffect } from "./helpers.js"
import { createTestPlan, runApprovedTestPlan } from "./plan-helpers.js"

const TestLayer = makeTestCommandRunnerLayer({ directories: new Set([".", "packages/cli"]) })
const config = (input: {
  readonly hooks?: unknown
  readonly publish?: Record<string, unknown>
}) => JSON.stringify({
  project: { name: "release", version: "0.1.0", commit: "abc123", tag: "v0.1.0" },
  ...(input.hooks === undefined ? {} : { hooks: input.hooks }),
  publish: input.publish ?? {},
  evidence: ".release/evidence"
})
const plan = (input: Parameters<typeof config>[0]) => createTestPlan(config(input))

describe("command hooks", () => {
  test("plans before hooks as rendered, execute-gated commands", async () => {
    const release = await runEffect(plan({ hooks: { before: [{
      id: "generate",
      run: ["bun", "run", "codegen", "--release", "{version}"],
      cwd: "packages/cli",
      env: ["CODEGEN_TOKEN"]
    }] } }), TestLayer)
    const operation = release.operations.find(({ id }) => id === "hook:before:generate")

    expect(operation).toMatchObject({
      pipeId: "hooks:before",
      phase: "build",
      risk: "writes-local",
      description: "Run generate hook.",
      action: { _tag: "command", command: {
        executable: "bun",
        args: ["run", "codegen", "--release", "0.1.0"],
        cwd: "packages/cli",
        requiredEnv: ["CODEGEN_TOKEN"],
        redactedEnv: ["CODEGEN_TOKEN"]
      } }
    })
  })

  test("defaults after risk locally and respects irreversible risk", async () => {
    const release = await runEffect(plan({ hooks: { after: [
      { id: "cleanup", run: ["bun", "cleanup"] },
      { id: "notify", run: ["bun", "notify"], risk: "irreversible" }
    ] } }), TestLayer)

    expect(release.operations.filter(({ id }) => id.startsWith("hook:after:"))
      .map(({ id, pipeId, phase, risk }) => ({ id, pipeId, phase, risk }))).toEqual([
      { id: "hook:after:cleanup", pipeId: "hooks:after", phase: "publish", risk: "writes-local" },
      { id: "hook:after:notify", pipeId: "hooks:after", phase: "publish", risk: "irreversible" }
    ])
  })

  test("defaults custom publishers to externally visible", async () => {
    const release = await runEffect(plan({ publish: { custom: [{
      id: "artifactory",
      run: ["jf", "rt", "upload", "dist/release", "cli/{version}/"],
      env: ["JFROG_TOKEN"]
    }] } }), TestLayer)
    const operation = release.operations.find(({ id }) => id === "custom:artifactory")

    expect(operation).toMatchObject({
      pipeId: "publish:custom",
      phase: "publish",
      risk: "externally-visible",
      action: { _tag: "command", command: {
        executable: "jf",
        args: ["rt", "upload", "dist/release", "cli/0.1.0/"],
        requiredEnv: ["JFROG_TOKEN"],
        redactedEnv: ["JFROG_TOKEN"]
      } }
    })
    expect(release.surfaceIds).toContain("custom")
  })

  test("schedules custom publishers after GitHub and after hooks last", async () => {
    const release = await runEffect(plan({
      hooks: { after: [{ id: "notify", run: ["notify"] }] },
      publish: {
        github: { repository: "owner/repo" },
        custom: [{ id: "deploy", run: ["deploy"] }]
      }
    }), TestLayer)
    const ids = release.operations.map(({ id }) => id)

    expect(ids.indexOf("custom:deploy")).toBeGreaterThan(ids.indexOf("github:github-release-verify-api"))
    expect(ids.at(-1)).toBe("hook:after:notify")
  })

  for (const [label, invalid] of [
    ["after read-only risk", { hooks: { after: [{ id: "unsafe", run: ["tool"], risk: "read-only" }] } }],
    ["custom read-only risk", { publish: { custom: [{ id: "unsafe", run: ["tool"], risk: "read-only" }] } }],
    ["before risk field", { hooks: { before: [{ id: "unsafe", run: ["tool"], risk: "writes-local" }] } }]
  ] as const) {
    test(`rejects ${label} during config decode`, async () => {
      const error = await Effect.runPromise(parseReleaseIntent(config(invalid)).pipe(Effect.flip))
      expect(error._tag).toBe("ConfigError")
    })
  }

  test("rejects duplicate operation ids within one lifecycle namespace", async () => {
    const error = await runEffect(plan({ hooks: { before: [
      { id: "generate", run: ["bun", "one"] },
      { id: "generate", run: ["bun", "two"] }
    ] } }).pipe(Effect.flip), TestLayer)

    expect(error).toMatchObject({
      _tag: "PlanError",
      field: "operations.id",
      reason: "Duplicate operation ids: hook:before:generate"
    })
  })

  test("keeps equal local ids distinct across before and after namespaces", async () => {
    const release = await runEffect(plan({ hooks: {
      before: [{ id: "notify", run: ["bun", "before"] }],
      after: [{ id: "notify", run: ["bun", "after"] }]
    } }), TestLayer)

    expect(release.operations.filter(({ id }) => id.includes("notify")).map(({ id }) => id))
      .toEqual(["hook:before:notify", "hook:after:notify"])
  })

  test("refuses an irreversible custom publisher without publish approval", async () => {
    const release = await runEffect(plan({ publish: { custom: [{
      id: "deploy", run: ["deploy"], risk: "irreversible"
    }] } }), TestLayer)
    const error = await runEffect(runApprovedTestPlan(
      release,
      ExecutionApproval.make({ execute: true, approveIrreversible: false })
    ).pipe(Effect.flip), TestLayer)

    expect(error).toMatchObject({
      _tag: "ExecutionApprovalError",
      operationId: "custom:deploy",
      reason: "Operation requires irreversible approval."
    })
  })

  test("rejects a hook whose executable renders empty", async () => {
    const error = await runEffect(plan({ hooks: { before: [{
      id: "empty",
      run: ["{os}"]
    }] } }).pipe(Effect.flip), TestLayer)

    expect(error).toMatchObject({
      _tag: "PlanError",
      pipeId: "hooks:before",
      field: "hooks.before[].run",
      reason: "Hook run must render to at least one non-empty argv entry."
    })
  })
})
