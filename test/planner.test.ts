import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { parseReleaseIntent } from "../src/config/load.js"
import { canExecuteOperation, CommandSpec, ExecutionApproval } from "../src/domain/operation.js"
import { commandKey, makeTestReleaseHostLayer } from "../src/host/test.js"
import { createReleasePlan } from "../src/planner/create-release-plan.js"
import { renderPlanJson } from "../src/planner/render-plan.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"
import { minimalConfig, runEffect } from "./helpers.js"

const TestLayer = Layer.mergeAll(
  makeTestReleaseHostLayer({
    directories: new Set(["."]),
    env: new Map([
      ["NPM_TOKEN", "npm_secret"],
      ["GH_TOKEN", "gh_secret"]
    ])
  }),
  LiveTargetRegistryLayer
)

const gitHeadCommand = CommandSpec.make({
  executable: "git",
  args: ["rev-parse", "--short", "HEAD"],
  requiredEnv: [],
  redactedEnv: []
})

describe("planner", () => {
  test("creates stable plans with sorted targets and operations", async () => {
    const plan = await runEffect(
      Effect.gen(function*() {
        const intent = yield* parseReleaseIntent(minimalConfig)
        return yield* createReleasePlan(intent)
      }),
      TestLayer
    )

    expect(plan.targets.map((target) => target.id)).toEqual(["github", "npm"])
    expect(plan.operations.map((operation) => operation.id)).toEqual(
      [...plan.operations.map((operation) => operation.id)].sort()
    )
    expect(plan.identity.commit).toBe("abc123")
    expect(renderPlanJson(plan)).toBe(renderPlanJson(plan))
  })

  test("resolves HEAD release identity through the host git command", async () => {
    const headConfig = minimalConfig.replace("\"commit\":\"abc123\"", "\"commit\":\"HEAD\"")
    const layer = Layer.mergeAll(
      makeTestReleaseHostLayer({
        directories: new Set(["."]),
        env: new Map([
          ["NPM_TOKEN", "npm_secret"],
          ["GH_TOKEN", "gh_secret"]
        ]),
        commands: new Map([
          [commandKey(gitHeadCommand), {
            exitCode: 0,
            stdout: "81587b5\n",
            stderr: ""
          }]
        ])
      }),
      LiveTargetRegistryLayer
    )

    const plan = await runEffect(
      Effect.gen(function*() {
        const intent = yield* parseReleaseIntent(headConfig)
        return yield* createReleasePlan(intent)
      }),
      layer
    )

    expect(plan.identity.commit).toBe("81587b5")
  })

  test("reports git HEAD resolution failures as normalization errors", async () => {
    const headConfig = minimalConfig.replace("\"commit\":\"abc123\"", "\"commit\":\"HEAD\"")
    const layer = Layer.mergeAll(
      makeTestReleaseHostLayer({
        directories: new Set(["."]),
        env: new Map([
          ["NPM_TOKEN", "npm_secret"],
          ["GH_TOKEN", "gh_secret"]
        ]),
        commands: new Map([
          [commandKey(gitHeadCommand), {
            exitCode: 1,
            stdout: "",
            stderr: "not a git checkout"
          }]
        ])
      }),
      LiveTargetRegistryLayer
    )

    const exit = await Effect.runPromiseExit(
      Effect.gen(function*() {
        const intent = yield* parseReleaseIntent(headConfig)
        return yield* createReleasePlan(intent)
      }).pipe(Effect.provide(layer))
    )

    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("ReleaseNormalizationError")
    }
  })

  test("marks publish operations as gated", async () => {
    const plan = await runEffect(
      Effect.gen(function*() {
        const intent = yield* parseReleaseIntent(minimalConfig)
        return yield* createReleasePlan(intent)
      }),
      TestLayer
    )

    const publish = plan.operations.filter((operation) => operation._tag === "PublishCommandOperation")
    expect(publish.length).toBe(2)
    expect(publish.every((operation) => !canExecuteOperation(operation, ExecutionApproval.none))).toBe(true)
  })

  test("does not attach npm tokens to pack dry-run validation", async () => {
    const plan = await runEffect(
      Effect.gen(function*() {
        const intent = yield* parseReleaseIntent(minimalConfig)
        return yield* createReleasePlan(intent)
      }),
      TestLayer
    )

    const pack = plan.operations.find((operation) => operation.id === "npm:npm-pack-dry-run")
    const publish = plan.operations.find((operation) => operation.id === "npm:npm-publish")
    expect(pack?._tag).toBe("ValidateCommandOperation")
    expect(publish?._tag).toBe("PublishCommandOperation")
    if (pack?._tag === "ValidateCommandOperation" && publish?._tag === "PublishCommandOperation") {
      expect(pack.command.requiredEnv).toEqual([])
      expect(publish.command.requiredEnv).toEqual(["NPM_TOKEN"])
    }
  })

  test("rejects unsafe evidence directory traversal", async () => {
    const unsafeConfig = minimalConfig.replace(
      "\"evidenceDirectory\":\".release/evidence\"",
      "\"evidenceDirectory\":\"../outside\""
    )
    const exit = await Effect.runPromiseExit(
      Effect.gen(function*() {
        const intent = yield* parseReleaseIntent(unsafeConfig)
        return yield* createReleasePlan(intent)
      }).pipe(Effect.provide(TestLayer))
    )
    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("ReleaseNormalizationError")
    }
  })

  test("rejects missing artifacts", async () => {
    const missingConfig = minimalConfig.replace("\"path\":\".\"", "\"path\":\"missing.tgz\"")
      .replace("\"format\":\"directory\"", "\"format\":\"tarball\"")
    const exit = await Effect.runPromiseExit(
      Effect.gen(function*() {
        const intent = yield* parseReleaseIntent(missingConfig)
        return yield* createReleasePlan(intent)
      }).pipe(Effect.provide(TestLayer))
    )
    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("ReleaseNormalizationError")
    }
  })
})
