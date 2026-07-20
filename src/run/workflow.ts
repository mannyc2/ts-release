// Invariant: each evidence workflow preflights once, records into one ref, and persists exactly once on every exit.
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Ref from "effect/Ref"
import type { ExecutionApproval } from "../grammar/approval.js"
import type { ReleasePlan } from "../grammar/plan.js"
import { writeWorkspaceFile } from "../host/workspace-path.js"
import {
  makeEvidenceRef,
  preflightEvidenceWorkflow,
  runEvidenceWorkflowInto,
  type EvidenceRef,
  type EvidenceWorkflow,
  type OperationRunContext
} from "./executor.js"
import { type EvidenceBundle, renderEvidenceJson } from "./evidence.js"
import { EvidenceWriteError } from "./errors.js"

export const releaseEvidencePath = (plan: ReleasePlan, name: string): string =>
  `${plan.evidenceDirectory}/${name}.json`

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
  workflowExit: Exit.Exit<A, E>
): Effect.Effect<void, E | EvidenceWriteError, FileSystem.FileSystem | Path.Path> =>
  Ref.get(ref).pipe(
    Effect.flatMap((evidence) => writeEvidenceBundle(releaseEvidencePath(plan, name), evidence, plan.source.root)),
    Effect.catchCause((writeCause) => Exit.isFailure(workflowExit)
      ? Effect.failCause(Cause.combine(writeCause, workflowExit.cause))
      : Effect.failCause(writeCause))
  )

export const runEvidenceWorkflowWithFinalizer = Effect.fn("run.workflowWithFinalizer")(
  function*<A, E, R>(plan: ReleasePlan, name: string, ref: EvidenceRef, workflow: Effect.Effect<A, E, R>) {
    return yield* workflow.pipe(Effect.onExit((exit) => finalizeEvidenceOnExit(plan, name, ref, exit)))
  }
)

const planContext = (plan: ReleasePlan): OperationRunContext => ({
  root: plan.source.root,
  identity: plan.identity,
  artifacts: plan.artifacts,
  configPath: plan.source.configPath
})

export const writeWorkflowEvidence = Effect.fn("run.writeWorkflowEvidence")(function*(
  plan: ReleasePlan,
  name: string,
  workflow: EvidenceWorkflow,
  approval: ExecutionApproval
) {
  const context = planContext(plan)
  yield* preflightEvidenceWorkflow(plan.operations, workflow, approval, context)
  const ref = yield* makeEvidenceRef(context)
  return yield* runEvidenceWorkflowWithFinalizer(
    plan, name, ref,
    runEvidenceWorkflowInto(ref, plan.operations, workflow, approval, context).pipe(Effect.andThen(Ref.get(ref)))
  )
})
