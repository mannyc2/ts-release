import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  CompletePreparedReleaseRef,
  GitHubActionsCompletePreparedReleaseRef,
  LocalCompletePreparedReleaseRef,
  PreparedReleaseRefMalformedError,
  PreparedReleaseRefUnknownSchemeError,
  decodeCompletePreparedReleaseRef,
  encodeCompletePreparedReleaseRef,
  isGitHubActionsCompletePreparedReleaseRef,
  isLocalCompletePreparedReleaseRef,
  makeGitHubActionsCompletePreparedReleaseRef,
  makeLocalCompletePreparedReleaseRef
} from "../../src/release/prepared-ref.js"

const digest = "0123456789abcdef".repeat(4)

describe("CompletePreparedReleaseRef codec", () => {
  it.effect("round-trips a digest-only local reference", () => Effect.gen(function*() {
    const reference = yield* makeLocalCompletePreparedReleaseRef(digest)
    const encoded = encodeCompletePreparedReleaseRef(reference)
    expect(encoded).toBe(`prepared:local:sha256-${digest}`)

    const decoded = yield* decodeCompletePreparedReleaseRef(encoded)
    expect(decoded).toEqual(reference)
    expect(decoded).toBeInstanceOf(LocalCompletePreparedReleaseRef)
    expect(decoded.kind).toBe("complete")
    expect(decoded.digest.toString()).toBe(digest)
    expect("directory" in decoded).toBe(false)
    expect("path" in decoded).toBe(false)
    expect(isLocalCompletePreparedReleaseRef(decoded)).toBe(true)
    expect(isGitHubActionsCompletePreparedReleaseRef(decoded)).toBe(false)
  }))

  it.effect("round-trips a GitHub Actions reference with durable coordinates", () => Effect.gen(function*() {
    const reference = yield* makeGitHubActionsCompletePreparedReleaseRef({
      owner: "openai",
      repository: "ts-release",
      runId: "12345678901234567890",
      attempt: "2",
      artifactName: "prepared-release-v1",
      digest
    })
    const encoded = `prepared:gha:openai/ts-release/runs/12345678901234567890/attempts/2/artifacts/prepared-release-v1#sha256-${digest}`
    expect(encodeCompletePreparedReleaseRef(reference)).toBe(encoded)

    const decoded = yield* decodeCompletePreparedReleaseRef(encoded)
    expect(decoded).toEqual(reference)
    expect(decoded).toBeInstanceOf(GitHubActionsCompletePreparedReleaseRef)
    expect(decoded.kind).toBe("complete")
    expect(decoded.digest.toString()).toBe(digest)
    expect(isGitHubActionsCompletePreparedReleaseRef(decoded)).toBe(true)
    expect(isLocalCompletePreparedReleaseRef(decoded)).toBe(false)
  }))

  it.effect("round-trips through the durable schema and refuses a partial kind", () => Effect.gen(function*() {
    const reference = yield* makeLocalCompletePreparedReleaseRef(digest)
    const encoded = Schema.encodeSync(CompletePreparedReleaseRef)(reference)
    expect(Schema.decodeUnknownSync(CompletePreparedReleaseRef)(encoded)).toEqual(reference)
    expect(() => Schema.decodeUnknownSync(CompletePreparedReleaseRef)({
      ...encoded,
      kind: "partial"
    })).toThrow()
  }))

  it.effect("reports an unknown scheme as a distinct typed error", () => Effect.gen(function*() {
    const error = yield* decodeCompletePreparedReleaseRef(`prepared:s3:sha256-${digest}`).pipe(Effect.flip)
    expect(error).toBeInstanceOf(PreparedReleaseRefUnknownSchemeError)
    expect(error._tag).toBe("PreparedReleaseRefUnknownSchemeError")
    if (error instanceof PreparedReleaseRefUnknownSchemeError) expect(error.scheme).toBe("s3")
  }))

  const malformedReferences: ReadonlyArray<unknown> = [
    null,
    "",
    `local:sha256-${digest}`,
    `prepared::sha256-${digest}`,
    `prepared:local:${digest}`,
    `prepared:local:sha256-${digest.toUpperCase()}`,
    `prepared:local:/tmp/prepared/sha256-${digest}`,
    `prepared:local:sha256-${digest}/extra`,
    `prepared:gha:openai/ts-release/runs/0/attempts/1/artifacts/release#sha256-${digest}`,
    `prepared:gha:openai/ts-release/runs/01/attempts/1/artifacts/release#sha256-${digest}`,
    `prepared:gha:openai/ts-release/runs/1/attempts/0/artifacts/release#sha256-${digest}`,
    `prepared:gha:openai/ts-release/runs/1/attempts/1/artifacts/a/b#sha256-${digest}`,
    `prepared:gha:openai/ts-release/runs/1/attempts/1/artifacts/release#sha256-${digest.toUpperCase()}`
  ]

  for (const input of malformedReferences) {
    it.effect(`rejects malformed input ${JSON.stringify(input)}`, () => Effect.gen(function*() {
      const error = yield* decodeCompletePreparedReleaseRef(input).pipe(Effect.flip)
      expect(error).toBeInstanceOf(PreparedReleaseRefMalformedError)
      expect(error._tag).toBe("PreparedReleaseRefMalformedError")
    }))
  }

  it.effect("smart constructors preserve the same canonical invariants", () => Effect.gen(function*() {
    const localError = yield* makeLocalCompletePreparedReleaseRef(digest.toUpperCase()).pipe(Effect.flip)
    expect(localError).toBeInstanceOf(PreparedReleaseRefMalformedError)

    const hostedError = yield* makeGitHubActionsCompletePreparedReleaseRef({
      owner: "openai",
      repository: "ts/release",
      runId: "1",
      attempt: "1",
      artifactName: "prepared",
      digest
    }).pipe(Effect.flip)
    expect(hostedError).toBeInstanceOf(PreparedReleaseRefMalformedError)
  }))

  it("type guards reject lookalike values that violate the durable schema", () => {
    expect(isLocalCompletePreparedReleaseRef({
      _tag: "LocalCompletePreparedReleaseRef",
      kind: "complete",
      scheme: "local",
      digest: "not-a-digest"
    })).toBe(false)
    expect(isGitHubActionsCompletePreparedReleaseRef({
      _tag: "GitHubActionsCompletePreparedReleaseRef",
      kind: "complete",
      scheme: "gha",
      owner: "openai",
      repository: "ts-release",
      runId: "01",
      attempt: "1",
      artifactName: "prepared",
      digest
    })).toBe(false)
  })
})
