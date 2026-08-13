import { createHash } from "node:crypto"
import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { makeReleaseApi } from "../../../src/api/api.js"
import { makeCustomReleaseLayer } from "../../../src/host.js"
import { CredentialRef, SubjectId } from "../../../src/model/authority.js"
import {
  CatalogManagedState,
  HomebrewRenderer,
  PreparedCatalogDownload,
  PreparedCatalogRenderer,
  decodeCatalogManagedState,
  encodeCatalogManagedState,
  renderCatalog
} from "../../../src/model/catalog.js"
import { sha256Digest } from "../../../src/model/digest.js"
import { NonEmptyName, OutputId, Version } from "../../../src/model/primitives.js"
import { CredentialProvider, makeCredentialProvider } from "../../../src/publication/authority.js"
import { bindAuthoredCorrection, correctPreparedRelease } from "../../../src/correction/coordinator.js"
import { decodeAuthoredCorrection } from "../../../src/correction/intent.js"
import { publishReleaseSubjects } from "../../../src/publication/coordinator.js"
import type {
  AuthorizedMutationHttpShape,
  HttpAuthorizerShape,
  HttpResponse,
  MutationHttpRequest
} from "../../../src/publication/http.js"
import { makeCatalogSubject } from "../../../src/publication/catalog-git.js"
import { CredentialPlatformError } from "../../../src/platform/credentials.js"
import { makeCatalogPublicationAuthorityIntent } from "../../../src/release/graph.js"
import {
  PreparedArtifact,
  PreparedCatalogPublication,
  PreparedProject,
  PreparedReleaseV2,
  PreparedSource
} from "../../../src/release/prepared.js"
import { makeLocalPreparedReleaseStore, type PreparedBundle } from "../../../src/release/prepared-store.js"
import { SafeRelativePath } from "../../../src/model/primitives.js"
import {
  fixtureArtifactProvenance,
  fixturePreparedProvenance,
  fixtureStagingSnapshot
} from "../../fixtures/prepared-provenance.js"
import {
  unavailableCertifiedPublisherSpawn,
  unavailableNpmUserConfigResource
} from "../../fixtures/mutation-services.js"

const encoder = new TextEncoder()
const json = (status: number, body: unknown): HttpResponse => ({
  status,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body)
})
const blobSha = (bytes: Uint8Array): string => createHash("sha1")
  .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), Buffer.from(bytes)]))
  .digest("hex")
const hash = (value: string): string => createHash("sha1").update(value).digest("hex")

interface Entry {
  readonly path: string
  readonly mode: string
  readonly type: "blob" | "tree" | "commit"
  readonly sha: string
}

class GitDataDouble {
  readonly repository = "owner/homebrew-tap"
  readonly branch = "main"
  readonly blobs = new Map<string, Uint8Array>()
  readonly trees = new Map<string, ReadonlyArray<Entry>>()
  readonly commits = new Map<string, string>()
  readonly requests: Array<{ readonly method: string, readonly url: string, readonly body?: unknown }> = []
  currentCommit = hash("initial commit")
  currentTree = hash("initial tree")
  mutationCount = 0
  rejectRef = false
  loseRefResponse = false
  malformedTree = false

  constructor(target?: Uint8Array, state?: Uint8Array) {
    const readme = encoder.encode("tap readme\n")
    const executable = encoder.encode("#!/bin/sh\n")
    const symlink = encoder.encode("README.md")
    for (const bytes of [readme, executable, symlink]) this.blobs.set(blobSha(bytes), bytes)
    const entries: Entry[] = [
      { path: "README.md", mode: "100644", type: "blob", sha: blobSha(readme) },
      { path: "verify.sh", mode: "100755", type: "blob", sha: blobSha(executable) },
      { path: "latest", mode: "120000", type: "blob", sha: blobSha(symlink) }
    ]
    if (target !== undefined && state !== undefined) {
      this.blobs.set(blobSha(target), target)
      this.blobs.set(blobSha(state), state)
      entries.push(
        { path: "Formula/fixture.rb", mode: "100644", type: "blob", sha: blobSha(target) },
        { path: ".ts-release/fixture.json", mode: "100644", type: "blob", sha: blobSha(state) }
      )
    }
    this.trees.set(this.currentTree, entries)
    this.commits.set(this.currentCommit, this.currentTree)
  }

  private body(request: MutationHttpRequest): Record<string, unknown> {
    const parsed = JSON.parse(typeof request.body === "string" ? request.body : new TextDecoder().decode(request.body)) as unknown
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("mutation body must be an object")
    return parsed as Record<string, unknown>
  }

  private observe(url: string): HttpResponse {
    const base = `https://api.github.com/repos/${this.repository}`
    if (url === base) return json(200, { full_name: this.repository })
    if (url === `${base}/git/ref/heads/${this.branch}`) return json(200, {
      ref: `refs/heads/${this.branch}`, object: { type: "commit", sha: this.currentCommit }
    })
    const commit = new RegExp(`^${base}/git/commits/([a-f0-9]{40})$`, "u").exec(url)?.[1]
    if (commit !== undefined) {
      const tree = this.commits.get(commit)
      return tree === undefined ? json(404, {}) : json(200, { sha: commit, tree: { sha: tree } })
    }
    const tree = new RegExp(`^${base}/git/trees/([a-f0-9]{40})\\?recursive=1$`, "u").exec(url)?.[1]
    if (tree !== undefined) return this.trees.has(tree)
      ? json(200, { sha: tree, truncated: this.malformedTree, tree: this.trees.get(tree) })
      : json(404, {})
    const blob = new RegExp(`^${base}/git/blobs/([a-f0-9]{40})$`, "u").exec(url)?.[1]
    if (blob !== undefined) {
      const bytes = this.blobs.get(blob)
      return bytes === undefined ? json(404, {}) : json(200, {
        sha: blob,
        encoding: "base64",
        content: Buffer.from(bytes).toString("base64")
      })
    }
    return json(404, {})
  }

  readonly http: HttpAuthorizerShape = {
    execute: (request) => Effect.sync(() => {
      this.requests.push({ method: request.method, url: request.url })
      return this.observe(request.url)
    })
  }

  readonly mutationHttp: AuthorizedMutationHttpShape = {
    execute: (operation, request) => {
      const host = this
      return Effect.gen(function*() {
      host.mutationCount += 1
      const body = host.body(request)
      host.requests.push({ method: request.method, url: request.url, body })
      expect(operation.provider.toString()).toBe("catalog-git")
      const base = `https://api.github.com/repos/${host.repository}`
      if (request.method === "POST" && request.url === `${base}/git/blobs`) {
        const bytes = new Uint8Array(Buffer.from(String(body.content), "base64"))
        const sha = blobSha(bytes)
        host.blobs.set(sha, bytes)
        return json(201, { sha })
      }
      if (request.method === "POST" && request.url === `${base}/git/trees`) {
        expect(body.base_tree).toBe(host.currentTree)
        expect(Array.isArray(body.tree)).toBe(true)
        const entries = new Map(host.trees.get(host.currentTree)!.map((entry) => [entry.path, entry]))
        for (const raw of body.tree as Array<Record<string, unknown>>) entries.set(String(raw.path), {
          path: String(raw.path), mode: String(raw.mode), type: "blob", sha: String(raw.sha)
        })
        const tree = hash(JSON.stringify([...entries.values()]))
        host.trees.set(tree, [...entries.values()])
        return json(201, { sha: tree })
      }
      if (request.method === "POST" && request.url === `${base}/git/commits`) {
        expect(body.parents).toEqual([host.currentCommit])
        const tree = String(body.tree)
        const commit = hash(`${tree}:${host.currentCommit}`)
        host.commits.set(commit, tree)
        return json(201, { sha: commit })
      }
      if (request.method === "PATCH" && request.url === `${base}/git/refs/heads/${host.branch}`) {
        expect(body.force).toBe(false)
        if (host.rejectRef) {
          const externalTree = hash("external tree")
          const externalCommit = hash("external commit")
          host.trees.set(externalTree, host.trees.get(host.currentTree)!)
          host.commits.set(externalCommit, externalTree)
          host.currentTree = externalTree
          host.currentCommit = externalCommit
          return json(422, {})
        }
        host.currentCommit = String(body.sha)
        host.currentTree = host.commits.get(host.currentCommit)!
        if (host.loseRefResponse) return yield* new CredentialPlatformError({
          phase: "mutate", commitment: "unknown", reason: "response lost after ref update"
        })
        return json(200, { ref: `refs/heads/${host.branch}`, object: { sha: host.currentCommit } })
      }
      return json(404, {})
      })
    }
  }
}

const renderer = HomebrewRenderer.make({
  name: NonEmptyName.make("fixture"),
  description: "Fixture command",
  homepage: "https://example.test/fixture",
  license: "MIT",
  installPath: NonEmptyName.make("fixture")
})
const sourceDigest = sha256Digest(encoder.encode("archive"))

const fixture = (versionText = "1.2.3") => {
  const version = Version.make(versionText)
  const downloads = [PreparedCatalogDownload.make({
    architecture: "arm64",
    url: `https://github.com/owner/fixture/releases/download/v${versionText}/fixture-darwin-arm64.tar.gz`,
    filename: NonEmptyName.make("fixture-darwin-arm64.tar.gz"),
    sha256: sourceDigest
  })] as const
  const target = renderCatalog(version, renderer, downloads)
  const state = encodeCatalogManagedState(CatalogManagedState.make({
    schemaVersion: "ts-release/catalog-state/v2",
    catalogId: NonEmptyName.make("fixture"),
    renderer: "homebrew",
    generation: version,
    status: "active",
    targetDigest: sha256Digest(target),
    sourceRepository: "owner/fixture" as never,
    sourceTag: NonEmptyName.make(`v${versionText}`)
  }))
  const authority = makeCatalogPublicationAuthorityIntent({
    repository: "owner/homebrew-tap",
    branch: "main",
    targetPath: "Formula/fixture.rb",
    statePath: ".ts-release/fixture.json",
    tokenEnv: "GITHUB_TOKEN"
  })
  const publication = PreparedCatalogPublication.make({
    id: NonEmptyName.make("catalog:fixture"),
    catalogId: NonEmptyName.make("fixture"),
    targetArtifactId: OutputId.make("catalog-fixture"),
    stateArtifactId: OutputId.make("catalog-state-fixture"),
    targetDigest: sha256Digest(target),
    stateDigest: sha256Digest(state),
    repository: "owner/homebrew-tap" as never,
    branch: "main" as never,
    targetPath: "Formula/fixture.rb" as never,
    statePath: ".ts-release/fixture.json" as never,
    version,
    sourceRepository: "owner/fixture" as never,
    sourceTag: NonEmptyName.make(`v${versionText}`),
    renderer: PreparedCatalogRenderer.make({ renderer, downloads: [...downloads] as [PreparedCatalogDownload] }),
    authority
  })
  return { publication, target, state }
}

const credentials = makeCredentialProvider({
  acquire: (request) => Effect.succeed(request.strategy.kind === "anonymous"
    ? { _tag: "AnonymousAccess", purposes: ["observe"] as const }
    : {
        _tag: "ScopedSecret",
        purposes: [request.purpose] as [typeof request.purpose],
        ref: request.strategy.kind === "token" ? request.strategy.credential : CredentialRef.make("GITHUB_TOKEN")
      })
})

const publish = (double: GitDataDouble, value = fixture()) => publishReleaseSubjects({
  prepared: SubjectId.make("prepared:catalog-protocol"),
  subjects: [makeCatalogSubject(value.publication, double.http, double.mutationHttp, {
    target: value.target,
    state: value.state
  })]
}).pipe(Effect.provideService(CredentialProvider, credentials))

const bundleFor = (value = fixture()): PreparedBundle => {
  const targetArtifact = PreparedArtifact.make({
    id: value.publication.targetArtifactId,
    path: SafeRelativePath.make(".release/catalogs/fixture.rb"),
    kind: "file",
    size: value.target.length,
    digest: value.publication.targetDigest,
    blob: value.publication.targetDigest,
    mediaType: "text/x-ruby",
    ...fixtureArtifactProvenance("catalog-render")
  })
  const stateArtifact = PreparedArtifact.make({
    id: value.publication.stateArtifactId,
    path: SafeRelativePath.make(".release/catalog-state/fixture.json"),
    kind: "file",
    size: value.state.length,
    digest: value.publication.stateDigest,
    blob: value.publication.stateDigest,
    mediaType: "application/json",
    ...fixtureArtifactProvenance("catalog-render")
  })
  const manifest = PreparedReleaseV2.make({
    kind: "complete",
    schemaVersion: "prepared-release/v2",
    source: PreparedSource.make({
      commit: NonEmptyName.make("1".repeat(40)),
      tree: NonEmptyName.make("2".repeat(40)),
      clean: true,
      packageManifestPath: SafeRelativePath.make("package.json"),
      packageManifestDigest: sha256Digest(encoder.encode("fixture")),
      materialized: fixtureStagingSnapshot
    }),
    project: PreparedProject.make({
      name: NonEmptyName.make("fixture"),
      version: value.publication.version,
      tag: NonEmptyName.make(`v${value.publication.version}`)
    }),
    provenance: fixturePreparedProvenance,
    artifacts: [targetArtifact, stateArtifact],
    collections: [],
    publications: [value.publication]
  })
  return {
    directory: "/protocol/catalog",
    manifest,
    blobs: new Map([
      [targetArtifact.id.toString(), value.target],
      [stateArtifact.id.toString(), value.state]
    ])
  }
}

describe("catalog Git-data provider protocol", () => {
  test("public API publishes and corrects an exact durable catalog pair through the host boundary", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-catalog-api-"))
    const value = fixture("1.2.3")
    const store = makeLocalPreparedReleaseStore(join(root, "prepared-store"))
    const bundle = bundleFor(value)
    const committed = await Effect.runPromise(store.commit(bundle.manifest, bundle.blobs))
    const double = new GitDataDouble()
    const unavailableRuntime = () => Effect.die("Catalog publish/correct must not enter preparation runtime services.")
    const api = makeReleaseApi(makeCustomReleaseLayer({
      runtime: {
        source: { observe: unavailableRuntime, materialize: unavailableRuntime },
        run: unavailableRuntime
      },
      preparedStore: store,
      credentialProvider: credentials,
      httpAuthorizer: double.http,
      authorizedMutationHttp: double.mutationHttp,
      npmUserConfigResource: unavailableNpmUserConfigResource,
      certifiedPublisherSpawn: unavailableCertifiedPublisherSpawn
    }))
    try {
      const published = await api.publish({ prepared: committed.ref })
      expect(published.status).toBe("complete")
      expect(published.subjects[1]?._tag).toBe("ConvergedAfterMutation")

      const replacementArchive = encoder.encode("replacement archive")
      const corrected = await api.correct({
        prepared: committed.ref,
        correction: decodeAuthoredCorrection({
          provider: "catalog-git",
          kind: "forward-catalog-state",
          publicationId: "catalog:fixture",
          replacementVersion: "1.2.4",
          replacementTag: "v1.2.4",
          downloads: [{
            architecture: "arm64",
            url: "https://github.com/owner/fixture/releases/download/v1.2.4/fixture-darwin-arm64.tar.gz",
            filename: "fixture-darwin-arm64.tar.gz",
            sha256: sha256Digest(replacementArchive).hex
          }],
          reason: "The original archive was faulty."
        })
      })
      expect(corrected).toMatchObject({ status: "complete", provider: "catalog-git" })
      expect(corrected.report).toMatchObject({ status: "complete" })
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("creates an exact pair, preserves unrelated object modes, and reruns as a no-op", async () => {
    const double = new GitDataDouble()
    const first = await Effect.runPromise(publish(double))
    expect(first.status).toBe("complete")
    expect(first.subjects[1]?._tag).toBe("ConvergedAfterMutation")
    const tree = double.trees.get(double.currentTree)!
    expect(tree).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "README.md", mode: "100644" }),
      expect.objectContaining({ path: "verify.sh", mode: "100755" }),
      expect.objectContaining({ path: "latest", mode: "120000" })
    ]))
    const mutations = double.mutationCount
    const second = await Effect.runPromise(publish(double))
    expect(second.subjects[1]?._tag).toBe("AlreadyEquivalent")
    expect(double.mutationCount).toBe(mutations)
  })

  test("treats a lost ref response as unknown until exact reobservation converges", async () => {
    const double = new GitDataDouble()
    double.loseRefResponse = true
    const report = await Effect.runPromise(publish(double))
    expect(report.status).toBe("complete")
    expect(report.subjects[1]?._tag).toBe("ConvergedAfterMutation")
  })

  test("does not overwrite a concurrently moved branch", async () => {
    const double = new GitDataDouble()
    double.rejectRef = true
    const report = await Effect.runPromise(publish(double))
    expect(report.status).toBe("blocked")
    expect(report.subjects[1]?._tag).toBe("BlockedSubject")
  })

  test("fails closed on a truncated full-tree observation", async () => {
    const double = new GitDataDouble()
    double.malformedTree = true
    const report = await Effect.runPromise(publish(double))
    expect(report.status).toBe("blocked")
    expect(double.mutationCount).toBe(0)
  })

  test("permits a real SemVer-forward managed pair and refuses a target/state forgery", async () => {
    const old = fixture("1.0.0-beta.2")
    const replacement = fixture("1.0.0-beta.10")
    const double = new GitDataDouble(old.target, old.state)
    const report = await Effect.runPromise(publish(double, replacement))
    expect(report.status).toBe("complete")
    expect(report.subjects[1]?._tag).toBe("ConvergedAfterMutation")

    const forgedState = encodeCatalogManagedState(CatalogManagedState.make({
      schemaVersion: "ts-release/catalog-state/v2",
      catalogId: NonEmptyName.make("fixture"), renderer: "homebrew",
      generation: Version.make("0.1.0"), status: "active",
      targetDigest: sha256Digest(encoder.encode("different target")),
      sourceRepository: "owner/fixture" as never, sourceTag: NonEmptyName.make("v0.1.0")
    }))
    const forged = new GitDataDouble(encoder.encode("attacker target"), forgedState)
    const blocked = await Effect.runPromise(publish(forged, replacement))
    expect(blocked.status).toBe("blocked")
    expect(forged.mutationCount).toBe(0)
  })

  test("executes an authored forward correction by changing both consumer target and managed state", async () => {
    const value = fixture("1.2.3")
    const bundle = bundleFor(value)
    const double = new GitDataDouble(value.target, value.state)
    const replacementArchive = encoder.encode("replacement archive")
    const authored = decodeAuthoredCorrection({
      provider: "catalog-git",
      kind: "forward-catalog-state",
      publicationId: "catalog:fixture",
      replacementVersion: "1.2.4",
      replacementTag: "v1.2.4",
      downloads: [{
        architecture: "arm64",
        url: "https://github.com/owner/fixture/releases/download/v1.2.4/fixture-darwin-arm64.tar.gz",
        filename: "fixture-darwin-arm64.tar.gz",
        sha256: sha256Digest(replacementArchive).hex
      }],
      reason: "The original archive was faulty."
    })
    const intent = bindAuthoredCorrection(bundle, authored)
    const outcome = await Effect.runPromise(correctPreparedRelease({
      bundle,
      intent,
      services: { credentials, http: double.http, mutationHttp: double.mutationHttp }
    }))
    expect(outcome._tag).toBe("CorrectionExecuted")
    if (outcome._tag !== "CorrectionExecuted") throw new Error("Expected executable catalog correction.")
    expect(outcome.report.status).toBe("complete")
    const tree = double.trees.get(double.currentTree)!
    const targetEntry = tree.find((entry) => entry.path === "Formula/fixture.rb")!
    const stateEntry = tree.find((entry) => entry.path === ".ts-release/fixture.json")!
    const correctedTarget = double.blobs.get(targetEntry.sha)!
    const correctedState = decodeCatalogManagedState(double.blobs.get(stateEntry.sha)!)
    expect(correctedTarget).not.toEqual(value.target)
    expect(new TextDecoder().decode(correctedTarget)).toContain('version "1.2.4"')
    expect(correctedState).toMatchObject({
      status: "corrected",
      generation: "1.2.4",
      replacementVersion: "1.2.4",
      correctionId: intent.correctionId
    })
    expect(correctedState?.targetDigest.hex).toBe(sha256Digest(correctedTarget).hex)
  })
})
