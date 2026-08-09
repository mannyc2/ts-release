import * as Effect from "effect/Effect"
import * as Result from "effect/Result"
import { ApprovalSigner, executionReviewId, publishReviewId, reconciliationKey } from "./approval.js"
import { checkpointIds, operationStatus, settled, transition, type TransitionCommand } from "./transition.js"
import { RunStore, type ExpectedLedger, type RunStoreShape } from "./store.js"
import {
  CatalogPublishRequest, CatalogStructuredRequest, CommitmentUnknown, CredentialStore,
  DriverCatalog, NotDispatched, SnapshotRequest,
  WorkspaceStore, type CredentialStoreShape, type DriverCatalogShape,
  type MutationResult, type VerifiedContentHandle, type WorkspaceStoreShape
} from "../drivers/services.js"
import type { ExecutionPermit, PublishPermit } from "../model/permit.js"
import {
  TransitionError, type ExecutionApprovalReceipt, type MaterializedOutput, type PublishApprovalReceipt,
  type RunLedger, type Stage
} from "../model/run.js"
import {
  OperationHash, type CheckpointId, type OperationId, type PublishReviewId, type WorkspaceRoot
} from "../model/primitives.js"
import {
  isRemotePublish, operationAuthority, type Operation, type RemotePublishOp
} from "../model/operation.js"
import { operationEntries, stageOrder } from "../model/validate.js"
import type { AcceptedPlan } from "../plan/accepted.js"

export type ApplyRunRequest = {
  readonly _tag: "NewRun", readonly path: string, readonly ledger: RunLedger
} | { readonly _tag: "ResumeRun", readonly path: string, readonly expected: ExpectedLedger }
export type PublishAuthorization = { readonly receipt: PublishApprovalReceipt }
export type ApplyRecovery = Extract<TransitionCommand, { readonly _tag: "Resolve" }> |
  { readonly _tag: "Reconcile", readonly operationId: OperationId, readonly checkpointId: CheckpointId } |
  { readonly _tag: "Retry", readonly operationId: OperationId }
export type ApplyRequest = {
  readonly run: ApplyRunRequest, readonly root: WorkspaceRoot, readonly snapshotDirectory: string,
  readonly through: Stage, readonly executionReceipt: ExecutionApprovalReceipt,
  readonly publish?: PublishAuthorization, readonly recoveries?: ReadonlyArray<ApplyRecovery>
}
type ApplyContext = {
  readonly accepted: AcceptedPlan, readonly request: ApplyRequest,
  readonly store: RunStoreShape, readonly catalog: DriverCatalogShape,
  readonly workspace: WorkspaceStoreShape, readonly credential: CredentialStoreShape
}
// Both arms carry a tag, so callers discriminate on a VALUE. The ledger arm
// used to be a bare RunLedger, which forced every caller to ask whether a
// `_tag` field was present — an accident of the ledger's shape, not a contract.
export type ApplyOutcome =
  | { readonly _tag: "Applied", readonly ledger: RunLedger }
  | {
    readonly _tag: "PublishReviewRequired", readonly reviewId: PublishReviewId
    readonly ledger: RunLedger
  }
const applied = (ledger: RunLedger): ApplyOutcome => ({ _tag: "Applied", ledger })

const moved = (ctx: ApplyContext, ledger: RunLedger, command: TransitionCommand) => Effect.gen(function*() {
  const next = transition(ctx.accepted, ledger, command)
  if (Result.isFailure(next)) return yield* next.failure
  yield* ctx.store.save(ctx.request.run.path, ledger.revision, next.success)
  return next.success
})
const structured = (
  ctx: ApplyContext, permit: ExecutionPermit, ledger: RunLedger, operation: Operation
) => Effect.gen(function*() {
  const start = operation._tag === "Exec" ? "BeginTrustedExec" : "BeginStructured"
  const next = yield* moved(ctx, ledger, {
    _tag: start, operationId: operation.id, at: new Date().toISOString()
  })
  const secret = operation._tag === "ReviewedNoteTransform"
    ? yield* ctx.credential.getRead(operation.credential, permit) : undefined
  const result = yield* ctx.catalog.structured(CatalogStructuredRequest.make({
    operation,
    root: ctx.request.root,
    availableOutputs: ctx.accepted.outputs.map(({ output }) => output)
  }), secret).pipe(
    Effect.map((value) => ({ success: true as const, value })),
    Effect.catch((cause) => Effect.succeed({ success: false as const, cause }))
  )
  const command: TransitionCommand = result.success
    ? { _tag: "Pass", operationId: operation.id,
        detail: result.value.outcome, outputs: result.value.outputs }
    : { _tag: "FailBeforeCommit", operationId: operation.id,
        detail: result.cause.reason, retryable: false }
  return yield* moved(ctx, next, command)
})
const localOperations = (
  ctx: ApplyContext, permit: ExecutionPermit, ledger: RunLedger, operations: ReadonlyArray<Operation>
) => Effect.gen(function*() {
  let next = ledger
  for (const operation of operations.filter((item) => !isRemotePublish(item))) {
    if (operationStatus(next, operation.id)?._tag === "Pending")
      next = yield* structured(ctx, permit, next, operation)
    if (!settled(operationStatus(next, operation.id))) return next
  }
  return next
})
const materialize = (ctx: ApplyContext, selected: ReadonlySet<string>) => Effect.gen(function*() {
  const publishInputs = new Set(operationEntries(ctx.accepted.plan)
    .filter(({ operation }) => selected.has(operation.id) && isRemotePublish(operation))
    .flatMap(({ operation }) => operation.inputs).map(String))
  return yield* Effect.forEach(
    ctx.accepted.outputs.filter(({ output }) => publishInputs.has(String(output.id))),
    ({ output }) => ctx.workspace.snapshot(SnapshotRequest.make({
      root: ctx.request.root, source: output.path,
      snapshotDirectory: ctx.request.snapshotDirectory, outputId: output.id
    }))
  )
})
const dispatched = (effect: ReturnType<DriverCatalogShape["publish"]>) =>
  effect.pipe(Effect.catch((cause) => Effect.succeed(cause.commitment === "unknown"
    ? CommitmentUnknown.make({ failure: cause.reason })
    : NotDispatched.make({ reason: cause.reason, retryable: false }))))
const publishTarget = (operation: RemotePublishOp): string => {
  switch (operation._tag) {
    case "HttpPublish":
      return operation.wire.baseUrl
    case "ForgeRelease":
      return operation.repository
    case "PackageRegistryRelease":
      return operation.registryUrl
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
const reconciliationKeyFor = (
  ctx: ApplyContext, ledger: RunLedger, operation: RemotePublishOp, operationHash: OperationHash,
  checkpointId: CheckpointId, target: string, materials: ReadonlyArray<MaterializedOutput>,
  bindings: ReadonlyArray<MaterializedOutput>
): string => {
  return reconciliationKey(ctx.accepted.planId, ledger.logicalRunId, ledger.scope,
    ledger.executionTopologyHash, operationHash, checkpointId, target, materials)
}
const publishOperation = (
  ctx: ApplyContext, ledger: RunLedger, operation: RemotePublishOp,
  materials: ReadonlyArray<MaterializedOutput>, permit: PublishPermit
) => Effect.gen(function*() {
  const before = operationStatus(ledger, operation.id)
  const operationHash = OperationHash.make(ctx.accepted.operationHashes
    .find((item) => item.operationId === operation.id)!.hash)
  const bindings = materials.filter((item) => operation.inputs.includes(item.outputId))
  const target = publishTarget(operation)
  const pendingIds = before?._tag === "DispatchingPublish"
    ? before.progress.filter((item) => item._tag === "CheckpointPending")
        .map((item) => item.checkpointId)
    : checkpointIds(operation)
  if (pendingIds.length === 0) {
    return yield* moved(ctx, ledger,
      { _tag: "Pass", operationId: operation.id, detail: "All checkpoints observed." })
  }
  // Everything that can fail locally — snapshot verification and the
  // credential fetch — happens BEFORE any durable publish intent, so a ledger
  // that says "dispatching" always means the wire was actually reached.
  const handles = new Map<string, VerifiedContentHandle | undefined>()
  for (const checkpointId of pendingIds) {
    const subjectFromInputs = checkpointId === "dispatch"
    const outputId = subjectFromInputs
      ? String(operation.inputs[0] ?? "")
      : String(checkpointId).replace(/^asset:/u, "")
    const facts = materials.find((item) => item.outputId === outputId)
    handles.set(String(checkpointId), facts === undefined ? undefined
      : yield* ctx.workspace.verify(ctx.request.snapshotDirectory, facts))
  }
  const credential = yield* ctx.credential.getPublish(operation.credential, permit)
  let next = before?._tag === "Pending"
    ? yield* moved(ctx, ledger,
        { _tag: "BeginPublish", operationId: operation.id, receipt: permit.receipt })
    : ledger
  const status = operationStatus(next, operation.id)
  const checkpoints = status?._tag === "DispatchingPublish" ? status.progress : []
  for (const checkpoint of checkpoints) {
    if (checkpoint._tag !== "CheckpointPending") continue
    const key = reconciliationKeyFor(ctx, next, operation, operationHash,
      checkpoint.checkpointId, target, materials, bindings)
    next = yield* moved(ctx, next,
      { _tag: "DispatchCheckpoint", operationId: operation.id,
        checkpointId: checkpoint.checkpointId, key,
        })
    const publish = CatalogPublishRequest.make({ operation, root: ctx.request.root,
      checkpointId: checkpoint.checkpointId, clientReconciliationKey: key })
    const result = yield* dispatched(
      ctx.catalog.publish(publish, handles.get(String(checkpoint.checkpointId)), credential))
    next = yield* moved(ctx, next, checkpointCommand(result, operation.id, checkpoint.checkpointId))
    if (result._tag !== "Committed") return next
  }
  return yield* moved(ctx, next,
    { _tag: "Pass", operationId: operation.id, detail: "All checkpoints observed." })
})
const blocksApply = (ledger: RunLedger): boolean => ledger.operations.some((record) =>
  ["CommitUnknown", "ManualReview"].includes(record.attempts.at(-1)!.state._tag))
const reconcile = (
  ctx: ApplyContext, ledger: RunLedger,
  recovery: Extract<ApplyRecovery, { readonly _tag: "Reconcile" }>, permit: PublishPermit
) => Effect.gen(function*() {
  const operation = operationEntries(ctx.accepted.plan).map(({ operation }) => operation)
    .find((item): item is RemotePublishOp => item.id === recovery.operationId && isRemotePublish(item))
  const state = operationStatus(ledger, recovery.operationId)
  const checkpoint = state?._tag === "CommitUnknown"
    ? state.progress.find((item) => item.checkpointId === recovery.checkpointId) : undefined
  if (operation === undefined || checkpoint?._tag !== "CheckpointUnknown")
    return yield* TransitionError.make({ reason: "Reconciliation does not name an unknown checkpoint." })
  const credential = yield* ctx.credential.getPublish(operation.credential, permit)
  const result = yield* ctx.catalog.reconcile(CatalogPublishRequest.make({
    operation, root: ctx.request.root, checkpointId: recovery.checkpointId,
    clientReconciliationKey: checkpoint.clientReconciliationKey
  }), credential)
  return yield* moved(ctx, ledger, {
    ...recovery, result: result.found ? "committed" : "absent",
    detail: result.remoteId ?? (result.found ? "Observed committed." : "Observed absent.")
  })
})
const openLedger = (ctx: ApplyContext) => Effect.gen(function*() {
  const run = ctx.request.run
  let ledger = run._tag === "NewRun" ? run.ledger : yield* ctx.store.load(run.path, run.expected)
  if (run._tag === "NewRun") yield* ctx.store.create(run.path, ledger)
  ledger = yield* moved(ctx, ledger, { _tag: "Recover" })
  if (stageOrder.indexOf(ctx.request.through) > stageOrder.indexOf(ledger.frontier))
    ledger = yield* moved(ctx, ledger, { _tag: "AdvanceFrontier", frontier: ctx.request.through })
  return ledger
})
export const applyAcceptedPlan = Effect.fn("applyAcceptedPlan")(function*(
  accepted: AcceptedPlan, request: ApplyRequest
) {
  const ctx: ApplyContext = {
    accepted, request, store: yield* RunStore, catalog: yield* DriverCatalog,
    workspace: yield* WorkspaceStore, credential: yield* CredentialStore
  }
  const signer = yield* ApprovalSigner
  let ledger = yield* openLedger(ctx)
  const executionPermit = yield* signer.execution(request.executionReceipt, ledger.runId,
    executionReviewId(accepted, ledger.scope, ledger.executionTopologyHash))
  for (const recovery of request.recoveries?.filter((item) => item._tag === "Resolve") ?? [])
    ledger = yield* moved(ctx, ledger, recovery)
  // Resolve (operator judgment) first, then Retry — which may act on a
  // just-created AssumedAbsent — then normal execution picks up the fresh
  // Pending attempts. Eligibility lives in transition.ts alone.
  for (const recovery of request.recoveries?.filter((item) => item._tag === "Retry") ?? [])
    ledger = yield* moved(ctx, ledger, { _tag: "Retry",
      operationId: recovery.operationId, receipt: request.executionReceipt })
  const selected = new Set(ledger.scope.operationIds.map(String))
  const entries = operationEntries(accepted.plan).filter(({ stage, operation }) =>
    selected.has(operation.id) &&
    stageOrder.indexOf(stage) <= stageOrder.indexOf(request.through))
  ledger = yield* localOperations(ctx, executionPermit, ledger,
    entries.map(({ operation }) => operation))
  // The publish review derives from the SCOPE, not the requested frontier: a
  // materialize-only apply (through: validate) must still emit the challenge
  // its publish job will confirm — but only once every in-scope pre-publish
  // operation is settled. Publish EXECUTION stays gated on `through`.
  const scoped = operationEntries(accepted.plan)
    .filter(({ operation }) => selected.has(operation.id))
  if (scoped.some(({ operation }) => operationAuthority(operation) !== "RemotePublish" &&
    !settled(operationStatus(ledger, operation.id)))) return applied(ledger)
  const publishEntries = entries.map(({ operation }) => operation).filter(isRemotePublish)
  if (!scoped.some(({ operation }) => isRemotePublish(operation))) return applied(ledger)
  if (blocksApply(ledger) && !request.recoveries?.some((item) => item._tag === "Reconcile")) return applied(ledger)
  const materials = yield* materialize(ctx, selected)
  // Fresh snapshots must match what the build recorded — the code-level truth
  // behind resume revalidation: publish inputs are compared against the
  // digests their producing operations persisted when they passed.
  for (const material of materials) {
    const producer = scoped.map(({ operation }) => operation).find((operation) =>
      operation.outputs.some((output) => String(output.id) === String(material.outputId)))
    const state = producer === undefined ? undefined : operationStatus(ledger, producer.id)
    if (state?._tag !== "Passed") continue
    const recorded = state.materializedOutputs.find((output) =>
      String(output.outputId) === String(material.outputId))
    if (recorded !== undefined &&
      (recorded.digest !== material.digest || recorded.size !== material.size)) {
      return yield* TransitionError.make({
        reason: `Output ${material.outputId} no longer matches its recorded digest; the workspace changed after it was built.`
      })
    }
  }
  const review = publishReviewId(accepted, executionReviewId(
    accepted, ledger.scope, ledger.executionTopologyHash
  ), ledger.scope, materials)
  if (request.publish === undefined)
    return { _tag: "PublishReviewRequired", reviewId: review, ledger } as const
  const permit = yield* signer.publish(request.publish.receipt, executionPermit, review)
  for (const recovery of request.recoveries?.filter((item) => item._tag === "Reconcile") ?? [])
    ledger = yield* reconcile(ctx, ledger, recovery, permit)
  if (blocksApply(ledger)) return applied(ledger)
  for (const operation of publishEntries) {
    const state = operationStatus(ledger, operation.id)
    if (state?._tag === "Pending" || state?._tag === "DispatchingPublish")
      ledger = yield* publishOperation(ctx, ledger, operation, materials, permit)
    if (!settled(operationStatus(ledger, operation.id))) return applied(ledger)
  }
  return applied(ledger)
})
