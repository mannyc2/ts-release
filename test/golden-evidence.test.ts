import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { parseReleaseIntent } from "../src/config/load.js"
import { CommandSpec, ExecutionApproval } from "../src/pipeline/operation.js"
import { type EvidenceBundle, EvidenceRecord } from "../src/engine/evidence.js"
import { makeTestReleaseHttpLayer } from "./host-fakes.js"
import { commandKey, makeTestCommandRunnerLayer } from "./host-fakes.js"
import { OperationFailedError } from "../src/engine/errors.js"
import { runEvidenceWorkflow } from "../src/engine/executor.js"
import { planRelease } from "../src/engine/engine.js"
import type { ReleasePlan } from "../src/pipeline/plan.js"
import { UnsupportedArtifactStagerLayer } from "../src/engine/stager.js"
import {
  GitHubApi,
  GitHubReleaseApiResponse
} from "../src/engine/github.js"
import {
  releaseConfig,
  runEffect
} from "./helpers.js"

const root = process.cwd()
const fixedTimestamp = "1970-01-01T00:00:00.000Z"
const updateGolden = process.env.UPDATE_GOLDEN === "1"

const npmPublishCommand = CommandSpec.make({
  executable: "npm",
  args: ["publish", ".", "--registry", "https://registry.npmjs.org"],
  requiredEnv: ["NPM_TOKEN"],
  redactedEnv: ["NPM_TOKEN"]
})

const fixtureConfig = releaseConfig({
  artifacts: [],
  npmPackage: {
    path: "."
  },
  publish: {
    npm: {
      registry: "https://registry.npmjs.org",
      packageName: "release",
      packagePath: ".",
      tokenEnv: "NPM_TOKEN"
    },
    github: {
      repository: "owner/repo",
      tokenEnv: "GH_TOKEN",
      draft: true,
      prerelease: false
    }
  }
})

const GitHubSuccessLayer = Layer.succeed(GitHubApi)({
  createRelease: (request) =>
    Effect.succeed(
      GitHubReleaseApiResponse.make({
        id: 123,
        tag_name: request.tag,
        name: request.title,
        draft: request.draft,
        prerelease: request.prerelease,
        upload_url: "https://uploads.github.com/repos/owner/repo/releases/123/assets{?name,label}",
        assets: request.assets.map((asset, index) => ({
          id: index + 1,
          name: asset.name
        }))
      })
    ),
  inspectRelease: (request) =>
    Effect.succeed(
      GitHubReleaseApiResponse.make({
        id: 123,
        tag_name: request.tag,
        name: "release 0.1.0",
        draft: true,
        prerelease: false,
        upload_url: "https://uploads.github.com/repos/owner/repo/releases/123/assets{?name,label}",
        assets: []
      })
    )
})

const makeGoldenLayer = (failNpmPublish: boolean) =>
  Layer.mergeAll(
    makeTestCommandRunnerLayer({
      directories: new Set(["."]),
      env: new Map([
        ["NPM_TOKEN", "npm_secret"],
        ["GH_TOKEN", "gh_secret"]
      ]),
      commands: failNpmPublish
        ? new Map([
          [commandKey(npmPublishCommand), {
            exitCode: 1,
            stdout: "publishing npm_secret\n",
            stderr: "publish failed with npm_secret\n"
          }]
        ])
        : new Map(),
      timestamps: [
        "2026-06-17T00:00:00.000Z",
        "2026-06-17T00:00:00.001Z",
        "2026-06-17T00:00:00.002Z",
        "2026-06-17T00:00:00.003Z",
        "2026-06-17T00:00:00.004Z",
        "2026-06-17T00:00:00.005Z",
        "2026-06-17T00:00:00.006Z",
        "2026-06-17T00:00:00.007Z",
        "2026-06-17T00:00:00.008Z",
        "2026-06-17T00:00:00.009Z",
        "2026-06-17T00:00:00.010Z",
        "2026-06-17T00:00:00.011Z"
      ]
    }),
    makeTestReleaseHttpLayer(),
    GitHubSuccessLayer,
    UnsupportedArtifactStagerLayer
  )

const planFixtureRelease = Effect.gen(function*() {
  const intent = yield* parseReleaseIntent(fixtureConfig)
  return yield* planRelease({ workspace: ".", config: intent })
})

const operationContext = (plan: ReleasePlan) => ({
  root: plan.source.root,
  identity: plan.identity,
  artifacts: plan.artifacts,
  notices: plan.notices,
  ...(plan.source.configPath === undefined ? {} : { configPath: plan.source.configPath })
})

const runFixtureRelease = Effect.fn("goldenEvidence.runFixtureRelease")(function*() {
  const plan = yield* planFixtureRelease
  return yield* runEvidenceWorkflow(
    plan.operations,
    "release",
    ExecutionApproval.make({ execute: true, approveIrreversible: true }),
    operationContext(plan)
  )
})

const scrubEvidenceBundle = (bundle: EvidenceBundle): EvidenceBundle => ({
  ...bundle,
  records: bundle.records.map((record) =>
    EvidenceRecord.make({
      ...record,
      startedAt: fixedTimestamp,
      endedAt: fixedTimestamp,
      durationMillis: 0
    }))
})

const renderEvidenceFixture = (bundle: EvidenceBundle): string =>
  `${JSON.stringify(scrubEvidenceBundle(bundle), null, 2)}\n`

const writeOrExpectFixture = (relativePath: string, actual: string): void => {
  const path = join(root, "test", "fixtures", "golden", "evidence", relativePath)
  if (updateGolden) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, actual)
    return
  }
  expect(readFileSync(path, "utf8")).toBe(actual)
}

describe("golden evidence", () => {
  test("approved release evidence matches the success fixture", async () => {
    const evidence = await runEffect(runFixtureRelease(), makeGoldenLayer(false))
    writeOrExpectFixture("release-run.json", renderEvidenceFixture(evidence))
  })

  test("failed npm publish evidence matches the failure fixture", async () => {
    const error = await runEffect(
      runFixtureRelease().pipe(Effect.flip),
      makeGoldenLayer(true)
    )

    expect(error).toBeInstanceOf(OperationFailedError)
    if (error instanceof OperationFailedError) {
      expect(error.operationId).toBe("npm:npm-publish")
      if (error.evidence === undefined) {
        throw new Error("Expected failure evidence.")
      }
      writeOrExpectFixture("release-failure.json", renderEvidenceFixture(error.evidence))
    }
  })
})
