import { Effect } from "effect"
import { candidateManifestInvariantIssues } from "./schema/candidate-manifest.js"
import { ArtifactId } from "./schema/primitives.js"
import {
  BooleanEvidenceValueV2,
  EvidenceEntryV2,
  EvidenceName,
  codePointCompare
} from "./schema/trial-evidence.js"
import {
  AcceptedProbeEvaluation,
  ProbeEvaluatorError,
  RejectedProbeEvaluation,
  probeChangeKindEvidenceIssues,
  type ProbeEvaluator
} from "./trial-adapter-executor.js"
import {
  CandidateTreeInventory,
  inventoryCandidateTree
} from "./trial-inventory.js"
import type { PreparedTrialRun } from "./trial-runner-preflight.js"

export const LIVE_PROBE_EVALUATOR_ID = ArtifactId.make(
  "probe-evaluator.runner-snapshot-v2"
)

const canonicalFailureIds = (
  values: ReadonlyArray<string>
): [typeof ArtifactId.Type, ...Array<typeof ArtifactId.Type>] => {
  const ids = [...new Set(values)].sort(codePointCompare).map((value) => ArtifactId.make(value))
  return (ids.length === 0 ? [ArtifactId.make("probe.runner-evaluation-failed")] : ids) as [
    typeof ArtifactId.Type,
    ...Array<typeof ArtifactId.Type>
  ]
}

const exactOrdered = (
  left: ReadonlyArray<string>,
  right: ReadonlyArray<string>
): boolean => left.length === right.length && left.every((value, index) => value === right[index])

const sameTree = (left: CandidateTreeInventory, right: CandidateTreeInventory): boolean =>
  left.treeSha256 === right.treeSha256 &&
  exactOrdered(left.entries.map(({ path }) => path), right.entries.map(({ path }) => path)) &&
  left.entries.every((entry, index) => {
    const other = right.entries[index]
    return other !== undefined && entry.mode === other.mode && entry.bytes === other.bytes &&
      entry.sha256 === other.sha256
  })

const acceptedFact = (): EvidenceEntryV2 => new EvidenceEntryV2({
  sequence: 1,
  name: EvidenceName.make("runner.probe-snapshot-verified"),
  value: new BooleanEvidenceValueV2({ value: true })
})

/**
 * Re-observes the runner-owned after snapshot and checks every authority that is
 * independent of candidate stdout. The adapter executor still owns the exact
 * patch arithmetic; this evaluator prevents an injected or candidate-authored
 * disposition from turning that arithmetic into a pass.
 */
export const makeLiveProbeEvaluator = (
  prepared: Pick<PreparedTrialRun, "candidateManifest" | "candidateTreeInventory">
): ProbeEvaluator => ({
  evaluatorId: LIVE_PROBE_EVALUATOR_ID,
  evaluate: Effect.fn("LiveProbeEvaluator.evaluate")(function* (input) {
    const observedAfter = yield* inventoryCandidateTree(
      input.inspectionRoot,
      input.afterManifest
    ).pipe(Effect.mapError((cause) => new ProbeEvaluatorError(cause.message)))

    const failures: Array<string> = []
    const original = prepared.candidateManifest
    const after = input.afterManifest

    if (after.candidateId !== original.candidateId ||
      after.scope !== original.scope ||
      after.model !== original.model ||
      after.implementationRoot !== original.implementationRoot) {
      failures.push("probe.candidate-identity-changed")
    }
    if (candidateManifestInvariantIssues(after).length > 0) {
      failures.push("probe.after-manifest-invalid")
    }
    if (input.patch.beforeTreeSha256 !== prepared.candidateTreeInventory.treeSha256 ||
      !sameTree(
        new CandidateTreeInventory({
          entries: input.patch.beforeTreeEntries,
          treeSha256: input.patch.beforeTreeSha256
        }),
        prepared.candidateTreeInventory
      )) {
      failures.push("probe.before-tree-authority-mismatch")
    }
    if (input.patch.afterTreeSha256 !== observedAfter.treeSha256 ||
      !sameTree(
        new CandidateTreeInventory({
          entries: input.patch.afterTreeEntries,
          treeSha256: input.patch.afterTreeSha256
        }),
        observedAfter
      )) {
      failures.push("probe.after-tree-authority-mismatch")
    }
    if (input.patch.patchEntries.length === 0 ||
      input.patch.beforeTreeSha256 === input.patch.afterTreeSha256) {
      failures.push("probe.runner-zero-change")
    }
    if (input.patch.touchedOwnerRoleIds.some((roleId) =>
      input.probe.requiredZeroTouchRoleIds.includes(
        roleId as typeof input.probe.requiredZeroTouchRoleIds[number]
      ))) {
      failures.push("probe.runner-zero-touch-violation")
    }
    failures.push(...probeChangeKindEvidenceIssues(input.probe, input.observation, input.patch))

    return failures.length === 0
      ? new AcceptedProbeEvaluation({ facts: [acceptedFact()] })
      : new RejectedProbeEvaluation({ failureIds: canonicalFailureIds(failures) })
  })
})
