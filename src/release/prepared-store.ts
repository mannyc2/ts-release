import * as Effect from "effect/Effect"
import * as Context from "effect/Context"
import * as Schema from "effect/Schema"
import { constants, existsSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, chmodSync, closeSync, fsyncSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"
import { secureRead, secureWrite } from "../drivers/workspace.js"
import { digestEquals, sha256Digest, Sha256Hex } from "../model/digest.js"
import { PreparedArtifact, PreparedReleaseV2, decodePreparedRelease, encodePreparedRelease } from "./prepared.js"
import { CompletePreparedReleaseRef, makeLocalCompletePreparedReleaseRef } from "./prepared-ref.js"

export class PreparedStoreError
  extends Schema.TaggedErrorClass<PreparedStoreError>()("PreparedStoreError", { reason: Schema.String }) {}

export class PreparedStoreProvenanceError
  extends Schema.TaggedErrorClass<PreparedStoreProvenanceError>()("PreparedStoreProvenanceError", {
    scheme: Schema.Literals(["local", "gha"]),
    reason: Schema.String
  }) {}

export class LocalPreparedStoreProvenance
  extends Schema.TaggedClass<LocalPreparedStoreProvenance>()("LocalPreparedStoreProvenance", {
    scheme: Schema.Literal("local"),
    filesystemRoot: Schema.NonEmptyString,
    operatorBoundary: Schema.NonEmptyString
  }) {}

export class GitHubActionsPreparedStoreProvenance
  extends Schema.TaggedClass<GitHubActionsPreparedStoreProvenance>()("GitHubActionsPreparedStoreProvenance", {
    scheme: Schema.Literal("gha"),
    repository: Schema.NonEmptyString,
    workflowRef: Schema.NonEmptyString,
    workflowSha: Schema.NonEmptyString,
    runId: Schema.NonEmptyString,
    attempt: Schema.NonEmptyString,
    candidateCommit: Schema.NonEmptyString,
    artifactName: Schema.NonEmptyString,
    artifactDigest: Schema.NonEmptyString,
    allowedWriter: Schema.Literal("repository-workflow")
  }) {}

export const PreparedStoreProvenance = Schema.Union([
  LocalPreparedStoreProvenance,
  GitHubActionsPreparedStoreProvenance
])
export type PreparedStoreProvenance = typeof PreparedStoreProvenance.Type

const canonicalPathEquals = (left: string, right: string): boolean => {
  try { return realpathSync(left) === realpathSync(right) } catch { return false }
}

/**
 * GitHub artifact lookup is name-based and may span every rerun attempt in a
 * workflow run. Bind the attempt as well as the content digest so an older
 * prepared reference cannot be shadowed by a newer rerun's duplicate name.
 */
export const githubActionsPreparedArtifactName = (attempt: string, digest: string): string =>
  `ts-release-prepared-${attempt}-${digest}`

export const verifyPreparedStoreProvenance = Effect.fn("verifyPreparedStoreProvenance")(function*(input: {
  readonly reference: CompletePreparedReleaseRef
  readonly bundle: PreparedBundle
  readonly evidence: PreparedStoreProvenance
}) {
  if (input.reference.kind !== "complete" || input.bundle.manifest.kind !== "complete") {
    return yield* new PreparedStoreProvenanceError({
      scheme: input.reference.scheme,
      reason: "Prepared store provenance verifies only complete references and bundles."
    })
  }
  const digest = sha256Digest(encodePreparedRelease(input.bundle.manifest)).hex
  if (digest !== input.reference.digest.toString()) {
    return yield* new PreparedStoreProvenanceError({
      scheme: input.reference.scheme,
      reason: "Prepared reference digest does not match canonical complete-bundle contents."
    })
  }
  if (input.reference.scheme === "local") {
    if (input.evidence.scheme !== "local" || input.evidence.filesystemRoot.trim().length === 0 ||
        input.evidence.operatorBoundary.trim().length === 0 ||
        !canonicalPathEquals(input.evidence.filesystemRoot, dirname(input.bundle.directory))) {
      return yield* new PreparedStoreProvenanceError({
        scheme: "local",
        reason: "Local prepared bytes require an explicit filesystem/operator trust boundary."
      })
    }
    return input.evidence
  }
  if (input.evidence.scheme !== "gha") {
    return yield* new PreparedStoreProvenanceError({
      scheme: "gha",
      reason: "Local evidence cannot be promoted into GitHub Actions trust by copying bytes or a digest."
    })
  }
  const coordinate = `${input.reference.owner}/${input.reference.repository}`
  const mismatches = [
    input.evidence.repository !== coordinate ? "repository" : undefined,
    input.evidence.runId !== input.reference.runId.toString() ? "runId" : undefined,
    input.evidence.attempt !== input.reference.attempt.toString() ? "attempt" : undefined,
    input.evidence.candidateCommit !== input.bundle.manifest.source.commit.toString() ? "candidateCommit" : undefined,
    input.evidence.artifactName !== input.reference.artifactName.toString() ? "artifactName" : undefined,
    input.evidence.artifactDigest !== input.reference.digest.toString() ? "artifactDigest" : undefined,
    !input.evidence.workflowRef.startsWith(`${coordinate}/.github/workflows/`) ||
      !input.evidence.workflowRef.includes("@refs/") ? "workflowRef" : undefined,
    !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(input.evidence.workflowSha) ? "workflowSha" : undefined,
    input.reference.artifactName.toString() !== githubActionsPreparedArtifactName(
      input.reference.attempt.toString(),
      input.reference.digest.toString()
    ) ? "immutableArtifactName" : undefined
  ].filter((field): field is string => field !== undefined)
  if (mismatches.length > 0) {
    return yield* new PreparedStoreProvenanceError({
      scheme: "gha",
      reason: `Hosted prepared-store provenance mismatched ${mismatches.join(", ")}.`
    })
  }
  return input.evidence
})

/**
 * The bytes are already durable and verified, but the host failed to expose
 * their recovery reference before publication could continue. This is a
 * post-commit abort, never a preparation failure.
 */
export class PreparedCommitHandoffError
  extends Schema.TaggedErrorClass<PreparedCommitHandoffError>()("PreparedCommitHandoffError", {
    prepared: CompletePreparedReleaseRef,
    reason: Schema.String
  }) {}

export const PreparedStoreFaultPoint = Schema.Literals([
  "before-blob-write",
  "after-blob-write",
  "before-manifest-write",
  "after-manifest-write",
  "before-blob-directory-fsync",
  "after-blob-directory-fsync",
  "before-bundle-directory-fsync",
  "after-bundle-directory-fsync",
  "before-promotion",
  "after-promotion",
  "before-store-fsync",
  "after-store-fsync",
  "before-cleanup",
  "after-cleanup"
])
export type PreparedStoreFaultPoint = typeof PreparedStoreFaultPoint.Type

/** Host-only fault seam used to prove the atomic store protocol. */
export interface PreparedStoreOptions {
  readonly onFaultPoint?: (point: PreparedStoreFaultPoint) => void
}

const equal = (left: Uint8Array, right: Uint8Array): boolean => left.length === right.length && left.every((byte, index) => byte === right[index])
const fail = (reason: string): never => { throw PreparedStoreError.make({ reason }) }
const causeReason = (cause: unknown): string =>
  typeof cause === "object" && cause !== null && "reason" in cause && typeof cause.reason === "string"
    ? cause.reason
    : cause instanceof Error
    ? cause.message
    : String(cause)
const canonicalDirectory = (directory: string): string => {
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true, mode: 0o700 })
  if (lstatSync(directory).isSymbolicLink()) fail("Prepared store root must not be a symlink.")
  const real = realpathSync(directory)
  if (!lstatSync(real).isDirectory()) fail("Prepared store root must be a directory.")
  return real
}
const syncDirectory = (directory: string): void => {
  const descriptor = openSync(directory, constants.O_RDONLY)
  try { fsyncSync(descriptor) } finally { closeSync(descriptor) }
}
const artifactsById = (manifest: PreparedReleaseV2): Map<string, PreparedArtifact> => {
  if (manifest.kind !== "complete") fail("Prepared store accepts only a kind:'complete' publication bundle.")
  const result = new Map<string, PreparedArtifact>()
  for (const artifact of manifest.artifacts) {
    const id = artifact.id.toString()
    if (result.has(id)) fail(`Prepared manifest repeats artifact ${id}.`)
    if (!digestEquals(artifact.digest, artifact.blob)) {
      fail(`Prepared artifact ${id} does not carry a canonical SHA-256 blob reference.`)
    }
    result.set(id, artifact)
  }
  return result
}
const validatePublications = (manifest: PreparedReleaseV2, artifacts: Map<string, PreparedArtifact>): void => {
  const ids = new Set<string>()
  const npmCoordinates = new Set<string>()
  const npmArtifacts = new Set<string>()
  for (const publication of manifest.publications) {
    const publicationId = publication.id.toString().toLocaleLowerCase("en-US")
    if (ids.has(publicationId)) fail(`Prepared manifest repeats or case-collides publication ${publication.id}.`)
    ids.add(publicationId)
    const references = publication._tag === "PreparedNpmPublication"
      ? [publication.artifactId]
      : publication._tag === "PreparedPyPiPublication"
      ? publication.files.map((file) => file.artifactId)
      : publication._tag === "PreparedGitHubPublication"
      ? publication.assets.map((asset) => asset.artifactId)
      : [publication.targetArtifactId, publication.stateArtifactId]
    for (const id of references) if (!artifacts.has(id.toString())) fail(`Publication ${publication.id} references missing artifact ${id}.`)
    if (publication._tag === "PreparedNpmPublication") {
      const coordinate = `${publication.packageName.toString().toLocaleLowerCase("en-US")}@${publication.version}`
      if (npmCoordinates.has(coordinate)) fail(`Prepared npm publication ${publication.id} repeats coordinate ${coordinate}.`)
      npmCoordinates.add(coordinate)
      const artifactId = publication.artifactId.toString()
      if (npmArtifacts.has(artifactId)) fail(`Prepared npm publication ${publication.id} repeats tarball artifact ${artifactId}.`)
      npmArtifacts.add(artifactId)
      const artifact = artifacts.get(artifactId)!
      if ((artifact.kind !== "archive" && artifact.kind !== "package") || artifact.mediaType !== "application/gzip" ||
          !artifact.path.toString().endsWith(".tgz") || !digestEquals(artifact.digest, artifact.blob)) {
        fail(`Prepared npm publication ${publication.id} does not bind one exact gzip tarball artifact.`)
      }
    }
    if (publication._tag === "PreparedPyPiPublication") for (const file of publication.files) {
      const artifact = artifacts.get(file.artifactId.toString())!
      if (artifact.size !== file.size || !digestEquals(artifact.digest, file.sha256) ||
          artifact.mediaType !== file.mediaType || artifact.path.toString().split("/").at(-1) !== file.filename.toString()) {
        fail(`PyPI publication ${publication.id} file ${file.filename} disagrees with its prepared artifact.`)
      }
    }
    if (publication._tag === "PreparedGitHubPublication" && publication.body !== undefined && publication.body.length === 0) {
      fail(`GitHub publication ${publication.id} carries an empty body.`)
    }
  }
}

export interface PreparedBundle {
  readonly directory: string
  readonly manifest: PreparedReleaseV2
  readonly blobs: ReadonlyMap<string, Uint8Array>
}

export interface CommittedPreparedRelease {
  readonly ref: CompletePreparedReleaseRef
  readonly bundle: PreparedBundle
}

const readBundle = (directory: string): PreparedBundle => {
  if (lstatSync(directory).isSymbolicLink()) fail("Prepared bundle directory must not be a symlink.")
  const real = realpathSync(directory)
  const bytes = secureRead(real, "prepared-release.json").bytes
  const manifest = decodePreparedRelease(bytes)
  if (manifest.kind !== "complete") fail("Prepared store refuses every unknown or partial bundle kind.")
  const manifestDigest = sha256Digest(bytes).hex
  if (basename(real) !== manifestDigest) fail("Prepared bundle directory does not match its manifest digest.")
  const entries = readdirSync(real, { withFileTypes: true })
  if (entries.some((entry) => entry.name !== "prepared-release.json" && entry.name !== "blobs")) fail("Prepared bundle contains an unexpected top-level entry.")
  const blobDirectory = join(real, "blobs")
  if (!existsSync(blobDirectory) || lstatSync(blobDirectory).isSymbolicLink() || !statSync(blobDirectory).isDirectory()) fail("Prepared bundle is missing its real blobs directory.")
  const artifacts = artifactsById(manifest)
  validatePublications(manifest, artifacts)
  const expectedBlobs = new Set([...artifacts.values()].map((artifact) => artifact.blob.hex))
  const actualBlobs = new Set(readdirSync(blobDirectory, { withFileTypes: true }).map((entry) => {
    if (!entry.isFile() || !Schema.is(Sha256Hex)(entry.name)) fail(`Prepared blob entry ${entry.name} is invalid.`)
    return entry.name
  }))
  if (actualBlobs.size !== expectedBlobs.size || [...expectedBlobs].some((blob) => !actualBlobs.has(blob))) fail("Prepared bundle blob set does not match its manifest.")
  const blobs = new Map<string, Uint8Array>()
  for (const artifact of artifacts.values()) {
    const blob = secureRead(real, `blobs/${artifact.blob.hex}`).bytes
    if (blob.length !== artifact.size || !digestEquals(sha256Digest(blob), artifact.digest)) fail(`Prepared blob ${artifact.id} failed size or digest verification.`)
    blobs.set(artifact.id.toString(), new Uint8Array(blob))
  }
  return { directory: real, manifest, blobs }
}

const atomicWrite = (directory: string, target: string, bytes: Uint8Array): void => {
  const temporary = `${target}.${randomUUID()}.tmp`
  secureWrite(directory, temporary, bytes)
  renameSync(join(directory, temporary), join(directory, target))
  chmodSync(join(directory, target), 0o400)
}

const writeBundle = (
  storeDirectory: string,
  manifest: PreparedReleaseV2,
  blobs: ReadonlyMap<string, Uint8Array>,
  options: PreparedStoreOptions = {}
): PreparedBundle => {
  const fault = options.onFaultPoint ?? (() => undefined)
  const store = canonicalDirectory(storeDirectory)
  const manifestBytes = encodePreparedRelease(manifest)
  if (manifest.kind !== "complete") fail("Prepared store commits only a kind:'complete' publication bundle.")
  const manifestDigest = sha256Digest(manifestBytes).hex
  const artifacts = artifactsById(manifest)
  validatePublications(manifest, artifacts)
  for (const artifact of artifacts.values()) {
    const bytes = blobs.get(artifact.id.toString()) ?? fail(`No prepared bytes supplied for artifact ${artifact.id}.`)
    if (bytes.length !== artifact.size || !digestEquals(sha256Digest(bytes), artifact.digest) || !digestEquals(artifact.blob, artifact.digest)) fail(`Prepared bytes do not match artifact ${artifact.id}.`)
  }
  const finalDirectory = join(store, manifestDigest)
  if (existsSync(finalDirectory)) {
    const existing = readBundle(finalDirectory)
    if (!equal(secureRead(finalDirectory, "prepared-release.json").bytes, manifestBytes)) fail("Existing prepared bundle has a different manifest.")
    return existing
  }
  const temporary = join(store, `.${manifestDigest}.${randomUUID()}.tmp`)
  mkdirSync(join(temporary, "blobs"), { recursive: true, mode: 0o700 })
  let promoted = false
  try {
    for (const artifact of artifacts.values()) {
      fault("before-blob-write")
      atomicWrite(join(temporary, "blobs"), artifact.blob.hex, blobs.get(artifact.id.toString())!)
      fault("after-blob-write")
    }
    fault("before-manifest-write")
    atomicWrite(temporary, "prepared-release.json", manifestBytes)
    fault("after-manifest-write")
    fault("before-blob-directory-fsync")
    syncDirectory(join(temporary, "blobs"))
    fault("after-blob-directory-fsync")
    fault("before-bundle-directory-fsync")
    syncDirectory(temporary)
    fault("after-bundle-directory-fsync")
    fault("before-promotion")
    renameSync(temporary, finalDirectory)
    promoted = true
    fault("after-promotion")
    fault("before-store-fsync")
    syncDirectory(store)
    fault("after-store-fsync")
  } catch (cause) {
    let cleanupFailure: unknown
    if (existsSync(temporary)) {
      try {
        fault("before-cleanup")
        rmSync(temporary, { recursive: true, force: true })
        fault("after-cleanup")
      } catch (cleanupCause) {
        cleanupFailure = cleanupCause
      }
    }
    if (!promoted && existsSync(finalDirectory)) {
      const existing = readBundle(finalDirectory)
      if (!equal(secureRead(finalDirectory, "prepared-release.json").bytes, manifestBytes)) {
        fail("Concurrent prepared-store promotion produced a different manifest.")
      }
      return existing
    }
    if (cleanupFailure !== undefined) {
      throw PreparedStoreError.make({
        reason: `Prepared-store cleanup failed after ${cause instanceof Error ? cause.message : String(cause)}: ${cleanupFailure instanceof Error ? cleanupFailure.message : String(cleanupFailure)}`
      })
    }
    if (cause instanceof PreparedStoreError) throw cause
    throw PreparedStoreError.make({ reason: cause instanceof Error ? cause.message : String(cause) })
  }
  return readBundle(finalDirectory)
}

export const storePreparedRelease = Effect.fn("storePreparedRelease")((
  storeDirectory: string,
  manifest: PreparedReleaseV2,
  blobs: ReadonlyMap<string, Uint8Array>,
  options?: PreparedStoreOptions
) => Effect.try({ try: () => writeBundle(storeDirectory, manifest, blobs, options), catch: (cause) =>
  cause instanceof PreparedStoreError ? cause : PreparedStoreError.make({ reason: causeReason(cause) })
}))

export const loadPreparedRelease = Effect.fn("loadPreparedRelease")((directory: string) => Effect.try({
  try: () => readBundle(directory),
  catch: (cause) => cause instanceof PreparedStoreError ? cause : PreparedStoreError.make({ reason: causeReason(cause) })
}))

/** The durable store boundary used by coordinators and host projections. */
export interface PreparedReleaseStoreShape {
  readonly commit: (
    manifest: PreparedReleaseV2,
    blobs: ReadonlyMap<string, Uint8Array>
  ) => Effect.Effect<CommittedPreparedRelease, PreparedStoreError | PreparedCommitHandoffError>
  readonly load: (reference: CompletePreparedReleaseRef) => Effect.Effect<PreparedBundle, PreparedStoreError>
}

export class PreparedReleaseStore
  extends Context.Service<PreparedReleaseStore, PreparedReleaseStoreShape>()("ts-release/PreparedReleaseStore") {}

/** A local store resolves digest-only references against one explicit root. */
export const makeLocalPreparedReleaseStore = (
  storeDirectory: string,
  options?: PreparedStoreOptions
): PreparedReleaseStoreShape => ({
  commit: (manifest, blobs) => storePreparedRelease(storeDirectory, manifest, blobs, options).pipe(
    Effect.flatMap((bundle) => makeLocalCompletePreparedReleaseRef(basename(bundle.directory)).pipe(
      Effect.map((ref) => ({ ref, bundle })),
      Effect.mapError((cause) => PreparedStoreError.make({ reason: cause.reason }))
    ))
  ),
  load: (reference) => reference.scheme === "local"
    ? loadPreparedRelease(join(storeDirectory, reference.digest))
    : Effect.fail(PreparedStoreError.make({
      reason: "A GitHub Actions prepared reference is not loadable by the local store; rerun the failed workflow publish job or dispatch its recovery workflow."
    }))
})
