import * as Effect from "effect/Effect"
import type { PreparedBundle } from "../release/prepared-store.js"
import { digestEquals, formatSha256Hex } from "../model/digest.js"
import { NonEmptyName } from "../model/primitives.js"
import {
  Applied, Conflict, Equivalent, Inconclusive, NeedsMutation, ObservationDifference,
  OutcomeUnknown, PublicationError, Rejected, type MutationResult, type Observation,
  type PublicationSubject
} from "../publication/observation.js"
import {
  CatalogManagedState, decodeCatalogManagedState, encodeCatalogManagedState,
  type CatalogRepositorySnapshot, type CatalogRepositoryTransport
} from "../publication/catalog-git.js"
import type { CatalogCorrection, CorrectionIntent } from "./intent.js"

const equal = (left: Uint8Array | undefined, right: Uint8Array): boolean =>
  left !== undefined && left.length === right.length && left.every((byte, index) => byte === right[index])
const versionCompare = (left: string, right: string): number => {
  const parse = (value: string): [number[], string | undefined] => {
    const [core, suffix] = value.replace(/^v/u, "").split("-", 2)
    return [(core ?? "").split(".").map((part) => Number.parseInt(part, 10) || 0), suffix]
  }
  const [leftCore, leftSuffix] = parse(left), [rightCore, rightSuffix] = parse(right)
  for (let index = 0; index < Math.max(leftCore.length, rightCore.length); index++) {
    const difference = (leftCore[index] ?? 0) - (rightCore[index] ?? 0)
    if (difference !== 0) return difference
  }
  if (leftSuffix === undefined && rightSuffix !== undefined) return 1
  if (leftSuffix !== undefined && rightSuffix === undefined) return -1
  return (leftSuffix ?? "") < (rightSuffix ?? "") ? -1 : (leftSuffix ?? "") > (rightSuffix ?? "") ? 1 : 0
}
const revision = (value: string): NonEmptyName => NonEmptyName.make(`revision:${value}`)
const revisionValue = (value: NonEmptyName): string => value.toString().slice("revision:".length)

export const makeCatalogCorrectionSubject = (
  bundle: PreparedBundle, intent: CorrectionIntent, transport: CatalogRepositoryTransport
): PublicationSubject => {
  const correction = intent.correction as CatalogCorrection
  const target = bundle.blobs.get(correction.artifactId.toString())
  const originalState = bundle.blobs.get(correction.stateArtifactId.toString())
  const correctedState = encodeCatalogManagedState(CatalogManagedState.make({
    schemaVersion: "ts-release/catalog-state/v2", version: correction.version,
    manifestDigest: intent.preparedDigest, status: correction.status, correctionId: intent.correctionId,
    reason: correction.reason, ...(correction.replacement === undefined ? {} : { replacement: NonEmptyName.make(correction.replacement.coordinate) })
  }))
  const subject = NonEmptyName.make(`catalog:correct:${correction.repository}:${correction.branch}:${correction.targetPath}`)
  const observe = (): Effect.Effect<Observation, PublicationError> => Effect.gen(function*() {
    if (intent.correction._tag !== "CatalogCorrection" || target === undefined || originalState === undefined) {
      return yield* Effect.fail(new PublicationError({ phase: "observe", commitment: "before-dispatch", reason: "Catalog correction does not have the exact prepared target/state pair." }))
    }
    const baseline = decodeCatalogManagedState(originalState)
    if (baseline === undefined || baseline.status !== "active" || baseline.version !== correction.version) {
      return yield* Effect.fail(new PublicationError({ phase: "observe", commitment: "before-dispatch", reason: "Catalog correction baseline is not the active state of this prepared release." }))
    }
    const current = yield* transport.observe(correction)
    if (current.repository !== correction.repository || current.branch !== correction.branch || current.revision.length === 0) return Inconclusive.make({ subject, reason: "Repository transport did not prove the configured catalog coordinate." })
    if (current.targetBytes === undefined || current.stateBytes === undefined) return Inconclusive.make({ subject, reason: "Catalog correction cannot distinguish missing files from a durable correction." })
    if (!equal(current.targetBytes, target)) return Conflict.make({ subject, differences: [ObservationDifference.make({ field: NonEmptyName.make("target.bytes"), expected: "prepared catalog bytes", observed: "different catalog bytes" })] })
    const currentState = decodeCatalogManagedState(current.stateBytes)
    if (currentState === undefined) return Inconclusive.make({ subject, reason: "Managed catalog correction state is malformed or noncanonical." })
    if (currentState.status !== "active") {
      return currentState.correctionId !== undefined && digestEquals(currentState.correctionId, intent.correctionId) &&
          currentState.status === correction.status && currentState.reason === correction.reason
        ? Equivalent.make({ subject })
        : Conflict.make({ subject, differences: [ObservationDifference.make({
          field: NonEmptyName.make("managed.correction"),
          expected: formatSha256Hex(intent.correctionId),
          observed: currentState.correctionId === undefined
            ? currentState.status
            : formatSha256Hex(currentState.correctionId)
        })] })
    }
    if (versionCompare(currentState.version.toString(), correction.version.toString()) > 0 ||
        !digestEquals(currentState.manifestDigest, baseline.manifestDigest)) {
      return Conflict.make({ subject, differences: [ObservationDifference.make({
        field: NonEmptyName.make("managed.generation"),
        expected: formatSha256Hex(baseline.manifestDigest),
        observed: formatSha256Hex(currentState.manifestDigest)
      })] })
    }
    return NeedsMutation.make({ subject, precondition: revision(current.revision) })
  }).pipe(Effect.catchTag("PublicationError", (cause) => Effect.succeed(Inconclusive.make({ subject, reason: cause.reason }))))
  const mutate = (needs: import("../publication/observation.js").NeedsMutation): Effect.Effect<MutationResult, PublicationError> => Effect.gen(function*() {
    if (needs.precondition.toString().startsWith("revision:") === false || target === undefined) return yield* new PublicationError({ phase: "mutate", commitment: "before-dispatch", reason: "Catalog correction lacks the exact revision precondition or target bytes." })
    const result = yield* transport.write({ repository: correction.repository, branch: correction.branch, expectedRevision: revisionValue(needs.precondition), targetPath: correction.targetPath,
      targetBytes: target, statePath: correction.statePath, stateBytes: correctedState, commitMessage: correction.reason })
    return Applied.make({ subject, detail: `Catalog correction commit ${result.revision}.` })
  }).pipe(Effect.catchTag("PublicationError", (cause) => cause.commitment === "before-dispatch"
    ? Effect.succeed<MutationResult>(Rejected.make({ subject, phase: "before-dispatch", reason: cause.reason }))
    : Effect.succeed<MutationResult>(OutcomeUnknown.make({ subject, reason: cause.reason })))) as Effect.Effect<MutationResult, PublicationError>
  return { id: subject, observe, mutate }
}
