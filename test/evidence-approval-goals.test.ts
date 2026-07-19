import { describe, expect, layer, test } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { parseReleaseIntent } from "../src/config/load.js"
import { runEvidenceWorkflow } from "./plan-helpers.js"
import {
  CommandSpec,
  ExecutionApproval,
  operationApprovalRequirements
} from "../src/pipeline/operation.js"
import {
  planRelease,
  writeReleaseEvidence
} from "../src/engine/engine.js"
import type { ReleasePlan } from "../src/pipeline/plan.js"
import { UnsupportedArtifactStagerLayer } from "../src/engine/stager.js"
import { commandKey } from "./host-fakes.js"
import { makeTestReleaseHttpLayer } from "./host-fakes.js"
import {
  expectTaggedError,
  makeObservableCommandRunnerLayer,
  minimalConfig,
  partialWorkflowConfig,
  TestGitHubApiLayer,
  withTempDirectoryPromise as withTempDirectory
} from "./helpers.js"

const TestLayer = Layer.mergeAll(
  makeObservableCommandRunnerLayer({
    env: new Map([
      ["NPM_TOKEN", "npm_secret"],
      ["GH_TOKEN", "gh_secret"]
    ]),
    commands: new Map()
  }),
  makeTestReleaseHttpLayer(),
  TestGitHubApiLayer,
  UnsupportedArtifactStagerLayer,
  BunServices.layer
)

const planFromConfig = (config: string) =>
  Effect.gen(function*() {
    const intent = yield* parseReleaseIntent(config)
    return yield* planRelease({ workspace: ".", config: intent })
  })

const operationContext = (plan: ReleasePlan) => ({
  root: plan.source.root,
  identity: plan.identity,
  artifacts: plan.artifacts,
  notices: plan.notices,
  ...(plan.source.configPath === undefined ? {} : { configPath: plan.source.configPath })
})

describe("minimal evidence and approval goals", () => {
  layer(TestLayer)((it) => {
    it.effect("approval is derived from operation risk", () =>
      Effect.gen(function*() {
        const plan = yield* planFromConfig(minimalConfig)
        const publish = plan.operations.find((operation) => operation.id === "npm:npm-publish")

        expect(publish?.action._tag).toBe("command")
        if (publish !== undefined) {
          expect(publish.risk).toBe("irreversible")
          expect(operationApprovalRequirements(publish).requiresExecute).toBe(true)
          expect(operationApprovalRequirements(publish).requiresIrreversibleApproval).toBe(true)
        }

        const withoutExecute = yield* runEvidenceWorkflow(
          plan.operations,
          "publish",
          ExecutionApproval.none,
          operationContext(plan)
        ).pipe(Effect.flip)
        expectTaggedError(withoutExecute, "ExecutionApprovalError")

        const withoutIrreversible = yield* runEvidenceWorkflow(
          plan.operations,
          "publish",
          ExecutionApproval.make({ execute: true, approveIrreversible: false }),
          operationContext(plan)
        ).pipe(Effect.flip)
        expectTaggedError(withoutIrreversible, "ExecutionApprovalError")
      }))

    it.effect("read-only validation runs without publish approval", () =>
      Effect.gen(function*() {
        const plan = yield* planFromConfig(minimalConfig)
        const evidence = yield* runEvidenceWorkflow(
          plan.operations,
          "validation",
          ExecutionApproval.none,
          operationContext(plan)
        )

        expect(evidence.records.length).toBeGreaterThan(0)
        expect(evidence.records.every((record) => record.phase === "publish")).toBe(true)
        expect(evidence.records.every((record) => record.risk === "read-only")).toBe(true)
        expect(evidence.records.some((record) => record.operationId === "npm:npm-publish")).toBe(false)
      }))
  })

  test("workflow failures persist attempted operation evidence as JSON", () =>
    withTempDirectory("ts-release-evidence-goals-", async (root) => {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, partialWorkflowConfig)
      await mkdir(join(root, "artifacts"), { recursive: true })
      await writeFile(join(root, "artifacts", "release-0.1.0.tgz"), "fake archive text")

      const npmVersionCommand = CommandSpec.make({
        executable: "npm",
        args: ["--version"],
        requiredEnv: [],
        redactedEnv: []
      })
      const layer = Layer.mergeAll(
        makeObservableCommandRunnerLayer({
          env: new Map([
            ["NPM_TOKEN", "npm_secret"],
            ["GH_TOKEN", "gh_secret"]
          ]),
          commands: new Map([
            [commandKey(npmVersionCommand), {
              exitCode: 1,
              stdout: "",
              stderr: "npm unavailable"
            }]
          ])
        }),
        makeTestReleaseHttpLayer(),
        TestGitHubApiLayer,
        UnsupportedArtifactStagerLayer,
        BunServices.layer
      )

      const exit = await Effect.runPromiseExit(
        Effect.gen(function*() {
          const plan = yield* planRelease({ workspace: root, config: configPath })
          return yield* writeReleaseEvidence(plan, {
            execute: true,
            approvePublish: true
          })
        }).pipe(Effect.provide(layer))
      )

      expect(exit._tag).toBe("Failure")

      const raw = await readFile(join(root, ".release", "evidence", "evidence.json"), "utf8")
      const parsed = JSON.parse(raw) as {
        readonly records?: ReadonlyArray<{ readonly operationId?: string; readonly phase?: string; readonly status?: string }>
      }
      const records = parsed.records ?? []
      expect(records.map((record) => record.operationId)).toContain("homebrew:homebrew-render-formula")
      expect(records.map((record) => record.operationId)).toContain("npm:npm-version")
      expect(records.some((record) => record.operationId === "npm:npm-publish")).toBe(false)
      expect(records.some((record) => record.phase === "catalog")).toBe(true)
      expect(records.some((record) => record.phase === "publish" && record.status === "failed")).toBe(true)
    }))
})
