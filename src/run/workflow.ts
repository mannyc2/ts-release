// Invariant: each evidence workflow preflights once, records into one ref, and persists exactly once on every exit.
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Ref from "effect/Ref"
import * as Schema from "effect/Schema"
import type { ExecutionApproval } from "../grammar/approval.js"
import { planFingerprint, ReleasePlan } from "../grammar/plan.js"
import { parseJsonAs } from "../grammar/json.js"
import { resolveWorkspacePath, writeWorkspaceFile } from "../host/workspace-path.js"
import {
  makeEvidenceRef,
  preflightEvidenceWorkflow,
  runEvidenceWorkflowInto,
  type EvidenceRef,
  type EvidenceWorkflow,
  type OperationRunContext
} from "./executor.js"
import { decodeEvidenceBundle, type EvidenceBundle, renderEvidenceJson } from "./evidence.js"
import {
  ContinueEvidenceInvalidError,
  ContinueEvidenceMissingError,
  ContinueEvidenceReadError,
  ContinueFingerprintMissingError,
  ContinueMismatchError,
  EvidenceWriteError
} from "./errors.js"

// Invocation carries the machine-local facts that left the durable plan in v5 (plan 169.1,
// D3): they are supplied per run by the caller, never encoded, and never fingerprinted.
export interface Invocation {
  readonly root: string
  readonly configPath?: string | undefined
}

export const releaseEvidencePath = (plan: ReleasePlan, name: string): string =>
  `${plan.evidenceDirectory}/${name}.json`

export { planFingerprint }

const errorReason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const continueSkipSet = Effect.fn("run.continueSkipSet")(function*(plan: ReleasePlan, root: string) {
  const pathName = releaseEvidencePath(plan, "evidence")
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const resolved = resolveWorkspacePath(path, root, pathName)
  const exists = yield* fs.exists(resolved).pipe(Effect.mapError((error) =>
    ContinueEvidenceReadError.make({ path: pathName, reason: error.message })))
  if (!exists) return yield* Effect.fail(ContinueEvidenceMissingError.make({ path: pathName }))
  const contents = yield* fs.readFileString(resolved).pipe(Effect.mapError((error) =>
    ContinueEvidenceReadError.make({ path: pathName, reason: error.message })))
  const parsed = yield* parseJsonAs(Schema.Unknown, contents, (error) =>
    ContinueEvidenceInvalidError.make({ path: pathName, reason: errorReason(error) }))
  const prior = yield* decodeEvidenceBundle(parsed).pipe(Effect.mapError((error) =>
    ContinueEvidenceInvalidError.make({ path: pathName, reason: error.message })))
  if (prior.planFingerprint === undefined) {
    return yield* Effect.fail(ContinueFingerprintMissingError.make({ path: pathName }))
  }
  const expected = planFingerprint(plan)
  if (prior.planFingerprint !== expected) {
    return yield* Effect.fail(ContinueMismatchError.make({
      path: pathName,
      expected,
      actual: prior.planFingerprint
    }))
  }
  return new Set(prior.records.filter(({ status }) => status === "passed").map(({ operationId }) => operationId))
})

export const writeEvidenceBundle = Effect.fn("run.writeEvidenceBundle")(function*(
  pathName: string,
  bundle: EvidenceBundle,
  root: string = "."
) {
  yield* writeWorkspaceFile(root, pathName, renderEvidenceJson(bundle), (path, reason, cause) =>
    EvidenceWriteError.make({ path, reason, ...(cause === undefined ? {} : { cause }) }))
})

const finalizeEvidenceOnExit = <A, E>(
  plan: ReleasePlan,
  name: string,
  ref: EvidenceRef,
  root: string,
  workflowExit: Exit.Exit<A, E>
): Effect.Effect<void, E | EvidenceWriteError, FileSystem.FileSystem | Path.Path> =>
  Ref.get(ref).pipe(
    Effect.flatMap((evidence) => writeEvidenceBundle(releaseEvidencePath(plan, name), evidence, root)),
    Effect.catchCause((writeCause) => Exit.isFailure(workflowExit)
      ? Effect.failCause(Cause.combine(writeCause, workflowExit.cause))
      : Effect.failCause(writeCause))
  )

export const runEvidenceWorkflowWithFinalizer = Effect.fn("run.workflowWithFinalizer")(
  function*<A, E, R>(
    plan: ReleasePlan,
    name: string,
    ref: EvidenceRef,
    root: string,
    workflow: Effect.Effect<A, E, R>
  ) {
    return yield* workflow.pipe(Effect.onExit((exit) => finalizeEvidenceOnExit(plan, name, ref, root, exit)))
  }
)

const planContext = (plan: ReleasePlan, invocation: Invocation): OperationRunContext => ({
  root: invocation.root,
  identity: plan.identity,
  artifacts: plan.artifacts,
  configPath: invocation.configPath
})

export const writeWorkflowEvidence = Effect.fn("run.writeWorkflowEvidence")(function*(
  plan: ReleasePlan,
  name: string,
  workflow: EvidenceWorkflow,
  approval: ExecutionApproval,
  skip: ReadonlySet<string> = new Set(),
  invocation: Invocation
) {
  const context = planContext(plan, invocation)
  yield* preflightEvidenceWorkflow(plan.operations, workflow, approval, context, skip)
  const ref = yield* makeEvidenceRef(context, planFingerprint(plan))
  return yield* runEvidenceWorkflowWithFinalizer(
    plan, name, ref, invocation.root,
    runEvidenceWorkflowInto(ref, plan.operations, workflow, approval, context, skip).pipe(Effect.andThen(Ref.get(ref)))
  )
})
