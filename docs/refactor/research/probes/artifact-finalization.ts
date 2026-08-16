// Disposable research probe. Not production API.
// Question: can finalization, bundle identity, shared bytes, and path hiding be
// represented structurally without separate ambient reader/writer services?

declare const bundleIdBrand: unique symbol
declare const artifactIdBrand: unique symbol
declare const byteObjectIdBrand: unique symbol

type BundleId = string & { readonly [bundleIdBrand]: true }
type ArtifactId = string & { readonly [artifactIdBrand]: true }
type ByteObjectId = string & { readonly [byteObjectIdBrand]: true }

interface ArtifactRef {
  readonly bundleId: BundleId
  readonly artifactId: ArtifactId
}

interface LogicalArtifact {
  readonly ref: ArtifactRef
  readonly name: string
  readonly mediaType: string
  readonly byteObjectId: ByteObjectId
}

interface AddInput {
  readonly artifactId: ArtifactId
  readonly name: string
  readonly mediaType: string
  readonly bytes: Uint8Array
}

interface LogicalFile {
  readonly name: string
  readonly mediaType: string
  readonly bytes: Uint8Array
}

class BundleDraft {
  private constructor(
    private readonly id: BundleId,
    private readonly entries: ReadonlyMap<ArtifactId, LogicalArtifact>,
    private readonly objects: ReadonlyMap<ByteObjectId, Uint8Array>
  ) {}

  static empty(id: BundleId): BundleDraft {
    return new BundleDraft(id, new Map(), new Map())
  }

  add(input: AddInput, byteObjectId: ByteObjectId): BundleDraft {
    const objects = new Map(this.objects)
    objects.set(byteObjectId, input.bytes)

    const entries = new Map(this.entries)
    entries.set(input.artifactId, {
      ref: { bundleId: this.id, artifactId: input.artifactId },
      name: input.name,
      mediaType: input.mediaType,
      byteObjectId
    })

    return new BundleDraft(this.id, entries, objects)
  }

  finalize(): Bundle {
    return new Bundle(this.id, this.entries, this.objects)
  }
}

class Bundle {
  constructor(
    readonly id: BundleId,
    private readonly entries: ReadonlyMap<ArtifactId, LogicalArtifact>,
    private readonly objects: ReadonlyMap<ByteObjectId, Uint8Array>
  ) {}

  resolve(ref: ArtifactRef): LogicalFile {
    if (ref.bundleId !== this.id) {
      throw new Error("wrong bundle")
    }
    const entry = this.entries.get(ref.artifactId)
    if (entry === undefined) {
      throw new Error("missing artifact")
    }
    const bytes = this.objects.get(entry.byteObjectId)
    if (bytes === undefined) {
      throw new Error("missing byte object")
    }
    return {
      name: entry.name,
      mediaType: entry.mediaType,
      bytes
    }
  }
}

const bundleId = "bundle-1" as BundleId
const firstId = "first" as ArtifactId
const secondId = "second" as ArtifactId
const sharedBytes = "sha256-deadbeef" as ByteObjectId
const bytes = new Uint8Array([1, 2, 3])

const draft = BundleDraft.empty(bundleId)
  .add({ artifactId: firstId, name: "one.bin", mediaType: "application/octet-stream", bytes }, sharedBytes)
  .add({ artifactId: secondId, name: "two.exe", mediaType: "application/vnd.microsoft.portable-executable", bytes }, sharedBytes)

const bundle = draft.finalize()

// Write-after-finalization is structurally unavailable.
// @ts-expect-error Bundle intentionally has no add method.
bundle.add({ artifactId: firstId, name: "late", mediaType: "text/plain", bytes }, sharedBytes)

const first = bundle.resolve({ bundleId, artifactId: firstId })
const second = bundle.resolve({ bundleId, artifactId: secondId })

// Two logical artifacts retain distinct names/meaning while sharing bytes.
void [first.name, second.name, first.bytes === second.bytes]

// A provider sees only the logical file. No storage path exists in this type.
function providerUpload(file: LogicalFile): number {
  return file.bytes.byteLength
}

void providerUpload(first)
