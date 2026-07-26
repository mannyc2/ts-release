import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { createHash, randomBytes } from "node:crypto"
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  applyAcceptedPlan
} from "../../src/rewrite/apply/apply.js"
import {
  executionReviewId,
  LocalApprovalSignerLayer,
  mintExecutionReceipt,
  mintPublishReceipt
} from "../../src/rewrite/apply/approval.js"
import {
  createLedger,
  operationStatus
} from "../../src/rewrite/apply/transition.js"
import {
  RunStore,
  makeFileRunStore
} from "../../src/rewrite/apply/store.js"
import {
  Committed,
  CommitmentUnknown,
  CredentialStore,
  DriverCatalog,
  ReadResult,
  WorkspaceStore,
  type DriverCatalogShape
} from "../../src/rewrite/drivers/services.js"
import {
  makeNodeWorkspaceStore
} from "../../src/rewrite/drivers/workspace.js"
import {
  ExecutionApprovalReceipt,
  ExecutionScope
} from "../../src/rewrite/model/run.js"
import {
  ApprovalNonce,
  CheckpointId,
  Digest,
  ExecutionTopologyHash,
  OperationHash,
  OperationId,
  RunId,
  WorkspaceRoot
} from "../../src/rewrite/model/primitives.js"
import { acceptedRunPlan } from "./run-fixture.js"

interface Calls {
  structured: number
  credentials: number
  readonly mutations: Array<{
    readonly checkpoint: string
    readonly key: string
    readonly content?: string | undefined
  }>
}
const setup = async (unknownFirst = false, reconcileFound = false) => {
  const directory = mkdtempSync(join(tmpdir(), "ts-release-apply-"))
  const root = join(directory, "workspace")
  const snapshots = join(directory, "snapshots")
  const runs = join(directory, "runs")
  mkdirSync(join(root, "dist"), { recursive: true })
  writeFileSync(join(root, "dist/source"), "first")
  writeFileSync(join(root, "dist/second"), "second")
  const accepted = await acceptedRunPlan()
  const scope = ExecutionScope.make({
    operationIds: accepted.operationHashes.map(({ operationId }) =>
      OperationId.make(operationId))
  })
  const topology = ExecutionTopologyHash.make("single-machine/v1")
  const reviewId = executionReviewId(accepted, scope, topology)
  const execution = mintExecutionReceipt(accepted, scope, topology, {
    reviewId,
    runId: RunId.make("run"),
    reviewer: "reviewer",
    approvalNonce: ApprovalNonce.make("execution-nonce"),
    approvedAt: "2026-07-26T00:00:00.000Z"
  })
  const ledger = createLedger(accepted, {
    runId: execution.runId,
    logicalRunId: execution.logicalRunId,
    scope,
    frontier: "validate",
    topologyHash: topology,
    receipt: execution
  })
  const store = makeFileRunStore()
  const path = store.path(runs, execution.logicalRunId)
  const calls: Calls = { structured: 0, credentials: 0, mutations: [] }
  const fakeCredential = process.env.REWRITE_FAKE_CREDENTIAL ?? randomBytes(32).toString("hex")
  let uncertain = unknownFirst
  const catalog: DriverCatalogShape = {
    structured: () => Effect.sync(() => {
      calls.structured += 1
      return { outcome: "observed", outputs: [] }
    }),
    publish: (request, handle) => Effect.sync(() => {
      const content = handle === undefined
        ? undefined
        : new TextDecoder().decode(handle.bytes)
      calls.mutations.push({
        checkpoint: request.checkpointId,
        key: request.clientReconciliationKey,
        content
      })
      if (uncertain) {
        uncertain = false
        return CommitmentUnknown.make({ failure: "response dropped" })
      }
      return Committed.make({
        observedOutcome: `committed:${request.checkpointId}`,
        ...(handle === undefined
          ? {}
          : {
              transmittedDigest: Digest.make(
                createHash("sha256").update(handle.bytes).digest("hex")
              )
            })
      })
    }),
    reconcile: () => Effect.succeed(ReadResult.make({
      found: reconcileFound,
      ...(reconcileFound ? { remoteId: "observed-upload" } : {})
    }))
  }
  const credential = {
    getRead: () => Effect.die("unused"),
    getPublish: () => Effect.sync(() => {
      calls.credentials += 1
      return fakeCredential
    })
  }
  const layer = Layer.mergeAll(
    Layer.succeed(RunStore)({ ...store }),
    Layer.succeed(DriverCatalog)(catalog),
    Layer.succeed(WorkspaceStore)(makeNodeWorkspaceStore()),
    Layer.succeed(CredentialStore)(credential),
    LocalApprovalSignerLayer
  )
  const base = {
    root: WorkspaceRoot.make(realpathSync(root)),
    snapshotDirectory: snapshots,
    through: "publish" as const,
    executionReceipt: execution
  }
  const expected = {
    planId: accepted.planId,
    operationHashes: accepted.operationHashes.map(({ hash }) => OperationHash.make(hash)),
    scope,
    topologyHash: topology
  }
  return {
    directory,
    root,
    accepted,
    execution,
    ledger,
    path,
    calls,
    layer,
    base,
    expected
  }
}

describe("applyAcceptedPlan", () => {
  test("forged execution receipt identity refuses before local work or credentials", async () => {
    const fixture = await setup()
    try {
      const forged = ExecutionApprovalReceipt.make({
        ...fixture.execution,
        reviewer: "altered-after-approval"
      })
      await expect(Effect.runPromise(applyAcceptedPlan(fixture.accepted, {
        ...fixture.base,
        executionReceipt: forged,
        run: { _tag: "NewRun", path: fixture.path, ledger: fixture.ledger }
      }).pipe(Effect.provide(fixture.layer)))).rejects.toBeDefined()
      expect(fixture.calls.structured).toBe(0)
      expect(fixture.calls.credentials).toBe(0)
      expect(fixture.calls.mutations).toEqual([])
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true })
    }
  })

  test("returns byte-bound publish review before credentials and applies exact checkpoints once", async () => {
    const fixture = await setup()
    try {
      const challenge = await Effect.runPromise(applyAcceptedPlan(
        fixture.accepted,
        {
          ...fixture.base,
          run: { _tag: "NewRun", path: fixture.path, ledger: fixture.ledger }
        }
      ).pipe(Effect.provide(fixture.layer)))
      if (!("_tag" in challenge)) throw new Error("Expected publish review.")
      expect(challenge._tag).toBe("PublishReviewRequired")
      expect(fixture.calls.credentials).toBe(0)
      expect(fixture.calls.mutations).toEqual([])
      const publish = mintPublishReceipt(
        fixture.execution,
        challenge.reviewId,
        {
          reviewId: challenge.reviewId,
          reviewer: "reviewer",
          approvalNonce: ApprovalNonce.make("publish-nonce"),
          approvedAt: "2026-07-26T00:01:00.000Z"
        }
      )
      const result = await Effect.runPromise(applyAcceptedPlan(
        fixture.accepted,
        {
          ...fixture.base,
          run: { _tag: "ResumeRun", path: fixture.path, expected: fixture.expected },
          publish: { receipt: publish }
        }
      ).pipe(Effect.provide(fixture.layer)))
      if ("_tag" in result) throw new Error("Expected completed ledger.")
      expect(operationStatus(result, OperationId.make("upload"))?._tag).toBe("Passed")
      expect(operationStatus(result, OperationId.make("forge"))?._tag).toBe("Passed")
      expect(fixture.calls.structured).toBe(3)
      expect(fixture.calls.credentials).toBe(4)
      expect(fixture.calls.mutations.map((call) => [
        call.checkpoint,
        call.content
      ])).toEqual([
        ["dispatch", "first"],
        ["release", undefined],
        ["asset:source", "first"],
        ["asset:second", "second"]
      ])
      expect(new Set(fixture.calls.mutations.map((call) => call.key)).size).toBe(4)
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true })
    }
  })

  test("artifact drift rejects before credential reads or remote requests", async () => {
    const fixture = await setup()
    try {
      const challenge = await Effect.runPromise(applyAcceptedPlan(
        fixture.accepted,
        {
          ...fixture.base,
          run: { _tag: "NewRun", path: fixture.path, ledger: fixture.ledger }
        }
      ).pipe(Effect.provide(fixture.layer)))
      if (!("_tag" in challenge)) throw new Error("Expected publish review.")
      const publish = mintPublishReceipt(fixture.execution, challenge.reviewId, {
        reviewId: challenge.reviewId,
        reviewer: "reviewer",
        approvalNonce: ApprovalNonce.make("publish-nonce"),
        approvedAt: "later"
      })
      writeFileSync(join(fixture.root, "dist/source"), "changed")
      await expect(Effect.runPromise(applyAcceptedPlan(
        fixture.accepted,
        {
          ...fixture.base,
          run: { _tag: "ResumeRun", path: fixture.path, expected: fixture.expected },
          publish: { receipt: publish }
        }
      ).pipe(Effect.provide(fixture.layer)))).rejects.toBeDefined()
      expect(fixture.calls.credentials).toBe(0)
      expect(fixture.calls.mutations).toEqual([])
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true })
    }
  })

  test("a dropped post-commit response becomes durable unknown and is never replayed", async () => {
    const fixture = await setup(true)
    try {
      const challenge = await Effect.runPromise(applyAcceptedPlan(
        fixture.accepted,
        {
          ...fixture.base,
          run: { _tag: "NewRun", path: fixture.path, ledger: fixture.ledger }
        }
      ).pipe(Effect.provide(fixture.layer)))
      if (!("_tag" in challenge)) throw new Error("Expected publish review.")
      const publish = mintPublishReceipt(fixture.execution, challenge.reviewId, {
        reviewId: challenge.reviewId,
        reviewer: "reviewer",
        approvalNonce: ApprovalNonce.make("publish-nonce"),
        approvedAt: "later"
      })
      const first = await Effect.runPromise(applyAcceptedPlan(
        fixture.accepted,
        {
          ...fixture.base,
          run: { _tag: "ResumeRun", path: fixture.path, expected: fixture.expected },
          publish: { receipt: publish }
        }
      ).pipe(Effect.provide(fixture.layer)))
      if ("_tag" in first) throw new Error("Expected ledger.")
      expect(operationStatus(first, OperationId.make("upload"))?._tag).toBe("CommitUnknown")
      expect(fixture.calls.mutations).toHaveLength(1)
      const second = await Effect.runPromise(applyAcceptedPlan(
        fixture.accepted,
        {
          ...fixture.base,
          run: { _tag: "ResumeRun", path: fixture.path, expected: fixture.expected },
          publish: { receipt: publish }
        }
      ).pipe(Effect.provide(fixture.layer)))
      if ("_tag" in second) throw new Error("Expected ledger.")
      expect(fixture.calls.mutations).toHaveLength(1)
      expect(operationStatus(second, OperationId.make("forge"))?._tag).toBe("Pending")
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true })
    }
  })

  test("read-only reconciliation proves an unknown checkpoint without replaying it", async () => {
    const fixture = await setup(true, true)
    try {
      const challenge = await Effect.runPromise(applyAcceptedPlan(
        fixture.accepted,
        { ...fixture.base, run: { _tag: "NewRun", path: fixture.path, ledger: fixture.ledger } }
      ).pipe(Effect.provide(fixture.layer)))
      if (!("_tag" in challenge)) throw new Error("Expected publish review.")
      const publish = mintPublishReceipt(fixture.execution, challenge.reviewId, {
        reviewId: challenge.reviewId,
        reviewer: "reviewer",
        approvalNonce: ApprovalNonce.make("publish-nonce"),
        approvedAt: "later"
      })
      const first = await Effect.runPromise(applyAcceptedPlan(fixture.accepted, {
        ...fixture.base,
        run: { _tag: "ResumeRun", path: fixture.path, expected: fixture.expected },
        publish: { receipt: publish }
      }).pipe(Effect.provide(fixture.layer)))
      if ("_tag" in first) throw new Error("Expected ledger.")
      const result = await Effect.runPromise(applyAcceptedPlan(fixture.accepted, {
        ...fixture.base,
        run: { _tag: "ResumeRun", path: fixture.path, expected: fixture.expected },
        publish: { receipt: publish },
        recoveries: [{
          _tag: "Reconcile",
          operationId: OperationId.make("upload"),
          checkpointId: CheckpointId.make("dispatch")
        }]
      }).pipe(Effect.provide(fixture.layer)))
      if ("_tag" in result) throw new Error("Expected ledger.")
      expect(operationStatus(result, OperationId.make("upload"))?._tag).toBe("Passed")
      expect(operationStatus(result, OperationId.make("forge"))?._tag).toBe("Passed")
      expect(fixture.calls.mutations.map(({ checkpoint }) => checkpoint)).toEqual([
        "dispatch", "release", "asset:source", "asset:second"
      ])
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true })
    }
  })
})
