import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { readFileSync } from "node:fs"
import { deferredContentArtifactIds } from "../src/engine/content.js"
import { CommandSpec } from "../src/pipeline/operation.js"
import { commandKey, makeTestCommandRunnerLayer } from "./host-fakes.js"
import { runEffect } from "./helpers.js"
import { createTestPlan, renderTestPlanText } from "./plan-helpers.js"

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
)

describe("repository release config", () => {
  test("plans npm and GitHub publication as approval-required operations", async () => {
    const plan = await runEffect(
      Effect.gen(function*() {
        return yield* createTestPlan(config, ".", selfReleaseConfigPath)
      }),
      TestLayer
    )

    expect(plan.identity.name).toBe("@mannyc1/ts-release")
    expect(plan.identity.commit).toBe("81587b5")
    expect(plan.evidenceDirectory).toBe(".release/evidence/0.0.3")
    expect(plan.surfaceIds).toEqual(["github", "homebrew", "npm", "pypi", "scoop"])
    expect(plan.operations.map((operation) => operation.id)).toEqual([
      "build:bun:cli-linux-x64", "build:bun:cli-linux-arm64", "build:bun:cli-darwin-x64",
      "build:bun:cli-darwin-arm64", "build:bun:cli-windows-x64",
      "build:pypi-wheel:pypi-wheel-linux-x64", "build:pypi-wheel:pypi-wheel-linux-arm64",
      "build:pypi-wheel:pypi-wheel-darwin-x64", "build:pypi-wheel:pypi-wheel-darwin-arm64",
      "build:pypi-wheel:pypi-wheel-windows-x64", "homebrew:homebrew-render-formula",
      "scoop:scoop-render-manifest", "npm:npm-version", "npm:npm-trusted-publishing-auth",
      "npm:npm-package-exists", "npm:npm-pack-dry-run", "npm:npm-publish", "npm:npm-version-verify",
      "pypi:python-version", "pypi:twine-version", "pypi:twine-trusted-publishing-auth", "pypi:twine-check",
      "pypi:twine-upload", "github:github-release-dry-run", "github:github-release-create",
      "github:github-release-verify-api", "homebrew:brew-audit", "homebrew:homebrew-push:add",
      "homebrew:homebrew-push:commit", "homebrew:homebrew-push", "scoop:scoop-manifest-validation",
      "scoop:scoop-push:add",
      "scoop:scoop-push:commit", "scoop:scoop-push"
    ])
    const npmAuth = plan.operations.find((operation) => operation.id === "npm:npm-trusted-publishing-auth")
    const pypiAuth = plan.operations.find((operation) => operation.id === "pypi:twine-trusted-publishing-auth")
    const text = renderTestPlanText(plan)

    const publishOperations = plan.operations.filter((operation) =>
      operation.phase === "publish" && operation.risk !== "read-only"
    )
    const npmPublish = publishOperations.find((operation) => operation.id === "npm:npm-publish")
    const githubPublish = publishOperations.find((operation) => operation.id === "github:github-release-create")
    expect(publishOperations).toHaveLength(9)
    expect(publishOperations.every((operation) => operation.risk !== "read-only")).toBe(true)
    expect(npmPublish?.action._tag).toBe("command")
    expect(npmAuth?.action._tag).toBe("note")
    expect(pypiAuth?.action._tag).toBe("note")
    expect(text).toContain("surfaces: 5")
    if (npmPublish?.action._tag === "command") {
      expect(npmPublish.action.command.args).toContain("--access")
      expect(npmPublish.action.command.args).toContain("public")
      expect(npmPublish.action.command.args).toContain("--provenance")
    }
    const npmVerify = plan.operations.find((operation) => operation.id === "npm:npm-version-verify")
    expect(npmVerify?.action._tag).toBe("command")
    expect(githubPublish?.action._tag).toBe("github-release-create")
    if (githubPublish?.action._tag === "github-release-create") {
      for (const path of releaseArtifactFiles) {
        if (!path.endsWith(".whl")) {
          expect(githubPublish.action.assets.map((asset) => asset.path)).toContain(path)
        }
      }
      expect(githubPublish.action.repository).toBe("mannyc2/ts-release")
      expect(githubPublish.action.tokenEnv).toBe("GH_TOKEN")
    }
    const pypiPublish = plan.operations.find((operation) => operation.id === "pypi:twine-upload")
    expect(pypiPublish?.action._tag).toBe("command")
    if (pypiPublish?.action._tag === "command") {
      expect(pypiPublish.action.command.executable).toBe("python3")
      expect(pypiPublish.action.command.args).toEqual([
        "-m",
        "twine",
        "upload",
        "--non-interactive",
        "--repository-url",
        "https://upload.pypi.org/legacy/",
        ".release/artifacts/ts_release-0.0.3-py3-none-manylinux2014_x86_64.whl",
        ".release/artifacts/ts_release-0.0.3-py3-none-manylinux2014_aarch64.whl",
        ".release/artifacts/ts_release-0.0.3-py3-none-macosx_10_15_x86_64.whl",
        ".release/artifacts/ts_release-0.0.3-py3-none-macosx_11_0_arm64.whl",
        ".release/artifacts/ts_release-0.0.3-py3-none-win_amd64.whl"
      ])
      expect(pypiPublish.action.command.requiredEnv).toEqual([
        "ACTIONS_ID_TOKEN_REQUEST_URL",
        "ACTIONS_ID_TOKEN_REQUEST_TOKEN"
      ])
    }
    const homebrewRender = plan.operations.find((operation) => operation.id === "homebrew:homebrew-render-formula")
    expect(homebrewRender?.action._tag).toBe("write-file")
    if (homebrewRender?.action._tag === "write-file") {
      expect(homebrewRender.action.path).toBe(".release/catalogs/homebrew-ts-release/Formula/ts-release.rb")
      expect(typeof homebrewRender.action.contents).toBe("object")
      if (typeof homebrewRender.action.contents === "object") {
        expect(homebrewRender.action.contents._tag).toBe("file-parts")
        expect(homebrewRender.action.contents.parts.filter((part) => typeof part === "string").join(""))
          .toContain("Portable artifact and package-manager distribution planning")
        expect(deferredContentArtifactIds(homebrewRender.action.contents)).toEqual([
          "cli-darwin-arm64",
          "cli-darwin-x64"
        ])
      }
    }
    const scoopRender = plan.operations.find((operation) => operation.id === "scoop:scoop-render-manifest")
    expect(scoopRender?.action._tag).toBe("write-file")
    if (scoopRender?.action._tag === "write-file") {
      expect(scoopRender.action.path).toBe(".release/catalogs/scoop-ts-release/bucket/ts-release.json")
      expect(typeof scoopRender.action.contents).toBe("object")
      if (typeof scoopRender.action.contents === "object") {
        expect(scoopRender.action.contents._tag).toBe("file-parts")
        expect(scoopRender.action.contents.parts.filter((part) => typeof part === "string").join(""))
          .toContain("https://github.com/mannyc2/ts-release/releases/download/v0.0.3/ts-release-0.0.3-windows-x64.exe")
        expect(deferredContentArtifactIds(scoopRender.action.contents)).toEqual(["cli-windows-x64"])
      }
    }
  })

  test("rejects unsafe evidence directories after placeholder normalization", async () => {
    const unsafeConfig = config.replace("\".release/evidence/{version}\"", "\"../evidence/{version}\"")
    const error = await runEffect(
      Effect.gen(function*() {
        return yield* createTestPlan(unsafeConfig, ".", selfReleaseConfigPath)
      }).pipe(Effect.flip),
      TestLayer
    )

    expect(error._tag).toBe("ConfigError")
  })

  test("rejects absolute catalog paths at config decode", async () => {
    const withFormula = JSON.parse(config)
    withFormula.publish.homebrew = {
      ...withFormula.publish.homebrew,
      formulaPath: "/etc/formula.rb"
    }
    const error = await runEffect(
      Effect.gen(function*() {
        return yield* createTestPlan(JSON.stringify(withFormula), ".", selfReleaseConfigPath)
      }).pipe(Effect.flip),
      TestLayer
    )

    expect(error._tag).toBe("ConfigError")
    if (error._tag === "ConfigError") {
      expect(error.reason).toContain("Path must be non-empty, relative, and must not contain parent traversal.")
      expect(error.reason).toContain(`["publish"]["homebrew"]["formulaPath"]`)
    }
  })

  test("rejects traversal catalog paths at config decode", async () => {
    const withFormula = JSON.parse(config)
    withFormula.publish.homebrew = {
      ...withFormula.publish.homebrew,
      formulaPath: "../outside/formula.rb"
    }
    const error = await runEffect(
      Effect.gen(function*() {
        return yield* createTestPlan(JSON.stringify(withFormula), ".", selfReleaseConfigPath)
      }).pipe(Effect.flip),
      TestLayer
    )

    expect(error._tag).toBe("ConfigError")
    if (error._tag === "ConfigError") {
      expect(error.reason).toContain("Path must be non-empty, relative, and must not contain parent traversal.")
    }
  })

  test("rejects trusted-publishing workflow names with separators at config decode", async () => {
    const withWorkflow = JSON.parse(config)
    withWorkflow.publish.npm = {
      ...withWorkflow.publish.npm,
      tokenEnv: undefined,
      trustedPublishing: { workflow: ".github/workflows/release.yml" }
    }
    const error = await runEffect(
      Effect.gen(function*() {
        return yield* createTestPlan(JSON.stringify(withWorkflow), ".", selfReleaseConfigPath)
      }).pipe(Effect.flip),
      TestLayer
    )

    expect(error._tag).toBe("ConfigError")
    if (error._tag === "ConfigError") {
      expect(error.reason).toContain("Workflow must be a .yml or .yaml filename without path separators.")
    }
  })

  test("rejects trusted-publishing workflow names without a yaml extension at config decode", async () => {
    const withWorkflow = JSON.parse(config)
    withWorkflow.publish.npm = {
      ...withWorkflow.publish.npm,
      tokenEnv: undefined,
      trustedPublishing: { workflow: "release.txt" }
    }
    const error = await runEffect(
      Effect.gen(function*() {
        return yield* createTestPlan(JSON.stringify(withWorkflow), ".", selfReleaseConfigPath)
      }).pipe(Effect.flip),
      TestLayer
    )

    expect(error._tag).toBe("ConfigError")
    if (error._tag === "ConfigError") {
      expect(error.reason).toContain("Workflow must be a .yml or .yaml filename without path separators.")
    }
  })
})
