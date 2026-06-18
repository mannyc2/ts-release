import { describe, expect, test } from "bun:test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { CommandSpec } from "../src/domain/operation.js"
import { PlatformCommandRunnerLayer } from "../src/host/platform.js"
import { ReleaseCommandRunner } from "../src/host/host.js"

const testLayer = (env: Record<string, string> = {}) =>
  Layer.mergeAll(
    PlatformCommandRunnerLayer.pipe(Layer.provide(BunServices.layer)),
    ConfigProvider.layer(ConfigProvider.fromEnv({ env }))
  )

const runCommand = (command: CommandSpec, env: Record<string, string> = {}) =>
  Effect.gen(function*() {
    const commandRunner = yield* ReleaseCommandRunner
    return yield* commandRunner.runCommand(command)
  }).pipe(Effect.provide(testLayer(env)))

describe("platform command runner", () => {
  test("does not forward redacted-only env to child commands", async () => {
    const result = await Effect.runPromise(
      runCommand(
        CommandSpec.make({
          executable: process.execPath,
          args: ["-e", "process.stdout.write(process.env.TS_RELEASE_PLATFORM_REDACT_ONLY ?? '')"],
          requiredEnv: [],
          redactedEnv: ["TS_RELEASE_PLATFORM_REDACT_ONLY"]
        }),
        { TS_RELEASE_PLATFORM_REDACT_ONLY: "redacted-secret" }
      )
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe("")
  })

  test("forwards required env to child commands", async () => {
    const result = await Effect.runPromise(
      runCommand(
        CommandSpec.make({
          executable: process.execPath,
          args: ["-e", "process.stdout.write(process.env.TS_RELEASE_PLATFORM_REQUIRED_ONLY ?? '')"],
          requiredEnv: ["TS_RELEASE_PLATFORM_REQUIRED_ONLY"],
          redactedEnv: []
        }),
        { TS_RELEASE_PLATFORM_REQUIRED_ONLY: "required-secret" }
      )
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe("required-secret")
  })

  test("forwards GitHub Actions context env to child commands", async () => {
    const result = await Effect.runPromise(
      runCommand(
        CommandSpec.make({
          executable: process.execPath,
          args: [
            "-e",
            "process.stdout.write(JSON.stringify({ actions: process.env.GITHUB_ACTIONS, workflowRef: process.env.GITHUB_WORKFLOW_REF, runner: process.env.RUNNER_ENVIRONMENT }))"
          ],
          requiredEnv: [],
          redactedEnv: []
        }),
        {
          GITHUB_ACTIONS: "true",
          GITHUB_WORKFLOW_REF: "mannyc2/ts-release/.github/workflows/release.yml@refs/heads/main",
          RUNNER_ENVIRONMENT: "github-hosted"
        }
      )
    )

    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({
      actions: "true",
      workflowRef: "mannyc2/ts-release/.github/workflows/release.yml@refs/heads/main",
      runner: "github-hosted"
    })
  })

  test("does not forward setup-node token env by default", async () => {
    const result = await Effect.runPromise(
      runCommand(
        CommandSpec.make({
          executable: process.execPath,
          args: ["-e", "process.stdout.write(process.env.NODE_AUTH_TOKEN ?? '')"],
          requiredEnv: [],
          redactedEnv: []
        }),
        { NODE_AUTH_TOKEN: "token-like-value" }
      )
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe("")
  })
})
