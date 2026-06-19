import * as Effect from "effect/Effect"
import type * as FileSystem from "effect/FileSystem"
import type * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import { EvidenceBundle, ReleaseWorkflowEvidence, ReleaseWorkflowFailureEvidence } from "../domain/evidence.js"
import { ReleasePlan } from "../domain/release.js"
import { writeEvidenceBundle } from "../planner/evidence-recorder.js"
import { EvidenceWriteError, OperationFailedError } from "../planner/errors.js"
import { workflowEvidencePaths } from "../planner/status.js"

export type * from "../types/effect-internal.js"

export class WorkflowEvidencePathsWritten extends Schema.Class<WorkflowEvidencePathsWritten>(
  "WorkflowEvidencePathsWritten"
)({
  render: Schema.optionalKey(Schema.String),
  validation: Schema.optionalKey(Schema.String),
  execution: Schema.optionalKey(Schema.String),
  verification: Schema.optionalKey(Schema.String)
}) {}

export const releaseEvidencePath = (plan: ReleasePlan, name: string): string =>
  `${plan.evidenceDirectory}/${name}.json`

export const writeNamedEvidence = Effect.fn("workflows.evidence.writeNamedEvidence")(function*(
  plan: ReleasePlan,
  name: string,
  evidence: EvidenceBundle
) {
  const path = releaseEvidencePath(plan, name)
  yield* writeEvidenceBundle(path, evidence, plan.source.root)
  return path
})

export const writeFailedOperationEvidence = Effect.fn("workflows.evidence.writeFailedOperationEvidence")(function*(
  plan: ReleasePlan,
  name: string,
  error: { readonly evidence?: EvidenceBundle | undefined }
) {
  if (error.evidence === undefined) {
    return undefined
  }
  return yield* writeNamedEvidence(plan, name, error.evidence)
})

const isOperationFailedError = (error: unknown): error is OperationFailedError =>
  error instanceof OperationFailedError ||
  (
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    error._tag === "OperationFailedError"
  )

const hasWorkflowEvidence = (
  error: unknown
): error is OperationFailedError & { readonly workflowEvidence: ReleaseWorkflowFailureEvidence } =>
  isOperationFailedError(error) && error.workflowEvidence !== undefined

export const writeNamedEvidenceWithFailure = <E, R>(
  plan: ReleasePlan,
  name: string,
  effect: Effect.Effect<EvidenceBundle, E | OperationFailedError, R>
) : Effect.Effect<EvidenceBundle, E | OperationFailedError | EvidenceWriteError, R | FileSystem.FileSystem | Path.Path> =>
  effect.pipe(
    Effect.catchIf(isOperationFailedError, (error) =>
      writeFailedOperationEvidence(plan, name, error).pipe(
        Effect.flatMap(() => Effect.fail(error))
      )
    ),
    Effect.flatMap((evidence) =>
      writeNamedEvidence(plan, name, evidence).pipe(
        Effect.map(() => evidence)
      )
    )
  )

type WritableWorkflowEvidence = ReleaseWorkflowEvidence | ReleaseWorkflowFailureEvidence

export const writeWorkflowEvidence = Effect.fn("workflows.evidence.writeWorkflowEvidence")(function*(
  plan: ReleasePlan,
  evidence: WritableWorkflowEvidence
) {
  const paths = workflowEvidencePaths(plan)
  const written: {
    render?: string
    validation?: string
    execution?: string
    verification?: string
  } = {}

  if (evidence.render !== undefined) {
    written.render = paths.render
    yield* writeEvidenceBundle(paths.render, evidence.render, plan.source.root)
  }
  if (evidence.validation !== undefined) {
    written.validation = paths.validation
    yield* writeEvidenceBundle(paths.validation, evidence.validation, plan.source.root)
  }
  if (evidence.execution !== undefined) {
    written.execution = paths.execution
    yield* writeEvidenceBundle(paths.execution, evidence.execution, plan.source.root)
  }
  if (evidence.verification !== undefined) {
    written.verification = paths.verification
    yield* writeEvidenceBundle(paths.verification, evidence.verification, plan.source.root)
  }

  return WorkflowEvidencePathsWritten.make(written)
})

export const writeWorkflowEvidenceWithFailure = <E, R>(
  plan: ReleasePlan,
  effect: Effect.Effect<ReleaseWorkflowEvidence, E | OperationFailedError, R>
) : Effect.Effect<WorkflowEvidencePathsWritten, E | OperationFailedError | EvidenceWriteError, R | FileSystem.FileSystem | Path.Path> =>
  effect.pipe(
    Effect.catchIf(
      hasWorkflowEvidence,
      (error) =>
        writeWorkflowEvidence(plan, error.workflowEvidence).pipe(
          Effect.flatMap(() => Effect.fail(error))
        )
    ),
    Effect.flatMap((evidence) => writeWorkflowEvidence(plan, evidence))
  )
