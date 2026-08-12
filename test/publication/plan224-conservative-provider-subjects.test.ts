import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import {
  CredentialRef,
  EnvironmentName,
  type CredentialRequest
} from "../../src/model/authority.js"
import {
  formatNpmSha1Shasum,
  formatNpmSha512Sri,
  sha1Digest,
  sha256Digest,
  sha512Digest,
  type Sha256Digest
} from "../../src/model/digest.js"
import { NonEmptyName, OutputId, SafeRelativePath, Version } from "../../src/model/primitives.js"
import {
  CanonicalNpmRegistryEndpoint,
  NpmDistTag,
  NpmTokenAuthentication
} from "../../src/recipes/config.js"
import {
  CredentialProvider,
  makeCredentialProvider,
  type CredentialGrantDescriptor
} from "../../src/publication/authority.js"
import {
  publishPreparedRelease,
  subjectsForPreparedRelease
} from "../../src/publication/adapter.js"
import type { HttpResponse } from "../../src/publication/http.js"
import { makeNpmSubject } from "../../src/publication/npm.js"
import {
  MutationPrecondition,
  NeedsMutation
} from "../../src/publication/report.js"
import {
  makeGitHubPublicationAuthorityIntent,
  makeNpmPublicationAuthorityIntent
} from "../../src/release/graph.js"
import {
  PreparedArtifact,
  PreparedGitHubAsset,
  PreparedGitHubPublication,
  PreparedNpmPublication,
  PreparedProject,
  PreparedReleaseV2,
  PreparedSource
} from "../../src/release/prepared.js"
import type { PreparedBundle } from "../../src/release/prepared-store.js"
import {
  HttpAuthorizer,
  type HttpAuthorizerShape,
  type HttpObservationRequest
} from "../../src/publication/http.js"
import {
  unavailableCertifiedPublisherSpawn,
  unavailableMutationServicesLayer,
  unavailableNpmUserConfigResource
} from "../fixtures/mutation-services.js"

const source = (digest: Sha256Digest): PreparedSource => PreparedSource.make({
  commit: NonEmptyName.make("commit"),
  tree: NonEmptyName.make("tree"),
  clean: true,
  packageManifestPath: SafeRelativePath.make("package.json"),
  packageManifestDigest: digest
})

const artifact = (id: string, path: string, mediaType: string, bytes: Uint8Array): PreparedArtifact => {
  const digest = sha256Digest(bytes)
  return PreparedArtifact.make({
    id: OutputId.make(id),
    path: SafeRelativePath.make(path),
    kind: "archive",
    size: bytes.length,
    digest,
    blob: digest,
    mediaType
  })
}

const npmFixture = (): {
  readonly bundle: PreparedBundle
  readonly publication: PreparedNpmPublication
  readonly bytes: Uint8Array
} => {
  const bytes = new TextEncoder().encode("exact npm tarball bytes\n")
  const preparedArtifact = artifact("npm-tarball", "package.tgz", "application/gzip", bytes)
  const registryUrl = CanonicalNpmRegistryEndpoint.make("https://registry.example.test/")
  const authentication = NpmTokenAuthentication.make({
    strategy: "token", credential: CredentialRef.make("NPM_TOKEN")
  })
  const publication = PreparedNpmPublication.make({
    id: NonEmptyName.make("npm-release"),
    packageName: NonEmptyName.make("@fixture/package"),
    version: Version.make("1.0.0"),
    registryUrl,
    artifactId: preparedArtifact.id,
    distTag: NpmDistTag.make("latest"), access: "public", authentication,
    provenance: "disabled", publicationMode: "direct",
    authority: makeNpmPublicationAuthorityIntent({
      packageName: "@fixture/package",
      version: "1.0.0",
      registryUrl, distTag: "latest", authentication
    })
  })
  const digest = sha256Digest(bytes)
  const manifest = PreparedReleaseV2.make({
    schemaVersion: "prepared-release/v2",
    source: source(digest),
    project: PreparedProject.make({
      name: NonEmptyName.make("fixture"),
      packageName: publication.packageName,
      version: publication.version,
      tag: NonEmptyName.make("v1.0.0")
    }),
    artifacts: [preparedArtifact],
    publications: [publication]
  })
  return {
    bundle: {
      directory: "/tmp/plan224/npm",
      manifest,
      blobs: new Map([[preparedArtifact.id.toString(), bytes]])
    },
    publication,
    bytes
  }
}

const githubFixture = (): {
  readonly bundle: PreparedBundle
  readonly publication: PreparedGitHubPublication
  readonly bytes: Uint8Array
} => {
  const bytes = new TextEncoder().encode("exact GitHub asset bytes\n")
  const preparedArtifact = artifact("github-asset", "asset.zip", "application/zip", bytes)
  const publication = PreparedGitHubPublication.make({
    id: NonEmptyName.make("github-release"),
    repository: "owner/project",
    tag: NonEmptyName.make("v1.0.0"),
    title: NonEmptyName.make("Project 1.0.0"),
    body: "release notes",
    draft: false,
    prerelease: false,
    targetCommit: NonEmptyName.make("prepared-commit"),
    assets: [PreparedGitHubAsset.make({
      artifactId: preparedArtifact.id,
      name: "asset.zip",
      mediaType: "application/zip"
    })],
    authority: makeGitHubPublicationAuthorityIntent({
      repository: "owner/project",
      tag: "v1.0.0"
    })
  })
  const digest = sha256Digest(bytes)
  const manifest = PreparedReleaseV2.make({
    schemaVersion: "prepared-release/v2",
    source: source(digest),
    project: PreparedProject.make({
      name: NonEmptyName.make("fixture"),
      version: Version.make("1.0.0"),
      tag: publication.tag
    }),
    artifacts: [preparedArtifact],
    publications: [publication]
  })
  return {
    bundle: {
      directory: "/tmp/plan224/github",
      manifest,
      blobs: new Map([[preparedArtifact.id.toString(), bytes]])
    },
    publication,
    bytes
  }
}

const response = (status: number, body: unknown): HttpResponse => ({
  status,
  headers: {},
  body: typeof body === "string" || body instanceof Uint8Array ? body : JSON.stringify(body)
})

const descriptorFor = (request: CredentialRequest): CredentialGrantDescriptor => {
  switch (request.strategy.kind) {
    case "anonymous":
      return { _tag: "AnonymousAccess", purposes: ["observe"] }
    case "token":
      return {
        _tag: "ScopedSecret",
        purposes: [request.purpose],
        ref: request.strategy.credential
      }
    case "trusted-publishing":
      return {
        _tag: "WorkloadIdentity",
        purposes: [request.purpose],
        names: [EnvironmentName.make("ACTIONS_ID_TOKEN_REQUEST_URL")]
      }
  }
}

const recordingCredentials = (
  requests: Array<CredentialRequest>
): CredentialProvider["Service"] => makeCredentialProvider({
  acquire: (request) => Effect.sync(() => {
    requests.push(request)
    return descriptorFor(request)
  })
})

const recordingHttp = (
  responses: ReadonlyArray<HttpResponse>,
  requests: Array<HttpObservationRequest>
): HttpAuthorizerShape => {
  let index = 0
  return {
    execute: (request) => Effect.sync(() => {
      requests.push(request)
      const result = responses[index++]
      if (result === undefined) throw new Error("Missing scripted HTTP response.")
      return result
    })
  }
}

const runPublish = async (
  bundle: PreparedBundle,
  responses: ReadonlyArray<HttpResponse>
) => {
  const credentialRequests: Array<CredentialRequest> = []
  const httpRequests: Array<HttpObservationRequest> = []
  const http = recordingHttp(responses, httpRequests)
  const report = await Effect.runPromise(publishPreparedRelease(bundle).pipe(
    Effect.provideService(HttpAuthorizer, http),
    Effect.provideService(CredentialProvider, recordingCredentials(credentialRequests)),
    Effect.provide(unavailableMutationServicesLayer)
  ))
  return { report, credentialRequests, httpRequests }
}

const npmMetadata = (bytes: Uint8Array): unknown => ({
  dist: {
    integrity: formatNpmSha512Sri(sha512Digest(bytes)),
    shasum: formatNpmSha1Shasum(sha1Digest(bytes))
  }
})

describe("Plan 224 conservative provider subjects", () => {
  test("derives exact credential requests and one composite GitHub subject from prepared authority", async () => {
    const npm = npmFixture()
    const github = githubFixture()
    const bundle: PreparedBundle = {
      ...npm.bundle,
      manifest: PreparedReleaseV2.make({
        ...npm.bundle.manifest,
        artifacts: [...npm.bundle.manifest.artifacts, ...github.bundle.manifest.artifacts],
        publications: [npm.publication, github.publication]
      }),
      blobs: new Map([...npm.bundle.blobs, ...github.bundle.blobs])
    }
    const subjects = await Effect.runPromise(subjectsForPreparedRelease(bundle).pipe(
      Effect.provideService(HttpAuthorizer, recordingHttp([], [])),
      Effect.provide(unavailableMutationServicesLayer)
    ))

    expect(subjects).toHaveLength(2)
    expect(subjects.map((subject) => subject.id)).toEqual([
      npm.publication.authority.subject,
      github.publication.authority.subject
    ])
    for (const [subject, publication] of [
      [subjects[0]!, npm.publication],
      [subjects[1]!, github.publication]
    ] as const) {
      expect(subject.observationRequests.map((request) => request.strategy)).toEqual(
        [...publication.authority.observationStrategies]
      )
      expect(subject.observationRequests.every((request) =>
        request.subject === publication.authority.subject &&
        request.provider === publication.authority.provider &&
        request.audience === publication.authority.audience &&
        request.purpose === "observe"
      )).toBe(true)
      expect(subject.mutationRequest).toMatchObject({
        subject: publication.authority.subject,
        provider: publication.authority.provider,
        audience: publication.authority.audience,
        purpose: "publish",
        strategy: publication.authority.publishStrategy
      })
    }
  })

  test("npm recomputes both digests and turns a witnessed mismatch into a conflict without mutation authority", async () => {
    const { bundle } = npmFixture()
    const differentBytes = new TextEncoder().encode("different npm tarball bytes\n")
    const { report, credentialRequests, httpRequests } = await runPublish(bundle, [response(200, {
      name: "@fixture/package",
      versions: {
        "1.0.0": {
          name: "@fixture/package",
          version: "1.0.0",
          dist: {
            integrity: formatNpmSha512Sri(sha512Digest(differentBytes)),
            shasum: formatNpmSha1Shasum(sha1Digest(differentBytes))
          }
        }
      },
      "dist-tags": { latest: "1.0.0" }
    })])

    expect(report.status).toBe("blocked")
    expect(report.subjects[1]).toMatchObject({
      _tag: "BlockedSubject",
      cause: { _tag: "Conflict" },
      observations: [{ _tag: "PresentDifferent" }]
    })
    expect(credentialRequests.map((request) => request.purpose)).toEqual(["observe"])
    expect(httpRequests).toHaveLength(1)
  })

  test("npm exact-looking, missing, malformed, 404, status, and malformed JSON reads remain inconclusive", async () => {
    const { bundle, bytes } = npmFixture()
    const cases: ReadonlyArray<HttpResponse> = [
      response(200, npmMetadata(bytes)),
      response(200, { dist: { integrity: (npmMetadata(bytes) as { dist: { integrity: string } }).dist.integrity } }),
      response(200, { dist: { integrity: "sha512-malformed", shasum: "malformed" } }),
      response(404, {}),
      response(429, {}),
      response(200, "not-json")
    ]

    for (const current of cases) {
      const { report, credentialRequests } = await runPublish(bundle, [current, current])
      expect(report.status).toBe("blocked")
      expect(report.subjects[1]).toMatchObject({
        _tag: "BlockedSubject",
        cause: { _tag: "Blocked" },
        observations: [{ _tag: "Inconclusive" }, { _tag: "Inconclusive" }]
      })
      expect(credentialRequests.map((request) => request.purpose)).toEqual(["observe", "observe"])
    }
  })

  test("an npm mutation without a matching observed plan fails before dispatch", async () => {
    const fixture = npmFixture()
    const httpRequests: Array<HttpObservationRequest> = []
    const http = recordingHttp([], httpRequests)
    const subject = makeNpmSubject(
      fixture.bundle,
      fixture.publication,
      http,
      unavailableNpmUserConfigResource,
      unavailableCertifiedPublisherSpawn
    )
    const decision = NeedsMutation.make({
      subject: subject.id,
      precondition: MutationPrecondition.make({ kind: NonEmptyName.make("test-only") })
    })
    const credentials = recordingCredentials([])
    const grant = await Effect.runPromise(credentials.acquireForMutation(subject.mutationRequest, decision))
    const error = await Effect.runPromise(subject.mutate(decision, grant).pipe(Effect.flip))

    expect(error).toMatchObject({
      _tag: "ReleaseSubjectError",
      phase: "mutate",
      commitment: "before-dispatch"
    })
    expect(httpRequests).toEqual([])
  })
})
