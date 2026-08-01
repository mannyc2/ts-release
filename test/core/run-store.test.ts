import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  ExecutionApprovalReceipt,
  ExecutionScope,
  RunLedger
} from "../../src/model/run.js"
import {
  ApprovalNonce,
  ExecutionReviewId,
  ExecutionTopologyHash,
  LogicalRunId,
  OperationHash,
  OperationId,
  ReceiptId,
  RunId
} from "../../src/model/primitives.js"
import {
  createLedger,
  transition
} from "../../src/apply/transition.js"
import {
  ledgerPath,
  makeFileRunStore
} from "../../src/apply/store.js"
import { acceptedRunPlan } from "./run-fixture.js"

const root = () => mkdtempSync(join(tmpdir(), "ts-release-run-store-"))
const failure = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(effect.pipe(Effect.flip))

describe("file-backed RunStore", () => {
  test("uses a deterministic logical-run path and canonical create/load", async () => {
    const directory = root()
    try {
      const accepted = await acceptedRunPlan()
      const topology = ExecutionTopologyHash.make("single-machine/v1")
      const logicalRunId = LogicalRunId.make("logical")
      const scope = ExecutionScope.make({
        operationIds: accepted.operationHashes.map(({ operationId }) =>
          OperationId.make(operationId))
      })
      const receipt = ExecutionApprovalReceipt.make({
        receiptId: ReceiptId.make("receipt"),
        reviewId: ExecutionReviewId.make("review"),
        runId: RunId.make("run"),
        logicalRunId,
        reviewer: "reviewer",
        approvalNonce: ApprovalNonce.make("nonce"),
        approvedAt: "now",
        topologyHash: topology
      })
      const ledger = createLedger(accepted, {
        runId: receipt.runId,
        logicalRunId,
        scope,
        frontier: "verify",
        topologyHash: topology,
        receipt
      })
      const store = makeFileRunStore()
      const path = store.path(directory, logicalRunId)
      expect(path).toBe(ledgerPath(directory, logicalRunId))
      expect(await Effect.runPromise(store.create(path, ledger)))
        .toMatch(/file-rename/)
      const expected = {
        planId: accepted.planId,
        operationHashes: accepted.operationHashes.map(({ hash }) => OperationHash.make(hash))
      }
      expect((await Effect.runPromise(store.load(path, expected))).revision).toBe(0)
      expect((await failure(store.create(path, ledger)))._tag).toBe("RunStoreError")
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test("lease and revision CAS allow one winner without rewriting durable bytes", async () => {
    const directory = root()
    try {
      const accepted = await acceptedRunPlan()
      const topology = ExecutionTopologyHash.make("single-machine/v1")
      const logicalRunId = LogicalRunId.make("logical")
      const runId = RunId.make("run")
      const scope = ExecutionScope.make({
        operationIds: accepted.operationHashes.map(({ operationId }) =>
          OperationId.make(operationId))
      })
      const receipt = ExecutionApprovalReceipt.make({
        receiptId: ReceiptId.make("receipt"),
        reviewId: ExecutionReviewId.make("review"),
        runId,
        logicalRunId,
        reviewer: "reviewer",
        approvalNonce: ApprovalNonce.make("nonce"),
        approvedAt: "now",
        topologyHash: topology
      })
      const ledger = createLedger(accepted, {
        runId,
        logicalRunId,
        scope,
        frontier: "build",
        topologyHash: topology,
        receipt
      })
      const store = makeFileRunStore()
      const path = store.path(directory, logicalRunId)
      await Effect.runPromise(store.create(path, ledger))
      const next = transition(accepted, ledger, {
        _tag: "AdvanceFrontier",
        frontier: "validate"
      })
      if ("_tag" in next) throw next
      await Effect.runPromise(store.save(path, 0, next))
      const durable = readFileSync(path, "utf8")
      expect((await failure(store.save(path, 0, next)))._tag).toBe("RunStoreError")
      expect(readFileSync(path, "utf8")).toBe(durable)
      writeFileSync(`${path}.lease`, "held\n")
      const newer = RunLedger.make({ ...next, revision: 2 })
      expect((await failure(store.save(path, 1, newer)))._tag).toBe("RunStoreError")
      expect(readFileSync(path, "utf8")).toBe(durable)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test("a young foreign lease names its holder; a stale lease is stolen once", async () => {
    const directory = root()
    try {
      const accepted = await acceptedRunPlan()
      const topology = ExecutionTopologyHash.make("single-machine/v1")
      const logicalRunId = LogicalRunId.make("logical")
      const runId = RunId.make("run")
      const scope = ExecutionScope.make({
        operationIds: accepted.operationHashes.map(({ operationId }) =>
          OperationId.make(operationId))
      })
      const receipt = ExecutionApprovalReceipt.make({
        receiptId: ReceiptId.make("receipt"),
        reviewId: ExecutionReviewId.make("review"),
        runId,
        logicalRunId,
        reviewer: "reviewer",
        approvalNonce: ApprovalNonce.make("nonce"),
        approvedAt: "now",
        topologyHash: topology
      })
      const ledger = createLedger(accepted, {
        runId,
        logicalRunId,
        scope,
        frontier: "build",
        topologyHash: topology,
        receipt
      })
      const store = makeFileRunStore()
      const path = store.path(directory, logicalRunId)
      await Effect.runPromise(store.create(path, ledger))
      const next = transition(accepted, ledger, {
        _tag: "AdvanceFrontier",
        frontier: "validate"
      })
      if ("_tag" in next) throw next
      writeFileSync(`${path}.lease`, "4242\n")
      const refusal = await failure(store.save(path, 0, next))
      expect(refusal._tag).toBe("RunStoreError")
      expect(refusal.reason).toContain("held by pid 4242")
      expect(refusal.reason).toContain(`${path}.lease`)
      const past = new Date(Date.now() - 2 * 3_600_000)
      utimesSync(`${path}.lease`, past, past)
      expect(await Effect.runPromise(store.save(path, 0, next))).toMatch(/file-rename/)
      expect(existsSync(`${path}.lease`)).toBe(false)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test("corrupt, stale, foreign, and torn temporary writes refuse without mutation", async () => {
    const directory = root()
    try {
      const accepted = await acceptedRunPlan()
      const topology = ExecutionTopologyHash.make("single-machine/v1")
      const logicalRunId = LogicalRunId.make("logical")
      const scope = ExecutionScope.make({ operationIds: [] })
      const receipt = ExecutionApprovalReceipt.make({
        receiptId: ReceiptId.make("receipt"),
        reviewId: ExecutionReviewId.make("review"),
        runId: RunId.make("run"),
        logicalRunId,
        reviewer: "reviewer",
        approvalNonce: ApprovalNonce.make("nonce"),
        approvedAt: "now",
        topologyHash: topology
      })
      const ledger = createLedger(accepted, {
        runId: receipt.runId,
        logicalRunId,
        scope,
        frontier: "build",
        topologyHash: topology,
        receipt
      })
      const store = makeFileRunStore()
      const path = store.path(directory, logicalRunId)
      await Effect.runPromise(store.create(path, ledger))
      const durable = readFileSync(path, "utf8")
      // A torn temporary matching the atomic-write naming pattern must never
      // become the ledger: load keeps serving the intact durable bytes.
      writeFileSync(join(directory, ".deadbeef.run-ledger.tmp"), '{"torn":')
      const expected = {
        planId: accepted.planId,
        operationHashes: accepted.operationHashes.map(({ hash }) => OperationHash.make(hash))
      }
      expect((await Effect.runPromise(store.load(path, expected))).revision).toBe(0)
      expect(readFileSync(path, "utf8")).toBe(durable)
      expect((await failure(store.load(path, {
        ...expected,
        planId: "foreign" as typeof accepted.planId
      })))._tag).toBe("RunStoreError")
      writeFileSync(path, '{"truncated":')
      expect((await failure(store.load(path, expected)))._tag).toBe("RunStoreError")
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
