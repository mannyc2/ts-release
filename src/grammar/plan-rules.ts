// Invariant: one policy table and one reference/uniqueness validator gate every constructed and decoded plan.
import * as Effect from "effect/Effect"
import { type Artifact, artifactPathBaseName } from "./artifact.js"
import { deferredContentArtifactIds } from "./content.js"
import { PlanIntegrityError } from "./errors.js"
import { type Action, type Operation, OperationPhase, OperationRisk } from "./operation.js"
import type { ReleasePlan } from "./plan.js"

export const duplicateValues = (
  existing: Iterable<string>,
  incoming: Iterable<string>
): ReadonlyArray<string> => {
  const seen = new Set(existing)
  const duplicates = new Set<string>()
  for (const value of incoming) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates].sort()
}

export const duplicateArtifactBaseNames = (
  existing: ReadonlyArray<Artifact>,
  incoming: ReadonlyArray<Artifact>
): ReadonlyArray<string> => {
  const seen = new Map(existing.map((artifact) => [artifactPathBaseName(artifact.path), artifact.id] as const))
  const collisions: Array<string> = []
  for (const artifact of incoming) {
    const name = artifactPathBaseName(artifact.path)
    const firstId = seen.get(name)
    if (firstId === undefined) seen.set(name, artifact.id)
    else collisions.push(`${name} (${firstId}, ${artifact.id})`)
  }
  return collisions
}

// Unconstrained cells derive their full set from the schema, so a future phase or risk widens
// them automatically while every explicitly constrained cell forces a reviewed product decision.
// There is deliberately no wildcard sentinel: consumers have exactly one membership check.
const allPhases: ReadonlySet<OperationPhase> = new Set(OperationPhase.literals)
const allRisks: ReadonlySet<OperationRisk> = new Set(OperationRisk.literals)

export const actionPolicy: Record<
  Action["_tag"],
  { readonly phases: ReadonlySet<OperationPhase>; readonly risks: ReadonlySet<OperationRisk> }
> = {
  "command": { phases: allPhases, risks: allRisks },
  "stage": { phases: new Set(["build", "process"]), risks: new Set(["writes-local"]) },
  "check-file": { phases: new Set(["build", "verify"]), risks: new Set(["read-only"]) },
  "write-file": { phases: new Set(["process", "catalog"]), risks: new Set(["writes-local"]) },
  "note": { phases: allPhases, risks: new Set(["read-only"]) },
  "github-release-create": { phases: new Set(["publish"]), risks: new Set(["externally-visible", "irreversible"]) },
  "github-release-verify": { phases: new Set(["verify"]), risks: new Set(["read-only"]) },
  "published-assets-verify": { phases: new Set(["verify"]), risks: new Set(["read-only"]) }
}

const reject = (rule: string, reason: string): Effect.Effect<never, PlanIntegrityError> =>
  Effect.fail(PlanIntegrityError.make({ rule, reason }))

const validateActionPolicy = (
  operations: ReadonlyArray<Operation>
): Effect.Effect<void, PlanIntegrityError> => {
  for (const operation of operations) {
    const policy = actionPolicy[operation.action._tag]
    const label = `Operation ${operation.id} (${operation.action._tag})`
    if (!policy.phases.has(operation.phase)) {
      return reject("operation.phase", `${label} may not run in phase ${operation.phase}.`)
    }
    if (!policy.risks.has(operation.risk)) {
      return reject("operation.risk", `${label} may not declare risk ${operation.risk}.`)
    }
  }
  return Effect.void
}

const validateUniqueness = (plan: ReleasePlan): Effect.Effect<void, PlanIntegrityError> => {
  const checks = [
    ["artifacts.id", "artifact ids", duplicateValues([], plan.artifacts.map(({ id }) => id))],
    ["artifacts.path", "artifact paths", duplicateValues([], plan.artifacts.map(({ path }) => path))],
    ["artifacts.name", "artifact names", duplicateArtifactBaseNames([], plan.artifacts)],
    ["operations.id", "operation ids", duplicateValues([], plan.operations.map(({ id }) => id))]
  ] as const
  for (const [rule, label, duplicates] of checks) {
    if (duplicates.length > 0) return reject(rule, `Duplicate ${label}: ${duplicates.join(", ")}`)
  }
  return Effect.void
}

const validateReferences = (plan: ReleasePlan): Effect.Effect<void, PlanIntegrityError> => {
  const artifactIds = new Set(plan.artifacts.map(({ id }) => id))
  const missing = (ids: Iterable<string>): ReadonlyArray<string> =>
    [...new Set([...ids].filter((id) => !artifactIds.has(id)))].sort()
  const unresolved = (rule: string, owner: string, ids: Iterable<string>) => {
    const absent = missing(ids)
    return absent.length === 0 ? undefined : reject(rule, `${owner} names unknown artifacts: ${absent.join(", ")}`)
  }

  const stagedBy = new Map<string, string>()
  for (const operation of plan.operations) {
    const action = operation.action
    if (action._tag === "stage") {
      const failure = unresolved("stage.producesArtifactIds", `Operation ${operation.id}`, action.producesArtifactIds)
      if (failure !== undefined) return failure
      for (const artifactId of action.producesArtifactIds) {
        const owner = stagedBy.get(artifactId)
        if (owner !== undefined) {
          return reject(
            "stage.producesArtifactIds",
            `Artifact ${artifactId} is staged by both ${owner} and ${operation.id}.`
          )
        }
        stagedBy.set(artifactId, operation.id)
      }
    }
    if (action._tag === "github-release-create") {
      const failure = unresolved(
        "github-release-create.assets",
        `Operation ${operation.id}`,
        action.assets.map(({ artifactId }) => artifactId)
      )
      if (failure !== undefined) return failure
    }
    if (action._tag === "write-file" && typeof action.contents !== "string") {
      const failure = unresolved(
        "write-file.contents",
        `Operation ${operation.id}`,
        deferredContentArtifactIds(action.contents)
      )
      if (failure !== undefined) return failure
    }
  }

  for (const artifact of plan.artifacts) {
    if (artifact.extra._tag === "checksum-file") {
      const failure = unresolved(
        "checksum-file.coversArtifactIds",
        `Artifact ${artifact.id}`,
        artifact.extra.coversArtifactIds
      )
      if (failure !== undefined) return failure
    }
  }
  return Effect.void
}

export const validateReleasePlan = Effect.fn("plan.validateReleasePlan")(function*(plan: ReleasePlan) {
  yield* validateActionPolicy(plan.operations)
  yield* validateUniqueness(plan)
  yield* validateReferences(plan)
  return plan
})
