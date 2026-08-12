import { createHash } from "node:crypto"
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  makeActionPreparedReleaseStore,
  type ActionArtifactTransport,
  type ActionProducerContext
} from "../apps/ts-release-action/src/prepared-store.js"
import { makeReleaseApi } from "../src/api/api.js"
import { ReleaseRuntime } from "../src/api/runtime.js"
import type { ReleaseApiLayer } from "../src/api/types.js"
import { encodeCanonicalJson } from "../src/model/canonical.js"
import {
  EnvironmentName,
  type CredentialRequest
} from "../src/model/authority.js"
import {
  Digest,
  NonEmptyName,
  OutputId,
  SafeRelativePath,
  Version,
  WorkspaceRoot
} from "../src/model/primitives.js"
import {
  CredentialProvider,
  makeCredentialProvider,
  type CredentialGrant,
  type CredentialGrantDescriptor
} from "../src/publication/authority.js"
import {
  HttpAuthorizer,
  type HttpAuthorizerShape,
  type HttpObservationRequest,
  type HttpResponse
} from "../src/publication/http.js"
import { makeNpmPublicationAuthorityIntent } from "../src/release/graph.js"
import {
  PreparedArtifact,
  PreparedNpmPublication,
  PreparedProject,
  PreparedReleaseV1,
  PreparedSource,
  encodePreparedRelease
} from "../src/release/prepared.js"
import {
  makeLocalCompletePreparedReleaseRef,
  type CompletePreparedReleaseRef
} from "../src/release/prepared-ref.js"
import {
  PreparedReleaseStore,
  makeLocalPreparedReleaseStore,
  type PreparedBundle,
  type PreparedReleaseStoreShape
} from "../src/release/prepared-store.js"
import { contextFor, noopRun } from "./core/runtime-fixture.js"

const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex")

const response = (status: number, body: unknown): HttpResponse => ({
  status,
  headers: {},
  body: typeof body === "string" ? body : JSON.stringify(body)
})

const conflictResponse = (): HttpResponse => response(200, {
  dist: { integrity: "sha512-different", shasum: "different" }
})

const remoteBundle = (commit = "c".repeat(40)): PreparedBundle => {
  const bytes = new TextEncoder().encode("exact prepared npm bytes\n")
  const digest = Digest.make(sha256(bytes))
  const artifact = PreparedArtifact.make({
    id: OutputId.make("npm-tarball"),
    path: SafeRelativePath.make("package.tgz"),
    kind: "archive",
    size: bytes.length,
    digest,
    blob: digest,
    mediaType: "application/gzip"
  })
  const publication = PreparedNpmPublication.make({
    id: NonEmptyName.make("npm-release"),
    packageName: NonEmptyName.make("@fixture/package"),
    version: Version.make("1.0.0"),
    registryUrl: "https://registry.example.test/",
    artifactId: artifact.id,
    authority: makeNpmPublicationAuthorityIntent({
      packageName: "@fixture/package",
      version: "1.0.0",
      registryUrl: "https://registry.example.test/"
    })
  })
  return {
    directory: "/not-stored",
    manifest: PreparedReleaseV1.make({
      schemaVersion: "prepared-release/v1",
      source: PreparedSource.make({
        commit: NonEmptyName.make(commit),
        tree: NonEmptyName.make("prepared-tree"),
        clean: true,
        packageManifestPath: SafeRelativePath.make("package.json"),
        packageManifestDigest: Digest.make("a".repeat(64))
      }),
      project: PreparedProject.make({
        name: NonEmptyName.make("fixture"),
        packageName: publication.packageName,
        version: publication.version,
        tag: NonEmptyName.make("v1.0.0")
      }),
      artifacts: [artifact],
      publications: [publication]
    }),
    blobs: new Map([[artifact.id.toString(), bytes]])
  }
}

const localOnlyBundle = (): PreparedBundle => {
  const fixture = remoteBundle()
  return {
    ...fixture,
    manifest: PreparedReleaseV1.make({
      ...fixture.manifest,
      publications: []
    })
  }
}

type ScriptedHttp = HttpResponse | "defect"

interface AuthorityTrace {
  readonly credentialRequests: Array<CredentialRequest>
  readonly secretRequests: Array<CredentialRequest>
  readonly mutationRequests: Array<CredentialRequest>
  readonly http: Array<{
    readonly request: HttpObservationRequest
    readonly grant: CredentialGrant["_tag"]
  }>
  readonly responses: Array<ScriptedHttp>
}

const trace = (...responses: ReadonlyArray<ScriptedHttp>): AuthorityTrace => ({
  credentialRequests: [],
  secretRequests: [],
  mutationRequests: [],
  http: [],
  responses: [...responses]
})

const descriptor = (request: CredentialRequest): CredentialGrantDescriptor => {
  switch (request.strategy.kind) {
    case "anonymous":
      return { _tag: "AnonymousAccess", purposes: ["observe"] }
    case "token":
      return {
        _tag: "ScopedSecret",
        purposes: ["observe", "publish"],
        ref: request.strategy.credential
      }
    case "trusted-publishing":
      return {
        _tag: "WorkloadIdentity",
        purposes: [request.purpose],
        names: [EnvironmentName.make("CERTIFIED_WORKLOAD_IDENTITY")]
      }
  }
}

const authorityLayer = (
  store: PreparedReleaseStoreShape,
  recorded: AuthorityTrace
): ReleaseApiLayer => {
  const credentials = makeCredentialProvider({
    acquire: (request) => Effect.sync(() => {
      recorded.credentialRequests.push(request)
      if (request.strategy.kind !== "anonymous") recorded.secretRequests.push(request)
      if (request.purpose !== "observe") recorded.mutationRequests.push(request)
      return descriptor(request)
    })
  })
  const http: HttpAuthorizerShape = {
    execute: (request, grant) => {
      recorded.http.push({ request, grant: grant._tag })
      const current = recorded.responses.shift()
      if (current === undefined) return Effect.die(new Error("Missing scripted provider response."))
      if (current === "defect") return Effect.die(new Error("forced post-commit provider defect"))
      return Effect.succeed(current)
    }
  }
  return Layer.mergeAll(
    Layer.succeed(ReleaseRuntime, {
      source: {
        observe: (workspace: WorkspaceRoot) => Effect.succeed(contextFor(workspace.toString()))
      },
      run: noopRun
    }),
    Layer.succeed(PreparedReleaseStore, store),
    Layer.succeed(CredentialProvider, credentials),
    Layer.succeed(HttpAuthorizer, http)
  )
}

const commitLocal = async (root: string, bundle: PreparedBundle) => {
  const store = makeLocalPreparedReleaseStore(join(root, "store"))
  const committed = await Effect.runPromise(store.commit(bundle.manifest, bundle.blobs))
  return { store, committed }
}

type RawPreparedPublication = {
  registryUrl: string
  authority: {
    observationStrategies: Array<unknown>
    publishStrategy: unknown
  }
}

const writeDigestValidInvalidBundle = async (
  root: string,
  mutate: (publication: RawPreparedPublication) => void
) => {
  const fixture = remoteBundle()
  const raw = JSON.parse(new TextDecoder().decode(encodePreparedRelease(fixture.manifest))) as {
    artifacts: ReadonlyArray<{ readonly blob: string }>
    publications: [RawPreparedPublication]
  }
  mutate(raw.publications[0])
  const manifestBytes = new TextEncoder().encode(encodeCanonicalJson(raw))
  const manifestDigest = sha256(manifestBytes)
  const storeDirectory = join(root, "store")
  const directory = join(storeDirectory, manifestDigest)
  mkdirSync(join(directory, "blobs"), { recursive: true })
  writeFileSync(join(directory, "prepared-release.json"), manifestBytes)
  const artifact = fixture.manifest.artifacts[0]!
  writeFileSync(
    join(directory, "blobs", raw.artifacts[0]!.blob),
    fixture.blobs.get(artifact.id.toString())!
  )
  return {
    store: makeLocalPreparedReleaseStore(storeDirectory),
    prepared: await Effect.runPromise(makeLocalCompletePreparedReleaseRef(manifestDigest))
  }
}

const actionContext: ActionProducerContext = {
  repository: "owner/repository",
  workflowRef: "owner/repository/.github/workflows/release.yml@refs/heads/main",
  workflowSha: "d".repeat(40),
  runId: "224",
  runAttempt: "1",
  candidateCommit: "c".repeat(40)
}

const artifactTransport = (
  root: string,
  events: Array<string>
): ActionArtifactTransport => ({
  upload: async ({ name, rootDirectory }) => {
    events.push(`upload:${name}`)
    mkdirSync(root, { recursive: true })
    cpSync(rootDirectory, join(root, name), { recursive: true })
    return { id: 224, digest: `sha256:${"b".repeat(64)}` }
  },
  download: async ({ name, destination }) => {
    events.push(`download:${name}`)
    cpSync(join(root, name), destination, { recursive: true })
    return { path: destination, digestMismatch: false }
  }
})

describe("Plan 224 public API authority ordering", () => {
  test("corrupt and digest-valid invalid destinations or capabilities acquire zero credentials", async () => {
    const cases: ReadonlyArray<{
      readonly name: string
      readonly arrange: (root: string) => Promise<{
        readonly store: PreparedReleaseStoreShape
        readonly prepared: CompletePreparedReleaseRef
      }>
    }> = [
      {
        name: "corrupt blob",
        arrange: async (root) => {
          const { store, committed } = await commitLocal(root, remoteBundle())
          const artifact = committed.bundle.manifest.artifacts[0]!
          const blob = join(committed.bundle.directory, "blobs", artifact.blob.toString())
          chmodSync(blob, 0o600)
          writeFileSync(blob, "corrupt bytes")
          return { store, prepared: committed.ref }
        }
      },
      {
        name: "invalid destination origin",
        arrange: (root) => writeDigestValidInvalidBundle(root, (publication) => {
          publication.registryUrl = "https://attacker.example.test/"
        })
      },
      {
        name: "unsupported anonymous mutation capability",
        arrange: (root) => writeDigestValidInvalidBundle(root, (publication) => {
          publication.authority.observationStrategies = [{ kind: "anonymous" }]
          publication.authority.publishStrategy = { kind: "anonymous" }
        })
      }
    ]

    for (const current of cases) {
      const root = mkdtempSync(join(tmpdir(), "ts-release-api-authority-invalid-"))
      const recorded = trace()
      try {
        const { store, prepared } = await current.arrange(root)
        const api = makeReleaseApi(authorityLayer(store, recorded))
        try {
          await expect(api.publish({ prepared })).rejects.toMatchObject({
            _tag: "ReleaseAbortedError",
            prepared
          })
          expect(recorded.credentialRequests, current.name).toEqual([])
          expect(recorded.http, current.name).toEqual([])
        } finally {
          await api.dispose()
        }
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  test("a digest-valid artifact from an unauthorized Action run is rejected before credentials", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-api-authority-provenance-"))
    const events: Array<string> = []
    const recorded = trace()
    try {
      const artifacts = artifactTransport(join(root, "artifacts"), events)
      const producer = makeActionPreparedReleaseStore({
        workspace: join(root, "producer"),
        context: actionContext,
        artifacts
      })
      const fixture = localOnlyBundle()
      const committed = await Effect.runPromise(producer.commit(fixture.manifest, fixture.blobs))
      expect(events.filter((event) => event.startsWith("download:"))).toHaveLength(1)
      events.length = 0

      const unauthorized = makeActionPreparedReleaseStore({
        workspace: join(root, "unauthorized"),
        context: { ...actionContext, runId: "225" },
        artifacts
      })
      const api = makeReleaseApi(authorityLayer(unauthorized, recorded))
      try {
        await expect(api.publish({ prepared: committed.ref })).rejects.toMatchObject({
          _tag: "ReleaseAbortedError",
          prepared: committed.ref
        })
        expect(events).toEqual([])
        expect(recorded.credentialRequests).toEqual([])
        expect(recorded.http).toEqual([])
      } finally {
        await api.dispose()
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("anonymous and authenticated observe remain read-only through the public API", async () => {
    const scenarios = [
      {
        name: "anonymous",
        responses: [conflictResponse()],
        expectedStrategies: ["anonymous"],
        expectedGrants: ["AnonymousAccess"],
        expectedSecretRequests: 0
      },
      {
        name: "authenticated retry",
        responses: [response(404, {}), conflictResponse()],
        expectedStrategies: ["anonymous", "token"],
        expectedGrants: ["AnonymousAccess", "ScopedSecret"],
        expectedSecretRequests: 1
      }
    ] as const

    for (const scenario of scenarios) {
      const root = mkdtempSync(join(tmpdir(), "ts-release-api-authority-observe-"))
      const recorded = trace(...scenario.responses)
      try {
        const { store, committed } = await commitLocal(root, remoteBundle())
        const api = makeReleaseApi(authorityLayer(store, recorded))
        try {
          const report = await api.observe({ prepared: committed.ref })
          expect(report.status, scenario.name).toBe("different")
          expect(report.subjects[1], scenario.name).toMatchObject({
            observation: { _tag: "Different" }
          })
          expect(recorded.credentialRequests.map((request) => request.purpose), scenario.name)
            .toEqual(scenario.expectedStrategies.map(() => "observe"))
          expect(recorded.credentialRequests.map((request) => request.strategy.kind), scenario.name)
            .toEqual([...scenario.expectedStrategies])
          expect(recorded.http.map((item) => item.grant), scenario.name)
            .toEqual([...scenario.expectedGrants])
          expect(recorded.secretRequests, scenario.name).toHaveLength(scenario.expectedSecretRequests)
          expect(recorded.mutationRequests, scenario.name).toEqual([])
          expect(recorded.http.every(({ request }) => request.method === "GET"), scenario.name).toBe(true)
        } finally {
          await api.dispose()
        }
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  test("equivalent, conflicting, and inconclusive publication reports request no mutation authority", async () => {
    const scenarios = [
      {
        name: "equivalent local prepared subject",
        bundle: localOnlyBundle(),
        responses: [] as ReadonlyArray<HttpResponse>,
        expectedStatus: "complete",
        expectedRemoteTag: undefined
      },
      {
        name: "remote conflict",
        bundle: remoteBundle(),
        responses: [conflictResponse()],
        expectedStatus: "blocked",
        expectedRemoteTag: "BlockedSubject"
      },
      {
        name: "remote inconclusive",
        bundle: remoteBundle(),
        responses: [response(404, {}), response(404, {})],
        expectedStatus: "blocked",
        expectedRemoteTag: "BlockedSubject"
      }
    ] as const

    for (const scenario of scenarios) {
      const root = mkdtempSync(join(tmpdir(), "ts-release-api-authority-publish-"))
      const recorded = trace(...scenario.responses)
      try {
        const { store, committed } = await commitLocal(root, scenario.bundle)
        const api = makeReleaseApi(authorityLayer(store, recorded))
        try {
          const report = await api.publish({ prepared: committed.ref })
          expect(report.status, scenario.name).toBe(scenario.expectedStatus)
          expect(report.subjects[0], scenario.name).toMatchObject({ _tag: "AlreadyEquivalent" })
          if (scenario.expectedRemoteTag !== undefined) {
            expect(report.subjects[1], scenario.name).toMatchObject({ _tag: scenario.expectedRemoteTag })
          }
          expect(recorded.mutationRequests, scenario.name).toEqual([])
          expect(recorded.credentialRequests.every((request) => request.purpose === "observe"), scenario.name)
            .toBe(true)
        } finally {
          await api.dispose()
        }
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  test("a forced provider defect after durable commit carries the exact prepared reference", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-api-authority-defect-"))
    const recorded = trace("defect")
    try {
      const { store, committed } = await commitLocal(root, remoteBundle())
      const api = makeReleaseApi(authorityLayer(store, recorded))
      try {
        await expect(api.publish({ prepared: committed.ref })).rejects.toMatchObject({
          _tag: "ReleaseAbortedError",
          prepared: committed.ref,
          cause: "forced post-commit provider defect"
        })
        expect(recorded.credentialRequests.map((request) => [request.purpose, request.strategy.kind]))
          .toEqual([["observe", "anonymous"]])
        expect(recorded.mutationRequests).toEqual([])
      } finally {
        await api.dispose()
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
