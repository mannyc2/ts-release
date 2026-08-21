import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { encodeCanonicalJson, hashCanonical, parseStrictJson } from "../model/canonical.js"
import { Sha256Hex, sha256Digest } from "../model/digest.js"

const canonicalIdentifier = <const Name extends string>(name: Name) =>
  Schema.NonEmptyString.check(Schema.makeFilter((value: string) =>
    value === value.normalize("NFC")
      ? undefined
      : `${name} must use Unicode NFC.`
  )).pipe(Schema.brand(name))

const NonNegativeByteLength = Schema.Number.check(Schema.makeFilter((value: number) =>
  Number.isSafeInteger(value) && value >= 0
    ? undefined
    : "Byte length must be a nonnegative safe integer."
))

export const ArtifactId = canonicalIdentifier("ArtifactId")
export type ArtifactId = typeof ArtifactId.Type

export const BundleId = Sha256Hex.pipe(Schema.brand("BundleId"))
export type BundleId = typeof BundleId.Type

export class ArtifactRef extends Schema.TaggedClass<ArtifactRef>()("ArtifactRef", {
  artifactId: ArtifactId
}) {}

export class BundleObjectV1 extends Schema.Class<BundleObjectV1>("BundleObjectV1")({
  digest: Sha256Hex,
  byteLength: NonNegativeByteLength
}) {}

export class BundleArtifactV1 extends Schema.Class<BundleArtifactV1>("BundleArtifactV1")({
  artifactId: ArtifactId,
  contentDigest: Sha256Hex
}) {}

export class ArtifactBundleManifestV1
  extends Schema.Class<ArtifactBundleManifestV1>("ArtifactBundleManifestV1")({
    schemaVersion: Schema.Literal("artifact-bundle/v1"),
    objects: Schema.Array(BundleObjectV1),
    artifacts: Schema.Array(BundleArtifactV1)
  }) {}

export class ArtifactBundleError
  extends Schema.TaggedErrorClass<ArtifactBundleError>()("ArtifactBundleError", {
    reason: Schema.NonEmptyString
  }) {}

export interface ArtifactInput {
  readonly artifactId: ArtifactId
  readonly bytes: Uint8Array
}

export interface BundleObjectInput {
  readonly digest: Sha256Hex
  readonly bytes: Uint8Array
}

export interface ResolvedArtifact {
  readonly bundleId: BundleId
  readonly artifactId: ArtifactId
  readonly digest: Sha256Hex
  readonly byteLength: number
  readonly bytes: Uint8Array
}

const compareCodePoints = (left: string, right: string): number => {
  const a = [...left]
  const b = [...right]
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    const difference = a[index]!.codePointAt(0)! - b[index]!.codePointAt(0)!
    if (difference !== 0) return difference
  }
  return a.length - b.length
}

const equalBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((byte, index) => byte === right[index])

const reason = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause)

const encodedManifest = (manifest: ArtifactBundleManifestV1): Schema.Json =>
  Schema.encodeSync(ArtifactBundleManifestV1)(manifest) as Schema.Json

const deriveBundleId = (manifest: ArtifactBundleManifestV1): BundleId =>
  BundleId.make(hashCanonical("ts-release/artifact-bundle/1", encodedManifest(manifest)))

const assertManifest = (manifest: ArtifactBundleManifestV1): void => {
  const objectDigests = new Set<string>()
  let previousObject: string | undefined
  for (const object of manifest.objects) {
    const digest = object.digest.toString()
    if (objectDigests.has(digest)) throw new Error(`Bundle repeats content object ${digest}.`)
    if (previousObject !== undefined && compareCodePoints(previousObject, digest) >= 0) {
      throw new Error("Bundle objects must be ordered by digest.")
    }
    objectDigests.add(digest)
    previousObject = digest
  }

  const artifactIds = new Set<string>()
  const referenced = new Set<string>()
  let previousArtifact: string | undefined
  for (const artifact of manifest.artifacts) {
    const artifactId = artifact.artifactId.toString()
    const digest = artifact.contentDigest.toString()
    if (artifactIds.has(artifactId)) throw new Error(`Bundle repeats artifact ${artifactId}.`)
    if (previousArtifact !== undefined && compareCodePoints(previousArtifact, artifactId) >= 0) {
      throw new Error("Bundle artifacts must be ordered by artifactId.")
    }
    if (!objectDigests.has(digest)) {
      throw new Error(`Artifact ${artifactId} references missing content object ${digest}.`)
    }
    artifactIds.add(artifactId)
    referenced.add(digest)
    previousArtifact = artifactId
  }
  for (const digest of objectDigests) {
    if (!referenced.has(digest)) throw new Error(`Bundle contains unreferenced content object ${digest}.`)
  }
}

const freezeManifest = (manifest: ArtifactBundleManifestV1): ArtifactBundleManifestV1 => {
  const objects = Object.freeze(manifest.objects.map((object) => Object.freeze(BundleObjectV1.make({
    digest: object.digest,
    byteLength: object.byteLength
  }))))
  const artifacts = Object.freeze(manifest.artifacts.map((artifact) => Object.freeze(BundleArtifactV1.make({
    artifactId: artifact.artifactId,
    contentDigest: artifact.contentDigest
  }))))
  return Object.freeze(ArtifactBundleManifestV1.make({
    schemaVersion: "artifact-bundle/v1",
    objects,
    artifacts
  }))
}

const artifactBundleConstruction = Symbol("ArtifactBundleConstruction")

export class ArtifactBundle {
  readonly #manifest: ArtifactBundleManifestV1
  readonly #content: ReadonlyMap<string, Uint8Array>

  private constructor(
    construction: typeof artifactBundleConstruction,
    manifest: ArtifactBundleManifestV1,
    content: ReadonlyMap<string, Uint8Array>
  ) {
    if (construction !== artifactBundleConstruction) {
      throw new Error("ArtifactBundle construction is internal; use a validated constructor.")
    }
    this.#manifest = manifest
    this.#content = content
    Object.freeze(this)
  }

  static from(
    manifest: ArtifactBundleManifestV1,
    suppliedObjects: ReadonlyArray<BundleObjectInput>
  ): ArtifactBundle {
    assertManifest(manifest)
    const declared = new Map(manifest.objects.map((object) => [object.digest.toString(), object]))
    const content = new Map<string, Uint8Array>()
    for (const supplied of suppliedObjects) {
      const digest = supplied.digest.toString()
      if (content.has(digest)) throw new Error(`Bundle input repeats content object ${digest}.`)
      const declaration = declared.get(digest)
      if (declaration === undefined) throw new Error(`Bundle input contains undeclared content object ${digest}.`)
      const owned = Uint8Array.from(supplied.bytes)
      const actual = sha256Digest(owned).hex.toString()
      if (actual !== digest) throw new Error(`Content object ${digest} does not match its bytes.`)
      if (owned.byteLength !== declaration.byteLength) {
        throw new Error(`Content object ${digest} does not match its byte length.`)
      }
      content.set(digest, owned)
    }
    for (const digest of declared.keys()) {
      if (!content.has(digest)) throw new Error(`Bundle input omits content object ${digest}.`)
    }
    return new ArtifactBundle(
      artifactBundleConstruction,
      freezeManifest(manifest),
      new Map([...content].map(([digest, bytes]) => [digest, Uint8Array.from(bytes)]))
    )
  }

  get manifest(): ArtifactBundleManifestV1 {
    return this.#manifest
  }

  get bundleId(): BundleId {
    return deriveBundleId(this.manifest)
  }

  get artifactIds(): ReadonlyArray<ArtifactId> {
    return this.manifest.artifacts.map((artifact) => artifact.artifactId)
  }

  hasArtifact(artifactId: ArtifactId): boolean {
    return this.manifest.artifacts.some((artifact) => artifact.artifactId === artifactId)
  }

  resolve(ref: ArtifactRef): Effect.Effect<ResolvedArtifact, ArtifactBundleError> {
    const artifact = this.manifest.artifacts.find((candidate) => candidate.artifactId === ref.artifactId)
    if (artifact === undefined) {
      return Effect.fail(ArtifactBundleError.make({ reason: `Bundle has no artifact ${ref.artifactId}.` }))
    }
    const object = this.manifest.objects.find((candidate) => candidate.digest === artifact.contentDigest)
    const bytes = this.#content.get(artifact.contentDigest.toString())
    if (object === undefined || bytes === undefined) {
      return Effect.fail(ArtifactBundleError.make({
        reason: `Validated content object ${artifact.contentDigest} is unavailable.`
      }))
    }
    return Effect.succeed({
      bundleId: this.bundleId,
      artifactId: artifact.artifactId,
      digest: artifact.contentDigest,
      byteLength: object.byteLength,
      bytes: Uint8Array.from(bytes)
    })
  }
}

const makeBundle = (
  manifest: ArtifactBundleManifestV1,
  suppliedObjects: ReadonlyArray<BundleObjectInput>
): ArtifactBundle => ArtifactBundle.from(manifest, suppliedObjects)

export const adoptArtifactBundle = Effect.fn("ArtifactBundle.adopt")(function*(
  inputs: ReadonlyArray<ArtifactInput>
) {
  try {
    const artifactIds = new Set<string>()
    const content = new Map<string, Uint8Array>()
    const artifacts: Array<BundleArtifactV1> = []
    for (const input of inputs) {
      const artifactId = Schema.decodeUnknownSync(ArtifactId)(input.artifactId)
      if (artifactIds.has(artifactId.toString())) {
        throw new Error(`Bundle input repeats artifact ${artifactId}.`)
      }
      artifactIds.add(artifactId.toString())
      const owned = Uint8Array.from(input.bytes)
      const digest = sha256Digest(owned).hex
      const existing = content.get(digest.toString())
      if (existing !== undefined && !equalBytes(existing, owned)) {
        throw new Error(`Content digest collision for ${digest}.`)
      }
      if (existing === undefined) content.set(digest.toString(), owned)
      artifacts.push(BundleArtifactV1.make({ artifactId, contentDigest: digest }))
    }
    artifacts.sort((left, right) => compareCodePoints(left.artifactId, right.artifactId))
    const objects = [...content].map(([digest, bytes]) => BundleObjectV1.make({
      digest: Sha256Hex.make(digest),
      byteLength: bytes.byteLength
    })).sort((left, right) => compareCodePoints(left.digest, right.digest))
    const manifest = ArtifactBundleManifestV1.make({
      schemaVersion: "artifact-bundle/v1",
      objects,
      artifacts
    })
    return makeBundle(manifest, [...content].map(([digest, bytes]) => ({
      digest: Sha256Hex.make(digest),
      bytes
    })))
  } catch (cause) {
    return yield* ArtifactBundleError.make({ reason: reason(cause) })
  }
})

export const encodeArtifactBundleManifest = (manifest: ArtifactBundleManifestV1): Uint8Array => {
  try {
    const normalized = Schema.decodeUnknownSync(ArtifactBundleManifestV1, {
      onExcessProperty: "error"
    })(Schema.encodeSync(ArtifactBundleManifestV1)(manifest))
    assertManifest(normalized)
    return new TextEncoder().encode(encodeCanonicalJson(encodedManifest(normalized)))
  } catch (cause) {
    throw ArtifactBundleError.make({ reason: reason(cause) })
  }
}

export const decodeArtifactBundleManifest = Effect.fn("ArtifactBundle.decodeManifest")(function*(
  bytes: Uint8Array
) {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    const manifest = Schema.decodeUnknownSync(ArtifactBundleManifestV1, {
      onExcessProperty: "error"
    })(parseStrictJson(text))
    assertManifest(manifest)
    const canonical = encodeArtifactBundleManifest(manifest)
    if (!equalBytes(canonical, bytes)) throw new Error("Bundle manifest bytes are not canonical.")
    return freezeManifest(manifest)
  } catch (cause) {
    return yield* cause instanceof ArtifactBundleError
      ? cause
      : ArtifactBundleError.make({ reason: reason(cause) })
  }
})

export const loadArtifactBundle = Effect.fn("ArtifactBundle.load")(function*(input: {
  readonly manifest: ArtifactBundleManifestV1
  readonly objects: ReadonlyArray<BundleObjectInput>
}) {
  try {
    const manifest = Schema.decodeUnknownSync(ArtifactBundleManifestV1, {
      onExcessProperty: "error"
    })(Schema.encodeSync(ArtifactBundleManifestV1)(input.manifest))
    return makeBundle(manifest, input.objects)
  } catch (cause) {
    return yield* ArtifactBundleError.make({ reason: reason(cause) })
  }
})
