import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { readFileSync } from "node:fs"
import { parseReleaseIntent } from "../src/config/load.js"
import { CommandSpec, operationRequiresExecute } from "../src/domain/operation.js"
import { commandKey, makeTestCommandRunnerLayer } from "../src/host/test.js"
import { createReleasePlan } from "../src/planner/create-release-plan.js"
import { renderPlanText } from "../src/planner/render-plan.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"
import { runEffect } from "./helpers.js"

const selfReleaseConfigPath = "apps/release-ts/release.config.json"
const config = readFileSync(selfReleaseConfigPath, "utf8")

const releaseArtifactFiles = [
  ".release/artifacts/ts-release-0.0.3-linux-x64",
  ".release/artifacts/ts-release-0.0.3-linux-arm64",
  ".release/artifacts/ts-release-0.0.3-darwin-x64",
  ".release/artifacts/ts-release-0.0.3-darwin-arm64",
  ".release/artifacts/ts-release-0.0.3-windows-x64.exe",
  ".release/artifacts/ts_release-0.0.3-py3-none-macosx_11_0_arm64.whl",
  ".release/artifacts/ts_release-0.0.3-py3-none-macosx_10_15_x86_64.whl",
  ".release/artifacts/ts_release-0.0.3-py3-none-manylinux2014_aarch64.whl",
  ".release/artifacts/ts_release-0.0.3-py3-none-manylinux2014_x86_64.whl",
  ".release/artifacts/ts_release-0.0.3-py3-none-win_amd64.whl"
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
    files: new Map([
      ["package.json", JSON.stringify({ name: "@mannyc1/ts-release", version: "0.0.3" })],
      ...releaseArtifactFixtures()
    ]),
    env: new Map([
      ["NPM_TOKEN", "npm_secret"],
      ["GH_TOKEN", "gh_secret"],
      ["TWINE_USERNAME", "__token__"],
      ["TWINE_PASSWORD", "twine_secret"],
      ["ACTIONS_ID_TOKEN_REQUEST_URL", "https://token.actions.githubusercontent.com"],
      ["ACTIONS_ID_TOKEN_REQUEST_TOKEN", "oidc_request_token"]
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
  test("plans npm and GitHub publication as approval-required operations", async () => {
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
    expect(plan.targets.map((target) => target.id).sort()).toEqual(["github", "homebrew", "npm", "pypi", "scoop"])
    expect(plan.operations.map((operation) => operation.id)).toContain("npm:npm-publish")
    expect(plan.operations.map((operation) => operation.id)).toContain("npm:npm-package-exists")
    expect(plan.operations.map((operation) => operation.id)).toContain("npm:npm-version-verify")
    expect(plan.operations.map((operation) => operation.id)).toContain("github:gh-release-create")
    expect(plan.operations.map((operation) => operation.id)).toContain("homebrew:homebrew-render-formula")
    expect(plan.operations.map((operation) => operation.id)).toContain("pypi:twine-upload")
    expect(plan.operations.map((operation) => operation.id)).toContain("scoop:scoop-render-manifest")
    const npm = plan.targetCapabilities.find((capability) => capability.targetId === "npm")
    const pypi = plan.targetCapabilities.find((capability) => capability.targetId === "pypi")
    const homebrew = plan.targetCapabilities.find((capability) => capability.targetId === "homebrew")
    const scoop = plan.targetCapabilities.find((capability) => capability.targetId === "scoop")
    const text = renderPlanText(plan)

    const publishOperations = plan.operations.filter((operation) => operation._tag === "PublishCommandOperation")
    const npmPublish = publishOperations.find((operation) => operation.id === "npm:npm-publish")
    const githubPublish = publishOperations.find((operation) => operation.id === "github:gh-release-create")
    expect(publishOperations.length).toBeGreaterThan(0)
    expect(publishOperations.map((operation) => operation.id)).toEqual([
      "npm:npm-publish",
      "pypi:twine-upload",
      "github:gh-release-create",
      "homebrew:homebrew-push:add",
      "scoop:scoop-push:add",
      "homebrew:homebrew-push:commit",
      "scoop:scoop-push:commit",
      "homebrew:homebrew-push",
      "scoop:scoop-push"
    ])
    expect(publishOperations.every(operationRequiresExecute)).toBe(true)
    expect(npmPublish?._tag).toBe("PublishCommandOperation")
    expect(npm?.authRequirement).toBe("trusted-publishing")
    expect(pypi?.authRequirement).toBe("trusted-publishing")
    expect(homebrew?.targetTag).toBe("HomebrewTapTarget")
    expect(scoop?.targetTag).toBe("ScoopBucketTarget")
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
        if (!path.endsWith(".whl")) {
          expect(githubPublish.command.args).toContain(path)
        }
      }
    }
    const pypiPublish = plan.operations.find((operation) => operation.id === "pypi:twine-upload")
    expect(pypiPublish?._tag).toBe("PublishCommandOperation")
    if (pypiPublish?._tag === "PublishCommandOperation") {
      expect(pypiPublish.command.executable).toBe("python3")
      expect(pypiPublish.command.args).toEqual([
        "-m",
        "twine",
        "upload",
        "--non-interactive",
        "--repository-url",
        "https://upload.pypi.org/legacy/",
        ".release/artifacts/ts_release-0.0.3-py3-none-macosx_11_0_arm64.whl",
        ".release/artifacts/ts_release-0.0.3-py3-none-macosx_10_15_x86_64.whl",
        ".release/artifacts/ts_release-0.0.3-py3-none-manylinux2014_aarch64.whl",
        ".release/artifacts/ts_release-0.0.3-py3-none-manylinux2014_x86_64.whl",
        ".release/artifacts/ts_release-0.0.3-py3-none-win_amd64.whl"
      ])
      expect(pypiPublish.command.requiredEnv).toEqual([
        "ACTIONS_ID_TOKEN_REQUEST_URL",
        "ACTIONS_ID_TOKEN_REQUEST_TOKEN"
      ])
    }
    const homebrewRender = plan.operations.find((operation) => operation.id === "homebrew:homebrew-render-formula")
    expect(homebrewRender?._tag).toBe("RenderFileOperation")
    if (homebrewRender?._tag === "RenderFileOperation") {
      expect(homebrewRender.path).toBe(".release/catalogs/homebrew-ts-release/Formula/ts-release.rb")
      expect(homebrewRender.contents).toContain("Portable artifact and package-manager distribution planning")
      expect(homebrewRender.contents).toContain("on_macos do")
      expect(homebrewRender.contents).toContain("on_arm do")
	      expect(homebrewRender.contents).toContain("on_intel do")
	      expect(homebrewRender.contents).toContain("https://github.com/mannyc2/ts-release/releases/download/v0.0.3/ts-release-0.0.3-darwin-arm64")
	      expect(homebrewRender.contents).toContain("https://github.com/mannyc2/ts-release/releases/download/v0.0.3/ts-release-0.0.3-darwin-x64")
	      expect(homebrewRender.contents).toContain("test do")
	      expect(homebrewRender.contents).toContain("assert File.executable?(bin/\"ts-release\")")
	    }
    const scoopRender = plan.operations.find((operation) => operation.id === "scoop:scoop-render-manifest")
    expect(scoopRender?._tag).toBe("RenderFileOperation")
    if (scoopRender?._tag === "RenderFileOperation") {
      expect(scoopRender.path).toBe(".release/catalogs/scoop-ts-release/bucket/ts-release.json")
      expect(scoopRender.contents).toContain("https://github.com/mannyc2/ts-release/releases/download/v0.0.3/ts-release-0.0.3-windows-x64.exe")
      expect(scoopRender.contents).toContain("\"bin\": [")
      expect(scoopRender.contents).toContain("\"ts-release-0.0.3-windows-x64.exe\"")
      expect(scoopRender.contents).toContain("\"ts-release\"")
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
