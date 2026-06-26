import * as Effect from "effect/Effect"
import type * as FileSystem from "effect/FileSystem"
import type * as Path from "effect/Path"
import { EvidenceBundle } from "../domain/evidence.js"
import { ReleasePlan } from "../domain/release.js"
import { writeEvidenceBundle } from "../planner/evidence-recorder.js"
import { EvidenceWriteError, OperationFailedError } from "../planner/errors.js"

export type * from "../types/effect-internal.js"

export const releaseEvidencePath = (plan: ReleasePlan, name: string): string =>
  `${plan.evidenceDirectory}/${name}.json`

export const releaseWorkflowEvidencePath = (plan: ReleasePlan): string =>
  releaseEvidencePath(plan, "evidence")

export const writeNamedEvidence = Effect.fn("workflows.evidence.writeNamedEvidence")(function*(
  plan: ReleasePlan,
  name: string,
  evidence: EvidenceBundle
) {
  const path = releaseEvidencePath(plan, name)
  yield* writeEvidenceBundle(path, evidence, plan.source.root)
  return path
})

export const writeWorkflowEvidence = Effect.fn("workflows.evidence.writeWorkflowEvidence")(function*(
  plan: ReleasePlan,
  evidence: EvidenceBundle
) {
  const path = releaseWorkflowEvidencePath(plan)
  yield* writeEvidenceBundle(path, evidence, plan.source.root)
  return path
})

const isOperationFailedError = (error: unknown): error is OperationFailedError =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  error._tag === "OperationFailedError"

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

export const writeNamedEvidenceWithFailure = <E, R>(
  plan: ReleasePlan,
  name: string,
  effect: Effect.Effect<EvidenceBundle, E | OperationFailedError, R>
): Effect.Effect<EvidenceBundle, E | OperationFailedError | EvidenceWriteError, R | FileSystem.FileSystem | Path.Path> =>
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

export const writeWorkflowEvidenceWithFailure = <E, R>(
  plan: ReleasePlan,
  effect: Effect.Effect<EvidenceBundle, E | OperationFailedError, R>
): Effect.Effect<EvidenceBundle, E | OperationFailedError | EvidenceWriteError, R | FileSystem.FileSystem | Path.Path> =>
  effect.pipe(
    Effect.catchIf(isOperationFailedError, (error) =>
      Effect.gen(function*() {
        if (error.evidence !== undefined) {
          yield* writeWorkflowEvidence(plan, error.evidence)
        }
        return yield* Effect.fail(error)
      })
    ),
    Effect.flatMap((evidence) =>
      writeWorkflowEvidence(plan, evidence).pipe(
        Effect.map(() => evidence)
      )
    )
  )
