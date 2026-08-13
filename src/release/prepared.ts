import * as Schema from "effect/Schema"
import { encodeCanonicalJson, parseStrictJson } from "../model/canonical.js"
import {
  ArtifactCollectionContract,
  ArtifactCollectionMember,
  cardinalityAccepts,
  cardinalityIssue,
  collectionContractIssue,
  collectionMemberId,
  collectionMemberPath
} from "../model/artifact-collection.js"
import { Sha256Digest } from "../model/digest.js"
import { NonEmptyName, OutputId, SafeRelativePath, Version } from "../model/primitives.js"
import { ExplicitInputSnapshot, StagingSnapshot } from "./context.js"
import {
  CanonicalNpmRegistryEndpoint,
  NpmAccess,
  NpmAuthentication,
  NpmDistTag,
  NpmProvenancePolicy
} from "../recipes/config.js"
import {
  PublicationAuthorityIntent,
  githubPublicationAuthorityIssue,
  npmPublicationAuthorityIssue
} from "./graph.js"

const optional = Schema.optionalKey
const artifactKind = Schema.Literals(["file", "executable", "archive", "package", "digest"])

export class PreparedSource extends Schema.Class<PreparedSource>("PreparedSource")({
  commit: NonEmptyName, tree: NonEmptyName, clean: Schema.Literal(true),
  packageManifestPath: SafeRelativePath, packageManifestDigest: Sha256Digest,
  materialized: StagingSnapshot
}) {}

export class PreparedProject extends Schema.Class<PreparedProject>("PreparedProject")({
  name: NonEmptyName, packageName: optional(NonEmptyName), version: Version, tag: NonEmptyName,
  repository: optional(Schema.NonEmptyString)
}) {}

export class PreparedArtifact extends Schema.Class<PreparedArtifact>("PreparedArtifact")({
  id: OutputId, path: SafeRelativePath, kind: artifactKind, size: Schema.Number.check(
    Schema.makeFilter((value: number) => Number.isSafeInteger(value) && value >= 0
      ? undefined : "Prepared artifact size must be a nonnegative safe integer.")
  ), digest: Sha256Digest, blob: Sha256Digest, mediaType: optional(Schema.NonEmptyString),
  producer: NonEmptyName,
  inputBasis: Sha256Digest
}) {}

/** Durable collection provenance; the graph itself remains ephemeral. */
export class PreparedArtifactCollection
  extends Schema.Class<PreparedArtifactCollection>("PreparedArtifactCollection")({
    contract: ArtifactCollectionContract,
    members: Schema.Array(ArtifactCollectionMember)
  }) {}

export class PreparedExecutionInputs extends Schema.Class<PreparedExecutionInputs>("PreparedExecutionInputs")({
  environment: Schema.Literal("closed"),
  network: Schema.Literal("prohibited"),
  timezone: Schema.Literal("UTC"),
  locale: Schema.Literal("C"),
  clock: Schema.Literal("source-date-epoch=0;host-clock-not-isolated"),
  randomness: Schema.Literal("host-randomness-not-isolated"),
  platform: Schema.NonEmptyString,
  runtime: Schema.NonEmptyString,
  networkIsolation: Schema.NonEmptyString,
  bunCompileRuntimes: Schema.NonEmptyString,
  npmPack: Schema.NonEmptyString,
  releaseGraph: Sha256Digest,
  preparer: Schema.NonEmptyString
}) {}

export class PreparedProvenance extends Schema.Class<PreparedProvenance>("PreparedProvenance")({
  source: StagingSnapshot,
  externalInputs: Schema.Array(ExplicitInputSnapshot),
  execution: PreparedExecutionInputs,
  inputBasis: Sha256Digest,
  reproducibility: Schema.Literal("not-asserted")
}) {}

export class PreparedNpmPublication extends Schema.TaggedClass<PreparedNpmPublication>()("PreparedNpmPublication", {
  id: NonEmptyName,
  artifactId: OutputId,
  packageName: NonEmptyName,
  version: Version,
  registryUrl: CanonicalNpmRegistryEndpoint,
  distTag: NpmDistTag,
  access: NpmAccess,
  authentication: NpmAuthentication,
  provenance: NpmProvenancePolicy,
  authority: PublicationAuthorityIntent
}) {}

export class PreparedGitHubAsset extends Schema.Class<PreparedGitHubAsset>("PreparedGitHubAsset")({
  artifactId: OutputId, name: Schema.NonEmptyString, mediaType: Schema.NonEmptyString
}) {}

export class PreparedGitHubPublication extends Schema.TaggedClass<PreparedGitHubPublication>()("PreparedGitHubPublication", {
  id: NonEmptyName, repository: Schema.NonEmptyString, tag: NonEmptyName, title: NonEmptyName,
  draft: Schema.Boolean, prerelease: Schema.Boolean, targetCommit: NonEmptyName, body: optional(Schema.String),
  assets: Schema.Array(PreparedGitHubAsset), authority: PublicationAuthorityIntent
}) {}

const PreparedPublicationVariants = Schema.Union([
  PreparedNpmPublication, PreparedGitHubPublication
])
export const PreparedPublication = PreparedPublicationVariants.pipe(Schema.check(
  Schema.makeFilter((publication) => publication._tag === "PreparedNpmPublication"
    ? npmPublicationAuthorityIssue(publication)
    : githubPublicationAuthorityIssue(publication))
))
export type PreparedPublication = typeof PreparedPublication.Type

export class PreparedReleaseV2 extends Schema.Class<PreparedReleaseV2>("PreparedReleaseV2")({
  kind: Schema.Literal("complete"),
  schemaVersion: Schema.Literal("prepared-release/v2"), source: PreparedSource, project: PreparedProject,
  provenance: PreparedProvenance,
  artifacts: Schema.Array(PreparedArtifact),
  collections: Schema.Array(PreparedArtifactCollection),
  publications: Schema.Array(PreparedPublication)
}) {}

export class PreparedManifestError
  extends Schema.TaggedErrorClass<PreparedManifestError>()("PreparedManifestError", {
    reason: Schema.String
  }) {}

const assertCompletePreparedRelease = (manifest: PreparedReleaseV2): void => {
  if (manifest.kind !== "complete") throw new Error("prepared manifest kind must be 'complete'")
  if (manifest.source.materialized.digest.hex !== manifest.provenance.source.digest.hex) {
    throw new Error("prepared source materialization must match provenance source")
  }
  for (const publication of manifest.publications) {
    if (publication._tag === "PreparedNpmPublication" &&
      publication.authority.publishStrategy.kind === "trusted-publishing" &&
      publication.authority.publishStrategy.sourceCommit.toString() !== manifest.source.commit.toString()) {
      throw new Error(`prepared npm publication ${publication.id} source commit disagrees with the verified source`)
    }
  }
  for (const artifact of manifest.artifacts) {
    if (artifact.inputBasis.hex !== manifest.provenance.inputBasis.hex) {
      throw new Error(`prepared artifact ${artifact.id} has a foreign input basis`)
    }
  }
  const artifacts = new Map(manifest.artifacts.map((artifact) => [artifact.id.toString(), artifact]))
  const collectionIds = new Set<string>()
  const collectionRoots = new Map<string, string>()
  const collectionProducers = new Set<string>()
  const memberArtifacts = new Set<string>()
  let previousCollection = ""
  for (const collection of manifest.collections) {
    const { contract } = collection
    const id = contract.id.toString()
    if (id <= previousCollection) throw new Error("prepared artifact collections must have unique code-point-sorted ids")
    previousCollection = id
    const foldedId = id.toLocaleLowerCase("en-US")
    if (collectionIds.has(foldedId)) throw new Error(`prepared artifact collection ${id} has a case-colliding id`)
    collectionIds.add(foldedId)
    const foldedRoot = contract.root.toString().toLocaleLowerCase("en-US")
    const overlappingRoot = [...collectionRoots.entries()].find(([root]) =>
      foldedRoot === root || foldedRoot.startsWith(`${root}/`) || root.startsWith(`${foldedRoot}/`))
    if (overlappingRoot !== undefined) {
      throw new Error(`prepared artifact collection ${id} root overlaps collection ${overlappingRoot[1]}`)
    }
    collectionRoots.set(foldedRoot, id)
    if (collectionProducers.has(contract.producer.toString())) {
      throw new Error(`prepared artifact collection ${id} repeats producer ${contract.producer}`)
    }
    collectionProducers.add(contract.producer.toString())
    const issue = cardinalityIssue(contract.cardinality)
    if (issue !== undefined) throw new Error(`prepared artifact collection ${id}: ${issue}`)
    const contractIssue = collectionContractIssue(contract)
    if (contractIssue !== undefined) throw new Error(`prepared artifact collection ${id}: ${contractIssue}`)
    if (!cardinalityAccepts(contract.cardinality, collection.members.length)) {
      throw new Error(`prepared artifact collection ${id} has ${collection.members.length} members outside its declared cardinality`)
    }
    const keys = new Set<string>()
    let previousKey = ""
    for (const member of collection.members) {
      const key = member.key.toString()
      if (key <= previousKey) throw new Error(`prepared artifact collection ${id} member keys must be unique and code-point sorted`)
      previousKey = key
      const foldedKey = key.toLocaleLowerCase("en-US")
      if (keys.has(foldedKey)) throw new Error(`prepared artifact collection ${id} has duplicate normalized member key ${key}`)
      keys.add(foldedKey)
      const expectedId = collectionMemberId(contract, member.key)
      if (member.artifactId !== expectedId) throw new Error(`prepared artifact collection ${id} member ${key} has an invalid stable artifact id`)
      const artifact = artifacts.get(member.artifactId.toString())
      if (artifact === undefined) throw new Error(`prepared artifact collection ${id} member ${key} references no artifact`)
      if (artifact.path !== collectionMemberPath(contract, member.key) || artifact.kind !== contract.artifactKind ||
          artifact.mediaType !== contract.mediaType || artifact.producer.toString() !== contract.producer.toString()) {
        throw new Error(`prepared artifact collection ${id} member ${key} disagrees with its contract`)
      }
      if (memberArtifacts.has(member.artifactId.toString())) {
        throw new Error(`prepared artifact ${member.artifactId} belongs to more than one collection`)
      }
      memberArtifacts.add(member.artifactId.toString())
    }
  }
  for (const artifact of manifest.artifacts) {
    if (collectionProducers.has(artifact.producer.toString()) && !memberArtifacts.has(artifact.id.toString())) {
      throw new Error(`prepared collection producer ${artifact.producer} has unclaimed artifact ${artifact.id}`)
    }
  }
}

export const encodePreparedRelease = (manifest: PreparedReleaseV2): Uint8Array => {
  assertCompletePreparedRelease(manifest)
  return new TextEncoder().encode(encodeCanonicalJson(Schema.encodeSync(PreparedReleaseV2)(manifest)))
}

export const decodePreparedRelease = (bytes: Uint8Array): PreparedReleaseV2 => {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    const value = Schema.decodeUnknownSync(PreparedReleaseV2, { onExcessProperty: "error" })(parseStrictJson(text))
    assertCompletePreparedRelease(value)
    const canonical = encodePreparedRelease(value)
    if (canonical.length !== bytes.length || canonical.some((byte, index) => byte !== bytes[index])) {
      throw new Error("manifest bytes are not canonical")
    }
    return value
  } catch (cause) {
    throw PreparedManifestError.make({ reason: cause instanceof Error ? cause.message : String(cause) })
  }
}
