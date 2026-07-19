import { expect, it } from "@effect/bun-test"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { runEvidenceWorkflowWithFinalizer } from "../src/run/workflow.js"
import { OperationFailedError, WorkspaceWriteError } from "../src/run/errors.js"
import type { EvidenceBundle } from "../src/run/evidence.js"
import { makeEvidenceRef, preflightEvidenceWorkflow, runEvidenceWorkflowInto, runOperationsInto } from "../src/run/executor.js"
import { UnsupportedArtifactStagerLayer } from "../src/pack/stager.js"
import { CheckFileAction, NoteAction, Operation } from "../src/grammar/operation.js"
import { ExecutionApproval } from "../src/grammar/approval.js"
import { ReleasePlan, SourceMetadata } from "../src/grammar/plan.js"
import { makePipelineIdentity, TestGitHubApiLayer } from "./helpers.js"
import { makeTestCommandRunnerLayer, makeTestReleaseHttpLayer } from "./host-fakes.js"

const identity = makePipelineIdentity()
const context = { root: ".", identity, artifacts: [], notices: [] }
const approval = ExecutionApproval.make({ execute: true, approveIrreversible: true })
const operation = (id: string, phase: Operation["phase"], risk: Operation["risk"], fail = false) =>
  Operation.make({
    id, pipeId: "test", phase, risk, description: id,
    action: fail
      ? CheckFileAction.make({ path: `missing/${id}` })
      : NoteAction.make({ message: id, severity: "info", skipped: false })
  })
const plan = (operations: ReadonlyArray<Operation> = []) => ReleasePlan.make({
  schemaVersion: "release-plan/v3", identity, artifacts: [], operations, notices: [],
  source: SourceMetadata.make({ root: "." }), evidenceDirectory: ".release/evidence"
})
const testLayer = (writes: Array<string>, failWrite = false) => Layer.mergeAll(
  makeTestCommandRunnerLayer({
    onWriteFileString: (_path, contents) => writes.push(contents),
    failWriteFileString: failWrite
  }),
  makeTestReleaseHttpLayer(), TestGitHubApiLayer, UnsupportedArtifactStagerLayer
)
const reasonTag = (reason: Cause.Reason<unknown>): string =>
  Cause.isFailReason(reason) && typeof reason.error === "object" && reason.error !== null && "_tag" in reason.error
    ? String(reason.error._tag)
    : reason._tag

it.effect("finalizes partial evidence exactly once for every workflow exit", () => Effect.gen(function*() {
  const typedFailure = WorkspaceWriteError.make({ path: "typed", reason: "typed failure" })
  const defect = new Error("defect after evidence")
  const cases = [
    { name: "first", mode: "first", ids: ["first-fail"], tags: ["OperationFailedError"] },
    { name: "later", mode: "later", ids: ["validate", "publish", "verify-fail"], tags: ["OperationFailedError"] },
    { name: "typed", mode: "tail", cause: Cause.fail(typedFailure), ids: ["typed-prior"], tags: ["WorkspaceWriteError"] },
    { name: "defect", mode: "tail", cause: Cause.die(defect), ids: ["defect-prior"], tags: ["Die"] },
    { name: "interrupt", mode: "tail", cause: Cause.interrupt(149), ids: ["interrupt-prior"], tags: ["Interrupt"] },
    { name: "write", mode: "success", failWrite: true, ids: ["write-prior"], tags: ["EvidenceWriteError"] },
    { name: "dual", mode: "first", failWrite: true, ids: ["dual-fail"], tags: ["EvidenceWriteError", "OperationFailedError"] }
  ] as const
  for (const testCase of cases) {
    const writes: Array<string> = []
    const ref = yield* makeEvidenceRef(context)
    const workflow = testCase.mode === "first"
      ? runOperationsInto(ref, [operation(`${testCase.name}-fail`, "verify", "read-only", true), operation("unreached", "verify", "read-only")], ExecutionApproval.none, context)
      : testCase.mode === "later"
      ? runEvidenceWorkflowInto(ref, [operation("verify-fail", "verify", "read-only", true), operation("publish", "publish", "writes-local"), operation("validate", "publish", "read-only")], "release", approval, context)
      : runOperationsInto(ref, [operation(`${testCase.name}-prior`, "publish", "read-only")], ExecutionApproval.none, context).pipe(
        Effect.andThen(testCase.mode === "tail" ? Effect.failCause(testCase.cause) : Effect.void)
      )
    const exit = yield* runEvidenceWorkflowWithFinalizer(plan(), testCase.name, ref, workflow).pipe(
      Effect.exit, Effect.provide(testLayer(writes, "failWrite" in testCase && testCase.failWrite === true))
    )
    expect(writes).toHaveLength(1)
    const written = JSON.parse(writes[0]!) as EvidenceBundle
    expect(Object.keys(written)).toEqual(["schemaVersion", "releaseName", "releaseVersion", "notices", "records"])
    expect([written.schemaVersion, written.releaseName, written.releaseVersion, written.notices]).toEqual(["release-evidence/v2", "release", "0.1.0", []])
    expect(written.records.map((record) => [record.operationId, record.status])).toEqual(
      testCase.ids.map((id) => [id, id.endsWith("-fail") ? "failed" : "passed"])
    )
    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(exit.cause.reasons.map(reasonTag)).toEqual([...testCase.tags])
      const failed = exit.cause.reasons.find((reason) => Cause.isFailReason(reason) && reason.error instanceof OperationFailedError)
      if (failed !== undefined && Cause.isFailReason(failed) && failed.error instanceof OperationFailedError)
        expect(failed.error.evidence?.records.map((record) => record.operationId)).toEqual([...testCase.ids])
      const first = exit.cause.reasons[0]!
      if (testCase.name === "typed") expect(Cause.isFailReason(first) && first.error === typedFailure).toBe(true)
      if (testCase.name === "defect") expect(Cause.isDieReason(first) && first.defect === defect).toBe(true)
      if (testCase.name === "interrupt") expect(Cause.isInterruptReason(first) && first.fiberId === 149).toBe(true)
    }
  }
  const writes: Array<string> = []
  const deniedPlan = plan([operation("denied", "publish", "irreversible")])
  const denied = yield* preflightEvidenceWorkflow(deniedPlan.operations, "release", ExecutionApproval.none, context).pipe(
    Effect.exit, Effect.provide(testLayer(writes))
  )
  expect(writes).toEqual([])
  expect(denied._tag === "Failure" ? denied.cause.reasons.map(reasonTag) : []).toEqual(["ExecutionApprovalError"])
}))
