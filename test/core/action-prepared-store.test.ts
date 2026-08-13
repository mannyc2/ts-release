import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { pathToFileURL } from "node:url"
import {
  actionProducerContextFromEnvironment,
  makeActionsArtifactTransport,
  makeActionPreparedReleaseStore,
  makeGitHubRunAttemptAuthenticator,
  type ActionArtifactFindBy,
  type ActionArtifactTransport,
  type ActionProducerContext,
  type ActionRunAttemptAuthenticator,
  type GitHubRunAttemptResponse
} from "../../apps/ts-release-action/src/prepared-store.js"
import { makePreparedReferenceChannel } from "../../apps/ts-release-action/src/commands.js"
import { parseSha256Hex } from "../../src/model/digest.js"
import { NonEmptyName, SafeRelativePath, Version } from "../../src/model/primitives.js"
import { PreparedProject, PreparedReleaseV2, PreparedSource } from "../../src/release/prepared.js"
import {
  encodeCompletePreparedReleaseRef,
  makeGitHubActionsCompletePreparedReleaseRef
} from "../../src/release/prepared-ref.js"
import { PreparedCommitHandoffError } from "../../src/release/prepared-store.js"
import { fixturePreparedProvenance, fixtureStagingSnapshot } from "../fixtures/prepared-provenance.js"

const context: ActionProducerContext = {
  repository: "owner/repository",
  workflowRef: "owner/repository/.github/workflows/release.yml@refs/heads/main",
  workflowSha: "d".repeat(40),
  runId: "1234",
  runAttempt: "2",
  candidateCommit: "c".repeat(40)
}

const manifest = PreparedReleaseV2.make({
  kind: "complete",
  schemaVersion: "prepared-release/v2",
  source: PreparedSource.make({
    commit: NonEmptyName.make(context.candidateCommit),
    tree: NonEmptyName.make("tree"),
    clean: true,
    packageManifestPath: SafeRelativePath.make("package.json"),
    packageManifestDigest: parseSha256Hex("a".repeat(64)),
    materialized: fixtureStagingSnapshot
  }),
  project: PreparedProject.make({
    name: NonEmptyName.make("fixture"),
    version: Version.make("1.0.0"),
    tag: NonEmptyName.make("v1.0.0")
  }),
  artifacts: [],
  collections: [],
  provenance: fixturePreparedProvenance,
  publications: []
})

const fakeArtifacts = (root: string, events: string[]): ActionArtifactTransport => ({
  upload: async ({ name, rootDirectory }) => {
    events.push(`upload:${name}`)
    mkdirSync(root, { recursive: true })
    cpSync(rootDirectory, join(root, name), { recursive: true })
    return { id: 7, digest: "b".repeat(64) }
  },
  download: async ({ name, destination }) => {
    events.push(`download:${name}`)
    cpSync(join(root, name), destination, { recursive: true })
    return { path: destination, digestMismatch: false }
  }
})

const recoveryContext: ActionProducerContext = {
  ...context,
  workflowSha: context.candidateCommit
}

const runAttemptResponse = (overrides: Partial<GitHubRunAttemptResponse> = {}): GitHubRunAttemptResponse => ({
  id: Number(recoveryContext.runId),
  run_attempt: Number(recoveryContext.runAttempt),
  head_sha: recoveryContext.candidateCommit,
  path: ".github/workflows/release.yml@main",
  repository: { full_name: recoveryContext.repository },
  head_repository: { full_name: recoveryContext.repository },
  ...overrides
})

const recoveryArtifacts = (
  root: string,
  downloads: Array<ActionArtifactFindBy | undefined>
): ActionArtifactTransport => ({
  upload: async ({ name, rootDirectory }) => {
    mkdirSync(root, { recursive: true })
    cpSync(rootDirectory, join(root, name), { recursive: true })
    return { id: 7, digest: "b".repeat(64) }
  },
  download: async ({ name, destination, findBy }) => {
    downloads.push(findBy)
    cpSync(join(root, name), destination, { recursive: true })
    return { path: destination, digestMismatch: false }
  }
})

describe("GitHub Actions durable prepared store", () => {
  test("matches the installed artifact client's name and digest wire contracts", async () => {
    const actionRoot = join(import.meta.dir, "../../apps/ts-release-action")
    const artifactRoot = join(
      dirname(Bun.resolveSync("@actions/artifact", actionRoot)),
      "internal"
    )
    const validator = await import(pathToFileURL(join(
      artifactRoot,
      "upload/path-and-artifact-name-validation.js"
    )).href) as { readonly validateArtifactName: (name: string) => void }
    const name = `ts-release-prepared-2-${"a".repeat(64)}`
    expect(() => validator.validateArtifactName(name)).not.toThrow()
    expect(() => validator.validateArtifactName(`ts-release-prepared-sha256:${"a".repeat(64)}`))
      .toThrow("Colon")

    const uploadSource = readFileSync(join(artifactRoot, "upload/upload-artifact.js"), "utf8")
    const lookupSource = readFileSync(join(artifactRoot, "find/get-artifact.js"), "utf8")
    expect(uploadSource).toMatch(/digest:\s*uploadResult\.sha256Hash/u)
    expect(uploadSource).toContain("value: `sha256:${uploadResult.sha256Hash}`")
    expect(lookupSource).toMatch(/digest:\s*artifact\.digest/u)
  })

  test("uploads before returning a hosted reference and reloads in a fresh invocation", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-action-store-"))
    const artifacts = join(root, "artifacts")
    const events: string[] = []
    try {
      const first = makeActionPreparedReleaseStore({
        workspace: join(root, "first"),
        context,
        artifacts: fakeArtifacts(artifacts, events),
        onCommit: (reference) => { events.push(`output:${reference.scheme}`) }
      })
      const committed = await Effect.runPromise(first.commit(manifest, new Map()))
      const artifactName = committed.ref.scheme === "gha" ? committed.ref.artifactName : "wrong"
      expect(events).toEqual([`upload:${artifactName}`, `download:${artifactName}`, "output:gha"])
      expect(committed.ref).toMatchObject({
        scheme: "gha", owner: "owner", repository: "repository", runId: "1234", attempt: "2"
      })
      expect(existsSync(committed.bundle.directory)).toBe(true)

      const second = makeActionPreparedReleaseStore({
        workspace: join(root, "second"),
        context: { ...context, runAttempt: "3" },
        artifacts: fakeArtifacts(artifacts, events)
      })
      const retried = await Effect.runPromise(second.commit(manifest, new Map()))
      if (committed.ref.scheme !== "gha" || retried.ref.scheme !== "gha") {
        throw new Error("fixture did not create hosted references")
      }
      expect(committed.ref.artifactName.toString()).toBe(`ts-release-prepared-2-${committed.ref.digest}`)
      expect(retried.ref.artifactName.toString()).toBe(`ts-release-prepared-3-${retried.ref.digest}`)
      expect(retried.ref.artifactName).not.toBe(committed.ref.artifactName)
      const loaded = await Effect.runPromise(second.load(committed.ref))
      expect(loaded.manifest.source.commit.toString()).toBe(context.candidateCommit)
      expect(existsSync(loaded.directory)).toBe(true)
      expect(events.at(-1)).toMatch(/^download:ts-release-prepared-/u)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test("authenticates a fresh-run recovery before using the public artifact channel", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-action-recovery-"))
    const artifacts = join(root, "artifacts")
    const downloads: Array<ActionArtifactFindBy | undefined> = []
    const requests: Array<{
      readonly token: string
      readonly owner: string
      readonly repository: string
      readonly runId: number
      readonly runAttempt: number
    }> = []
    try {
      const producer = makeActionPreparedReleaseStore({
        workspace: join(root, "producer"),
        context: recoveryContext,
        artifacts: recoveryArtifacts(artifacts, downloads)
      })
      const committed = await Effect.runPromise(producer.commit(manifest, new Map()))
      expect(downloads).toEqual([undefined])
      downloads.length = 0

      const consumer = makeActionPreparedReleaseStore({
        workspace: join(root, "consumer"),
        context: { ...recoveryContext, runId: "5678", runAttempt: "1" },
        artifacts: recoveryArtifacts(artifacts, downloads),
        token: "sentinel:actions-read",
        runAttempts: makeGitHubRunAttemptAuthenticator(async (request) => {
          requests.push(request)
          return runAttemptResponse()
        })
      })
      const loaded = await Effect.runPromise(consumer.load(committed.ref))

      expect(loaded.manifest.source.commit.toString()).toBe(recoveryContext.candidateCommit)
      expect(requests).toEqual([{
        token: "sentinel:actions-read",
        owner: "owner",
        repository: "repository",
        runId: 1234,
        runAttempt: 2
      }])
      expect(downloads).toEqual([{
        token: "sentinel:actions-read",
        workflowRunId: "1234",
        repositoryOwner: "owner",
        repositoryName: "repository"
      }])
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test("refuses every unauthenticated or foreign cross-run coordinate before artifact download", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-action-recovery-refusal-"))
    const artifacts = join(root, "artifacts")
    const downloads: Array<ActionArtifactFindBy | undefined> = []
    try {
      const producer = makeActionPreparedReleaseStore({
        workspace: join(root, "producer"),
        context: recoveryContext,
        artifacts: recoveryArtifacts(artifacts, downloads)
      })
      const committed = await Effect.runPromise(producer.commit(manifest, new Map()))
      if (committed.ref.scheme !== "gha") throw new Error("fixture did not create a hosted reference")
      downloads.length = 0

      let authenticationCalls = 0
      const missingToken = makeActionPreparedReleaseStore({
        workspace: join(root, "missing-token"),
        context: { ...recoveryContext, runId: "5678", runAttempt: "1" },
        artifacts: recoveryArtifacts(artifacts, downloads),
        runAttempts: {
          authenticate: async () => {
            authenticationCalls += 1
            throw new Error("must not authenticate without a token")
          }
        }
      })
      await expect(Effect.runPromise(missingToken.load(committed.ref))).rejects.toMatchObject({
        reason: expect.stringContaining("GITHUB_TOKEN with actions:read")
      })
      expect(authenticationCalls).toBe(0)
      expect(downloads).toEqual([])

      const responseCases: ReadonlyArray<{
        readonly name: string
        readonly response: GitHubRunAttemptResponse
        readonly reason: string
      }> = [
        { name: "run id", response: runAttemptResponse({ id: 1235 }), reason: "run/attempt/repository/head/workflow commit" },
        { name: "run attempt", response: runAttemptResponse({ run_attempt: 3 }), reason: "run/attempt/repository/head/workflow commit" },
        { name: "candidate SHA", response: runAttemptResponse({ head_sha: "e".repeat(40) }), reason: "run/attempt/repository/head/workflow commit" },
        { name: "workflow path", response: runAttemptResponse({ path: ".github/workflows/other.yml@main" }), reason: "workflow path/ref" },
        { name: "workflow ref", response: runAttemptResponse({ path: ".github/workflows/release.yml@other" }), reason: "workflow path/ref" },
        {
          name: "repository",
          response: runAttemptResponse({ repository: { full_name: "owner/other" } }),
          reason: "run/attempt/repository/head/workflow commit"
        },
        {
          name: "head repository",
          response: runAttemptResponse({ head_repository: { full_name: "foreign/repository" } }),
          reason: "run/attempt/repository/head/workflow commit"
        }
      ]
      for (const [index, testCase] of responseCases.entries()) {
        const consumer = makeActionPreparedReleaseStore({
          workspace: join(root, `refusal-${index}`),
          context: { ...recoveryContext, runId: "5678", runAttempt: "1" },
          artifacts: recoveryArtifacts(artifacts, downloads),
          token: "sentinel:actions-read",
          runAttempts: makeGitHubRunAttemptAuthenticator(async () => testCase.response)
        })
        await expect(Effect.runPromise(consumer.load(committed.ref)), testCase.name).rejects.toMatchObject({
          reason: expect.stringContaining(testCase.reason)
        })
        expect(downloads, testCase.name).toEqual([])
      }

      const foreignReference = await Effect.runPromise(makeGitHubActionsCompletePreparedReleaseRef({
        owner: "foreign",
        repository: committed.ref.repository,
        runId: committed.ref.runId,
        attempt: committed.ref.attempt,
        artifactName: committed.ref.artifactName,
        digest: committed.ref.digest
      }))
      const foreignConsumer = makeActionPreparedReleaseStore({
        workspace: join(root, "foreign-reference"),
        context: { ...recoveryContext, runId: "5678", runAttempt: "1" },
        artifacts: recoveryArtifacts(artifacts, downloads),
        token: "sentinel:actions-read",
        runAttempts: {
          authenticate: async () => {
            authenticationCalls += 1
            throw new Error("must not authenticate a foreign reference")
          }
        }
      })
      await expect(Effect.runPromise(foreignConsumer.load(foreignReference))).rejects.toMatchObject({
        reason: expect.stringContaining("repository trust boundary")
      })
      expect(authenticationCalls).toBe(0)
      expect(downloads).toEqual([])

      const wrongArtifactReference = await Effect.runPromise(makeGitHubActionsCompletePreparedReleaseRef({
        owner: committed.ref.owner,
        repository: committed.ref.repository,
        runId: committed.ref.runId,
        attempt: committed.ref.attempt,
        artifactName: "ts-release-prepared-wrong",
        digest: committed.ref.digest
      }))
      await expect(Effect.runPromise(foreignConsumer.load(wrongArtifactReference))).rejects.toMatchObject({
        reason: expect.stringContaining("immutable artifact name")
      })
      expect(authenticationCalls).toBe(0)
      expect(downloads).toEqual([])
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test("refuses untrusted injected run evidence before artifact download", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-action-recovery-evidence-"))
    const artifacts = join(root, "artifacts")
    const downloads: Array<ActionArtifactFindBy | undefined> = []
    try {
      const producer = makeActionPreparedReleaseStore({
        workspace: join(root, "producer"), context: recoveryContext,
        artifacts: recoveryArtifacts(artifacts, downloads)
      })
      const committed = await Effect.runPromise(producer.commit(manifest, new Map()))
      if (committed.ref.scheme !== "gha") throw new Error("fixture did not create a hosted reference")
      downloads.length = 0
      const validEvidence = {
        repository: recoveryContext.repository,
        workflowPath: recoveryContext.workflowRef,
        runId: committed.ref.runId.toString(),
        runAttempt: committed.ref.attempt.toString(),
        headSha: recoveryContext.candidateCommit
      }
      const cases = [
        { ...validEvidence, repository: "owner/other" },
        { ...validEvidence, workflowPath: "owner/repository/.github/workflows/other.yml@refs/heads/main" },
        { ...validEvidence, runId: "9999" },
        { ...validEvidence, runAttempt: "9" },
        { ...validEvidence, headSha: "e".repeat(40) }
      ]
      for (const [index, evidence] of cases.entries()) {
        const runAttempts: ActionRunAttemptAuthenticator = { authenticate: async () => evidence }
        const consumer = makeActionPreparedReleaseStore({
          workspace: join(root, `consumer-${index}`),
          context: { ...recoveryContext, runId: "5678", runAttempt: "1" },
          artifacts: recoveryArtifacts(artifacts, downloads),
          token: "sentinel:actions-read",
          runAttempts
        })
        await expect(Effect.runPromise(consumer.load(committed.ref))).rejects.toMatchObject({
          reason: expect.stringContaining("does not match")
        })
        expect(downloads).toEqual([])
      }
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test("binds public artifact lookup and download to the authenticated producer run", async () => {
    const calls: unknown[] = []
    const client = {
      uploadArtifact: async () => ({ id: 1, digest: "a".repeat(64) }),
      getArtifact: async (name: string, options?: unknown) => {
        calls.push({ operation: "get", name, options })
        return { artifact: { id: 17, name, size: 1, digest: `sha256:${"b".repeat(64)}` } }
      },
      downloadArtifact: async (id: number, options?: unknown) => {
        calls.push({ operation: "download", id, options })
        return { downloadPath: "/tmp/artifact", digestMismatch: false }
      }
    } as unknown as NonNullable<Parameters<typeof makeActionsArtifactTransport>[0]>
    const transport = makeActionsArtifactTransport(client)
    const findBy: ActionArtifactFindBy = {
      token: "sentinel:actions-read",
      workflowRunId: "1234",
      repositoryOwner: "owner",
      repositoryName: "repository"
    }
    await transport.download({ name: "prepared", destination: "/tmp/destination", findBy })
    const publicOptions = {
      findBy: {
        token: findBy.token,
        workflowRunId: 1234,
        repositoryOwner: findBy.repositoryOwner,
        repositoryName: findBy.repositoryName
      }
    }
    expect(calls).toEqual([
      { operation: "get", name: "prepared", options: publicOptions },
      {
        operation: "download",
        id: 17,
        options: {
          path: "/tmp/destination",
          expectedHash: `sha256:${"b".repeat(64)}`,
          ...publicOptions
        }
      }
    ])

    calls.length = 0
    await transport.download({ name: "prepared", destination: "/tmp/current" })
    expect(calls).toEqual([
      { operation: "get", name: "prepared", options: undefined },
      {
        operation: "download",
        id: 17,
        options: { path: "/tmp/current", expectedHash: `sha256:${"b".repeat(64)}` }
      }
    ])
  })

  test("treats a rejected reference notification as a post-commit failure", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-action-store-"))
    const artifacts = join(root, "artifacts")
    const events: string[] = []
    const outputs: Record<string, string> = {}
    try {
      const channel = makePreparedReferenceChannel({
        output: (name, value) => {
          events.push(`output:${name}`)
          outputs[name] = value
        },
        summarize: async () => {
          events.push("summary:failed")
          throw new Error("prepared reference summary failed")
        }
      })
      const store = makeActionPreparedReleaseStore({
        workspace: join(root, "workspace"),
        context,
        artifacts: fakeArtifacts(artifacts, events),
        onCommit: (reference) => channel.emit(encodeCompletePreparedReleaseRef(reference))
      })

      let failure: unknown
      let mutations = 0
      try {
        await Effect.runPromise(store.commit(manifest, new Map()).pipe(
          Effect.tap(() => Effect.sync(() => { mutations += 1 }))
        ))
      } catch (cause) {
        failure = cause
      }

      const artifactName = events.find((event) => event.startsWith("upload:"))?.slice("upload:".length)
      expect(artifactName).toMatch(/^ts-release-prepared-/u)
      expect(events).toEqual([
        `upload:${artifactName}`,
        `download:${artifactName}`,
        "output:prepared-ref",
        "summary:failed"
      ])
      expect(existsSync(join(artifacts, artifactName!))).toBe(true)
      expect(mutations).toBe(0)
      expect(failure).toMatchObject({
        _tag: "PreparedCommitHandoffError",
        prepared: {
          scheme: "gha",
          owner: "owner",
          repository: "repository",
          runId: context.runId,
          attempt: context.runAttempt,
          artifactName,
          digest: artifactName!.slice(-64)
        },
        reason: "prepared reference summary failed"
      })
      if (!(failure instanceof PreparedCommitHandoffError)) {
        throw new Error("Expected a post-commit handoff failure.")
      }
      const encoded = encodeCompletePreparedReleaseRef(failure.prepared)
      expect(outputs["prepared-ref"]).toBe(encoded)
      expect(channel.current()).toBe(encoded)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test("rejects a foreign run before artifact access and rejects tampered producer provenance", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-action-store-"))
    const artifacts = join(root, "artifacts")
    const events: string[] = []
    try {
      const store = makeActionPreparedReleaseStore({
        workspace: join(root, "first"), context, artifacts: fakeArtifacts(artifacts, events)
      })
      const committed = await Effect.runPromise(store.commit(manifest, new Map()))
      events.length = 0
      const foreign = makeActionPreparedReleaseStore({
        workspace: join(root, "foreign"),
        context: { ...context, runId: "9999" },
        artifacts: fakeArtifacts(artifacts, events)
      })
      await expect(Effect.runPromise(foreign.load(committed.ref))).rejects.toMatchObject({ _tag: "PreparedStoreError" })
      expect(events).toEqual([])

      if (committed.ref.scheme !== "gha") throw new Error("fixture did not create a hosted reference")
      const producer = join(artifacts, committed.ref.artifactName, "producer-context.json")
      chmodSync(producer, 0o600)
      writeFileSync(producer, readFileSync(producer, "utf8").replace(context.workflowSha, "tampered"))
      await expect(Effect.runPromise(store.load(committed.ref))).rejects.toMatchObject({
        _tag: "PreparedStoreError",
        reason: expect.stringContaining("workflowSha verification")
      })
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test("builds a canonical producer context only from the Action entry environment", () => {
    const environment = {
      GITHUB_REPOSITORY: context.repository,
      GITHUB_WORKFLOW_REF: context.workflowRef,
      GITHUB_WORKFLOW_SHA: context.workflowSha,
      GITHUB_RUN_ID: context.runId,
      GITHUB_RUN_ATTEMPT: context.runAttempt,
      GITHUB_SHA: context.candidateCommit
    }
    expect(actionProducerContextFromEnvironment(environment)).toEqual(context)
    let workflowError: unknown
    try {
      actionProducerContextFromEnvironment({
        ...environment,
        GITHUB_WORKFLOW_REF: "other/repository/.github/workflows/release.yml@refs/heads/main"
      })
    } catch (cause) { workflowError = cause }
    expect(workflowError).toMatchObject({ reason: expect.stringContaining("workflow-writer boundary") })

    let runError: unknown
    try {
      actionProducerContextFromEnvironment({ ...environment, GITHUB_RUN_ID: "01" })
    } catch (cause) { runError = cause }
    expect(runError).toMatchObject({ reason: expect.stringContaining("canonical positive decimal") })
  })
})
