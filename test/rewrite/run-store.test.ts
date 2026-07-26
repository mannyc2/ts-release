import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  ExecutionApprovalReceipt,
  ExecutionScope,
  RunLedger
} from "../../src/rewrite/model/run.js"
import {
  ApprovalNonce,
  ExecutionReviewId,
  ExecutionTopologyHash,
  LogicalRunId,
  OperationHash,
  OperationId,
  ReceiptId,
  RunId
} from "../../src/rewrite/model/primitives.js"
import {
  createLedger,
  transition
} from "../../src/rewrite/apply/transition.js"
import {
  ledgerPath,
  makeFileRunStore
} from "../../src/rewrite/apply/store.js"
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
        operationHashes: accepted.operationHashes.map(({ hash }) => OperationHash.make(hash)),
        scope,
        topologyHash: topology
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

  test("corrupt, stale, foreign, and killed temporary writes refuse without mutation", async () => {
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
      const child = Bun.spawn([
        process.execPath,
        "-e",
        "await Bun.write(process.argv[1], '{\"truncated\":');process.kill(process.pid, 'SIGKILL')",
        join(directory, ".killed.tmp")
      ], { stdout: "pipe", stderr: "pipe" })
      await child.exited
      expect(readFileSync(path, "utf8")).toBe(durable)
      const expected = {
        planId: accepted.planId,
        operationHashes: [],
        scope,
        topologyHash: topology
      }
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
