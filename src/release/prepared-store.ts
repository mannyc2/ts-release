import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { constants, existsSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, chmodSync, closeSync, fsyncSync } from "node:fs"
import { createHash, randomUUID } from "node:crypto"
import { basename, join } from "node:path"
import { secureRead, secureWrite } from "../drivers/workspace.js"
import { PreparedArtifact, PreparedReleaseV1, decodePreparedRelease, encodePreparedRelease } from "./prepared.js"

export class PreparedStoreError
  extends Schema.TaggedErrorClass<PreparedStoreError>()("PreparedStoreError", { reason: Schema.String }) {}

const hex = /^[a-f0-9]{64}$/u
const hash = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex")
const equal = (left: Uint8Array, right: Uint8Array): boolean => left.length === right.length && left.every((byte, index) => byte === right[index])
const fail = (reason: string): never => { throw PreparedStoreError.make({ reason }) }
const canonicalDirectory = (directory: string): string => {
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true, mode: 0o700 })
  const real = realpathSync(directory)
  if (real !== directory) fail("Prepared store root must not be a symlink.")
  return real
}
const syncDirectory = (directory: string): void => {
  const descriptor = openSync(directory, constants.O_RDONLY)
  try { fsyncSync(descriptor) } finally { closeSync(descriptor) }
}
const artifactsById = (manifest: PreparedReleaseV1): Map<string, PreparedArtifact> => {
  const result = new Map<string, PreparedArtifact>()
  for (const artifact of manifest.artifacts) {
    const id = artifact.id.toString()
    if (result.has(id)) fail(`Prepared manifest repeats artifact ${id}.`)
    if (!hex.test(artifact.digest) || !hex.test(artifact.blob) || artifact.digest !== artifact.blob) {
      fail(`Prepared artifact ${id} does not carry a canonical SHA-256 blob reference.`)
    }
    result.set(id, artifact)
  }
  return result
}
const validatePublications = (manifest: PreparedReleaseV1, artifacts: Map<string, PreparedArtifact>): void => {
  const ids = new Set<string>()
  for (const publication of manifest.publications) {
    if (ids.has(publication.id.toString())) fail(`Prepared manifest repeats publication ${publication.id}.`)
    ids.add(publication.id.toString())
    const references = publication._tag === "PreparedNpmPublication"
      ? [publication.artifactId]
      : publication.assets.map((asset) => asset.artifactId)
    for (const id of references) if (!artifacts.has(id.toString())) fail(`Publication ${publication.id} references missing artifact ${id}.`)
    if (publication._tag === "PreparedGitHubPublication" && publication.body !== undefined && publication.body.length === 0) {
      fail(`GitHub publication ${publication.id} carries an empty body.`)
    }
  }
}

export interface PreparedBundle {
  readonly directory: string
  readonly manifest: PreparedReleaseV1
  readonly blobs: ReadonlyMap<string, Uint8Array>
}

const readBundle = (directory: string): PreparedBundle => {
  const real = realpathSync(directory)
  if (real !== directory || lstatSync(directory).isSymbolicLink()) fail("Prepared bundle directory must not be a symlink.")
  const bytes = secureRead(directory, "prepared-release.json").bytes
  const manifest = decodePreparedRelease(bytes)
  const manifestDigest = hash(bytes)
  if (basename(directory) !== manifestDigest) fail("Prepared bundle directory does not match its manifest digest.")
  const entries = readdirSync(directory, { withFileTypes: true })
  if (entries.some((entry) => entry.name !== "prepared-release.json" && entry.name !== "blobs")) fail("Prepared bundle contains an unexpected top-level entry.")
  const blobDirectory = join(directory, "blobs")
  if (!existsSync(blobDirectory) || lstatSync(blobDirectory).isSymbolicLink() || !statSync(blobDirectory).isDirectory()) fail("Prepared bundle is missing its real blobs directory.")
  const artifacts = artifactsById(manifest)
  validatePublications(manifest, artifacts)
  const expectedBlobs = new Set([...artifacts.values()].map((artifact) => artifact.blob.toString()))
  const actualBlobs = new Set(readdirSync(blobDirectory, { withFileTypes: true }).map((entry) => {
    if (!entry.isFile() || !hex.test(entry.name)) fail(`Prepared blob entry ${entry.name} is invalid.`)
    return entry.name
  }))
  if (actualBlobs.size !== expectedBlobs.size || [...expectedBlobs].some((blob) => !actualBlobs.has(blob))) fail("Prepared bundle blob set does not match its manifest.")
  const blobs = new Map<string, Uint8Array>()
  for (const artifact of artifacts.values()) {
    const blob = secureRead(directory, `blobs/${artifact.blob}`).bytes
    if (blob.length !== artifact.size || hash(blob) !== artifact.digest) fail(`Prepared blob ${artifact.id} failed size or digest verification.`)
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

const writeBundle = (storeDirectory: string, manifest: PreparedReleaseV1, blobs: ReadonlyMap<string, Uint8Array>): PreparedBundle => {
  const store = canonicalDirectory(storeDirectory)
  const manifestBytes = encodePreparedRelease(manifest)
  const manifestDigest = hash(manifestBytes)
  const artifacts = artifactsById(manifest)
  validatePublications(manifest, artifacts)
  for (const artifact of artifacts.values()) {
    const bytes = blobs.get(artifact.id.toString()) ?? fail(`No prepared bytes supplied for artifact ${artifact.id}.`)
    if (bytes.length !== artifact.size || hash(bytes) !== artifact.digest || artifact.blob !== artifact.digest) fail(`Prepared bytes do not match artifact ${artifact.id}.`)
  }
  const finalDirectory = join(store, manifestDigest)
  if (existsSync(finalDirectory)) {
    const existing = readBundle(finalDirectory)
    if (!equal(secureRead(finalDirectory, "prepared-release.json").bytes, manifestBytes)) fail("Existing prepared bundle has a different manifest.")
    return existing
  }
  const temporary = join(store, `.${manifestDigest}.${randomUUID()}.tmp`)
  mkdirSync(join(temporary, "blobs"), { recursive: true, mode: 0o700 })
  try {
    for (const artifact of artifacts.values()) atomicWrite(join(temporary, "blobs"), artifact.blob.toString(), blobs.get(artifact.id.toString())!)
    atomicWrite(temporary, "prepared-release.json", manifestBytes)
    syncDirectory(join(temporary, "blobs"))
    syncDirectory(temporary)
    renameSync(temporary, finalDirectory)
    syncDirectory(store)
  } catch (cause) {
    if (existsSync(temporary)) rmSync(temporary, { recursive: true, force: true })
    if (existsSync(finalDirectory)) return readBundle(finalDirectory)
    if (cause instanceof PreparedStoreError) throw cause
    throw PreparedStoreError.make({ reason: cause instanceof Error ? cause.message : String(cause) })
  }
  return readBundle(finalDirectory)
}

export const storePreparedRelease = Effect.fn("storePreparedRelease")((
  storeDirectory: string, manifest: PreparedReleaseV1, blobs: ReadonlyMap<string, Uint8Array>
) => Effect.try({ try: () => writeBundle(storeDirectory, manifest, blobs), catch: (cause) =>
  cause instanceof PreparedStoreError ? cause : PreparedStoreError.make({ reason: cause instanceof Error ? cause.message : String(cause) })
}))

export const loadPreparedRelease = Effect.fn("loadPreparedRelease")((directory: string) => Effect.try({
  try: () => readBundle(directory),
  catch: (cause) => cause instanceof PreparedStoreError ? cause : PreparedStoreError.make({ reason: cause instanceof Error ? cause.message : String(cause) })
}))
