import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { parseReleaseIntent } from "../src/config/load.js"
import { makeTestReleaseHostLayer } from "../src/host/test.js"
import { createReleasePlan } from "../src/planner/create-release-plan.js"
import { validatePlan } from "../src/planner/executor.js"
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

const expectValidationRecord = (
  records: ReadonlyArray<{ readonly id: string; readonly status: string; readonly severity?: string; readonly skipped?: boolean }>,
  id: string,
  expected: { readonly status: string; readonly severity: string; readonly skipped: boolean }
) => {
  const record = records.find((item) => item.id === id)
  expect(record?.status).toBe(expected.status)
  expect(record?.severity).toBe(expected.severity)
  if (record !== undefined && "skipped" in record) {
    expect(record.skipped).toBe(expected.skipped)
  }
}

describe("npm target", () => {
  test("records simulated validation note evidence with current adapter severities", async () => {
    const npmSimulatedConfig = minimalConfig.replace("\"dryRunSupport\":\"native\"", "\"dryRunSupport\":\"simulated\"")
    const evidence = await runEffect(
      Effect.gen(function*() {
        const plan = yield* createPlan(npmSimulatedConfig)
        return yield* validatePlan(plan)
      }),
      TestLayer
    )

    expectValidationRecord(evidence.records, "npm:npm-pack-dry-run:validation", {
      status: "passed",
      skipped: false,
      severity: "info"
    })
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
})
