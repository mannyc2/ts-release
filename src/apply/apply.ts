import * as Effect from "effect/Effect"
import {
  ApprovalSigner, executionReviewId, packageStoreReconciliationKey, publishReviewId,
  reconciliationKey, supplyChainReconciliationKey
} from "./approval.js"
import { operationStatus, transition, type TransitionCommand } from "./transition.js"
import { RunStore, type ExpectedLedger, type RunStoreShape } from "./store.js"
import {
  CatalogPublishRequest, CatalogStructuredRequest, CommitmentUnknown, CredentialStore,
  DriverCatalog, NotDispatched, SnapshotRequest,
  WorkspaceStore, type DriverCatalogShape, type MutationResult, type WorkspaceStoreShape
} from "../drivers/services.js"
import type { PublishPermit } from "../model/permit.js"
import type { ExecutionPermit } from "../model/permit.js"
import {
  TransitionError, type ExecutionApprovalReceipt, type MaterializedOutput, type PublishApprovalReceipt,
  type RunLedger, type Stage
} from "../model/run.js"
import { CheckpointId, OperationHash, OperationId, type WorkspaceRoot } from "../model/primitives.js"
import { operationAuthority, type Operation } from "../model/operation.js"
import { operationEntries, stageOrder } from "../model/validate.js"
import type { AcceptedPlan } from "../plan/accepted.js"

export type ApplyRunRequest = {
  readonly _tag: "NewRun", readonly path: string, readonly ledger: RunLedger
} | { readonly _tag: "ResumeRun", readonly path: string, readonly expected: ExpectedLedger }
export type PublishAuthorization = { readonly receipt: PublishApprovalReceipt }
export type ApplyRecovery = Extract<TransitionCommand, { readonly _tag: "Resolve" }> |
  { readonly _tag: "Reconcile", readonly operationId: OperationId, readonly checkpointId: CheckpointId }
export type ApplyRequest = {
  readonly run: ApplyRunRequest, readonly root: WorkspaceRoot, readonly snapshotDirectory: string,
  readonly through: Stage, readonly executionReceipt: ExecutionApprovalReceipt,
  readonly publish?: PublishAuthorization, readonly recoveries?: ReadonlyArray<ApplyRecovery>
}

const moved = (
  accepted: AcceptedPlan, store: RunStoreShape, path: string,
  ledger: RunLedger, command: TransitionCommand
) => Effect.gen(function*() {
  const next = transition(accepted, ledger, command)
  if ("_tag" in next) return yield* next
  yield* store.save(path, ledger.revision, next)
  return next
})
const structured = (
  accepted: AcceptedPlan, catalog: DriverCatalogShape, store: RunStoreShape,
  credential: typeof CredentialStore.Service, permit: ExecutionPermit,
  path: string, root: WorkspaceRoot, ledger: RunLedger, operation: Operation
) => Effect.gen(function*() {
  const start = operation._tag === "Exec" ? "BeginTrustedExec" : "BeginStructured"
  let next = yield* moved(accepted, store, path, ledger, {
    _tag: start, operationId: operation.id, at: new Date().toISOString()
  })
  const secret = operation._tag === "ReviewedNoteTransform"
    ? yield* credential.getRead(operation.credential, permit) : undefined
  const result = yield* catalog.structured(CatalogStructuredRequest.make({
    operation,
    root,
    availableOutputs: accepted.outputs.map(({ output }) => output)
  }), secret).pipe(
    Effect.map((value) => ({ success: true as const, value })),
    Effect.catch((cause) => Effect.succeed({ success: false as const, cause }))
  )
  const command: TransitionCommand = result.success
    ? { _tag: "Pass", operationId: operation.id,
        detail: result.value.outcome, outputs: result.value.outputs }
    : { _tag: "FailBeforeCommit", operationId: operation.id,
        detail: result.cause.reason, retryable: false }
  return yield* moved(accepted, store, path, next, command)
})
const localOperations = (
  accepted: AcceptedPlan, catalog: DriverCatalogShape, store: RunStoreShape,
  credential: typeof CredentialStore.Service, permit: ExecutionPermit,
  request: ApplyRequest, ledger: RunLedger, operations: ReadonlyArray<Operation>
) => Effect.gen(function*() {
  let next = ledger
  for (const operation of operations.filter((item) => operationAuthority(item) !== "RemotePublish")) {
    if (operationStatus(next, operation.id)?._tag === "Pending")
      next = yield* structured(accepted, catalog, store, credential, permit,
        request.run.path, request.root, next, operation)
    if (!["Passed", "AssumedCommitted"].includes(operationStatus(next, operation.id)!._tag)) return next
  }
  return next
})
const materialize = (accepted: AcceptedPlan, workspace: WorkspaceStoreShape,
  request: ApplyRequest) => Effect.gen(function*() {
  const ids = new Set(operationEntries(accepted.plan)
    .filter(({ operation }) => operationAuthority(operation) === "RemotePublish")
    .flatMap(({ operation }) => operation.inputs).map(String))
  return yield* Effect.forEach(
    accepted.outputs.filter(({ output }) => ids.has(String(output.id))),
    ({ output }) => workspace.snapshot(SnapshotRequest.make({
      root: request.root, source: output.path, snapshotDirectory: request.snapshotDirectory,
      outputId: output.id
    }))
  )
})
const mutation = (effect: ReturnType<DriverCatalogShape["publish"]>) =>
  effect.pipe(Effect.catch((cause) => Effect.succeed(cause.commitment === "unknown"
    ? CommitmentUnknown.make({ failure: cause.reason })
    : NotDispatched.make({ reason: cause.reason, retryable: false }))))
type PublishServices = {
  readonly store: RunStoreShape, readonly catalog: DriverCatalogShape,
  readonly workspace: WorkspaceStoreShape, readonly credential: typeof CredentialStore.Service }
type PublishOperation = Extract<Operation, {
  readonly _tag:
    | "HttpPublish" | "ForgeRelease"
    | "PackageRegistryRelease"
    | "PackageStorePublish"
    | "SupplyChainPublish"
    | "ProviderPublish"
    | "AnnouncementPublish"
    | "OpaquePublish"
}>
const publishTarget = (operation: PublishOperation): string => {
  switch (operation._tag) {
    case "HttpPublish":
      return operation.wire.baseUrl
    case "ForgeRelease":
      return operation.repository
    case "PackageRegistryRelease":
      return operation.registryUrl
    case "PackageStorePublish":
      return `${operation.profileId}:${operation.target.name}:${operation.target.channel??operation.target.version??""}`
    case "SupplyChainPublish":
    case "ProviderPublish":
      return `${operation.profileId}:${Object.entries(operation.target)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${value}`).join(",")}`
    case "AnnouncementPublish":
      return `${operation.profileId}:${operation.target.destination}`
    case "OpaquePublish":
      return `${operation.contractFixtureId}:${operation.argv[0]}`
  }
}
const checkpointCommand = (
  result: MutationResult, operationId: Operation["id"], checkpointId: CheckpointId
): TransitionCommand => {
  switch (result._tag) {
    case "Committed":
      return { _tag: "PassCheckpoint", operationId, checkpointId, detail: result.observedOutcome }
    case "NotDispatched":
      return { _tag: "FailCheckpoint", operationId, checkpointId,
        detail: result.reason, retryable: result.retryable }
    case "CommitmentUnknown":
      return { _tag: "UnknownCheckpoint", operationId, checkpointId,
        detail: result.failure, ...(result.observedRemoteId === undefined
          ? {} : { remoteId: result.observedRemoteId }) }
  }
}
const keyFor = (
  accepted: AcceptedPlan, ledger: RunLedger, hash: string, checkpointId: CheckpointId,
  operation: PublishOperation, target: string, materials: ReadonlyArray<MaterializedOutput>,
  bindings: ReadonlyArray<MaterializedOutput>
): string => operation._tag === "PackageStorePublish"
  ? packageStoreReconciliationKey(
      accepted.planId, ledger.logicalRunId, ledger.scope, ledger.executionTopologyHash,
      OperationHash.make(hash), checkpointId, operation.profileId, operation.target, bindings)
  : operation._tag === "SupplyChainPublish" || operation._tag === "ProviderPublish" ||
    operation._tag === "AnnouncementPublish"
  ? supplyChainReconciliationKey(
      accepted.planId, ledger.logicalRunId, ledger.scope, ledger.executionTopologyHash,
      OperationHash.make(hash), checkpointId, operation.profileId, operation.target, bindings,
      ({ AnnouncementPublish: "announcement", ProviderPublish: "provider",
        SupplyChainPublish: "supply-chain" } as const)[operation._tag])
  : reconciliationKey(accepted.planId, ledger.logicalRunId, ledger.scope,
      ledger.executionTopologyHash, OperationHash.make(hash), checkpointId, target, materials)
const publishOperation = (
  accepted: AcceptedPlan, services: PublishServices, request: ApplyRequest, ledger: RunLedger,
  operation: PublishOperation, materials: ReadonlyArray<MaterializedOutput>, permit: PublishPermit
) => Effect.gen(function*() {
  let next = operationStatus(ledger, operation.id)?._tag === "Pending"
    ? yield* moved(accepted, services.store, request.run.path, ledger,
        { _tag: "BeginPublish", operationId: operation.id, receipt: permit.receipt })
    : ledger
  const status = operationStatus(next, operation.id)
  const checkpoints = status?._tag === "DispatchingPublish" ? status.progress : []
  for (const checkpoint of checkpoints) {
    if (checkpoint._tag !== "CheckpointPending") continue
    const operationHash = accepted.operationHashes.find((item) =>
      item.operationId === operation.id)!.hash
    const bindings = materials.filter((item) => operation.inputs.includes(item.outputId))
    const target = publishTarget(operation)
    const key = keyFor(accepted, next, operationHash, checkpoint.checkpointId,
      operation, target, materials, bindings)
    const subject = bindings[0]
    next = yield* moved(accepted, services.store, request.run.path, next,
      { _tag: "DispatchCheckpoint", operationId: operation.id,
        checkpointId: checkpoint.checkpointId, key,
        ...(["PackageStorePublish", "SupplyChainPublish", "ProviderPublish", "AnnouncementPublish"]
          .includes(operation._tag) ? {
          targetCoordinates: target,
          ...(subject === undefined ? {} : { subjectDigest: subject.digest })
        } : {}) })
    const outputId = checkpoint.checkpointId === "dispatch" ||
      ["SupplyChainPublish", "ProviderPublish", "AnnouncementPublish"]
        .includes(operation._tag) ? String(operation.inputs[0] ?? "")
      : String(checkpoint.checkpointId).replace(/^asset:/u, "")
    const facts = materials.find((item) => item.outputId === outputId)
    const handle = facts === undefined ? undefined
      : yield* services.workspace.verify(request.snapshotDirectory, facts)
    const credential = yield* services.credential.getPublish(operation.credential, permit)
    const publish = CatalogPublishRequest.make({ operation,
      checkpointId: CheckpointId.make(checkpoint.checkpointId),
      clientReconciliationKey: key })
    const result = yield* mutation(services.catalog.publish(publish, handle, credential))
    next = yield* moved(accepted, services.store, request.run.path, next,
      checkpointCommand(result, operation.id, checkpoint.checkpointId)
    )
    if (result._tag !== "Committed") return next
  }
  return yield* moved(accepted, services.store, request.run.path, next,
    { _tag: "Pass", operationId: operation.id, detail: "All checkpoints observed." })
})
const blocksApply = (ledger: RunLedger): boolean => ledger.operations.some((record) =>
  ["CommitUnknown", "ManualReview"].includes(record.attempts.at(-1)!.state._tag))
const reconcile = (
  accepted: AcceptedPlan, services: PublishServices, request: ApplyRequest, ledger: RunLedger,
  recovery: Extract<ApplyRecovery, { readonly _tag: "Reconcile" }>, permit: PublishPermit
) => Effect.gen(function*() {
  const operation = operationEntries(accepted.plan).map(({ operation }) => operation)
    .find((item): item is PublishOperation => item.id === recovery.operationId &&
      operationAuthority(item) === "RemotePublish")
  const state = operationStatus(ledger, recovery.operationId)
  const checkpoint = state?._tag === "CommitUnknown"
    ? state.progress.find((item) => item.checkpointId === recovery.checkpointId) : undefined
  if (operation === undefined || checkpoint?._tag !== "CheckpointUnknown")
    return yield* TransitionError.make({ reason: "Reconciliation does not name an unknown checkpoint." })
  const credential = yield* services.credential.getPublish(operation.credential, permit)
  const result = yield* services.catalog.reconcile(CatalogPublishRequest.make({
    operation, checkpointId: recovery.checkpointId,
    clientReconciliationKey: checkpoint.clientReconciliationKey
  }), credential)
  return yield* moved(accepted, services.store, request.run.path, ledger, {
    ...recovery, result: result.found ? "committed" : "absent",
    detail: result.remoteId ?? (result.found ? "Observed committed." : "Observed absent.")
  })
})
const openLedger = (accepted: AcceptedPlan, request: ApplyRequest, store: RunStoreShape) => Effect.gen(function*() {
  let ledger = request.run._tag === "NewRun" ? request.run.ledger
    : yield* store.load(request.run.path, request.run.expected)
  if (request.run._tag === "NewRun") yield* store.create(request.run.path, ledger)
  ledger = yield* moved(accepted, store, request.run.path, ledger, { _tag: "Recover" })
  if (stageOrder.indexOf(request.through) > stageOrder.indexOf(ledger.frontier))
    ledger = yield* moved(accepted, store, request.run.path, ledger,
      { _tag: "AdvanceFrontier", frontier: request.through })
  return ledger
})
export const applyAcceptedPlan = Effect.fn("applyAcceptedPlan")(function*(
  accepted: AcceptedPlan, request: ApplyRequest
) {
  const store = yield* RunStore
  const catalog = yield* DriverCatalog
  const workspace = yield* WorkspaceStore
  const credential = yield* CredentialStore
  const signer = yield* ApprovalSigner
  let ledger = yield* openLedger(accepted, request, store)
  const executionPermit = yield* signer.execution(request.executionReceipt, ledger.runId,
    executionReviewId(accepted, ledger.scope, ledger.executionTopologyHash))
  for (const recovery of request.recoveries?.filter((item) => item._tag === "Resolve") ?? [])
    ledger = yield* moved(accepted, store, request.run.path, ledger, recovery)
  const selected = new Set(ledger.scope.operationIds.map(String))
  const entries = operationEntries(accepted.plan).filter(({ stage, operation }) =>
    selected.has(operation.id) &&
    stageOrder.indexOf(stage) <= stageOrder.indexOf(request.through))
  ledger = yield* localOperations(accepted, catalog, store, credential, executionPermit, request, ledger,
    entries.map(({ operation }) => operation))
  if (entries.some(({ operation }) => operationAuthority(operation) !== "RemotePublish" &&
    !["Passed", "AssumedCommitted"].includes(operationStatus(ledger, operation.id)!._tag))) return ledger
  const publishEntries = entries.map(({ operation }) => operation).filter(
    (operation): operation is PublishOperation =>
      operationAuthority(operation) === "RemotePublish")
  if (publishEntries.length === 0) return ledger
  if (blocksApply(ledger) && !request.recoveries?.some((item) => item._tag === "Reconcile")) return ledger
  const materials = yield* materialize(accepted, workspace, request)
  const review = publishReviewId(accepted, executionReviewId(
    accepted, ledger.scope, ledger.executionTopologyHash
  ), ledger.scope, materials)
  if (request.publish === undefined)
    return { _tag: "PublishReviewRequired", reviewId: review, ledger } as const
  const permit = yield* signer.publish(request.publish.receipt, executionPermit, review)
  for (const recovery of request.recoveries?.filter((item) => item._tag === "Reconcile") ?? [])
    ledger = yield* reconcile(accepted, { store, catalog, workspace, credential },
      request, ledger, recovery, permit)
  if (blocksApply(ledger)) return ledger
  for (const operation of publishEntries) {
    const state = operationStatus(ledger, operation.id)
    if (state?._tag === "Pending" || state?._tag === "DispatchingPublish")
      ledger = yield* publishOperation(
        accepted, { store, catalog, workspace, credential }, request, ledger,
        operation, materials, permit
      )
    if (!["Passed", "AssumedCommitted"].includes(operationStatus(ledger, operation.id)!._tag))
      return ledger
  }
  return ledger
})
