import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { readFileSync } from "node:fs"
import { parseReleaseIntent } from "../src/config/load.js"
import { CommandSpec } from "../src/domain/operation.js"
import { commandKey, makeTestCommandRunnerLayer } from "../src/host/test.js"
import { createReleasePlan } from "../src/planner/create-release-plan.js"
import { renderPlanText } from "../src/planner/render-plan.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"
import { runEffect } from "./helpers.js"

const selfReleaseConfigPath = "apps/release-ts/release.config.json"
const config = readFileSync(selfReleaseConfigPath, "utf8")

const releaseArtifactFiles = [
  ".release/artifacts/mannyc1-ts-release-0.0.3.tgz",
  ".release/artifacts/ts-release-0.0.3-linux-x64",
  ".release/artifacts/ts-release-0.0.3-linux-arm64",
  ".release/artifacts/ts-release-0.0.3-darwin-x64",
  ".release/artifacts/ts-release-0.0.3-darwin-arm64",
  ".release/artifacts/ts-release-0.0.3-windows-x64.exe"
]

const releaseArtifactFixtures = (): ReadonlyArray<readonly [string, string]> =>
  releaseArtifactFiles.map((path) => [path, `${path} fixture\n`])

const gitHeadCommand = CommandSpec.make({
  executable: "git",
  args: ["rev-parse", "--short", "HEAD"],
  requiredEnv: [],
  redactedEnv: []
})

const TestLayer = Layer.mergeAll(
  makeTestCommandRunnerLayer({
    directories: new Set(["."]),
    files: new Map(releaseArtifactFixtures()),
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

describe("repository release config", () => {
  test("plans npm and GitHub publication as gated operations", async () => {
    const plan = await runEffect(
      Effect.gen(function*() {
        const intent = yield* parseReleaseIntent(config, selfReleaseConfigPath)
        return yield* createReleasePlan(intent)
      }),
      TestLayer
    )

    expect(plan.identity.name).toBe("@mannyc1/ts-release")
    expect(plan.identity.commit).toBe("81587b5")
    expect(plan.evidenceDirectory).toBe(".release/evidence/0.0.3")
    expect(plan.targets.map((target) => target.id).sort()).toEqual(["github", "npm"])
    expect(plan.operations.map((operation) => operation.id)).toContain("npm:npm-publish")
    expect(plan.operations.map((operation) => operation.id)).toContain("npm:npm-package-exists")
    expect(plan.operations.map((operation) => operation.id)).toContain("npm:npm-version-verify")
    expect(plan.operations.map((operation) => operation.id)).toContain("github:gh-release-create")
    const npm = plan.targetCapabilities.find((capability) => capability.targetId === "npm")
    const text = renderPlanText(plan)

    const publishOperations = plan.operations.filter((operation) => operation._tag === "PublishCommandOperation")
    const npmPublish = publishOperations.find((operation) => operation.id === "npm:npm-publish")
    const githubPublish = publishOperations.find((operation) => operation.id === "github:gh-release-create")
    expect(publishOperations.length).toBeGreaterThan(0)
    expect(publishOperations.map((operation) => operation.id)).toEqual(["npm:npm-publish", "github:gh-release-create"])
    expect(publishOperations.every((operation) => operation.gate.requiresExecute)).toBe(true)
    expect(npmPublish?._tag).toBe("PublishCommandOperation")
    expect(npm?.authRequirement).toBe("trusted-publishing")
    expect(npm?.authSetup?.workflow).toBe("release.yml")
    expect(text).toContain(
      "auth=trusted-publishing runs-in=ci provider=github-actions workflow=release.yml required-permission=id-token:write package-prerequisite=exists"
    )
    if (npmPublish?._tag === "PublishCommandOperation") {
      expect(npmPublish.command.args).toContain("--access")
      expect(npmPublish.command.args).toContain("public")
      expect(npmPublish.command.args).toContain("--provenance")
    }
    const npmVerify = plan.operations.find((operation) => operation.id === "npm:npm-version-verify")
    expect(npmVerify?._tag).toBe("VerifyRemoteOperation")
    expect(githubPublish?._tag).toBe("PublishCommandOperation")
    if (githubPublish?._tag === "PublishCommandOperation") {
      for (const path of releaseArtifactFiles) {
        expect(githubPublish.command.args).toContain(path)
      }
    }
  })

  test("rejects unsafe evidence directories after placeholder normalization", async () => {
    const unsafeConfig = config.replace("\".release/evidence/{version}\"", "\"../evidence/{version}\"")
    const error = await runEffect(
      Effect.gen(function*() {
        const intent = yield* parseReleaseIntent(unsafeConfig, selfReleaseConfigPath)
        return yield* createReleasePlan(intent)
      }).pipe(Effect.flip),
      TestLayer
    )

    expect(error._tag).toBe("ReleaseNormalizationError")
    if (error._tag === "ReleaseNormalizationError") {
      expect(error.field).toBe("evidenceDirectory")
    }
  })
})
