import {
  AssumedAbsent, AssumedCommitted, AttemptRecord, CheckpointDispatching,
  CheckpointFailedBeforeCommit, CheckpointPassed, CheckpointPending,
  CheckpointUnknown, CommitUnknown, DispatchingPublish, FailedBeforeCommit,
  ManualReview, OperationRunRecord, Passed, Pending, PublishApprovalReceipt,
  RunLedger, RunningStructured, RunningTrustedExec, TransitionError, type AttemptState,
  type CheckpointState, type ExecutionApprovalReceipt, type MaterializedOutput, type Stage
} from "../model/run.js"
import { CheckpointId, OperationId } from "../model/primitives.js"
import { operationAuthority, type Operation } from "../model/operation.js"
import { stageOrder } from "../model/validate.js"
import type { AcceptedPlan } from "../plan/accepted.js"
import {
  assertReceipt, attemptId, checkpointIds, createLedger, current, fail,
  operationFor, progress, validateLedger
} from "./ledger.js"
export { checkpointIds, createLedger, validateLedger } from "./ledger.js"

type Start = {
  readonly _tag: "BeginStructured" | "BeginTrustedExec", readonly operationId: OperationId,
  readonly at: string
}
type CheckpointCommand = {
  readonly _tag: "DispatchCheckpoint" | "PassCheckpoint" | "FailCheckpoint" | "UnknownCheckpoint",
  readonly operationId: OperationId, readonly checkpointId: CheckpointId, readonly detail?: string,
  readonly key?: string, readonly retryable?: boolean, readonly remoteId?: string,
  readonly targetCoordinates?: string, readonly subjectDigest?: MaterializedOutput["digest"]
}
type Settle = {
  readonly _tag: "Pass" | "FailBeforeCommit" | "CommitUnknown",
  readonly operationId: OperationId, readonly detail: string, readonly outputs?: ReadonlyArray<MaterializedOutput>,
  readonly retryable?: boolean
}
type BeginPublish = { readonly _tag: "BeginPublish", readonly operationId: OperationId,
  readonly receipt: PublishApprovalReceipt }
type Resolve = {
  readonly _tag: "Resolve", readonly operationId: OperationId, readonly resolution: "committed" | "absent",
  readonly operator: string, readonly reason: string, readonly at: string
}
type Reconcile = {
  readonly _tag: "Reconcile", readonly operationId: OperationId, readonly checkpointId: CheckpointId,
  readonly result: "committed" | "absent", readonly detail: string
}
type Retry = { readonly _tag: "Retry", readonly operationId: OperationId, readonly receipt: ExecutionApprovalReceipt }
export type TransitionCommand = Start | CheckpointCommand | Settle | BeginPublish |
  Resolve | Reconcile | Retry | { readonly _tag: "Recover" } |
  { readonly _tag: "AdvanceFrontier"; readonly frontier: Stage }

const setState = (record: OperationRunRecord, state: AttemptState,
  receipt = current(record).publishReceipt): OperationRunRecord => {
  const prior = current(record)
  const next = AttemptRecord.make({
    attemptId: prior.attemptId, executionReceipt: prior.executionReceipt,
    ...(receipt === undefined ? {} : { publishReceipt: receipt }), state })
  return OperationRunRecord.make({ operationId: record.operationId, operationHash: record.operationHash,
    attempts: [...record.attempts.slice(0, -1), next] })
}
const mapCheckpoint = (record: OperationRunRecord, id: CheckpointId,
  update: (state: CheckpointState) => CheckpointState): ReadonlyArray<CheckpointState> => {
  const before = progress(current(record).state)
  if (before.filter((item) => item.checkpointId === id).length !== 1) throw fail(`Unknown checkpoint ${id}.`)
  return before.map((item) => item.checkpointId === id ? update(item) : item)
}
const evidence = (state: CheckpointState) => ({
  ...("clientReconciliationKey" in state && state.clientReconciliationKey !== undefined
    ? { clientReconciliationKey: state.clientReconciliationKey } : {}),
  ...("targetCoordinates" in state && state.targetCoordinates !== undefined
    ? { targetCoordinates: state.targetCoordinates } : {}),
  ...("subjectDigest" in state && state.subjectDigest !== undefined
    ? { subjectDigest: state.subjectDigest } : {})
})

const start = (record: OperationRunRecord, operation: Operation, command: Start): OperationRunRecord => {
  if (current(record).state._tag !== "Pending") throw fail("Operation is not pending.")
  switch (command._tag) {
    case "BeginStructured":
      if (operation._tag === "Exec" || operationAuthority(operation) === "RemotePublish")
        throw fail("Illegal structured start.")
      return setState(record, RunningStructured.make({ startedAt: command.at }))
    case "BeginTrustedExec":
      if (operation._tag !== "Exec") throw fail("Only Exec is trusted execution.")
      return setState(record, RunningTrustedExec.make({ startedAt: command.at }))
  }
}
const resumeProgress = (record: OperationRunRecord): ReadonlyArray<CheckpointState> => {
  const found = [...record.attempts].reverse()
    .map((attempt) => progress(attempt.state)).find((items) => items.length > 0) ?? []
  return found.map((item) => item._tag === "CheckpointPassed" ? item
    : CheckpointPending.make({ checkpointId: item.checkpointId }))
}
const beginPublish = (ledger: RunLedger, record: OperationRunRecord,
  operation: Operation, receipt: PublishApprovalReceipt): OperationRunRecord => {
  const attempt = current(record)
  if (attempt.state._tag !== "Pending" || operationAuthority(operation) !== "RemotePublish")
    throw fail("Illegal publish start.")
  if (receipt.runId !== ledger.runId || receipt.executionReceiptId !== attempt.executionReceipt.receiptId) {
    throw fail("Publish receipt is foreign to this attempt.")
  }
  const carried = resumeProgress(record)
  const initial = carried.length > 0 ? carried
    : checkpointIds(operation).map((id) => CheckpointPending.make({ checkpointId: id }))
  if (initial.length === 0) throw fail("Publication has no checkpoints.")
  return setState(record, DispatchingPublish.make(
    { attemptId: attempt.attemptId, progress: initial }), receipt)
}
const checkpoint = (record: OperationRunRecord, command: CheckpointCommand): OperationRunRecord => {
  const attempt = current(record)
  if (attempt.state._tag !== "DispatchingPublish") throw fail("Publication is not dispatching.")
  const states = mapCheckpoint(record, command.checkpointId, (state) => {
    switch (command._tag) {
      case "DispatchCheckpoint":
        if (state._tag !== "CheckpointPending" || command.key === undefined)
          throw fail("Checkpoint is not pending or has no key.")
        return CheckpointDispatching.make({ checkpointId: state.checkpointId, attemptId: attempt.attemptId,
          clientReconciliationKey: command.key,
          ...(command.targetCoordinates === undefined ? {} : {
            targetCoordinates: command.targetCoordinates
          }),
          ...(command.subjectDigest === undefined ? {} : { subjectDigest: command.subjectDigest }) })
      case "PassCheckpoint":
        if (state._tag !== "CheckpointDispatching") throw fail("Checkpoint was not dispatching.")
        return CheckpointPassed.make(
          { checkpointId: state.checkpointId, ...evidence(state), observedOutcome: command.detail ?? "" })
      case "FailCheckpoint":
        if (state._tag !== "CheckpointDispatching") throw fail("Checkpoint was not dispatching.")
        return CheckpointFailedBeforeCommit.make({ checkpointId: state.checkpointId,
          ...evidence(state), failure: command.detail ?? "", retryable: command.retryable ?? false })
      case "UnknownCheckpoint":
        if (state._tag !== "CheckpointDispatching") throw fail("Checkpoint was not dispatching.")
        return CheckpointUnknown.make({ checkpointId: state.checkpointId,
          ...evidence(state), clientReconciliationKey: state.clientReconciliationKey,
          ...(command.remoteId === undefined ? {} : { observedRemoteId: command.remoteId }),
          failure: command.detail ?? "" })
    }
  })
  return setState(record, command._tag === "UnknownCheckpoint"
    ? CommitUnknown.make({ progress: states, failure: command.detail ?? "" })
    : DispatchingPublish.make({ attemptId: attempt.attemptId, progress: states }))
}
const settle = (record: OperationRunRecord, command: Settle): OperationRunRecord => {
  const state = current(record).state
  if (!["RunningStructured", "RunningTrustedExec", "DispatchingPublish"].includes(state._tag))
    throw fail("Operation is not running.")
  switch (command._tag) {
    case "Pass":
      return setState(record, Passed.make({ progress: progress(state), outcome: command.detail,
        materializedOutputs: [...command.outputs ?? []] }))
    case "FailBeforeCommit":
      return setState(record, FailedBeforeCommit.make({ progress: progress(state),
        failure: command.detail, retryable: command.retryable ?? false }))
    case "CommitUnknown":
      if (state._tag !== "DispatchingPublish") throw fail("No durable publication intent.")
      return setState(record, CommitUnknown.make({ progress: state.progress, failure: command.detail }))
  }
}
const resolve = (ledger: RunLedger, record: OperationRunRecord,
  command: Extract<TransitionCommand, { readonly _tag: "Resolve" | "Reconcile" | "Retry" }>): OperationRunRecord => {
  const attempt = current(record)
  switch (command._tag) {
    case "Resolve": {
      if (!["CommitUnknown", "ManualReview"].includes(attempt.state._tag))
        throw fail("Only unknown or manual work can be resolved.")
      const value = { operator: command.operator, reason: command.reason, timestamp: command.at }
      return setState(record, command.resolution === "committed" ? AssumedCommitted.make(value)
        : AssumedAbsent.make(value))
    }
    case "Reconcile": {
      if (attempt.state._tag !== "CommitUnknown") throw fail("Publication is not unknown.")
      const states = mapCheckpoint(record, command.checkpointId, (state) => {
        if (state._tag !== "CheckpointUnknown") throw fail("Checkpoint is not unknown.")
        return command.result === "committed" ? CheckpointPassed.make(
          { checkpointId: state.checkpointId, ...evidence(state), observedOutcome: command.detail })
          : CheckpointFailedBeforeCommit.make(
            { checkpointId: state.checkpointId, ...evidence(state),
              failure: command.detail, retryable: true })
      })
      return setState(record, command.result === "committed"
        ? DispatchingPublish.make({ attemptId: attempt.attemptId, progress: states })
        : FailedBeforeCommit.make({ progress: states, failure: command.detail, retryable: true }))
    }
    case "Retry":
      if (attempt.state._tag !== "AssumedAbsent" &&
        !(attempt.state._tag === "FailedBeforeCommit" && attempt.state.retryable))
        throw fail("Operation is not eligible for retry.")
      assertReceipt(ledger, command.receipt)
      return OperationRunRecord.make({ operationId: record.operationId, operationHash: record.operationHash,
        attempts: [...record.attempts, AttemptRecord.make({
          attemptId: attemptId(record.attempts.length), executionReceipt: command.receipt,
          state: Pending.make() })] })
  }
}
const changeRecord = (accepted: AcceptedPlan, ledger: RunLedger, record: OperationRunRecord,
  command: Exclude<TransitionCommand, { readonly _tag: "Recover" | "AdvanceFrontier" }>): OperationRunRecord => {
  const operation = operationFor(accepted, record.operationId)
  switch (command._tag) {
    case "BeginStructured": case "BeginTrustedExec":
      return start(record, operation, command)
    case "BeginPublish":
      return beginPublish(ledger, record, operation, command.receipt)
    case "DispatchCheckpoint": case "PassCheckpoint":
    case "FailCheckpoint": case "UnknownCheckpoint":
      return checkpoint(record, command)
    case "Pass": case "FailBeforeCommit": case "CommitUnknown":
      return settle(record, command)
    case "Resolve": case "Reconcile": case "Retry":
      return resolve(ledger, record, command)
  }
}
const recovered = (record: OperationRunRecord): OperationRunRecord => {
  const state = current(record).state
  switch (state._tag) {
    case "RunningStructured":
      return setState(record, FailedBeforeCommit.make({ progress: [],
        failure: "Recovered interrupted replay-safe work.", retryable: true }))
    case "RunningTrustedExec":
      return setState(record, ManualReview.make({ reason: "Recovered interrupted trusted exec." }))
    case "DispatchingPublish": {
      const states = state.progress.map((item) => item._tag === "CheckpointDispatching"
        ? CheckpointUnknown.make({ checkpointId: item.checkpointId,
            ...evidence(item), clientReconciliationKey: item.clientReconciliationKey,
            failure: "Recovered after durable dispatch intent." }) : item)
      return setState(record, CommitUnknown.make(
        { progress: states, failure: "Recovered in-flight publication." }))
    }
    default:
      return record
  }
}

export const transition = (accepted: AcceptedPlan, ledger: RunLedger,
  command: TransitionCommand): RunLedger | TransitionError => {
  try {
    validateLedger(accepted, ledger)
    if (command._tag === "AdvanceFrontier") {
      if (stageOrder.indexOf(command.frontier) < stageOrder.indexOf(ledger.frontier))
        throw fail("Frontier cannot move backward.")
      const advanced = RunLedger.make(
        { ...ledger, frontier: command.frontier, revision: ledger.revision + 1 })
      validateLedger(accepted, advanced)
      return advanced
    }
    const operations = command._tag === "Recover"
      ? ledger.operations.map(recovered)
      : ledger.operations.map((record) => record.operationId === command.operationId
        ? changeRecord(accepted, ledger, record, command)
        : record)
    if (command._tag !== "Recover" &&
      !ledger.operations.some((record) => record.operationId === command.operationId))
      throw fail(`Unknown operation ${command.operationId}.`)
    const next = RunLedger.make({ ...ledger, revision: ledger.revision + 1, operations })
    validateLedger(accepted, next)
    return next
  } catch (error) {
    return error instanceof TransitionError ? error : fail(String(error))
  }
}
export const operationStatus = (ledger: RunLedger, operationId: OperationId): AttemptState | undefined =>
  ledger.operations.find((item) => item.operationId === operationId)?.attempts.at(-1)?.state
export const settled = (state: AttemptState | undefined): boolean =>
  state?._tag === "Passed" || state?._tag === "AssumedCommitted"
export type StagedOutcome = "prepare" | "publish" | "announce" | "continue"
export const stagedOutcome = (frontier: Stage): StagedOutcome =>
  stageOrder.indexOf(frontier) <= stageOrder.indexOf("validate") ? "prepare"
    : frontier === "publish" ? "publish" : frontier === "announce" ? "announce" : "continue"
