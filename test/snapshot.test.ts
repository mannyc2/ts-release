import { describe, expect, it, layer } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { parseReleaseIntent } from "../src/config/load.js"
import { runApprovedRelease, planRelease, release } from "../src/engine/engine.js"
import { renderPlanText } from "../src/engine/render.js"
import { runOperationEvidence } from "../src/engine/executor.js"
import { makeTestReleaseHttpLayer } from "./host-fakes.js"
import { makeTestCommandRunnerLayer } from "./host-fakes.js"
import {
  CommandAction,
  CommandSpec,
  ExecutionApproval,
  Operation
} from "../src/pipeline/operation.js"
import { UnsupportedArtifactStagerLayer } from "../src/engine/stager.js"
import { releaseConfig, runEffect, TestGitHubApiLayer, makePipelineIdentity } from "./helpers.js"
const snapshotConfig = JSON.stringify({
  project: {
    name: "release",
    version: "0.1.0",
    commit: "abcdef123",
    tag: "v0.1.0"
  },
  publish: {},
  evidence: ".release/evidence/{version}"
})
const gitTagConfig = JSON.stringify({
  project: {
    name: "release",
    commit: "abcdef123",
    tag: "v1.2.3"
  },
  versionFrom: "git-tag",
  publish: {},
  evidence: ".release/evidence/{version}"
})
const npmSnapshotConfig = releaseConfig({
  identity: {
    name: "release",
    version: "0.1.0",
    commit: "abcdef123",
    tag: "v0.1.0"
  },
  artifacts: [],
  npmPackage: { path: "." },
  publish: {
    npm: {
      registry: "https://registry.npmjs.org",
      packageName: "release",
      packagePath: ".",
      tokenEnv: "NPM_TOKEN"
    }
  }
})
const EngineLayer = Layer.mergeAll(
  makeTestCommandRunnerLayer({
    directories: new Set(["."]),
    files: new Map([
      ["release.config.json", npmSnapshotConfig]
    ]),
    env: new Map([["NPM_TOKEN", "npm_secret"]])
  }),
  makeTestReleaseHttpLayer(),
  TestGitHubApiLayer,
  UnsupportedArtifactStagerLayer
)
const snapshotIdentity = makePipelineIdentity({ version: "0.1.0-SNAPSHOT-abcdef1", commit: "abcdef123", shortCommit: "abcdef1", versionSource: "test", snapshot: true })

describe("snapshot mode", () => {
  it.effect("applies the snapshot suffix over manifest identity and marks the plan", () =>
    Effect.gen(function*() {
      const intent = yield* parseReleaseIntent(snapshotConfig)
      const plan = yield* planRelease({ workspace: ".", config: intent, snapshot: true })
      expect(plan.identity).toMatchObject({
        version: "0.1.0-SNAPSHOT-abcdef1",
        snapshot: true,
        versionSource: "manifest"
      })
      expect(plan.evidenceDirectory).toBe(".release/evidence/0.1.0-SNAPSHOT-abcdef1")
      expect(renderPlanText(plan)).toContain("snapshot: true")
    }).pipe(Effect.provide(EngineLayer)))

  it.effect("applies the snapshot suffix over git-tag identity", () =>
    Effect.gen(function*() {
      const intent = yield* parseReleaseIntent(gitTagConfig)
      const plan = yield* planRelease({ workspace: ".", config: intent, snapshot: true })
      expect(plan.identity).toMatchObject({
        version: "1.2.3-SNAPSHOT-abcdef1",
        tag: "v1.2.3",
        snapshot: true,
        versionSource: "git-tag"
      })
    }).pipe(Effect.provide(EngineLayer)))

  it.effect("refuses publish operations under snapshot even with full approval", () =>
    Effect.gen(function*() {
      const operation = Operation.make({
        id: "publish:danger",
        pipeId: "publish:test",
        phase: "publish",
        risk: "irreversible",
        description: "Publish something externally.",
        action: CommandAction.make({
          command: CommandSpec.make({
            executable: "tool",
            args: ["publish"],
            requiredEnv: [],
            redactedEnv: []
          })
        })
      })
      const evidence = yield* runOperationEvidence(
        operation,
        ExecutionApproval.make({ execute: true, approveIrreversible: true }),
        {
          root: ".",
          identity: snapshotIdentity,
          artifacts: [],
          notices: []
        }
      )
      expect(evidence.status).toBe("refused")
      expect(evidence.message).toBe("Refused by snapshot policy.")
    }).pipe(Effect.provide(EngineLayer)))

  layer(EngineLayer)((it) => {
    it.effect("records snapshot refusals in workflow evidence", () =>
      Effect.gen(function*() {
        const result = yield* runApprovedRelease({
          snapshot: true,
          execute: true,
          approvePublish: true
        })
        const refusal = result.evidence.records.find((record) => record.operationId === "npm:npm-publish")
        expect(refusal?.status).toBe("refused")
        expect(result.evidence.records.some((record) => record.message === "Refused by snapshot policy.")).toBe(true)
      }))

    it.effect("exposes snapshot refusals in the public release summary", () =>
      Effect.gen(function*() {
        const summary = yield* release({
          snapshot: true,
          execute: true,
          approvePublish: true
        })
        expect(summary.refused.map((operation) => operation.id)).toContain("npm:npm-publish")
        expect(summary.refused.every((operation) => operation.status === "refused")).toBe(true)
      }))
  })
})
