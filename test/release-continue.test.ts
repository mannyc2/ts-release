import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import { join } from "node:path"
import { parseReleaseIntent } from "../src/config/load.js"
import { release } from "../src/engine/engine.js"
import { CommandSpec } from "../src/grammar/operation.js"
import { planFingerprint } from "../src/run/workflow.js"
import { UnsupportedArtifactStagerLayer } from "../src/pack/stager.js"
import {
  commandKey,
  makeTestCommandRunnerLayer,
  makeTestReleaseHttpLayer
} from "./host-fakes.js"
import { runEffect, TestGitHubApiLayer } from "./helpers.js"
import { createTestPlan } from "./plan-helpers.js"

const config = (
  commands: ReadonlyArray<Record<string, unknown>> = [],
  evidence: string = ".release/evidence"
) => JSON.stringify({
  project: { name: "release", version: "0.1.0", commit: "abc123", tag: "v0.1.0" },
  publish: { custom: commands },
  evidence
})

const command = (id: string, risk?: "externally-visible" | "irreversible") => ({
  id,
  run: ["tool", id],
  ...(risk === undefined ? {} : { risk })
})

const commandSpec = (id: string) => CommandSpec.make({
  executable: "tool",
  args: [id],
  requiredEnv: [],
  redactedEnv: []
})

const response = (exitCode: number) => ({ exitCode, stdout: "", stderr: "" })

const fullLayer = (options: Parameters<typeof makeTestCommandRunnerLayer>[0] = {}) => Layer.mergeAll(
  makeTestCommandRunnerLayer(options),
  makeTestReleaseHttpLayer(),
  TestGitHubApiLayer,
  UnsupportedArtifactStagerLayer
)

const evidenceFile = (directory: string = ".release/evidence") =>
  join(process.cwd(), directory, "evidence.json")

const editEvidence = (path: string, edit: (value: Record<string, unknown>) => unknown) =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const value = JSON.parse(yield* fs.readFileString(path)) as Record<string, unknown>
    yield* fs.writeFileString(path, `${JSON.stringify(edit(value), null, 2)}\n`)
  })

describe("release continue", () => {
  test("fingerprints stable plans, change with operations, and exclude source", async () => {
    const layer = makeTestCommandRunnerLayer()
    const base = config([command("one")])
    const [first, second, changed, rootA, rootB] = await Promise.all([
      runEffect(createTestPlan(base), layer),
      runEffect(createTestPlan(base), layer),
      runEffect(createTestPlan(config([command("two")])), layer),
      runEffect(createTestPlan(base, "/tmp/release-continue-a"), layer),
      runEffect(createTestPlan(base, "/tmp/release-continue-b"), layer)
    ])

    expect(planFingerprint(first.document)).toBe(planFingerprint(second.document))
    expect(planFingerprint(first.document)).not.toBe(planFingerprint(changed.document))
    expect(planFingerprint(rootA.document)).toBe(planFingerprint(rootB.document))
  })

  test("skips exactly the prior passed set and rewrites a complete bundle", async () => {
    const firstResponse = response(0)
    const secondResponse = response(1)
    const input = config([command("one"), command("two"), command("three")])
    const intent = await Effect.runPromise(parseReleaseIntent(input))
    const layer = fullLayer({ commands: new Map([
      [commandKey(commandSpec("one")), firstResponse],
      [commandKey(commandSpec("two")), secondResponse]
    ]) })

    const failed = await runEffect(release({
      config: intent, execute: true, approvePublish: true
    }).pipe(Effect.flip), layer)
    expect(failed).toMatchObject({ _tag: "OperationFailedError", operationId: "custom:two" })

    firstResponse.exitCode = 9
    secondResponse.exitCode = 0
    const continued = await runEffect(release({
      config: intent, execute: true, approvePublish: true, continueRun: true
    }), layer)

    if (continued.evidence === undefined) throw new Error("Expected continued evidence.")
    expect(continued.evidence.records.map(({ operationId, status }) => [operationId, status])).toEqual([
      ["custom:one", "skipped"],
      ["custom:two", "passed"],
      ["custom:three", "passed"]
    ])
    expect(continued.evidence.records[0]?.message).toBe("Skipped: passed in prior evidence.")
    expect(continued.evidence.planFingerprint).toBe(planFingerprint(continued.plan))
  })

  test("rejects a tampered fingerprint", async () => {
    const input = config([command("one")])
    const intent = await Effect.runPromise(parseReleaseIntent(input))
    const layer = fullLayer()
    await runEffect(release({ config: intent, execute: true, approvePublish: true }), layer)
    await runEffect(editEvidence(evidenceFile(), (value) => ({ ...value, planFingerprint: "tampered" })), layer)

    const error = await runEffect(release({
      config: intent, execute: true, approvePublish: true, continueRun: true
    }).pipe(Effect.flip), layer)
    expect(error).toMatchObject({
      _tag: "ContinueMismatchError",
      actual: "tampered",
      path: ".release/evidence/evidence.json"
    })
  })

  test("rejects missing evidence after a prior release wrote another directory", async () => {
    const layer = fullLayer()
    const first = await Effect.runPromise(parseReleaseIntent(config([command("one")], ".release/first")))
    const missing = await Effect.runPromise(parseReleaseIntent(config([command("one")], ".release/missing")))
    await runEffect(release({ config: first, execute: true }), layer)
    const error = await runEffect(release({
      config: missing,
      execute: true,
      continueRun: true
    }).pipe(Effect.flip), layer)

    expect(error).toMatchObject({
      _tag: "ContinueEvidenceMissingError",
      path: ".release/missing/evidence.json"
    })
  })

  test("rejects legacy evidence without a fingerprint", async () => {
    const input = config([command("one")])
    const intent = await Effect.runPromise(parseReleaseIntent(input))
    const layer = fullLayer()
    await runEffect(release({ config: intent, execute: true }), layer)
    await runEffect(editEvidence(evidenceFile(), ({ planFingerprint: _fingerprint, ...value }) => value), layer)
    const error = await runEffect(release({
      config: intent, execute: true, continueRun: true
    }).pipe(Effect.flip), layer)

    expect(error).toMatchObject({ _tag: "ContinueFingerprintMissingError" })
  })

  test("maps prior evidence read failures", async () => {
    let failRead = false
    const input = config([command("one")])
    const intent = await Effect.runPromise(parseReleaseIntent(input))
    const layer = fullLayer({ failReadFileString: () => failRead })
    await runEffect(release({ config: intent, execute: true }), layer)
    failRead = true
    const error = await runEffect(release({
      config: intent, execute: true, continueRun: true
    }).pipe(Effect.flip), layer)

    expect(error).toMatchObject({ _tag: "ContinueEvidenceReadError" })
  })

  test("strictly rejects malformed or excess prior evidence", async () => {
    for (const mode of ["malformed", "excess"] as const) {
      const input = config([command("one")])
      const intent = await Effect.runPromise(parseReleaseIntent(input))
      const layer = fullLayer()
      await runEffect(release({ config: intent, execute: true }), layer)
      const original = await runEffect(Effect.flatMap(FileSystem.FileSystem, (service) =>
        service.readFileString(evidenceFile())), layer)
      const replacement = mode === "malformed"
        ? "{"
        : `${JSON.stringify({ ...(JSON.parse(original) as Record<string, unknown>), unexpected: true })}\n`
      await runEffect(Effect.flatMap(FileSystem.FileSystem, (service) =>
        service.writeFileString(evidenceFile(), replacement)), layer)
      const error = await runEffect(release({
        config: intent, execute: true, continueRun: true
      }).pipe(Effect.flip), layer)
      expect(error).toMatchObject({ _tag: "ContinueEvidenceInvalidError" })
    }
  })

  test("requires execution and refuses snapshot continuation", async () => {
    const input = config()
    const intent = await Effect.runPromise(parseReleaseIntent(input))
    const layer = fullLayer()
    const requiresExecute = await runEffect(release({
      config: intent, continueRun: true
    }).pipe(Effect.flip), layer)
    const snapshot = await runEffect(release({
      config: intent, execute: true, continueRun: true, snapshot: true
    }).pipe(Effect.flip), layer)

    expect(requiresExecute).toMatchObject({ _tag: "ContinueRequiresExecuteError" })
    expect(snapshot).toMatchObject({ _tag: "ContinueSnapshotRefusedError" })
  })

  test("still gates an unapproved irreversible remainder", async () => {
    const firstResponse = response(0)
    const secondResponse = response(1)
    const input = config([
      command("one"),
      command("two", "irreversible")
    ])
    const intent = await Effect.runPromise(parseReleaseIntent(input))
    const layer = fullLayer({ commands: new Map([
      [commandKey(commandSpec("one")), firstResponse],
      [commandKey(commandSpec("two")), secondResponse]
    ]) })
    await runEffect(release({
      config: intent, execute: true, approvePublish: true
    }).pipe(Effect.flip), layer)
    firstResponse.exitCode = 9
    secondResponse.exitCode = 0

    const error = await runEffect(release({
      config: intent, execute: true, approvePublish: false, continueRun: true
    }).pipe(Effect.flip), layer)
    expect(error).toMatchObject({ _tag: "ExecutionApprovalError", operationId: "custom:two" })
  })
})
