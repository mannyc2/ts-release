import { describe, expect, layer, test } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parseReleaseIntent } from "../src/config/load.js"
import {
  CommandSpec,
  ExecutionApproval,
  operationRequiresExecute,
  operationRequiresIrreversibleApproval
} from "../src/domain/operation.js"
import { createReleasePlan } from "../src/planner/create-release-plan.js"
import {
  executePlan,
  validatePlan
} from "../src/planner/executor.js"
import {
  planRelease,
  writeReleaseEvidence
} from "../src/workflows/release.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"
import { commandKey } from "../src/host/test.js"
import { makeTestReleaseHttpLayer } from "../src/host/http.js"
import {
  expectTaggedError,
  makeObservableCommandRunnerLayer,
  minimalConfig,
  partialWorkflowConfig,
  TestGitHubApiLayer
} from "./helpers.js"

const withTempDirectory = async <A>(
  prefix: string,
  use: (root: string) => Promise<A>
): Promise<A> => {
  const root = await mkdtemp(join(tmpdir(), prefix))
  try {
    return await use(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

const TestLayer = Layer.mergeAll(
  makeObservableCommandRunnerLayer({
    env: new Map([
      ["NPM_TOKEN", "npm_secret"],
      ["GH_TOKEN", "gh_secret"]
    ]),
    commands: new Map()
  }),
  makeTestReleaseHttpLayer(),
  LiveTargetRegistryLayer,
  TestGitHubApiLayer,
  BunServices.layer
)

describe("minimal evidence and approval goals", () => {
  layer(TestLayer)((it) => {
    it.effect("approval is derived from operation risk", () =>
      Effect.gen(function*() {
        const intent = yield* parseReleaseIntent(minimalConfig)
        const plan = yield* createReleasePlan(intent)
        const publish = plan.operations.find((operation) => operation._tag === "PublishCommandOperation")

        expect(publish?._tag).toBe("PublishCommandOperation")
        if (publish?._tag === "PublishCommandOperation") {
          expect(publish.risk).toBe("irreversible")
          expect(operationRequiresExecute(publish)).toBe(true)
          expect(operationRequiresIrreversibleApproval(publish)).toBe(true)
        }

        const withoutExecute = yield* executePlan(plan, ExecutionApproval.none).pipe(Effect.flip)
        expectTaggedError(withoutExecute, "ExecutionApprovalError")

        const withoutIrreversible = yield* executePlan(
          plan,
          ExecutionApproval.make({ execute: true, approveIrreversible: false })
        ).pipe(Effect.flip)
        expectTaggedError(withoutIrreversible, "ExecutionApprovalError")
      }))

    it.effect("read-only validation runs without publish approval", () =>
      Effect.gen(function*() {
        const intent = yield* parseReleaseIntent(minimalConfig)
        const plan = yield* createReleasePlan(intent)
        const evidence = yield* validatePlan(plan)

        expect(evidence.records.length).toBeGreaterThan(0)
        expect(evidence.records.every((record) => record.phase === "validation")).toBe(true)
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
        LiveTargetRegistryLayer,
        TestGitHubApiLayer,
        BunServices.layer
      )

      const exit = await Effect.runPromiseExit(
        Effect.gen(function*() {
          const plan = yield* planRelease({ root, configPath })
          return yield* writeReleaseEvidence(plan, {
            root,
            configPath,
            execute: true,
            approveIrreversible: true
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
      expect(records.some((record) => record.phase === "render")).toBe(true)
      expect(records.some((record) => record.phase === "validation" && record.status === "failed")).toBe(true)
    }))
})
