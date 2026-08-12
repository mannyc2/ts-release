import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { Sha256Hex } from "../model/digest.js"

const referenceSegmentPattern = /^[A-Za-z0-9._~-]{1,255}$/u
const positiveDecimalPattern = /^[1-9][0-9]*$/u

/** The lowercase hexadecimal payload of a SHA-256 digest. */
export const PreparedReleaseSha256 = Sha256Hex
export type PreparedReleaseSha256 = Sha256Hex

const GitHubReferenceSegment = Schema.String.check(
  Schema.makeFilter((value: string) =>
    referenceSegmentPattern.test(value) && value !== "." && value !== ".."
      ? undefined
      : "GitHub prepared-reference segments must be nonempty URI-unreserved tokens.")
).pipe(Schema.brand("GitHubPreparedReferenceSegment"))

const GitHubRunCoordinate = Schema.String.check(
  Schema.makeFilter((value: string) =>
    positiveDecimalPattern.test(value)
      ? undefined
      : "GitHub run coordinates must be canonical positive decimal strings.")
).pipe(Schema.brand("GitHubPreparedReferenceRunCoordinate"))

/** A complete bundle in the configured/default local content-addressed store. */
export class LocalCompletePreparedReleaseRef
  extends Schema.TaggedClass<LocalCompletePreparedReleaseRef>()("LocalCompletePreparedReleaseRef", {
    kind: Schema.Literal("complete"),
    scheme: Schema.Literal("local"),
    digest: PreparedReleaseSha256
  }) {}

/** A complete bundle in a durable GitHub Actions artifact store. */
export class GitHubActionsCompletePreparedReleaseRef
  extends Schema.TaggedClass<GitHubActionsCompletePreparedReleaseRef>()("GitHubActionsCompletePreparedReleaseRef", {
    kind: Schema.Literal("complete"),
    scheme: Schema.Literal("gha"),
    owner: GitHubReferenceSegment,
    repository: GitHubReferenceSegment,
    runId: GitHubRunCoordinate,
    attempt: GitHubRunCoordinate,
    artifactName: GitHubReferenceSegment,
    digest: PreparedReleaseSha256
  }) {}

/** Every complete prepared-release reference accepted by the kernel. */
export const CompletePreparedReleaseRef = Schema.Union([
  LocalCompletePreparedReleaseRef,
  GitHubActionsCompletePreparedReleaseRef
])
export type CompletePreparedReleaseRef = typeof CompletePreparedReleaseRef.Type

export class PreparedReleaseRefMalformedError
  extends Schema.TaggedErrorClass<PreparedReleaseRefMalformedError>()("PreparedReleaseRefMalformedError", {
    reason: Schema.String
  }) {}

export class PreparedReleaseRefUnknownSchemeError
  extends Schema.TaggedErrorClass<PreparedReleaseRefUnknownSchemeError>()("PreparedReleaseRefUnknownSchemeError", {
    scheme: Schema.String
  }) {}

export const PreparedReleaseRefCodecError = Schema.Union([
  PreparedReleaseRefMalformedError,
  PreparedReleaseRefUnknownSchemeError
])
export type PreparedReleaseRefCodecError = typeof PreparedReleaseRefCodecError.Type

export interface GitHubActionsCompletePreparedReleaseRefInput {
  readonly owner: string
  readonly repository: string
  readonly runId: string
  readonly attempt: string
  readonly artifactName: string
  readonly digest: string
}

const malformed = (reason: string): PreparedReleaseRefMalformedError =>
  PreparedReleaseRefMalformedError.make({ reason })

const validateDigest = (digest: string): Effect.Effect<PreparedReleaseSha256, PreparedReleaseRefMalformedError> =>
  Schema.is(Sha256Hex)(digest)
    ? Effect.succeed(digest)
    : Effect.fail(malformed("The digest must contain exactly 64 lowercase hexadecimal characters."))

const validateSegment = (
  value: string,
  field: string
): Effect.Effect<typeof GitHubReferenceSegment.Type, PreparedReleaseRefMalformedError> =>
  referenceSegmentPattern.test(value) && value !== "." && value !== ".."
    ? Effect.succeed(GitHubReferenceSegment.make(value))
    : Effect.fail(malformed(`${field} must be a nonempty URI-unreserved token.`))

const validateRunCoordinate = (
  value: string,
  field: string
): Effect.Effect<typeof GitHubRunCoordinate.Type, PreparedReleaseRefMalformedError> =>
  positiveDecimalPattern.test(value)
    ? Effect.succeed(GitHubRunCoordinate.make(value))
    : Effect.fail(malformed(`${field} must be a canonical positive decimal string.`))

export const makeLocalCompletePreparedReleaseRef = Effect.fn("makeLocalCompletePreparedReleaseRef")(
  function*(digest: string) {
    return LocalCompletePreparedReleaseRef.make({
      kind: "complete",
      scheme: "local",
      digest: yield* validateDigest(digest)
    })
  }
)

export const makeGitHubActionsCompletePreparedReleaseRef = Effect.fn(
  "makeGitHubActionsCompletePreparedReleaseRef"
)(function*(input: GitHubActionsCompletePreparedReleaseRefInput) {
  return GitHubActionsCompletePreparedReleaseRef.make({
    kind: "complete",
    scheme: "gha",
    owner: yield* validateSegment(input.owner, "owner"),
    repository: yield* validateSegment(input.repository, "repository"),
    runId: yield* validateRunCoordinate(input.runId, "runId"),
    attempt: yield* validateRunCoordinate(input.attempt, "attempt"),
    artifactName: yield* validateSegment(input.artifactName, "artifactName"),
    digest: yield* validateDigest(input.digest)
  })
})

export const isLocalCompletePreparedReleaseRef = (
  value: unknown
): value is LocalCompletePreparedReleaseRef => Schema.is(LocalCompletePreparedReleaseRef)(value)

export const isGitHubActionsCompletePreparedReleaseRef = (
  value: unknown
): value is GitHubActionsCompletePreparedReleaseRef => Schema.is(GitHubActionsCompletePreparedReleaseRef)(value)

/** Encode a validated complete reference to its single canonical CLI representation. */
export const encodeCompletePreparedReleaseRef = (reference: CompletePreparedReleaseRef): string =>
  reference.scheme === "local"
    ? `prepared:local:sha256-${reference.digest}`
    : `prepared:gha:${reference.owner}/${reference.repository}/runs/${reference.runId}/attempts/${reference.attempt}/artifacts/${reference.artifactName}#sha256-${reference.digest}`

const githubActionsPayloadPattern =
  /^([A-Za-z0-9._~-]{1,255})\/([A-Za-z0-9._~-]{1,255})\/runs\/([1-9][0-9]*)\/attempts\/([1-9][0-9]*)\/artifacts\/([A-Za-z0-9._~-]{1,255})#sha256-([a-f0-9]{64})$/u

/** Decode only the canonical `prepared:local:` and `prepared:gha:` grammars. */
export const decodeCompletePreparedReleaseRef = Effect.fn("decodeCompletePreparedReleaseRef")(
  function*(input: unknown) {
    if (typeof input !== "string") {
      return yield* malformed("A prepared reference must be a string.")
    }
    if (!input.startsWith("prepared:")) {
      return yield* malformed("A prepared reference must start with 'prepared:'.")
    }
    const schemeEnd = input.indexOf(":", "prepared:".length)
    if (schemeEnd < 0) {
      return yield* malformed("A prepared reference must include a scheme and payload.")
    }
    const scheme = input.slice("prepared:".length, schemeEnd)
    const payload = input.slice(schemeEnd + 1)
    if (scheme !== "local" && scheme !== "gha") {
      if (scheme.length === 0) {
        return yield* malformed("A prepared reference scheme must be nonempty.")
      }
      return yield* PreparedReleaseRefUnknownSchemeError.make({ scheme })
    }
    if (scheme === "local") {
      const match = /^sha256-([a-f0-9]{64})$/u.exec(payload)
      if (match === null) {
        return yield* malformed("A local reference payload must be 'sha256-' followed by 64 lowercase hexadecimal characters.")
      }
      return yield* makeLocalCompletePreparedReleaseRef(match[1]!)
    }
    const match = githubActionsPayloadPattern.exec(payload)
    if (match === null || match[1] === "." || match[1] === ".." || match[2] === "." || match[2] === ".." ||
      match[5] === "." || match[5] === "..") {
      return yield* malformed(
        "A GitHub Actions reference must contain canonical owner, repository, run, attempt, artifact, and SHA-256 coordinates."
      )
    }
    const reference = yield* makeGitHubActionsCompletePreparedReleaseRef({
      owner: match[1]!,
      repository: match[2]!,
      runId: match[3]!,
      attempt: match[4]!,
      artifactName: match[5]!,
      digest: match[6]!
    })
    if (encodeCompletePreparedReleaseRef(reference) !== input) {
      return yield* malformed("The prepared reference is not in canonical form.")
    }
    return reference
  }
)
