import { Crypto, Effect, FileSystem, Path, PlatformError, Schema } from "effect"
import * as Artifact from "effect-build/Artifact"
import { SystemTarget } from "effect-build/SystemTarget"
import * as Tree from "effect-build/Author/Tree"

const Decimal = Schema.String.check(Schema.isPattern(/^(0|[1-9][0-9]*)$/))
const Sha256 = Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/))
export class AdoptionError extends Schema.TaggedError<AdoptionError>()("AdoptionError", {
  reason: Schema.String
}) {}
export class Content extends Schema.Class<Content>("lab/Content")({
  bytes: Decimal, sha256: Sha256
}) {}
export interface ContentOwner {
  /** Copy the argument before retaining it; return identity of the stored copy. */
  readonly putOwned: (bytes: Uint8Array) => Effect.Effect<Content, AdoptionError>
  /** Copy a regular file in fixed chunks, checking its exact decimal size and SHA-256. */
  readonly putFileOwned: (source: Artifact.HashedFile | Artifact.HashedExecutable) => Effect.Effect<Content, AdoptionError>
  readonly verify: (content: Content) => Effect.Effect<void, AdoptionError>
  readonly read: (content: Content) => Effect.Effect<Uint8Array, AdoptionError>
}
export const MAX_BUFFERED_TREE_BYTES = 512n * 1024n * 1024n
export const MAX_TREE_ENTRIES = 100_000
export class OwnedFile extends Schema.TaggedClass<OwnedFile>()("OwnedFile", {
  logicalName: Artifact.PortableRelativePath, content: Content,
  deliveryMode: Artifact.FileModeSchema,
  executable: Schema.NullOr(Schema.Struct({nativeFormat:Schema.Literals(["elf","mach-o","pe"]),runtime:Schema.Struct({name:Schema.NonEmptyString,version:Schema.NonEmptyString}),target:SystemTarget})),
  provenance: Artifact.ProvenanceSchema
}) {}
export class TreeFile extends Schema.TaggedClass<TreeFile>()("TreeFile", {
  relativePath: Artifact.PortableRelativePath, mode: Artifact.FileModeSchema, content: Content
}) {}
export class TreeDirectory extends Schema.TaggedClass<TreeDirectory>()("TreeDirectory", {
  relativePath: Artifact.PortableRelativePath, mode: Artifact.FileModeSchema
}) {}
export class TreeLink extends Schema.TaggedClass<TreeLink>()("TreeLink", {
  relativePath: Artifact.PortableRelativePath, target: Schema.String
}) {}
const Entry = Schema.Union([TreeFile, TreeDirectory, TreeLink])
export class OwnedTree extends Schema.TaggedClass<OwnedTree>()("OwnedTree", {
  logicalName: Artifact.PortableRelativePath, rootMode: Artifact.FileModeSchema,
  totalBytes: Decimal, upstreamManifestSha256: Sha256, entries: Schema.Array(Entry),provenance: Artifact.ProvenanceSchema
}) {}
export const OwnedArtifact = Schema.Union([OwnedFile, OwnedTree])
export type OwnedArtifact = typeof OwnedArtifact.Type
export class OwnedBundle extends Schema.Class<OwnedBundle>("lab/OwnedBundle")({
  format: Schema.Literal("lab/owned-bundle/1"), artifacts: Schema.Array(OwnedArtifact)
}) {}

const freeze = <A>(value: A): A => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}

const same = (content: Content, expected: Artifact.HashedFileIdentity) =>
  content.bytes === expected.bytes && content.sha256 === expected.digest.value

/** Research adapter: upstream access is scoped; release storage owns a distinct copy. */
export const adoptFile = Effect.fn("lab.adoptFile")(function*(
  owner: ContentOwner, logicalName: string, source: Artifact.HashedFile | Artifact.HashedExecutable
) {
  source = freeze(JSON.parse(JSON.stringify(source)))
  const name = yield* Schema.decodeUnknownEffect(Artifact.PortableRelativePath)(logicalName)
  if (!Artifact.isHashedFile(source) && !Artifact.isHashedExecutable(source)) {
    return yield* new AdoptionError({ reason: "source is not a finalized hashed file or executable" })
  }
  const content = yield* owner.putFileOwned(source)
  if (!same(content, source)) return yield* new AdoptionError({ reason: "adopted identity mismatch" })
  return new OwnedFile({ logicalName: name, content, executable:Artifact.isHashedExecutable(source)?{nativeFormat:source.nativeFormat,runtime:source.runtime,target:source.target}:null,
    deliveryMode:Artifact.fileMode(Artifact.isHashedExecutable(source)?0o755:0o644),provenance:source.provenance })
})

export const adoptTree = Effect.fn("lab.adoptTree")(function*(
  owner: ContentOwner, logicalName: string, source: Artifact.HashedTree
) {
  source = freeze(JSON.parse(JSON.stringify(source)))
  const name = yield* Schema.decodeUnknownEffect(Artifact.PortableRelativePath)(logicalName)
  if (!Artifact.isHashedTree(source)) return yield* new AdoptionError({ reason: "invalid hashed tree" })
  if(BigInt(source.totalBytes)>MAX_BUFFERED_TREE_BYTES||source.entries.length>MAX_TREE_ENTRIES) {
    return yield* new AdoptionError({reason:"tree exceeds the admitted 512 MiB / 100,000 entry snapshot capacity"})
  }
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const crypto = yield* Crypto.Crypto
  // Upstream capture reads twice (source and rebuilt private snapshot). Bound
  // actual bytes too, so a growing/tampered tree cannot bypass its declaration.
  let remaining=2n*BigInt(source.totalBytes)
  let remainingEntries=2*source.entries.length
  const boundedFileSystem:FileSystem.FileSystem={...fs,readDirectory:(directory)=>Effect.gen(function*(){
    const names=yield* fs.readDirectory(directory);remainingEntries-=names.length
    if(remainingEntries<0)return yield* PlatformError.badArgument({module:"artifact-adoption",method:"readDirectory",description:"tree entry count changed beyond admitted budget"})
    return names
  }),readFile:(fileName)=>Effect.scoped(Effect.gen(function*(){
    const file=yield* fs.open(fileName)
    const chunks:Uint8Array[]=[];let length=0
    for(;;){
      const buffer=new Uint8Array(64*1024),size=yield* file.read(buffer)
      if(size===0n)break
      remaining-=size
      if(remaining<0n)return yield* PlatformError.badArgument({module:"artifact-adoption",method:"readFile",description:"tree changed beyond its admitted byte budget"})
      const chunk=buffer.slice(0,Number(size));length+=chunk.length;chunks.push(chunk)
    }
    const result=new Uint8Array(length);let offset=0
    for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length}
    return result
  }))}
  // The upstream shape guard does not bind supplied entries to manifestDigest.
  // Preserve the upstream ordered preimage; generic key sorting changes its ID.
  const manifest = JSON.stringify({rootMode:source.rootMode,totalBytes:source.totalBytes,entries:source.entries})
  const digest = yield* crypto.digest("SHA-256",new TextEncoder().encode(manifest))
  const hex = Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("")
  if (hex !== source.manifestDigest.value) return yield* new AdoptionError({reason:"manifest entries do not match digest"})
  return yield* Tree.withVerifiedSnapshot(source, (snapshot) => Effect.gen(function*() {
    const entries: Array<typeof Entry.Type> = []
    for (const entry of source.entries) {
      if (entry.kind === "directory") entries.push(new TreeDirectory(entry))
      else if (entry.kind === "symbolic-link") entries.push(new TreeLink(entry))
      else {
        const bytes = yield* fs.readFile(path.join(snapshot, ...entry.relativePath.split("/")))
        const content = yield* owner.putOwned(bytes)
        if (content.bytes !== entry.bytes || content.sha256 !== entry.digest.value) {
          return yield* new AdoptionError({ reason: "tree content identity mismatch" })
        }
        entries.push(new TreeFile({relativePath:entry.relativePath,mode:entry.mode,content}))
      }
    }
    return new OwnedTree({logicalName:name,rootMode:source.rootMode,totalBytes:source.totalBytes,
      upstreamManifestSha256:source.manifestDigest.value,entries,provenance:source.provenance})
  })).pipe(Effect.provideService(FileSystem.FileSystem,boundedFileSystem))
})

/** No ingestion methods or mutable builder escape this finalization boundary. */
export const finalize = Effect.fn("lab.finalize")(function*(artifacts: readonly OwnedArtifact[]) {
  const names = new Set<string>()
  for (const artifact of artifacts) {
    const name = artifact.logicalName.toLowerCase()
    if (names.has(name)) return yield* new AdoptionError({reason:`duplicate logical name: ${artifact.logicalName}`})
    names.add(name)
  }
  // Schema roundtrip severs caller-owned object/array aliases.
  const encoded = JSON.stringify(yield* Schema.encodeEffect(Schema.Array(OwnedArtifact))(artifacts))
  const copied = yield* Schema.decodeUnknownEffect(Schema.Array(OwnedArtifact))(JSON.parse(encoded))
  return freeze(new OwnedBundle({format:"lab/owned-bundle/1",artifacts:copied}))
})
