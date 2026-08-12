import artifactClient, { type ArtifactClient } from "@actions/artifact"
import * as Effect from "effect/Effect"
import {
  cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { basename, join, relative } from "node:path"
import {
  makeGitHubActionsCompletePreparedReleaseRef,
  type CompletePreparedReleaseRef
} from "@mannyc1/ts-release"
import {
  loadPreparedRelease, makeLocalPreparedReleaseStore, PreparedCommitHandoffError, PreparedStoreError,
  type PreparedReleaseStoreShape
} from "../../../src/release/prepared-store.js"

const digestPattern = /^sha256:[a-f0-9]{64}$/u

export interface ActionProducerContext {
  readonly repository: string
  readonly workflowRef: string
  readonly workflowSha: string
  readonly runId: string
  readonly runAttempt: string
  readonly candidateCommit: string
}

export type ActionEnvironment = Readonly<Record<string, string | undefined>>

const requiredEnvironment = (environment: ActionEnvironment, name: string): string => {
  const value = environment[name]?.trim()
  if (value === undefined || value.length === 0) {
    throw PreparedStoreError.make({ reason: `${name} is required to authenticate the Action producer context.` })
  }
  return value
}

/** Reads the GitHub producer identity once, at the Action entry boundary. */
export const actionProducerContextFromEnvironment = (
  environment: ActionEnvironment
): ActionProducerContext => {
  const repository = requiredEnvironment(environment, "GITHUB_REPOSITORY")
  const workflowRef = requiredEnvironment(environment, "GITHUB_WORKFLOW_REF")
  const workflowSha = requiredEnvironment(environment, "GITHUB_WORKFLOW_SHA")
  const runId = requiredEnvironment(environment, "GITHUB_RUN_ID")
  const runAttempt = requiredEnvironment(environment, "GITHUB_RUN_ATTEMPT")
  const candidateCommit = requiredEnvironment(environment, "GITHUB_SHA")
  splitRepository(repository)
  if (!workflowRef.startsWith(`${repository}/.github/workflows/`) || !workflowRef.includes("@refs/")) {
    throw PreparedStoreError.make({ reason: "GITHUB_WORKFLOW_REF is outside the current repository workflow-writer boundary." })
  }
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(workflowSha) ||
    !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(candidateCommit)) {
    throw PreparedStoreError.make({ reason: "GitHub workflow and candidate commits must be canonical Git object ids." })
  }
  if (!/^[1-9][0-9]*$/u.test(runId) || !/^[1-9][0-9]*$/u.test(runAttempt)) {
    throw PreparedStoreError.make({ reason: "GitHub run id and attempt must be canonical positive decimal strings." })
  }
  return { repository, workflowRef, workflowSha, runId, runAttempt, candidateCommit }
}

export interface ActionArtifactTransport {
  readonly upload: (input: {
    readonly name: string
    readonly files: ReadonlyArray<string>
    readonly rootDirectory: string
  }) => Promise<{ readonly id?: number, readonly digest?: string }>
  readonly download: (input: {
    readonly name: string
    readonly destination: string
  }) => Promise<{ readonly path?: string, readonly digestMismatch?: boolean }>
}

export const makeActionsArtifactTransport = (
  client: ArtifactClient = artifactClient
): ActionArtifactTransport => ({
  upload: ({ name, files, rootDirectory }) => client.uploadArtifact(
    name, [...files], rootDirectory, { compressionLevel: 0 }
  ),
  download: async ({ name, destination }) => {
    const found = await client.getArtifact(name)
    return client.downloadArtifact(found.artifact.id, {
      path: destination,
      ...(found.artifact.digest === undefined ? {} : { expectedHash: found.artifact.digest })
    })
  }
})

interface ProducerRecord extends ActionProducerContext {
  readonly schemaVersion: "ts-release-action-producer/v1"
  readonly artifactName: string
  readonly preparedDigest: string
}

const producerBytes = (record: ProducerRecord): string => `${JSON.stringify({
  schemaVersion: record.schemaVersion,
  repository: record.repository,
  workflowRef: record.workflowRef,
  workflowSha: record.workflowSha,
  runId: record.runId,
  runAttempt: record.runAttempt,
  candidateCommit: record.candidateCommit,
  artifactName: record.artifactName,
  preparedDigest: record.preparedDigest
})}\n`

const decodeProducer = (bytes: string): ProducerRecord => {
  let value: unknown
  try { value = JSON.parse(bytes) } catch { throw PreparedStoreError.make({ reason: "Action producer context is not valid JSON." }) }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw PreparedStoreError.make({ reason: "Action producer context must be an object." })
  }
  const record = value as Record<string, unknown>
  const fields = [
    "schemaVersion", "repository", "workflowRef", "workflowSha", "runId",
    "runAttempt", "candidateCommit", "artifactName", "preparedDigest"
  ] as const
  if (Object.keys(record).sort().join("\0") !== [...fields].sort().join("\0") ||
    record.schemaVersion !== "ts-release-action-producer/v1" ||
    fields.slice(1).some((field) => typeof record[field] !== "string" || (record[field] as string).length === 0)) {
    throw PreparedStoreError.make({ reason: "Action producer context has an invalid or unexpected shape." })
  }
  const decoded = record as unknown as ProducerRecord
  if (producerBytes(decoded) !== bytes) throw PreparedStoreError.make({ reason: "Action producer context is not canonical." })
  return decoded
}

const allFiles = (root: string): ReadonlyArray<string> => {
  const result: string[] = []
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.isFile()) result.push(path)
      else throw PreparedStoreError.make({ reason: `Action artifact staging refuses non-file entry ${relative(root, path)}.` })
    }
  }
  walk(root)
  return result.sort()
}

const splitRepository = (repository: string): { readonly owner: string, readonly name: string } => {
  const match = /^([^/]+)\/([^/]+)$/u.exec(repository)
  if (match === null) throw PreparedStoreError.make({ reason: "GITHUB_REPOSITORY must be an owner/name coordinate." })
  return { owner: match[1]!, name: match[2]! }
}

const verifyReferenceContext = (reference: CompletePreparedReleaseRef, context: ActionProducerContext): void => {
  if (reference.scheme !== "gha") return
  const repository = splitRepository(context.repository)
  if (reference.owner !== repository.owner || reference.repository !== repository.name || reference.runId !== context.runId) {
    throw PreparedStoreError.make({ reason: "Hosted prepared reference is outside this Action repository/run trust boundary." })
  }
  if (reference.artifactName !== `ts-release-prepared-${reference.digest}`) {
    throw PreparedStoreError.make({ reason: "Hosted prepared reference does not bind its immutable artifact name to its digest." })
  }
}

export const makeActionPreparedReleaseStore = (input: {
  readonly workspace: string
  readonly context: ActionProducerContext
  readonly artifacts: ActionArtifactTransport
  readonly onCommit?: (reference: CompletePreparedReleaseRef) => void | Promise<void>
}): PreparedReleaseStoreShape => {
  const local = makeLocalPreparedReleaseStore(join(input.workspace, ".release", "ts-release", "prepared"))
  splitRepository(input.context.repository)
  const loadHosted = (reference: Extract<CompletePreparedReleaseRef, { readonly scheme: "gha" }>) => Effect.tryPromise({
    try: async () => {
      const transfer = mkdtempSync(join(tmpdir(), "ts-release-action-download-"))
      try {
        const downloaded = await input.artifacts.download({ name: reference.artifactName, destination: transfer })
        if (downloaded.digestMismatch === true) throw PreparedStoreError.make({ reason: "Actions artifact transport digest mismatch." })
        const root = downloaded.path ?? transfer
        const producer = decodeProducer(readFileSync(join(root, "producer-context.json"), "utf8"))
        const expected = {
          repository: input.context.repository,
          workflowRef: input.context.workflowRef,
          workflowSha: input.context.workflowSha,
          runId: reference.runId.toString(),
          runAttempt: reference.attempt.toString(),
          candidateCommit: input.context.candidateCommit,
          artifactName: reference.artifactName.toString(),
          preparedDigest: reference.digest.toString()
        }
        for (const [field, value] of Object.entries(expected)) {
          if (producer[field as keyof ProducerRecord] !== value) {
            throw PreparedStoreError.make({ reason: `Action producer context failed ${field} verification.` })
          }
        }
        const transferred = await Effect.runPromise(loadPreparedRelease(join(root, reference.digest)))
        if (transferred.manifest.source.commit.toString() !== producer.candidateCommit ||
          basename(transferred.directory) !== producer.preparedDigest) {
          throw PreparedStoreError.make({ reason: "Prepared bundle does not match its authenticated producer context." })
        }
        const persisted = await Effect.runPromise(local.commit(transferred.manifest, transferred.blobs))
        return persisted.bundle
      } finally { rmSync(transfer, { recursive: true, force: true }) }
    },
    catch: (cause) => cause instanceof PreparedStoreError
      ? cause
      : PreparedStoreError.make({ reason: cause instanceof Error ? cause.message : String(cause) })
  })
  return {
    commit: (manifest, blobs) => local.commit(manifest, blobs).pipe(Effect.flatMap((committed) => Effect.tryPromise({
      try: async () => {
        if (committed.ref.scheme !== "local") throw PreparedStoreError.make({ reason: "Action staging requires a local content-addressed commit." })
        const digest = committed.ref.digest.toString()
        const artifactName = `ts-release-prepared-${digest}`
        const transfer = mkdtempSync(join(tmpdir(), "ts-release-action-artifact-"))
        try {
          cpSync(committed.bundle.directory, join(transfer, digest), { recursive: true, dereference: false })
          const producer: ProducerRecord = {
            schemaVersion: "ts-release-action-producer/v1",
            ...input.context,
            artifactName,
            preparedDigest: digest
          }
          writeFileSync(join(transfer, "producer-context.json"), producerBytes(producer), { mode: 0o400 })
          const uploaded = await input.artifacts.upload({ name: artifactName, files: allFiles(transfer), rootDirectory: transfer })
          if (!Number.isSafeInteger(uploaded.id) || uploaded.id! <= 0 || uploaded.digest === undefined || !digestPattern.test(uploaded.digest)) {
            throw PreparedStoreError.make({ reason: "Actions artifact upload did not return a canonical id and digest." })
          }
          const repository = splitRepository(input.context.repository)
          const ref = await Effect.runPromise(makeGitHubActionsCompletePreparedReleaseRef({
            owner: repository.owner,
            repository: repository.name,
            runId: input.context.runId,
            attempt: input.context.runAttempt,
            artifactName,
            digest
          }))
          {
            const verified = await Effect.runPromise(loadHosted(ref))
            if (verified.manifest.source.commit.toString() !== committed.bundle.manifest.source.commit.toString()) {
              throw PreparedStoreError.make({ reason: "Actions artifact verification returned a different prepared release." })
            }
          }
          if (input.onCommit !== undefined) {
            try {
              await input.onCommit(ref)
            } catch (cause) {
              throw new PreparedCommitHandoffError({
                prepared: ref,
                reason: cause instanceof Error ? cause.message : String(cause)
              })
            }
          }
          return { ref, bundle: committed.bundle }
        } finally { rmSync(transfer, { recursive: true, force: true }) }
      },
      catch: (cause) => cause instanceof PreparedStoreError || cause instanceof PreparedCommitHandoffError
        ? cause
        : PreparedStoreError.make({ reason: cause instanceof Error ? cause.message : String(cause) })
    }))),
    load: (reference) => Effect.try({
      try: () => verifyReferenceContext(reference, input.context),
      catch: (cause) => cause instanceof PreparedStoreError
        ? cause
        : PreparedStoreError.make({ reason: cause instanceof Error ? cause.message : String(cause) })
    }).pipe(Effect.flatMap(() => {
      if (reference.scheme === "local") return local.load(reference)
      return loadHosted(reference)
    }))
  }
}
