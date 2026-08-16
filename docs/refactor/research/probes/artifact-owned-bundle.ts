// Disposable research probe. Not production API.
//
// Question: what is the smallest explicit BundleDraft -> Bundle candidate that
// establishes owned bytes, content-derived identities, deterministic repeated
// finalization, duplicate rejection, private construction, and a decode/load
// boundary without ambient reader/writer services?

import { createHash } from "node:crypto"

declare const artifactIdBrand: unique symbol
declare const objectIdBrand: unique symbol
declare const bundleIdBrand: unique symbol

type ArtifactId = string & { readonly [artifactIdBrand]: true }
type ObjectId = `sha256-${string}` & { readonly [objectIdBrand]: true }
type BundleId = `sha256-${string}` & { readonly [bundleIdBrand]: true }

const artifactId = (value: string): ArtifactId => value as ArtifactId

interface ArtifactEntry {
  readonly id: ArtifactId
  readonly name: string
  readonly mediaType: string
  readonly executable: boolean
  readonly object: ObjectId
}

interface EncodedObject {
  readonly id: string
  readonly bytes: ReadonlyArray<number>
}

interface EncodedBundle {
  readonly format: "artifact-bundle@probe-1"
  readonly id: string
  readonly artifacts: ReadonlyArray<{
    readonly id: string
    readonly name: string
    readonly mediaType: string
    readonly executable: boolean
    readonly object: string
  }>
  readonly objects: ReadonlyArray<EncodedObject>
}

class DuplicateArtifactId {
  readonly _tag = "DuplicateArtifactId"
  constructor(readonly id: ArtifactId) {}
}

class InvalidBundle {
  readonly _tag = "InvalidBundle"
  constructor(readonly reason: string) {}
}

type Result<A, E> =
  | { readonly _tag: "Success"; readonly value: A }
  | { readonly _tag: "Failure"; readonly error: E }

const success = <A>(value: A): Result<A, never> => ({ _tag: "Success", value })
const failure = <E>(error: E): Result<never, E> => ({ _tag: "Failure", error })

const sha256 = async (bytes: Uint8Array): Promise<`sha256-${string}`> =>
  `sha256-${createHash("sha256").update(bytes).digest("hex")}`

const utf8 = (value: string): Uint8Array => new TextEncoder().encode(value)

const canonicalArtifacts = (entries: ReadonlyMap<ArtifactId, ArtifactEntry>): ReadonlyArray<ArtifactEntry> =>
  [...entries.values()].sort((left, right) => left.id.localeCompare(right.id))

const canonicalObjects = (objects: ReadonlyMap<ObjectId, Uint8Array>): ReadonlyArray<readonly [ObjectId, Uint8Array]> =>
  [...objects.entries()].sort(([left], [right]) => left.localeCompare(right))

const bundleIdentityInput = (
  entries: ReadonlyMap<ArtifactId, ArtifactEntry>,
  objects: ReadonlyMap<ObjectId, Uint8Array>
): Uint8Array => new TextEncoder().encode(JSON.stringify({
  artifacts: canonicalArtifacts(entries),
  objects: canonicalObjects(objects).map(([id, bytes]) => ({ id, size: bytes.byteLength }))
}))

const cloneBytes = (bytes: Uint8Array): Uint8Array => Uint8Array.from(bytes)

class BundleDraft {
  private constructor(
    private readonly entries: ReadonlyMap<ArtifactId, ArtifactEntry>,
    private readonly objects: ReadonlyMap<ObjectId, Uint8Array>
  ) {}

  static empty(): BundleDraft {
    return new BundleDraft(new Map(), new Map())
  }

  async add(input: {
    readonly id: ArtifactId
    readonly name: string
    readonly mediaType: string
    readonly executable?: boolean
    readonly bytes: Uint8Array
  }): Promise<Result<BundleDraft, DuplicateArtifactId>> {
    if (this.entries.has(input.id)) {
      return failure(new DuplicateArtifactId(input.id))
    }

    const owned = cloneBytes(input.bytes)
    const object = await sha256(owned) as ObjectId

    const objects = new Map(this.objects)
    const existing = objects.get(object)
    if (existing !== undefined) {
      if (existing.byteLength !== owned.byteLength || existing.some((byte, index) => byte !== owned[index])) {
        throw new Error("sha256 collision or corrupted in-memory object table")
      }
    } else {
      objects.set(object, owned)
    }

    const entries = new Map(this.entries)
    entries.set(input.id, {
      id: input.id,
      name: input.name,
      mediaType: input.mediaType,
      executable: input.executable ?? false,
      object
    })
    return success(new BundleDraft(entries, objects))
  }

  async finalize(): Promise<Bundle> {
    const id = await sha256(bundleIdentityInput(this.entries, this.objects)) as BundleId
    return Bundle.fromValidated(id, this.entries, this.objects)
  }
}

class Bundle {
  private constructor(
    readonly id: BundleId,
    private readonly entries: ReadonlyMap<ArtifactId, ArtifactEntry>,
    private readonly objects: ReadonlyMap<ObjectId, Uint8Array>
  ) {}

  static fromValidated(
    id: BundleId,
    entries: ReadonlyMap<ArtifactId, ArtifactEntry>,
    objects: ReadonlyMap<ObjectId, Uint8Array>
  ): Bundle {
    return new Bundle(
      id,
      new Map(entries),
      new Map([...objects].map(([key, value]) => [key, cloneBytes(value)]))
    )
  }

  static async decode(input: unknown): Promise<Result<Bundle, InvalidBundle>> {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return failure(new InvalidBundle("root must be an object"))
    }
    const raw = input as Partial<EncodedBundle>
    if (raw.format !== "artifact-bundle@probe-1" || typeof raw.id !== "string" ||
      !Array.isArray(raw.artifacts) || !Array.isArray(raw.objects)) {
      return failure(new InvalidBundle("manifest shape is invalid"))
    }

    const objects = new Map<ObjectId, Uint8Array>()
    for (const rawObject of raw.objects) {
      if (typeof rawObject !== "object" || rawObject === null ||
        typeof rawObject.id !== "string" || !Array.isArray(rawObject.bytes) ||
        rawObject.bytes.some((byte: unknown) => typeof byte !== "number" || !Number.isInteger(byte) || byte < 0 || byte > 255)) {
        return failure(new InvalidBundle("object entry is invalid"))
      }
      const bytes = Uint8Array.from(rawObject.bytes)
      const derived = await sha256(bytes)
      if (derived !== rawObject.id) {
        return failure(new InvalidBundle(`object identity mismatch: ${rawObject.id}`))
      }
      const id = derived as ObjectId
      if (objects.has(id)) {
        return failure(new InvalidBundle(`duplicate object id: ${id}`))
      }
      objects.set(id, bytes)
    }

    const entries = new Map<ArtifactId, ArtifactEntry>()
    for (const rawEntry of raw.artifacts) {
      if (typeof rawEntry !== "object" || rawEntry === null ||
        typeof rawEntry.id !== "string" || typeof rawEntry.name !== "string" ||
        typeof rawEntry.mediaType !== "string" || typeof rawEntry.executable !== "boolean" ||
        typeof rawEntry.object !== "string") {
        return failure(new InvalidBundle("artifact entry is invalid"))
      }
      const id = artifactId(rawEntry.id)
      if (entries.has(id)) {
        return failure(new InvalidBundle(`duplicate artifact id: ${rawEntry.id}`))
      }
      if (!objects.has(rawEntry.object as ObjectId)) {
        return failure(new InvalidBundle(`missing object: ${rawEntry.object}`))
      }
      entries.set(id, {
        id,
        name: rawEntry.name,
        mediaType: rawEntry.mediaType,
        executable: rawEntry.executable,
        object: rawEntry.object as ObjectId
      })
    }

    const derivedBundleId = await sha256(bundleIdentityInput(entries, objects))
    if (derivedBundleId !== raw.id) {
      return failure(new InvalidBundle(`bundle identity mismatch: ${raw.id}`))
    }
    return success(Bundle.fromValidated(derivedBundleId as BundleId, entries, objects))
  }

  encode(): EncodedBundle {
    return {
      format: "artifact-bundle@probe-1",
      id: this.id,
      artifacts: canonicalArtifacts(this.entries),
      objects: canonicalObjects(this.objects).map(([id, bytes]) => ({ id, bytes: [...bytes] }))
    }
  }

  artifactIds(): ReadonlyArray<ArtifactId> {
    return canonicalArtifacts(this.entries).map((entry) => entry.id)
  }

  logicalFile(id: ArtifactId): Result<{
    readonly name: string
    readonly mediaType: string
    readonly executable: boolean
    readonly bytes: Uint8Array
  }, InvalidBundle> {
    const entry = this.entries.get(id)
    if (entry === undefined) return failure(new InvalidBundle(`missing artifact: ${id}`))
    const bytes = this.objects.get(entry.object)
    if (bytes === undefined) return failure(new InvalidBundle(`missing object: ${entry.object}`))
    return success({
      name: entry.name,
      mediaType: entry.mediaType,
      executable: entry.executable,
      bytes: cloneBytes(bytes)
    })
  }
}

const expectSuccess = <A, E>(result: Result<A, E>): A => {
  if (result._tag === "Failure") throw result.error
  return result.value
}

const main = async (): Promise<void> => {
  const source = new Uint8Array([1, 2, 3])
  const empty = BundleDraft.empty()
  const one = expectSuccess(await empty.add({
    id: artifactId("one"),
    name: "one.bin",
    mediaType: "application/octet-stream",
    bytes: source
  }))

  source[0] = 99

  const two = expectSuccess(await one.add({
    id: artifactId("two"),
    name: "two.exe",
    mediaType: "application/octet-stream",
    bytes: new Uint8Array([1, 2, 3])
  }))

  const duplicate = await two.add({
    id: artifactId("two"),
    name: "replacement",
    mediaType: "text/plain",
    bytes: new Uint8Array([4])
  })
  if (duplicate._tag !== "Failure" || duplicate.error._tag !== "DuplicateArtifactId") {
    throw new Error("duplicate artifact ID was not rejected")
  }

  const firstFinalization = await two.finalize()
  const repeatedFinalization = await two.finalize()
  if (firstFinalization.id !== repeatedFinalization.id) {
    throw new Error("repeated finalization changed identity")
  }

  const divergent = await one.finalize()
  if (divergent.id === firstFinalization.id) {
    throw new Error("divergent contents shared a bundle identity")
  }

  const oneFile = expectSuccess(firstFinalization.logicalFile(artifactId("one")))
  oneFile.bytes[0] = 77
  const oneAgain = expectSuccess(firstFinalization.logicalFile(artifactId("one")))
  if (oneAgain.bytes[0] !== 1) {
    throw new Error("provider byte mutation escaped into bundle storage")
  }

  const encoded = firstFinalization.encode()
  const decoded = expectSuccess(await Bundle.decode(JSON.parse(JSON.stringify(encoded))))
  if (decoded.id !== firstFinalization.id || decoded.artifactIds().length !== 2) {
    throw new Error("round trip changed the bundle")
  }

  const corrupted: unknown = JSON.parse(JSON.stringify(encoded))
  const mutableCorrupted = corrupted as { objects: Array<{ bytes: number[] }> }
  mutableCorrupted.objects[0]!.bytes[0] = 255
  const corruptionResult = await Bundle.decode(corrupted)
  if (corruptionResult._tag !== "Failure") {
    throw new Error("corrupted bytes passed the load boundary")
  }
}

void main()
