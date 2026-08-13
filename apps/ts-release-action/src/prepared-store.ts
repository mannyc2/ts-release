import artifactClient, { type ArtifactClient } from "@actions/artifact"
import { getOctokit } from "@actions/github"
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
  githubActionsPreparedArtifactName, GitHubActionsPreparedStoreProvenance,
  loadPreparedRelease, makeLocalPreparedReleaseStore, PreparedCommitHandoffError, PreparedStoreError,
  verifyPreparedStoreProvenance,
  type PreparedReleaseStoreShape
} from "../../../src/release/prepared-store.js"

const artifactUploadDigestPattern = /^[a-f0-9]{64}$/u
const artifactLookupDigestPattern = /^sha256:[a-f0-9]{64}$/u
const gitObjectIdPattern = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u
const positiveDecimalPattern = /^[1-9][0-9]*$/u
const workflowFilePattern = /^\.github\/workflows\/[A-Za-z0-9][A-Za-z0-9_.-]*\.ya?ml$/u

export interface ActionProducerContext {
  readonly repository: string
  readonly workflowRef: string
  readonly workflowSha: string
  readonly runId: string
  readonly runAttempt: string
  readonly candidateCommit: string
}

export type ActionEnvironment = Readonly<Record<string, string | undefined>>

type GitHubActionsPreparedReleaseRef = Extract<CompletePreparedReleaseRef, { readonly scheme: "gha" }>

export interface ActionArtifactFindBy {
  readonly token: string
  readonly workflowRunId: string
  readonly repositoryOwner: string
  readonly repositoryName: string
}

export interface ActionRunAttemptEvidence {
  readonly repository: string
  readonly workflowPath: string
  readonly runId: string
  readonly runAttempt: string
  readonly headSha: string
}

export interface GitHubRunAttemptResponse {
  readonly id: number
  readonly run_attempt?: number
  readonly head_sha: string
  readonly path: string
  readonly repository: { readonly full_name: string }
  readonly head_repository: { readonly full_name: string }
}

export type GitHubRunAttemptRequest = (input: {
  readonly token: string
  readonly owner: string
  readonly repository: string
  readonly runId: number
  readonly runAttempt: number
}) => Promise<GitHubRunAttemptResponse>

export interface ActionRunAttemptAuthenticator {
  readonly authenticate: (input: {
    readonly reference: GitHubActionsPreparedReleaseRef
    readonly current: ActionProducerContext
    readonly token: string
  }) => Promise<ActionRunAttemptEvidence>
}

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
  if (!gitObjectIdPattern.test(workflowSha) || !gitObjectIdPattern.test(candidateCommit)) {
    throw PreparedStoreError.make({ reason: "GitHub workflow and candidate commits must be canonical Git object ids." })
  }
  if (!positiveDecimalPattern.test(runId) || !positiveDecimalPattern.test(runAttempt)) {
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
    readonly findBy?: ActionArtifactFindBy
  }) => Promise<{ readonly path?: string, readonly digestMismatch?: boolean }>
}

const positiveSafeInteger = (value: string, field: string): number => {
  if (!positiveDecimalPattern.test(value)) {
    throw PreparedStoreError.make({ reason: `${field} must be a canonical positive decimal string.` })
  }
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed.toString() !== value) {
    throw PreparedStoreError.make({ reason: `${field} exceeds the exact GitHub API integer boundary.` })
  }
  return parsed
}

export const makeActionsArtifactTransport = (
  client: ArtifactClient = artifactClient
): ActionArtifactTransport => ({
  upload: ({ name, files, rootDirectory }) => client.uploadArtifact(
    name, [...files], rootDirectory, { compressionLevel: 0 }
  ),
  download: async ({ name, destination, findBy }) => {
    const options = findBy === undefined ? undefined : {
      findBy: {
        token: findBy.token,
        workflowRunId: positiveSafeInteger(findBy.workflowRunId, "prepared reference run id"),
        repositoryOwner: findBy.repositoryOwner,
        repositoryName: findBy.repositoryName
      }
    }
    const found = await client.getArtifact(name, options)
    if (found.artifact.name !== name || !Number.isSafeInteger(found.artifact.id) || found.artifact.id <= 0 ||
      found.artifact.digest === undefined || !artifactLookupDigestPattern.test(found.artifact.digest)) {
      throw PreparedStoreError.make({ reason: "Actions artifact lookup returned non-canonical artifact identity metadata." })
    }
    const downloaded = await client.downloadArtifact(found.artifact.id, {
      path: destination,
      expectedHash: found.artifact.digest,
      ...options
    })
    return {
      ...(downloaded.downloadPath === undefined ? {} : { path: downloaded.downloadPath }),
      ...(downloaded.digestMismatch === undefined ? {} : { digestMismatch: downloaded.digestMismatch })
    }
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

interface CanonicalWorkflowIdentity {
  readonly repository: string
  readonly workflowPath: string
  readonly workflowRef: string
}

const canonicalWorkflowIdentity = (workflowRef: string): CanonicalWorkflowIdentity => {
  const match = /^([^/]+\/[^/]+)\/(\.github\/workflows\/[A-Za-z0-9][A-Za-z0-9_.-]*\.ya?ml)@(refs\/(?:heads|tags)\/[A-Za-z0-9][A-Za-z0-9._\/-]*)$/u.exec(workflowRef)
  if (match === null || !workflowFilePattern.test(match[2]!)) {
    throw PreparedStoreError.make({ reason: "GitHub workflow ref must be a canonical repository workflow path at a heads/tags ref." })
  }
  splitRepository(match[1]!)
  return { repository: match[1]!, workflowPath: match[2]!, workflowRef: match[3]! }
}

const canonicalApiWorkflowPath = (path: string, expected: CanonicalWorkflowIdentity): {
  readonly workflowPath: string
  readonly workflowRef: string
} => {
  const withoutRepository = path.startsWith(`${expected.repository}/`)
    ? path.slice(expected.repository.length + 1)
    : path
  const separator = withoutRepository.lastIndexOf("@")
  if (separator <= 0 || separator === withoutRepository.length - 1) {
    throw PreparedStoreError.make({ reason: "GitHub workflow run attempt returned a non-canonical workflow path/ref." })
  }
  const workflowPath = withoutRepository.slice(0, separator)
  const refValue = withoutRepository.slice(separator + 1)
  const expectedShortRef = expected.workflowRef.replace(/^refs\/(?:heads|tags)\//u, "")
  const workflowRef = refValue === expected.workflowRef || refValue === expectedShortRef
    ? expected.workflowRef
    : ""
  if (!workflowFilePattern.test(workflowPath) ||
    !/^refs\/(?:heads|tags)\/[A-Za-z0-9][A-Za-z0-9._\/-]*$/u.test(workflowRef)) {
    throw PreparedStoreError.make({ reason: "GitHub workflow run attempt returned a non-canonical workflow path/ref." })
  }
  return { workflowPath, workflowRef }
}

const exactWorkflowRefFromApiPath = (
  path: string,
  expected: CanonicalWorkflowIdentity
): string => {
  const canonical = canonicalApiWorkflowPath(path, expected)
  if (canonical.workflowPath !== expected.workflowPath || canonical.workflowRef !== expected.workflowRef) {
    throw PreparedStoreError.make({ reason: "GitHub workflow run attempt failed exact workflow path/ref verification." })
  }
  return `${expected.repository}/${canonical.workflowPath}@${canonical.workflowRef}`
}

export const makeGitHubRunAttemptAuthenticator = (
  request: GitHubRunAttemptRequest = async (input) => {
    const response = await getOctokit(input.token).rest.actions.getWorkflowRunAttempt({
      owner: input.owner,
      repo: input.repository,
      run_id: input.runId,
      attempt_number: input.runAttempt
    })
    return response.data
  }
): ActionRunAttemptAuthenticator => ({
  authenticate: async ({ reference, current, token }) => {
    const expected = canonicalWorkflowIdentity(current.workflowRef)
    const repository = splitRepository(current.repository)
    if (expected.repository !== current.repository || reference.owner !== repository.owner ||
      reference.repository !== repository.name) {
      throw PreparedStoreError.make({ reason: "Hosted prepared reference is outside this Action repository trust boundary." })
    }
    const runId = positiveSafeInteger(reference.runId.toString(), "prepared reference run id")
    const attempt = positiveSafeInteger(reference.attempt.toString(), "prepared reference run attempt")
    const run = await request({
      token,
      owner: repository.owner,
      repository: repository.name,
      runId,
      runAttempt: attempt
    })
    const apiWorkflowRef = exactWorkflowRefFromApiPath(run.path, expected)
    if (run.id !== runId || run.run_attempt !== attempt || run.repository.full_name !== current.repository ||
      run.head_repository.full_name !== current.repository || !gitObjectIdPattern.test(run.head_sha) ||
      run.head_sha !== current.candidateCommit || run.head_sha !== current.workflowSha) {
      throw PreparedStoreError.make({
        reason: "GitHub workflow run attempt failed exact run/attempt/repository/head/workflow commit verification."
      })
    }
    return {
      repository: run.repository.full_name,
      workflowPath: apiWorkflowRef,
      runId: run.id.toString(),
      runAttempt: run.run_attempt.toString(),
      headSha: run.head_sha
    }
  }
})

const verifyReferenceContext = (reference: CompletePreparedReleaseRef, context: ActionProducerContext): void => {
  if (reference.scheme !== "gha") return
  const repository = splitRepository(context.repository)
  if (reference.owner !== repository.owner || reference.repository !== repository.name) {
    throw PreparedStoreError.make({ reason: "Hosted prepared reference is outside this Action repository trust boundary." })
  }
  if (reference.artifactName !== githubActionsPreparedArtifactName(
    reference.attempt.toString(),
    reference.digest.toString()
  )) {
    throw PreparedStoreError.make({
      reason: "Hosted prepared reference does not bind its immutable artifact name to its run attempt and digest."
    })
  }
}

export const makeActionPreparedReleaseStore = (input: {
  readonly workspace: string
  readonly context: ActionProducerContext
  readonly artifacts: ActionArtifactTransport
  readonly token?: string
  readonly runAttempts?: ActionRunAttemptAuthenticator
  readonly onCommit?: (reference: CompletePreparedReleaseRef) => void | Promise<void>
}): PreparedReleaseStoreShape => {
  const local = makeLocalPreparedReleaseStore(join(input.workspace, ".release", "ts-release", "prepared"))
  const workflow = canonicalWorkflowIdentity(input.context.workflowRef)
  if (workflow.repository !== input.context.repository) {
    throw PreparedStoreError.make({ reason: "Action workflow identity does not match the current repository." })
  }
  const loadHosted = (reference: GitHubActionsPreparedReleaseRef) => Effect.tryPromise({
    try: async () => {
      const transfer = mkdtempSync(join(tmpdir(), "ts-release-action-download-"))
      try {
        const isCurrentRun = reference.runId.toString() === input.context.runId
        let expectedProducer: ActionProducerContext
        let findBy: ActionArtifactFindBy | undefined
        if (isCurrentRun) {
          expectedProducer = {
            ...input.context,
            runAttempt: reference.attempt.toString()
          }
        } else {
          const token = input.token?.trim()
          if (token === undefined || token.length === 0) {
            throw PreparedStoreError.make({
              reason: "GITHUB_TOKEN with actions:read is required before cross-run prepared artifact access."
            })
          }
          if (input.runAttempts === undefined) {
            throw PreparedStoreError.make({ reason: "Cross-run prepared recovery has no authenticated GitHub run-attempt boundary." })
          }
          const evidence = await input.runAttempts.authenticate({ reference, current: input.context, token })
          const currentWorkflow = canonicalWorkflowIdentity(input.context.workflowRef)
          if (evidence.repository !== input.context.repository || evidence.workflowPath !== input.context.workflowRef ||
            evidence.runId !== reference.runId.toString() || evidence.runAttempt !== reference.attempt.toString() ||
            evidence.headSha !== input.context.candidateCommit || evidence.headSha !== input.context.workflowSha) {
            throw PreparedStoreError.make({ reason: "Authenticated GitHub run-attempt evidence does not match the prepared reference/current workflow." })
          }
          expectedProducer = {
            repository: evidence.repository,
            workflowRef: evidence.workflowPath,
            workflowSha: input.context.workflowSha,
            runId: evidence.runId,
            runAttempt: evidence.runAttempt,
            candidateCommit: evidence.headSha
          }
          const repository = splitRepository(evidence.repository)
          findBy = {
            token,
            workflowRunId: evidence.runId,
            repositoryOwner: repository.owner,
            repositoryName: repository.name
          }
          // Parse once more at this boundary so injected authenticators cannot smuggle a looser workflow coordinate.
          if (currentWorkflow.repository !== evidence.repository) {
            throw PreparedStoreError.make({ reason: "Authenticated GitHub run attempt is outside the current workflow repository." })
          }
        }
        const downloaded = await input.artifacts.download({
          name: reference.artifactName,
          destination: transfer,
          ...(findBy === undefined ? {} : { findBy })
        })
        if (downloaded.digestMismatch === true) throw PreparedStoreError.make({ reason: "Actions artifact transport digest mismatch." })
        const root = downloaded.path ?? transfer
        const producer = decodeProducer(readFileSync(join(root, "producer-context.json"), "utf8"))
        const expected = {
          repository: expectedProducer.repository,
          workflowRef: expectedProducer.workflowRef,
          workflowSha: expectedProducer.workflowSha,
          runId: reference.runId.toString(),
          runAttempt: reference.attempt.toString(),
          candidateCommit: expectedProducer.candidateCommit,
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
        await Effect.runPromise(verifyPreparedStoreProvenance({
          reference,
          bundle: transferred,
          evidence: GitHubActionsPreparedStoreProvenance.make({
            scheme: "gha",
            repository: producer.repository,
            workflowRef: producer.workflowRef,
            workflowSha: producer.workflowSha,
            runId: producer.runId,
            attempt: producer.runAttempt,
            candidateCommit: producer.candidateCommit,
            artifactName: producer.artifactName,
            artifactDigest: producer.preparedDigest,
            allowedWriter: "repository-workflow"
          })
        }))
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
        const artifactName = githubActionsPreparedArtifactName(input.context.runAttempt, digest)
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
          if (!Number.isSafeInteger(uploaded.id) || uploaded.id! <= 0 || uploaded.digest === undefined ||
            !artifactUploadDigestPattern.test(uploaded.digest)) {
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
