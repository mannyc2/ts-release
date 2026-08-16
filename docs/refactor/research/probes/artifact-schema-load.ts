// Disposable research probe. Not production API.
//
// Question: can bundle decoding and artifact resolution report typed Effect
// failures while keeping the constructor private and validating nested
// references once at a load boundary?
//
// Narrow result only: this in-memory probe demonstrates Schema decoding,
// duplicate/missing-entry validation, copied byte reads, and typed lookup
// failures. It does not derive or verify the manifest's bundle identity, bind a
// relative reference structurally to a bundle, or exercise durable storage.

import { Effect, Schema } from "effect"

const Byte = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 255 }))

class ByteObject extends Schema.Class<ByteObject>("ByteObject")({
  id: Schema.NonEmptyString,
  bytes: Schema.Array(Byte)
}) {}

class ArtifactEntry extends Schema.Class<ArtifactEntry>("ArtifactEntry")({
  id: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  mediaType: Schema.NonEmptyString,
  objectId: Schema.NonEmptyString
}) {}

class BundleManifest extends Schema.Class<BundleManifest>("BundleManifest")({
  format: Schema.Literal("artifact-bundle@probe-effect-1"),
  id: Schema.NonEmptyString,
  objects: Schema.Array(ByteObject),
  artifacts: Schema.Array(ArtifactEntry)
}) {}

class InvalidBundle extends Schema.TaggedError<InvalidBundle>("ArtifactProbe/InvalidBundle")(
  "InvalidBundle",
  { reason: Schema.NonEmptyString }
) {}

class MissingArtifact extends Schema.TaggedError<MissingArtifact>("ArtifactProbe/MissingArtifact")(
  "MissingArtifact",
  { artifactId: Schema.NonEmptyString }
) {}

class WrongBundle extends Schema.TaggedError<WrongBundle>("ArtifactProbe/WrongBundle")(
  "WrongBundle",
  {
    expectedBundleId: Schema.NonEmptyString,
    observedBundleId: Schema.NonEmptyString
  }
) {}

interface RelativeArtifactRef {
  readonly artifactId: string
}

interface QualifiedArtifactRef extends RelativeArtifactRef {
  readonly bundleId: string
}

interface LogicalFile {
  readonly name: string
  readonly mediaType: string
  readonly bytes: Uint8Array
}

const copyBytes = (bytes: ReadonlyArray<number>): Uint8Array => Uint8Array.from(bytes)

class Bundle {
  private constructor(
    readonly id: string,
    private readonly artifacts: ReadonlyMap<string, ArtifactEntry>,
    private readonly objects: ReadonlyMap<string, Uint8Array>
  ) {}

  static load = Effect.fn("ArtifactProbe.Bundle.load")(function*(input: unknown) {
    const manifest = yield* Schema.decodeUnknownEffect(BundleManifest)(input).pipe(
      Effect.mapError((error) => new InvalidBundle({ reason: String(error) }))
    )

    const objects = new Map<string, Uint8Array>()
    for (const object of manifest.objects) {
      if (objects.has(object.id)) {
        return yield* new InvalidBundle({ reason: `duplicate object id: ${object.id}` })
      }
      objects.set(object.id, copyBytes(object.bytes))
    }

    const artifacts = new Map<string, ArtifactEntry>()
    for (const artifact of manifest.artifacts) {
      if (artifacts.has(artifact.id)) {
        return yield* new InvalidBundle({ reason: `duplicate artifact id: ${artifact.id}` })
      }
      if (!objects.has(artifact.objectId)) {
        return yield* new InvalidBundle({ reason: `missing object: ${artifact.objectId}` })
      }
      artifacts.set(artifact.id, artifact)
    }

    return new Bundle(manifest.id, artifacts, objects)
  })

  resolveRelative(ref: RelativeArtifactRef): Effect.Effect<LogicalFile, MissingArtifact> {
    const artifact = this.artifacts.get(ref.artifactId)
    if (artifact === undefined) {
      return Effect.fail(new MissingArtifact({ artifactId: ref.artifactId }))
    }
    const bytes = this.objects.get(artifact.objectId)
    if (bytes === undefined) {
      return Effect.die(`validated object disappeared: ${artifact.objectId}`)
    }
    return Effect.succeed({
      name: artifact.name,
      mediaType: artifact.mediaType,
      bytes: Uint8Array.from(bytes)
    })
  }

  resolveQualified(ref: QualifiedArtifactRef): Effect.Effect<LogicalFile, WrongBundle | MissingArtifact> {
    if (ref.bundleId !== this.id) {
      return Effect.fail(new WrongBundle({
        expectedBundleId: this.id,
        observedBundleId: ref.bundleId
      }))
    }
    return this.resolveRelative(ref)
  }
}

const valid = {
  format: "artifact-bundle@probe-effect-1",
  id: "bundle-a",
  objects: [{ id: "object-a", bytes: [1, 2, 3] }],
  artifacts: [{
    id: "artifact-a",
    name: "tool.bin",
    mediaType: "application/octet-stream",
    objectId: "object-a"
  }]
} as const

const program = Effect.gen(function*() {
  const decoded = yield* Bundle.load(valid)
  const file = yield* decoded.resolveRelative({ artifactId: "artifact-a" })
  file.bytes[0] = 99
  const again = yield* decoded.resolveQualified({ bundleId: "bundle-a", artifactId: "artifact-a" })
  if (again.bytes[0] !== 1) {
    return yield* Effect.die("resolved bytes alias bundle-owned storage")
  }

  const missing = yield* Effect.flip(decoded.resolveRelative({ artifactId: "missing" }))
  if (missing._tag !== "MissingArtifact") {
    return yield* Effect.die("missing artifact did not remain typed")
  }

  const wrong = yield* Effect.flip(decoded.resolveQualified({
    bundleId: "bundle-b",
    artifactId: "artifact-a"
  }))
  if (wrong._tag !== "WrongBundle") {
    return yield* Effect.die("wrong bundle did not remain typed")
  }

  const encoded = yield* Schema.encodeEffect(BundleManifest)(new BundleManifest(valid))
  const roundTrip = yield* Bundle.load(encoded)
  if (roundTrip.id !== decoded.id) {
    return yield* Effect.die("schema round trip changed bundle identity")
  }

  const invalid = yield* Effect.flip(Bundle.load({
    ...valid,
    artifacts: [{ ...valid.artifacts[0], objectId: "absent" }]
  }))
  if (invalid._tag !== "InvalidBundle") {
    return yield* Effect.die("nested missing object did not fail at load")
  }

  for (const invalidByte of [256, 1.5]) {
    const invalidBytes = yield* Effect.flip(Bundle.load({
      ...valid,
      objects: [{ ...valid.objects[0], bytes: [invalidByte] }]
    }))
    if (invalidBytes._tag !== "InvalidBundle") {
      return yield* Effect.die(`invalid byte ${invalidByte} did not fail at load`)
    }
  }
})

await Effect.runPromise(program)
