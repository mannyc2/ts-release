import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  executionReviewId, mintExecutionReceipt, mintPublishReceipt,
  packageStoreReconciliationKey, publishReviewId
} from "../../src/apply/approval.js"
import { checkpointIds, createLedger, operationStatus, transition } from "../../src/apply/transition.js"
import { Operation, type PackageStorePublish } from "../../src/model/operation.js"
import {
  ApprovalNonce, CheckpointId, Digest, ExecutionTopologyHash, NonEmptyName,
  OperationHash, OperationId, OutputId, RunId, SnapshotId, WorkspaceRoot
} from "../../src/model/primitives.js"
import { ExecutionScope, MaterializedOutput, type RunLedger } from "../../src/model/run.js"
import { compilePlan, Invocation } from "../../src/plan/compiler.js"
import { operationEntries } from "../../src/model/validate.js"
import { packageStoreProfiles } from "../../src/recipes/packages/store-profiles.js"

const acceptedStore = async () => {
  const fixtures = await Bun.file("test/fixtures/parity/configs/packages/configs.json").json()
  const config = fixtures.fixtures.find((item: any) => item.rowId === "C043").config
  return Effect.runPromise(compilePlan(config, Invocation.make({
    workspace: WorkspaceRoot.make("/package-store"),
    commit: NonEmptyName.make("0123456789abcdef"), snapshot: false
  })))
}
const moved = (accepted: Awaited<ReturnType<typeof acceptedStore>>, ledger: RunLedger,
  command: Parameters<typeof transition>[2]): RunLedger => {
  const next = transition(accepted, ledger, command)
  if ("reason" in next) throw next
  return next
}

describe("closed package store publication", () => {
  test("strictly lowers only the frozen operation and checkpoint topology", async () => {
    const accepted = await acceptedStore()
    const operation = operationEntries(accepted.plan)
      .map(({ operation }) => operation)
      .find((item): item is PackageStorePublish => item._tag === "PackageStorePublish")
    if (operation === undefined) throw new Error("Missing package store operation.")
    expect(Schema.decodeUnknownSync(Operation, { onExcessProperty: "error" })(operation)._tag)
      .toBe("PackageStorePublish")
    expect(() => Schema.decodeUnknownSync(Operation, { onExcessProperty: "error" })({
      ...operation, endpoint: "https://injected.invalid"
    })).toThrow()
    expect(checkpointIds(operation).map(String)).toEqual(["upload", "release"])
  })

  test("persists the target, digest, and domain-separated key before uncertainty", async () => {
    const accepted = await acceptedStore()
    const operation = operationEntries(accepted.plan)
      .map(({ operation }) => operation)
      .find((item): item is PackageStorePublish => item._tag === "PackageStorePublish")!
    const scope = ExecutionScope.make({ operationIds: accepted.operationHashes
      .map(({ operationId }) => OperationId.make(operationId)) })
    const topology = ExecutionTopologyHash.make("single-machine/v1")
    const reviewId = executionReviewId(accepted, scope, topology)
    const execution = mintExecutionReceipt(accepted, scope, topology, {
      reviewId, runId: RunId.make("package-run"), reviewer: "maintainer",
      approvalNonce: ApprovalNonce.make("execute"), approvedAt: "2026-07-27T00:00:00Z"
    })
    let ledger = createLedger(accepted, {
      runId: execution.runId, logicalRunId: execution.logicalRunId, scope,
      frontier: "publish", topologyHash: topology, receipt: execution
    })
    const material = MaterializedOutput.make({
      outputId: OutputId.make("c043-package"), snapshotId: SnapshotId.make("snapshot"),
      digest: Digest.make("digest-a"), size: 10, inode: 1
    })
    const publishReview = publishReviewId(accepted, reviewId, scope, [material])
    const receipt = mintPublishReceipt(execution, publishReview, {
      reviewId: publishReview, reviewer: "maintainer",
      approvalNonce: ApprovalNonce.make("publish"), approvedAt: "2026-07-27T00:01:00Z"
    })
    ledger = moved(accepted, ledger, { _tag: "BeginPublish", operationId: operation.id, receipt })
    const operationHash = OperationHash.make(accepted.operationHashes
      .find((item) => item.operationId === operation.id)!.hash)
    const checkpointId = CheckpointId.make("upload")
    const key = packageStoreReconciliationKey(
      accepted.planId, ledger.logicalRunId, scope, topology, operationHash,
      checkpointId, operation.profileId, operation.target, [material])
    ledger = moved(accepted, ledger, {
      _tag: "DispatchCheckpoint", operationId: operation.id, checkpointId, key,
      targetCoordinates: `${operation.profileId}:fixture:stable`, subjectDigest: material.digest
    })
    ledger = moved(accepted, ledger, {
      _tag: "UnknownCheckpoint", operationId: operation.id, checkpointId, detail: "response loss"
    })
    const state = operationStatus(ledger, operation.id)
    if (state?._tag !== "CommitUnknown") throw new Error("Expected durable uncertainty.")
    expect(state.progress[0]).toMatchObject({
      clientReconciliationKey: key, targetCoordinates: "package.store-snap.v1:fixture:stable",
      subjectDigest: "digest-a"
    })
    expect(packageStoreReconciliationKey(
      accepted.planId, ledger.logicalRunId, scope, topology, operationHash,
      checkpointId, operation.profileId, { ...operation.target, channel: "edge" }, [material]
    )).not.toBe(key)
  })

  test("freezes every transport commitment classifier branch", () => {
    for (const profile of packageStoreProfiles) {
      expect(Object.values(profile.contract.commitmentClassifier).sort()).toEqual([
        "DefinitelyCommitted", "DefinitelyNotCommitted", "DefinitelyNotCommitted",
        "PossiblyCommitted", "PossiblyCommitted", "Unclassifiable"
      ].sort())
    }
  })
})
