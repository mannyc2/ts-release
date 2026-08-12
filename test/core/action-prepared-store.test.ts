import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  actionProducerContextFromEnvironment,
  makeActionPreparedReleaseStore,
  type ActionArtifactTransport,
  type ActionProducerContext
} from "../../apps/ts-release-action/src/prepared-store.js"
import { Digest, NonEmptyName, SafeRelativePath, Version } from "../../src/model/primitives.js"
import { PreparedProject, PreparedReleaseV1, PreparedSource } from "../../src/release/prepared.js"

const context: ActionProducerContext = {
  repository: "owner/repository",
  workflowRef: "owner/repository/.github/workflows/release.yml@refs/heads/main",
  workflowSha: "d".repeat(40),
  runId: "1234",
  runAttempt: "2",
  candidateCommit: "c".repeat(40)
}

const manifest = PreparedReleaseV1.make({
  schemaVersion: "prepared-release/v1",
  source: PreparedSource.make({
    commit: NonEmptyName.make(context.candidateCommit),
    tree: NonEmptyName.make("tree"),
    clean: true,
    packageManifestPath: SafeRelativePath.make("package.json"),
    packageManifestDigest: Digest.make("a".repeat(64))
  }),
  project: PreparedProject.make({
    name: NonEmptyName.make("fixture"),
    version: Version.make("1.0.0"),
    tag: NonEmptyName.make("v1.0.0")
  }),
  artifacts: [],
  publications: []
})

const fakeArtifacts = (root: string, events: string[]): ActionArtifactTransport => ({
  upload: async ({ name, rootDirectory }) => {
    events.push(`upload:${name}`)
    mkdirSync(root, { recursive: true })
    cpSync(rootDirectory, join(root, name), { recursive: true })
    return { id: 7, digest: `sha256:${"b".repeat(64)}` }
  },
  download: async ({ name, destination }) => {
    events.push(`download:${name}`)
    cpSync(join(root, name), destination, { recursive: true })
    return { path: destination, digestMismatch: false }
  }
})

describe("GitHub Actions durable prepared store", () => {
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
      const loaded = await Effect.runPromise(second.load(committed.ref))
      expect(loaded.manifest.source.commit.toString()).toBe(context.candidateCommit)
      expect(existsSync(loaded.directory)).toBe(true)
      expect(events.at(-1)).toMatch(/^download:ts-release-prepared-/u)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  test("treats a rejected reference notification as a post-commit failure", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-action-store-"))
    const artifacts = join(root, "artifacts")
    const events: string[] = []
    try {
      const store = makeActionPreparedReleaseStore({
        workspace: join(root, "workspace"),
        context,
        artifacts: fakeArtifacts(artifacts, events),
        onCommit: () => {
          events.push("output:failed")
          throw new Error("prepared reference output failed")
        }
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
        "output:failed"
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
          digest: artifactName!.slice("ts-release-prepared-".length)
        },
        reason: "prepared reference output failed"
      })
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
