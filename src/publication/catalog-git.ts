import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { encodeCanonicalJson, parseStrictJson } from "../model/canonical.js"
import { Sha256Digest, formatSha256Hex, sha256Digest } from "../model/digest.js"
import type { PreparedBundle } from "../release/prepared-store.js"
import { NonEmptyName, SafeRelativePath, Version } from "../model/primitives.js"
import {
  Applied, Conflict, Equivalent, Inconclusive, NeedsMutation, ObservationDifference,
  OutcomeUnknown, PublicationError, Rejected, type MutationResult, type Observation, type PublicationSubject
} from "./observation.js"

const repositoryName = Schema.String.check(Schema.makeFilter((value: string) =>
  /^[A-Za-z0-9.-]+\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(value) ? undefined : "Repository must be host/owner/name."))
const repositoryPath = Schema.String.check(Schema.makeFilter((value: string) =>
  value.length > 0 && !value.startsWith("/") && !value.includes("\\") && !value.split("/").includes("..")
    ? undefined : "Repository path must be a contained POSIX path."))

export class CatalogFileIntent extends Schema.Class<CatalogFileIntent>("CatalogFileIntent")({
  id: NonEmptyName, repository: repositoryName, branch: NonEmptyName,
  targetPath: repositoryPath, statePath: repositoryPath,
  artifactId: NonEmptyName, stateArtifactId: NonEmptyName,
  version: Version, commitMessage: NonEmptyName
}) {}

export class CatalogManagedState extends Schema.Class<CatalogManagedState>("CatalogManagedState")({
  schemaVersion: Schema.Literal("ts-release/catalog-state/v2"), version: Version,
  manifestDigest: Sha256Digest, status: Schema.Literals(["active", "corrected", "withdrawn", "superseded"]),
  correctionId: Schema.optionalKey(Sha256Digest), reason: Schema.optionalKey(Schema.String),
  replacement: Schema.optionalKey(NonEmptyName)
}) {}
export const encodeCatalogManagedState = (value: CatalogManagedState): Uint8Array =>
  new TextEncoder().encode(encodeCanonicalJson(Schema.encodeSync(CatalogManagedState)(value)))

export const decodeCatalogManagedState = (bytes: Uint8Array): CatalogManagedState | undefined => {
  try {
    const value = Schema.decodeUnknownSync(CatalogManagedState, { onExcessProperty: "error" })(parseStrictJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes)))
    const canonical = encodeCatalogManagedState(value)
    if (canonical.length !== bytes.length || canonical.some((byte, index) => byte !== bytes[index])) return undefined
    if (value.status === "active" && (value.correctionId !== undefined || value.reason !== undefined || value.replacement !== undefined)) return undefined
    if (value.status !== "active" && (value.correctionId === undefined || value.reason === undefined || value.reason.length === 0)) return undefined
    return value
  } catch {
    return undefined
  }
}

export type CatalogRepositorySnapshot = {
  readonly repository: string, readonly branch: string, readonly revision: string,
  readonly targetBytes?: Uint8Array, readonly stateBytes?: Uint8Array
}
export type CatalogRepositoryWrite = {
  readonly repository: string, readonly branch: string, readonly expectedRevision: string,
  readonly targetPath: string, readonly targetBytes: Uint8Array, readonly statePath: string,
  readonly stateBytes: Uint8Array, readonly commitMessage: string
}
export type CatalogRepositoryTransport = {
  readonly observe: (request: Pick<CatalogFileIntent, "repository" | "branch" | "targetPath" | "statePath">) => Effect.Effect<CatalogRepositorySnapshot, PublicationError>
  readonly write: (request: CatalogRepositoryWrite) => Effect.Effect<{ readonly revision: string }, PublicationError>
}

const digest = (bytes: Uint8Array): string => formatSha256Hex(sha256Digest(bytes))
const equal = (left: Uint8Array | undefined, right: Uint8Array): boolean => left !== undefined && left.length === right.length && left.every((value, index) => value === right[index])
const state = (bytes: Uint8Array | undefined): CatalogManagedState | undefined => {
  return bytes === undefined ? undefined : decodeCatalogManagedState(bytes)
}
const versionCompare = (left: string, right: string): number => {
  const parse = (value: string): [number[], string | undefined] => {
    const [rawCore, suffix] = value.replace(/^v/u, "").split("-", 2)
    return [(rawCore ?? "").split(".").map((part) => Number.parseInt(part, 10) || 0), suffix]
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
const precondition = (revision: string): NonEmptyName => NonEmptyName.make(`revision:${revision}`)
const revisionOf = (value: NonEmptyName): string => value.toString().replace(/^revision:/u, "")

export const makeCatalogSubject = (
  bundle: PreparedBundle, intent: CatalogFileIntent, transport: CatalogRepositoryTransport
): PublicationSubject => {
  const target = bundle.blobs.get(intent.artifactId.toString())
  const managed = bundle.blobs.get(intent.stateArtifactId.toString())
  const subject = NonEmptyName.make(`catalog:${intent.repository}:${intent.branch}:${intent.targetPath}`)
  const observe = (): Effect.Effect<Observation, PublicationError> => Effect.gen(function*() {
    if (target === undefined || managed === undefined) return yield* Effect.fail(new PublicationError({ phase: "observe", commitment: "before-dispatch", reason: "Catalog target or managed-state blob is unavailable." }))
    const current = yield* transport.observe(intent)
    if (current.repository !== intent.repository || current.branch !== intent.branch || current.revision.length === 0) return Inconclusive.make({ subject, reason: "Repository transport did not prove the configured repository, branch, and revision." })
    if (current.targetBytes === undefined && current.stateBytes === undefined) return NeedsMutation.make({ subject, precondition: precondition(current.revision) })
    if (current.targetBytes === undefined || current.stateBytes === undefined) return Conflict.make({ subject, differences: [ObservationDifference.make({ field: NonEmptyName.make("file/state-pair"), expected: "both present or both absent", observed: "half-present" })] })
    const currentState = state(current.stateBytes)
    if (currentState === undefined) return Inconclusive.make({ subject, reason: "Managed catalog state is malformed." })
    if (currentState.status !== "active") return Conflict.make({ subject, differences: [ObservationDifference.make({ field: NonEmptyName.make("managed.status"), expected: "active", observed: currentState.status })] })
    if (versionCompare(currentState.version.toString(), intent.version.toString()) > 0) return Conflict.make({ subject, differences: [ObservationDifference.make({ field: NonEmptyName.make("managed.version"), expected: intent.version, observed: currentState.version })] })
    if (versionCompare(currentState.version.toString(), intent.version.toString()) === 0 && (!equal(current.targetBytes, target) || !equal(current.stateBytes, managed))) {
      return Conflict.make({ subject, differences: [ObservationDifference.make({ field: NonEmptyName.make("bytes"), expected: digest(target), observed: digest(current.targetBytes) })] })
    }
    return equal(current.targetBytes, target) && equal(current.stateBytes, managed)
      ? Equivalent.make({ subject }) : NeedsMutation.make({ subject, precondition: precondition(current.revision) })
  }).pipe(Effect.catchTag("PublicationError", (cause) => Effect.succeed(Inconclusive.make({ subject, reason: cause.reason }))))
  const mutate = (needs: import("./observation.js").NeedsMutation): Effect.Effect<MutationResult, PublicationError> => Effect.gen(function*() {
    if (target === undefined || managed === undefined || needs.precondition.toString().startsWith("revision:") === false) return yield* Effect.fail(new PublicationError({ phase: "mutate", commitment: "before-dispatch", reason: "Catalog mutation lacks exact bytes or revision precondition." }))
    const result = yield* transport.write({ repository: intent.repository, branch: intent.branch, expectedRevision: revisionOf(needs.precondition), targetPath: intent.targetPath,
      targetBytes: target, statePath: intent.statePath, stateBytes: managed, commitMessage: intent.commitMessage })
    return Applied.make({ subject, detail: `Catalog commit ${result.revision}.` })
  }).pipe(Effect.catchTag("PublicationError", (cause) => cause.commitment === "before-dispatch"
    ? Effect.succeed<MutationResult>(Rejected.make({ subject, phase: "before-dispatch", reason: cause.reason }))
    : Effect.succeed<MutationResult>(OutcomeUnknown.make({ subject, reason: cause.reason })))) as Effect.Effect<MutationResult, PublicationError>
  return { id: subject, observe, mutate }
}
