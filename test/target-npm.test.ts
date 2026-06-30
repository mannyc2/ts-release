import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { parseReleaseIntent } from "../src/config/load.js"
import { makeTestCommandRunnerLayer } from "../src/host/test.js"
import { createReleasePlan } from "../src/planner/create-release-plan.js"
import { renderPlanText } from "../src/planner/render-plan.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"
import { minimalConfig, runEffect } from "./helpers.js"

const TestLayer = Layer.mergeAll(
  makeTestCommandRunnerLayer({
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

const trustedPublishingConfig = (
  options: { readonly verifyPackageExists?: boolean; readonly workflow?: string } = {}
) => {
  const trustedPublishing = {
    provider: "github-actions",
    workflow: options.workflow ?? "release.yml",
    packageExists: true,
    ...(options.verifyPackageExists === undefined ? {} : { verifyPackageExists: options.verifyPackageExists })
  }
  return minimalConfig.replace(
    "\"tokenEnv\":\"NPM_TOKEN\"",
    `"trustedPublishing":${JSON.stringify(trustedPublishing)}`
  )
}

describe("npm target", () => {
  test("plans native npm pack dry-run validation", async () => {
    const plan = await runEffect(createPlan(), TestLayer)
    const dryRun = plan.operations.find((operation) => operation.id === "npm:npm-pack-dry-run")

    expect(dryRun?._tag).toBe("ValidateCommandOperation")
    if (dryRun?._tag === "ValidateCommandOperation") {
      expect(dryRun.command.args).toEqual(["pack", "--dry-run", "--json", "."])
      expect(dryRun.command.requiredEnv).toEqual([])
    }
  })

  test("validates npm cli auth even when auth comes from the local CLI", async () => {
    const cliAuthConfig = minimalConfig.replace(",\"tokenEnv\":\"NPM_TOKEN\"", "")
    const plan = await runEffect(createPlan(cliAuthConfig), TestLayer)
    const npm = plan.targetCapabilities.find((capability) => capability.targetId === "npm")
    const whoami = plan.operations.find((operation) => operation.id === "npm:npm-whoami")

    expect(npm?.authRequirement).toBe("cli-auth")
    expect(whoami?._tag).toBe("ValidateCommandOperation")
    if (whoami?._tag === "ValidateCommandOperation") {
      expect(whoami.command.requiredEnv).toEqual([])
    }
  })

  test("models npm trusted publishing without npm whoami", async () => {
    const plan = await runEffect(createPlan(trustedPublishingConfig()), TestLayer)
    const npm = plan.targetCapabilities.find((capability) => capability.targetId === "npm")
    const whoami = plan.operations.find((operation) => operation.id === "npm:npm-whoami")
    const authNote = plan.operations.find((operation) => operation.id === "npm:npm-trusted-publishing-auth")
    const packageExists = plan.operations.find((operation) => operation.id === "npm:npm-package-exists")
    const publish = plan.operations.find((operation) => operation.id === "npm:npm-publish")
    const verify = plan.operations.find((operation) => operation.id === "npm:npm-version-verify")
    const text = renderPlanText(plan)

    expect(npm?.authRequirement).toBe("trusted-publishing")
    expect(npm?.authSetup?.runsIn).toBe("ci")
    expect(npm?.authSetup?.provider).toBe("github-actions")
    expect(npm?.authSetup?.workflow).toBe("release.yml")
    expect(npm?.authSetup?.requiredPermissions).toEqual([
      { name: "id-token", value: "write" }
    ])
    expect(npm?.authSetup?.prerequisites).toEqual(["npm-package-exists"])
    expect(whoami).toBeUndefined()
    expect(packageExists).toBeUndefined()
    expect(authNote?._tag).toBe("ValidationNoteOperation")
    if (authNote?._tag === "ValidationNoteOperation") {
      expect(authNote.message).toContain("OIDC")
      expect(authNote.message).toContain("id-token: write")
      expect(authNote.message).toContain("release.yml")
      expect(authNote.message).toContain("package release to already exist")
    }
    expect(publish?._tag).toBe("PublishCommandOperation")
    if (publish?._tag === "PublishCommandOperation") {
      expect(publish.command.requiredEnv).toEqual([
        "ACTIONS_ID_TOKEN_REQUEST_URL",
        "ACTIONS_ID_TOKEN_REQUEST_TOKEN"
      ])
      expect(publish.command.redactedEnv).toEqual([
        "ACTIONS_ID_TOKEN_REQUEST_URL",
        "ACTIONS_ID_TOKEN_REQUEST_TOKEN"
      ])
    }
    expect(verify?._tag).toBe("VerifyRemoteOperation")
    if (verify?._tag === "VerifyRemoteOperation") {
      expect(verify.command.args).toEqual([
        "view",
        "release@0.1.0",
        "version",
        "--registry",
        "https://registry.npmjs.org"
      ])
      expect(verify.command.requiredEnv).toEqual([])
    }
    expect(text).toContain(
      "auth=trusted-publishing runs-in=ci provider=github-actions workflow=release.yml required-permission=id-token:write package-prerequisite=exists"
    )
  })

  test("optionally validates trusted publishing package existence", async () => {
    const plan = await runEffect(createPlan(trustedPublishingConfig({ verifyPackageExists: true })), TestLayer)
    const packageExists = plan.operations.find((operation) => operation.id === "npm:npm-package-exists")

    expect(packageExists?._tag).toBe("ValidateCommandOperation")
    if (packageExists?._tag === "ValidateCommandOperation") {
      expect(packageExists.command.args).toEqual([
        "view",
        "release",
        "name",
        "--registry",
        "https://registry.npmjs.org"
      ])
      expect(packageExists.command.requiredEnv).toEqual([])
    }
  })

  test("validates trusted publishing package existence with target package name", async () => {
    const config = trustedPublishingConfig({ verifyPackageExists: true })
      .replace("\"name\":\"release\"", "\"name\":\"workspace-release\"")
      .replace("\"packageName\":\"release\",\"packagePath\"", "\"packageName\":\"@scope/package\",\"packagePath\"")
    const plan = await runEffect(createPlan(config), TestLayer)
    const packageExists = plan.operations.find((operation) => operation.id === "npm:npm-package-exists")

    expect(packageExists?._tag).toBe("ValidateCommandOperation")
    if (packageExists?._tag === "ValidateCommandOperation") {
      expect(packageExists.command.args).toEqual([
        "view",
        "@scope/package",
        "name",
        "--registry",
        "https://registry.npmjs.org"
      ])
    }
  })

  test("rejects npm trusted publishing when tokenEnv is also declared", async () => {
    const invalidConfig = minimalConfig.replace(
      "\"tokenEnv\":\"NPM_TOKEN\"",
      "\"tokenEnv\":\"NPM_TOKEN\",\"trustedPublishing\":{\"provider\":\"github-actions\",\"workflow\":\"release.yml\",\"packageExists\":true}"
    )
    const error = await runEffect(createPlan(invalidConfig).pipe(Effect.flip), TestLayer)

    expect(error._tag).toBe("ReleaseNormalizationError")
    if (error._tag === "ReleaseNormalizationError") {
      expect(error.field).toBe("targets.npm.tokenEnv")
      expect(error.reason).toContain("trusted publishing")
    }
  })

  test("rejects trusted publishing workflow paths", async () => {
    const error = await runEffect(
      createPlan(trustedPublishingConfig({ workflow: ".github/workflows/release.yml" })).pipe(Effect.flip),
      TestLayer
    )

    expect(error._tag).toBe("ReleaseNormalizationError")
    if (error._tag === "ReleaseNormalizationError") {
      expect(error.field).toBe("targets.npm.trustedPublishing.workflow")
    }
  })

  test("rejects trusted publishing workflow without yaml extension", async () => {
    const error = await runEffect(
      createPlan(trustedPublishingConfig({ workflow: "release.txt" })).pipe(Effect.flip),
      TestLayer
    )

    expect(error._tag).toBe("ReleaseNormalizationError")
    if (error._tag === "ReleaseNormalizationError") {
      expect(error.field).toBe("targets.npm.trustedPublishing.workflow")
    }
  })

  test("rejects empty npm package name", async () => {
    const invalidConfig = minimalConfig.replace("\"packageName\":\"release\",\"packagePath\"", "\"packageName\":\"\",\"packagePath\"")
    const error = await runEffect(createPlan(invalidConfig).pipe(Effect.flip), TestLayer)

    expect(error._tag).toBe("ConfigValidationError")
  })

  test("adds npm provenance only when target policy enables it", async () => {
    const provenanceConfig = minimalConfig.replace(
      "\"tokenEnv\":\"NPM_TOKEN\"",
      "\"tokenEnv\":\"NPM_TOKEN\",\"provenance\":true"
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
      "\"tokenEnv\":\"NPM_TOKEN\"",
      "\"tokenEnv\":\"NPM_TOKEN\",\"access\":\"public\""
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
})
