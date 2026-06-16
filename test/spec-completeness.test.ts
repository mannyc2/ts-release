import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { parseReleaseIntent } from "../src/config/load.js"
import { CommandSpec, ExecutionApproval } from "../src/domain/operation.js"
import { commandKey, makeTestReleaseHostLayer } from "../src/host/test.js"
import { createReleasePlan } from "../src/planner/create-release-plan.js"
import { renderPlan, validatePlan } from "../src/planner/executor.js"
import { renderPlanText } from "../src/planner/render-plan.js"
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

const createPlan = (config: string = minimalConfig) =>
  Effect.gen(function*() {
    const intent = yield* parseReleaseIntent(config)
    return yield* createReleasePlan(intent)
  })

const homebrewConfig = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    identity: {
      name: "release",
      version: "0.1.0",
      commit: "abc123",
      tag: "v0.1.0"
    },
    artifacts: [
      {
        id: "archive",
        path: "artifacts/release-0.1.0.tgz",
        format: "tarball",
        consumers: ["homebrew"]
      }
    ],
    targets: [
      {
        _tag: "HomebrewTapTarget",
        id: "homebrew",
        repository: "owner/homebrew-tap",
        formulaName: "release",
        formulaPath: ".release/generated/release.rb",
        artifactId: "archive",
        homepage: "https://github.com/owner/release",
        url: "https://github.com/owner/release/releases/download/v0.1.0/release-0.1.0.tgz",
        installPath: "bin/release",
        dryRunSupport: "simulated",
        mutability: "mutable-index",
        recovery: "manual",
        ...overrides
      }
    ],
    strict: true,
    evidenceDirectory: ".release/evidence"
  })

const HomebrewLayer = Layer.mergeAll(
  makeTestReleaseHostLayer({
    files: new Map([["artifacts/release-0.1.0.tgz", "homebrew archive"]]),
    directories: new Set(["."])
  }),
  LiveTargetRegistryLayer
)

describe("SPEC completeness", () => {
  test("records first-class target capabilities in the plan", async () => {
    const plan = await runEffect(createPlan(), TestLayer)

    const npm = plan.targetCapabilities.find((capability) => capability.targetId === "npm")
    const github = plan.targetCapabilities.find((capability) => capability.targetId === "github")

    expect(npm?.authRequirement).toBe("env-token")
    expect(npm?.dryRunSupport).toBe("native")
    expect(npm?.validationStrategy).toBe("native-command")
    expect(npm?.recovery).toBe("publish-new-version")

    expect(github?.authRequirement).toBe("env-token")
    expect(github?.dryRunSupport).toBe("native")
    expect(github?.validationStrategy).toBe("simulated-plan")
    expect(github?.recovery).toBe("delete-and-recreate")
  })

  test("records skipped dry-run validators in non-strict evidence", async () => {
    const nonStrictNoDryRunConfig = minimalConfig
      .replaceAll("\"dryRunSupport\":\"native\"", "\"dryRunSupport\":\"none\"")
      .replace("\"strict\":true", "\"strict\":false")

    const evidence = await runEffect(
      Effect.gen(function*() {
        const plan = yield* createPlan(nonStrictNoDryRunConfig)
        return yield* validatePlan(plan)
      }),
      TestLayer
    )

    expect(evidence.records.filter((record) => record.status === "skipped").map((record) => record.id).sort()).toEqual([
      "github:gh-release-dry-run:validation",
      "npm:npm-pack-dry-run:validation"
    ])
  })

  test("strict mode rejects targets without dry-run support", async () => {
    const strictNoDryRunConfig = minimalConfig.replaceAll("\"dryRunSupport\":\"native\"", "\"dryRunSupport\":\"none\"")
    const exit = await Effect.runPromiseExit(createPlan(strictNoDryRunConfig).pipe(Effect.provide(TestLayer)))

    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("PlanConstructionError")
    }
  })

  test("failed command errors carry the partial evidence bundle", async () => {
    const npmVersion = CommandSpec.make({
      executable: "npm",
      args: ["--version"],
      requiredEnv: [],
      redactedEnv: []
    })
    const layer = Layer.mergeAll(
      makeTestReleaseHostLayer({
        directories: new Set(["."]),
        env: new Map([
          ["NPM_TOKEN", "npm_secret"],
          ["GH_TOKEN", "gh_secret"]
        ]),
        commands: new Map([
          [commandKey(npmVersion), {
            exitCode: 1,
            stdout: "",
            stderr: "npm unavailable"
          }]
        ])
      }),
      LiveTargetRegistryLayer
    )

    const error = await runEffect(
      Effect.gen(function*() {
        const plan = yield* createPlan()
        return yield* validatePlan(plan)
      }).pipe(Effect.flip),
      layer
    )

    expect(error._tag).toBe("OperationFailedError")
    if (error._tag === "OperationFailedError") {
      expect(error.evidence?.records.map((record) => record.id)).toContain("npm:npm-version:command")
      expect(error.evidence?.records.find((record) => record.id === "npm:npm-version:command")?.status).toBe("failed")
    }
  })

  test("rejects unsafe artifact and package paths", async () => {
    const unsafeArtifactConfig = minimalConfig
      .replace("\"path\":\".\"", "\"path\":\"../release.tgz\"")
      .replace("\"format\":\"directory\"", "\"format\":\"tarball\"")
    const unsafePackageConfig = minimalConfig.replace("\"packagePath\":\".\"", "\"packagePath\":\"../pkg\"")

    const artifactError = await runEffect(createPlan(unsafeArtifactConfig).pipe(Effect.flip), TestLayer)
    const packageError = await runEffect(createPlan(unsafePackageConfig).pipe(Effect.flip), TestLayer)

    expect(artifactError._tag).toBe("ReleaseNormalizationError")
    expect(packageError._tag).toBe("ReleaseNormalizationError")
    if (artifactError._tag === "ReleaseNormalizationError") {
      expect(artifactError.field).toBe("artifacts.package.path")
    }
    if (packageError._tag === "ReleaseNormalizationError") {
      expect(packageError.field).toBe("targets.npm.packagePath")
    }
  })

  test("covers GitHub command construction for release flags and assets", async () => {
    const githubConfig = JSON.stringify({
      identity: {
        name: "release",
        version: "0.1.0",
        commit: "abc123",
        tag: "v0.1.0",
        notes: "ship it"
      },
      artifacts: [
        {
          id: "github-asset",
          path: ".",
          format: "directory",
          consumers: ["github"]
        },
        {
          id: "npm-only",
          path: ".",
          format: "directory",
          consumers: ["npm"]
        }
      ],
      targets: [
        {
          _tag: "GitHubReleaseTarget",
          id: "github",
          repository: "owner/repo",
          tokenEnv: "GH_TOKEN",
          draft: true,
          prerelease: true,
          dryRunSupport: "native",
          mutability: "mutable-release",
          recovery: "delete-and-recreate"
        }
      ],
      strict: true,
      evidenceDirectory: ".release/evidence"
    })

    const plan = await runEffect(createPlan(githubConfig), TestLayer)
    const publish = plan.operations.find((operation) => operation.id === "github:gh-release-create")
    const verifyTitle = plan.operations.find((operation) => operation.id === "github:gh-release-verify-title")
    const verifyDraft = plan.operations.find((operation) => operation.id === "github:gh-release-verify-draft")
    const verifyPrerelease = plan.operations.find((operation) => operation.id === "github:gh-release-verify-prerelease")
    const verifyAsset = plan.operations.find((operation) => operation.id === "github:gh-release-verify-asset-github-asset")
    const npmOnlyAsset = plan.operations.find((operation) => operation.id === "github:gh-release-verify-asset-npm-only")

    expect(publish?._tag).toBe("PublishCommandOperation")
    if (publish?._tag === "PublishCommandOperation") {
      expect(publish.command.args).toEqual([
        "release",
        "create",
        "v0.1.0",
        "--repo",
        "owner/repo",
        "--title",
        "release 0.1.0",
        "--draft",
        "--prerelease",
        "--notes",
        "ship it",
        "."
      ])
    }
    expect(npmOnlyAsset).toBeUndefined()
    expect(verifyTitle?._tag).toBe("VerifyRemoteOperation")
    expect(verifyDraft?._tag).toBe("VerifyRemoteOperation")
    expect(verifyPrerelease?._tag).toBe("VerifyRemoteOperation")
    expect(verifyAsset?._tag).toBe("VerifyRemoteOperation")
    if (verifyTitle?._tag === "VerifyRemoteOperation") {
      expect(verifyTitle.command.args).toContain("name")
      expect(verifyTitle.command.args).toContain("if .name == \"release 0.1.0\" then empty else error(\"Expected release title release 0.1.0.\") end")
    }
    if (verifyDraft?._tag === "VerifyRemoteOperation") {
      expect(verifyDraft.command.args).toContain("isDraft")
      expect(verifyDraft.command.args).toContain("if .isDraft == true then empty else error(\"Expected release draft flag true.\") end")
    }
    if (verifyPrerelease?._tag === "VerifyRemoteOperation") {
      expect(verifyPrerelease.command.args).toContain("isPrerelease")
      expect(verifyPrerelease.command.args).toContain(
        "if .isPrerelease == true then empty else error(\"Expected release prerelease flag true.\") end"
      )
    }
    if (verifyAsset?._tag === "VerifyRemoteOperation") {
      expect(verifyAsset.command.args).toContain("assets")
      expect(verifyAsset.command.args).toContain(
        "if .assets | map(.name) | index(\".\") != null then empty else error(\"Expected release asset .\") end"
      )
    }
  })

  test("validates npm cli auth even when auth comes from the local CLI", async () => {
    const cliAuthConfig = minimalConfig.replace("\"tokenEnv\":\"NPM_TOKEN\",", "")
    const plan = await runEffect(createPlan(cliAuthConfig), TestLayer)
    const npm = plan.targetCapabilities.find((capability) => capability.targetId === "npm")
    const whoami = plan.operations.find((operation) => operation.id === "npm:npm-whoami")

    expect(npm?.authRequirement).toBe("cli-auth")
    expect(whoami?._tag).toBe("ValidateCommandOperation")
    if (whoami?._tag === "ValidateCommandOperation") {
      expect(whoami.command.requiredEnv).toEqual([])
    }
  })

  test("adds npm provenance only when target policy enables it", async () => {
    const provenanceConfig = minimalConfig.replace(
      "\"tokenEnv\":\"NPM_TOKEN\",",
      "\"tokenEnv\":\"NPM_TOKEN\",\"provenance\":true,"
    )
    const provenancePlan = await runEffect(createPlan(provenanceConfig), TestLayer)
    const defaultPlan = await runEffect(createPlan(), TestLayer)

    const provenancePublish = provenancePlan.operations.find((operation) => operation.id === "npm:npm-publish")
    const defaultPublish = defaultPlan.operations.find((operation) => operation.id === "npm:npm-publish")

    expect(provenancePublish?._tag).toBe("PublishCommandOperation")
    expect(defaultPublish?._tag).toBe("PublishCommandOperation")
    if (provenancePublish?._tag === "PublishCommandOperation") {
      expect(provenancePublish.command.args).toContain("--provenance")
    }
    if (defaultPublish?._tag === "PublishCommandOperation") {
      expect(defaultPublish.command.args).not.toContain("--provenance")
    }
    expect(renderPlanText(provenancePlan)).toContain("npm publish . --registry https://registry.npmjs.org --provenance")
  })

  test("adds npm access only when target policy enables it", async () => {
    const publicAccessConfig = minimalConfig.replace(
      "\"tokenEnv\":\"NPM_TOKEN\",",
      "\"tokenEnv\":\"NPM_TOKEN\",\"access\":\"public\","
    )
    const publicAccessPlan = await runEffect(createPlan(publicAccessConfig), TestLayer)
    const defaultPlan = await runEffect(createPlan(), TestLayer)

    const publicAccessPublish = publicAccessPlan.operations.find((operation) => operation.id === "npm:npm-publish")
    const defaultPublish = defaultPlan.operations.find((operation) => operation.id === "npm:npm-publish")

    expect(publicAccessPublish?._tag).toBe("PublishCommandOperation")
    expect(defaultPublish?._tag).toBe("PublishCommandOperation")
    if (publicAccessPublish?._tag === "PublishCommandOperation") {
      expect(publicAccessPublish.command.args).toEqual([
        "publish",
        ".",
        "--registry",
        "https://registry.npmjs.org",
        "--access",
        "public"
      ])
    }
    if (defaultPublish?._tag === "PublishCommandOperation") {
      expect(defaultPublish.command.args).not.toContain("--access")
    }
    expect(renderPlanText(publicAccessPlan)).toContain(
      "npm publish . --registry https://registry.npmjs.org --access public"
    )
  })

  test("plans Homebrew tap capabilities and formula rendering", async () => {
    const plan = await runEffect(createPlan(homebrewConfig()), HomebrewLayer)
    const homebrew = plan.targetCapabilities.find((capability) => capability.targetId === "homebrew")
    const render = plan.operations.find((operation) => operation.id === "homebrew:homebrew-render-formula")
    const publish = plan.operations.find((operation) => operation.id === "homebrew:homebrew-push")

    expect(homebrew?.targetTag).toBe("HomebrewTapTarget")
    expect(homebrew?.mutability).toBe("mutable-index")
    expect(homebrew?.validationStrategy).toBe("simulated-plan")
    expect(render?._tag).toBe("RenderFileOperation")
    expect(publish?._tag).toBe("PublishCommandOperation")
    if (render?._tag === "RenderFileOperation") {
      expect(render.path).toBe(".release/generated/release.rb")
      expect(render.contents).toContain("class Release < Formula")
      expect(render.contents).toContain("sha256 \"sha256:16:artifacts/release-0.1.0.tgz\"")
      expect(render.contents).toContain("bin.install \"bin/release\" => \"release\"")
    }
    if (publish?._tag === "PublishCommandOperation") {
      expect(publish.risk).toBe("externally-visible")
      expect(publish.command.args).toEqual(["-C", ".", "push"])
    }
  })

  test("renders Homebrew formula evidence through the render workflow", async () => {
    const evidence = await runEffect(
      Effect.gen(function*() {
        const plan = yield* createPlan(homebrewConfig())
        return yield* renderPlan(plan, ExecutionApproval.make({ execute: true, approveIrreversible: false }))
      }),
      HomebrewLayer
    )

    expect(evidence.records.map((record) => record.id)).toEqual(["homebrew:homebrew-render-formula:execution"])
  })

  test("rejects Homebrew targets that reference missing artifacts", async () => {
    const error = await runEffect(
      createPlan(homebrewConfig({ artifactId: "missing" })).pipe(Effect.flip),
      HomebrewLayer
    )

    expect(error._tag).toBe("PlanConstructionError")
  })

  test("rejects directory artifacts for Homebrew formulas", async () => {
    const directoryConfig = JSON.stringify({
      identity: {
        name: "release",
        version: "0.1.0",
        commit: "abc123",
        tag: "v0.1.0"
      },
      artifacts: [
        {
          id: "archive",
          path: ".",
          format: "directory",
          consumers: ["homebrew"]
        }
      ],
      targets: [
        {
          _tag: "HomebrewTapTarget",
          id: "homebrew",
          repository: "owner/homebrew-tap",
          formulaName: "release",
          formulaPath: ".release/generated/release.rb",
          artifactId: "archive",
          dryRunSupport: "simulated",
          mutability: "mutable-index",
          recovery: "manual"
        }
      ],
      strict: true,
      evidenceDirectory: ".release/evidence"
    })
    const error = await runEffect(createPlan(directoryConfig).pipe(Effect.flip), HomebrewLayer)

    expect(error._tag).toBe("PlanConstructionError")
  })

  test("records skipped Homebrew validation in non-strict mode", async () => {
    const evidence = await runEffect(
      Effect.gen(function*() {
        const plan = yield* createPlan(homebrewConfig({ dryRunSupport: "none" }).replace("\"strict\":true", "\"strict\":false"))
        return yield* validatePlan(plan)
      }),
      HomebrewLayer
    )

    expect(evidence.records.filter((record) => record.status === "skipped").map((record) => record.id)).toEqual([
      "homebrew:brew-audit:validation"
    ])
  })

  test("renders review-critical details in text plans", async () => {
    const plan = await runEffect(createPlan(), TestLayer)
    const text = renderPlanText(plan)

    expect(text).toContain("evidence: .release/evidence")
    expect(text).toContain("checksum=none")
    expect(text).toContain("auth=env-token")
    expect(text).toContain("strategy=simulated-plan")
    expect(text).toContain("recovery=delete-and-recreate")
    expect(text).toContain("note: GitHub release dry-run validation is simulated")
  })
})
