import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { makeTestCommandRunnerLayer } from "./host-fakes.js"
import { minimalConfig, runEffect } from "./helpers.js"
import { createTestPlan, renderTestPlanText } from "./plan-helpers.js"

const TestLayer = Layer.mergeAll(
  makeTestCommandRunnerLayer({
    directories: new Set(["."]),
    env: new Map([
      ["NPM_TOKEN", "npm_secret"],
      ["GH_TOKEN", "gh_secret"]
    ])
  }),
)

const createPlan = (config: string = minimalConfig) =>
  createTestPlan(config)

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

    expect(dryRun?.action._tag).toBe("command")
    if (dryRun?.action._tag === "command") {
      expect(dryRun.action.command.args).toEqual(["pack", "--dry-run", "--json", "."])
      expect(dryRun.action.command.requiredEnv).toEqual([])
    }
  })

  test("validates npm cli auth even when auth comes from the local CLI", async () => {
    const cliAuthConfig = minimalConfig.replace(",\"tokenEnv\":\"NPM_TOKEN\"", "")
    const plan = await runEffect(createPlan(cliAuthConfig), TestLayer)
    const whoami = plan.operations.find((operation) => operation.id === "npm:npm-whoami")

    expect(plan.surfaceIds).toContain("npm")
    expect(whoami?.action._tag).toBe("command")
    if (whoami?.action._tag === "command") {
      expect(whoami.action.command.requiredEnv).toEqual([])
    }
  })

  test("models npm trusted publishing without npm whoami", async () => {
    const plan = await runEffect(createPlan(trustedPublishingConfig()), TestLayer)
    const whoami = plan.operations.find((operation) => operation.id === "npm:npm-whoami")
    const authNote = plan.operations.find((operation) => operation.id === "npm:npm-trusted-publishing-auth")
    const packageExists = plan.operations.find((operation) => operation.id === "npm:npm-package-exists")
    const publish = plan.operations.find((operation) => operation.id === "npm:npm-publish")
    const verify = plan.operations.find((operation) => operation.id === "npm:npm-version-verify")
    const text = renderTestPlanText(plan)

    expect(whoami).toBeUndefined()
    expect(packageExists).toBeUndefined()
    expect(authNote?.action._tag).toBe("note")
    if (authNote?.action._tag === "note") {
      expect(authNote.action.message).toContain("OIDC")
      expect(authNote.action.message).toContain("id-token: write")
      expect(authNote.action.message).toContain("release.yml")
      expect(authNote.action.message).toContain("package release to already exist")
    }
    expect(publish?.action._tag).toBe("command")
    if (publish?.action._tag === "command") {
      expect(publish.action.command.requiredEnv).toEqual([
        "ACTIONS_ID_TOKEN_REQUEST_URL",
        "ACTIONS_ID_TOKEN_REQUEST_TOKEN"
      ])
      expect(publish.action.command.redactedEnv).toEqual([
        "ACTIONS_ID_TOKEN_REQUEST_URL",
        "ACTIONS_ID_TOKEN_REQUEST_TOKEN"
      ])
    }
    expect(verify?.action._tag).toBe("command")
    if (verify?.action._tag === "command") {
      expect(verify.action.command.args).toEqual([
        "view",
        "release@0.1.0",
        "version",
        "--registry",
        "https://registry.npmjs.org"
      ])
      expect(verify.action.command.requiredEnv).toEqual([])
    }
    expect(text).toContain("note: NPM trusted publishing authenticates")
  })

  test("optionally validates trusted publishing package existence", async () => {
    const plan = await runEffect(createPlan(trustedPublishingConfig({ verifyPackageExists: true })), TestLayer)
    const packageExists = plan.operations.find((operation) => operation.id === "npm:npm-package-exists")

    expect(packageExists?.action._tag).toBe("command")
    if (packageExists?.action._tag === "command") {
      expect(packageExists.action.command.args).toEqual([
        "view",
        "release",
        "name",
        "--registry",
        "https://registry.npmjs.org"
      ])
      expect(packageExists.action.command.requiredEnv).toEqual([])
    }
  })

  test("validates trusted publishing package existence with target package name", async () => {
    const config = trustedPublishingConfig({ verifyPackageExists: true })
      .replace("\"name\":\"release\"", "\"name\":\"workspace-release\"")
      .replace("\"packageName\":\"release\",\"packagePath\"", "\"packageName\":\"@scope/package\",\"packagePath\"")
    const plan = await runEffect(createPlan(config), TestLayer)
    const packageExists = plan.operations.find((operation) => operation.id === "npm:npm-package-exists")

    expect(packageExists?.action._tag).toBe("command")
    if (packageExists?.action._tag === "command") {
      expect(packageExists.action.command.args).toEqual([
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

    expect(error._tag).toBe("PlanError")
    if (error._tag === "PlanError") {
      expect(error.field).toBe("publish.npm.tokenEnv")
      expect(error.reason).toContain("trusted publishing")
    }
  })

  test("rejects trusted publishing workflow paths", async () => {
    const error = await runEffect(
      createPlan(trustedPublishingConfig({ workflow: ".github/workflows/release.yml" })).pipe(Effect.flip),
      TestLayer
    )

    expect(error._tag).toBe("ConfigValidationError")
    if (error._tag === "ConfigValidationError") {
      expect(error.reason).toContain(`["publish"]["npm"]["trustedPublishing"]["workflow"]`)
    }
  })

  test("rejects trusted publishing workflow without yaml extension", async () => {
    const error = await runEffect(
      createPlan(trustedPublishingConfig({ workflow: "release.txt" })).pipe(Effect.flip),
      TestLayer
    )

    expect(error._tag).toBe("ConfigValidationError")
    if (error._tag === "ConfigValidationError") {
      expect(error.reason).toContain(`["publish"]["npm"]["trustedPublishing"]["workflow"]`)
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

    expect(provenancePublish?.action._tag).toBe("command")
    expect(defaultPublish?.action._tag).toBe("command")
    if (provenancePublish?.action._tag === "command") {
      expect(provenancePublish.action.command.args).toContain("--provenance")
    }
    if (defaultPublish?.action._tag === "command") {
      expect(defaultPublish.action.command.args).not.toContain("--provenance")
    }
    expect(renderTestPlanText(provenancePlan)).toContain("npm publish . --registry https://registry.npmjs.org --provenance")
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

    expect(publicAccessPublish?.action._tag).toBe("command")
    expect(defaultPublish?.action._tag).toBe("command")
    if (publicAccessPublish?.action._tag === "command") {
      expect(publicAccessPublish.action.command.args).toEqual([
        "publish",
        ".",
        "--registry",
        "https://registry.npmjs.org",
        "--access",
        "public"
      ])
    }
    if (defaultPublish?.action._tag === "command") {
      expect(defaultPublish.action.command.args).not.toContain("--access")
    }
    expect(renderTestPlanText(publicAccessPlan)).toContain(
      "npm publish . --registry https://registry.npmjs.org --access public"
    )
  })
})
