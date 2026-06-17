import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import * as BunHttpClient from "@effect/platform-bun/BunHttpClient"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { mkdir, rm } from "node:fs/promises"
import { dirname } from "node:path"
import { pid } from "node:process"
import { parseReleaseIntent } from "../src/config/load.js"
import { ExecutionApproval } from "../src/domain/operation.js"
import { LiveReleaseHttpLayer } from "../src/host/http-live.js"
import { PlatformCommandRunnerLayer } from "../src/host/platform.js"
import { createReleasePlan } from "../src/planner/create-release-plan.js"
import { runOperations } from "../src/planner/executor.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"
import { runEffect } from "./helpers.js"

const integrationEnabled = Bun.env.RELEASE_INTEGRATION_TOOLS === "1"
const githubEnabled = integrationEnabled && Bun.env.RELEASE_INTEGRATION_GITHUB === "1"
const maybeTest = integrationEnabled ? test : test.skip
const maybeGithubTest = githubEnabled ? test : test.skip
const fixtureRoot = Bun.env.RELEASE_INTEGRATION_FIXTURE_DIR ?? `.tmp-release-integration-tools-${pid}`
const npmPackagePath = `${fixtureRoot}/npm-package`
const githubAssetPath = `${fixtureRoot}/github-asset.tgz`

const IntegrationHostHttpClientLayer = Layer.mergeAll(
  PlatformCommandRunnerLayer.pipe(Layer.provideMerge(BunServices.layer)),
  BunHttpClient.layer
)

const IntegrationLayer = Layer.mergeAll(
  LiveReleaseHttpLayer.pipe(Layer.provideMerge(IntegrationHostHttpClientLayer)),
  LiveTargetRegistryLayer
)

const writeText = async (path: string, contents: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true })
  await Bun.write(path, contents)
}

const writeJson = async (path: string, value: unknown): Promise<void> =>
  writeText(path, `${JSON.stringify(value, null, 2)}\n`)

const planFromConfig = (config: unknown) =>
  Effect.gen(function*() {
    const intent = yield* parseReleaseIntent(JSON.stringify(config))
    return yield* createReleasePlan(intent)
  })

describe("real tool integrations", () => {
  if (integrationEnabled) {
    beforeAll(async () => {
      await rm(fixtureRoot, { recursive: true, force: true })
      await writeJson(`${npmPackagePath}/package.json`, {
        name: "release-integration-fixture",
        version: "0.0.0",
        type: "module",
        files: ["index.js"]
      })
      await writeText(`${npmPackagePath}/index.js`, "export const fixture = true\n")
      await writeText(githubAssetPath, "github asset fixture\n")
    })

    afterAll(async () => {
      await rm(fixtureRoot, { recursive: true, force: true })
    })
  }

  maybeTest("runs npm adapter validators against the real npm CLI", async () => {
    const plan = await runEffect(
      planFromConfig({
        identity: {
          name: "release-integration-fixture",
          version: "0.0.0",
          commit: "integration",
          tag: "v0.0.0"
        },
        artifacts: [
          {
            id: "npm-package",
            path: npmPackagePath,
            format: "directory",
            consumers: ["npm"]
          }
        ],
        targets: [
          {
            _tag: "NpmRegistryTarget",
            id: "npm",
            registry: "https://registry.npmjs.org",
            packageName: "release-integration-fixture",
            packagePath: npmPackagePath,
            dryRunSupport: "native",
            mutability: "immutable",
            recovery: "publish-new-version"
          }
        ],
        strict: true,
        evidenceDirectory: ".release/integration-evidence"
      }),
      IntegrationLayer
    )

    const operations = plan.operations.filter((operation) =>
      operation.id === "npm:npm-version" || operation.id === "npm:npm-pack-dry-run"
    )
    const evidence = await runEffect(runOperations(plan, operations, ExecutionApproval.none), IntegrationLayer)

    expect(evidence.records.map((record) => record.id).sort()).toEqual([
      "npm:npm-pack-dry-run:command",
      "npm:npm-version:command"
    ])
    expect(evidence.records.every((record) => record.status === "passed")).toBe(true)
  })

  maybeGithubTest("runs GitHub adapter validators against the real gh CLI", async () => {
    const plan = await runEffect(
      planFromConfig({
        identity: {
          name: "release-integration-fixture",
          version: "0.0.0",
          commit: "integration",
          tag: "v0.0.0"
        },
        artifacts: [
          {
            id: "github-asset",
            path: githubAssetPath,
            format: "tarball",
            consumers: ["github"]
          }
        ],
        targets: [
          {
            _tag: "GitHubReleaseTarget",
            id: "github",
            repository: "owner/repo",
            ...(Bun.env.GH_TOKEN === undefined ? {} : { tokenEnv: "GH_TOKEN" }),
            dryRunSupport: "native",
            mutability: "mutable-release",
            recovery: "delete-and-recreate"
          }
        ],
        strict: true,
        evidenceDirectory: ".release/integration-evidence"
      }),
      IntegrationLayer
    )

    const operations = plan.operations.filter((operation) =>
      operation.id === "github:gh-version" ||
      operation.id === "github:gh-auth-status" ||
      operation.id === "github:gh-release-dry-run"
    )
    const evidence = await runEffect(runOperations(plan, operations, ExecutionApproval.none), IntegrationLayer)

    expect(evidence.records.map((record) => record.id).sort()).toEqual([
      "github:gh-auth-status:command",
      "github:gh-release-dry-run:validation",
      "github:gh-version:command"
    ])
    expect(evidence.records.every((record) => record.status === "passed")).toBe(true)
  })
})
