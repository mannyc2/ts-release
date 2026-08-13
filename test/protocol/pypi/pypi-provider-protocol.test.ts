import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { CredentialRef, EnvironmentName, SubjectId } from "../../../src/model/authority.js"
import { sha256Digest } from "../../../src/model/digest.js"
import { inspectPythonDistribution } from "../../../src/model/python-distribution.js"
import { NonEmptyName, OutputId, SafeRelativePath, Version } from "../../../src/model/primitives.js"
import { CredentialProvider, makeCredentialProvider } from "../../../src/publication/authority.js"
import { PublicationClaimOccupied, type PublicationClaimStoreShape } from "../../../src/publication/claim.js"
import { publishReleaseSubjects } from "../../../src/publication/coordinator.js"
import type { AuthorizedMutationHttpShape, HttpAuthorizerShape } from "../../../src/publication/http.js"
import { makePyPiSubjects } from "../../../src/publication/pypi.js"
import { SafeReason } from "../../../src/publication/report.js"
import { makePyPiPublicationAuthorityIntent } from "../../../src/release/graph.js"
import {
  PreparedArtifact,
  PreparedProject,
  PreparedPyPiFile,
  PreparedPyPiPublication,
  PreparedReleaseV2,
  PreparedSource
} from "../../../src/release/prepared.js"
import type { PreparedBundle } from "../../../src/release/prepared-store.js"
import {
  PyPiExternalTrustedPublishingAuthentication,
  PyPiProjectName,
  PyPiTokenAuthentication,
  pypiRepositoryEndpoints
} from "../../../src/recipes/config.js"
import { fixtureArtifactProvenance, fixturePreparedProvenance, fixtureStagingSnapshot } from "../../fixtures/prepared-provenance.js"
import { sdistFixture, wheelFixture } from "../../fixtures/python-distributions.js"

const project = PyPiProjectName.make("fixture")
const version = Version.make("1.2.3")
const authentication = PyPiTokenAuthentication.make({
  strategy: "token", credential: CredentialRef.make("FIXTURE_PYPI_TOKEN"), scope: "project"
})
const endpoints = pypiRepositoryEndpoints("pypi")

const fixture = (): { readonly bundle: PreparedBundle, readonly publication: PreparedPyPiPublication } => {
  const distributions = [wheelFixture(), sdistFixture()]
  const artifacts = distributions.map((distribution, index) => {
    const digest = sha256Digest(distribution.bytes)
    return PreparedArtifact.make({
      id: OutputId.make(`pypi-${index}`), path: SafeRelativePath.make(`dist/${distribution.filename}`),
      kind: "archive", size: distribution.bytes.length, digest, blob: digest,
      mediaType: distribution.filename.endsWith(".whl") ? "application/zip" : "application/gzip",
      ...fixtureArtifactProvenance("pypi-fixture")
    })
  })
  const files = distributions.map((distribution, index) => {
    const artifact = artifacts[index]!
    return PreparedPyPiFile.make({
      artifactId: artifact.id, filename: NonEmptyName.make(distribution.filename), size: artifact.size,
      sha256: artifact.digest, mediaType: artifact.mediaType as "application/zip" | "application/gzip",
      distribution: inspectPythonDistribution(distribution.filename, distribution.bytes, project, version),
      authority: makePyPiPublicationAuthorityIntent({
        project, version, filename: distribution.filename, repository: "pypi", authentication,
        sourceCommit: "1".repeat(40)
      })
    })
  }) as [PreparedPyPiFile, PreparedPyPiFile]
  const publication = PreparedPyPiPublication.make({
    id: NonEmptyName.make("pypi-release"), project, version, repository: "pypi",
    simpleBaseUrl: endpoints.simpleBaseUrl, projectUrl: `${endpoints.simpleBaseUrl}${project}/`,
    uploadUrl: endpoints.uploadUrl, authentication, files
  })
  const manifest = PreparedReleaseV2.make({
    kind: "complete", schemaVersion: "prepared-release/v2",
    source: PreparedSource.make({
      commit: NonEmptyName.make("1".repeat(40)), tree: NonEmptyName.make("2".repeat(40)), clean: true,
      packageManifestPath: SafeRelativePath.make("package.json"),
      packageManifestDigest: sha256Digest(new TextEncoder().encode("fixture")),
      materialized: fixtureStagingSnapshot
    }),
    project: PreparedProject.make({ name: NonEmptyName.make("fixture"), version, tag: NonEmptyName.make("v1.2.3") }),
    provenance: fixturePreparedProvenance, artifacts, collections: [], publications: [publication]
  })
  return {
    bundle: { directory: "/protocol/pypi", manifest, blobs: new Map(artifacts.map((artifact, index) => [artifact.id.toString(), distributions[index]!.bytes])) },
    publication
  }
}

const credentials = makeCredentialProvider({
  acquire: (request) => Effect.succeed(request.strategy.kind === "anonymous"
    ? { _tag: "AnonymousAccess", purposes: ["observe"] as const }
    : request.strategy.kind === "token"
    ? { _tag: "ScopedSecret", purposes: [request.purpose] as [typeof request.purpose], ref: request.strategy.credential }
    : {
      _tag: "WorkloadIdentity", purposes: [request.purpose] as [typeof request.purpose],
      names: [EnvironmentName.make("ACTIONS_ID_TOKEN_REQUEST_URL"), EnvironmentName.make("ACTIONS_ID_TOKEN_REQUEST_TOKEN")] as const
    })
})

const simple = (prepared: ReturnType<typeof fixture>, present: ReadonlySet<string>): string => JSON.stringify({
  meta: { "api-version": "1.1" }, name: project, versions: [version],
  files: prepared.publication.files.filter((file) => present.has(file.filename.toString())).map((file) => ({
    filename: file.filename, url: `https://files.pythonhosted.org/${file.filename}`,
    hashes: { sha256: file.sha256.hex }, size: file.size, yanked: false
  }))
})

const claimStore = (): PublicationClaimStoreShape => {
  const claimed = new Set<string>()
  return {
    claim: (request) => claimed.has(request.subject)
      ? Effect.fail(PublicationClaimOccupied.make({
        subject: request.subject,
        reason: SafeReason.make("protocol terminal claim already exists")
      }))
      : Effect.sync(() => { claimed.add(request.subject) })
  }
}

describe("PyPI exact-file provider protocol", () => {
  test("publishes missing files one at a time and fresh rerun is a no-op", async () => {
    const prepared = fixture()
    const present = new Set<string>()
    const events: Array<string> = []
    const http: HttpAuthorizerShape = {
      execute: (request) => Effect.sync(() => {
        events.push(`GET ${request.url}`)
        return { status: 200, headers: { "content-type": "application/vnd.pypi.simple.v1+json" }, body: simple(prepared, present) }
      })
    }
    const mutation: AuthorizedMutationHttpShape = {
      execute: (operation, request, grant) => Effect.sync(() => {
        expect(grant._tag).toBe("ScopedSecret")
        expect(request.credentialScheme).toBe("pypi-token-basic")
        expect(request.url).toBe(endpoints.uploadUrl)
        expect(request.headers?.authorization).toBeUndefined()
        const file = prepared.publication.files.find((candidate) => candidate.authority.subject === operation.subject)!
        const body = request.body as Uint8Array
        expect(new TextDecoder().decode(body)).not.toContain("FIXTURE_PYPI_TOKEN")
        present.add(file.filename.toString())
        events.push(`POST ${file.filename}`)
        return { status: 200, headers: {}, body: "OK" }
      })
    }
    const subjects = makePyPiSubjects(prepared.bundle, prepared.publication, http, mutation, claimStore())
    const first = await Effect.runPromise(publishReleaseSubjects({
      prepared: SubjectId.make("prepared:pypi"), subjects
    }).pipe(Effect.provideService(CredentialProvider, credentials)))
    expect(first.subjects.slice(1).map((subject) => subject._tag)).toEqual([
      "ConvergedAfterMutation", "ConvergedAfterMutation"
    ])
    expect(events.filter((event) => event.startsWith("POST"))).toEqual([
      `POST ${prepared.publication.files[0]!.filename}`,
      `POST ${prepared.publication.files[1]!.filename}`
    ])
    const postCount = events.length
    const second = await Effect.runPromise(publishReleaseSubjects({
      prepared: SubjectId.make("prepared:pypi"), subjects
    }).pipe(Effect.provideService(CredentialProvider, credentials)))
    expect(second.subjects.slice(1).map((subject) => subject._tag)).toEqual(["AlreadyEquivalent", "AlreadyEquivalent"])
    expect(events.slice(postCount).every((event) => event.startsWith("GET"))).toBe(true)
  })

  test("response loss converges only through exact reobservation", async () => {
    const prepared = fixture()
    const present = new Set<string>([prepared.publication.files[1]!.filename.toString()])
    let writes = 0
    const http: HttpAuthorizerShape = { execute: () => Effect.succeed({
      status: 200, headers: { "content-type": "application/vnd.pypi.simple.v1+json" }, body: simple(prepared, present)
    }) }
    const mutation: AuthorizedMutationHttpShape = {
      execute: (operation) => Effect.sync(() => {
        writes += 1
        const file = prepared.publication.files.find((candidate) => candidate.authority.subject === operation.subject)!
        present.add(file.filename.toString())
      }).pipe(Effect.flatMap(() => Effect.fail({
        _tag: "CredentialPlatformError" as const,
        phase: "mutate" as const,
        commitment: "unknown" as const,
        reason: "protocol response lost"
      })))
    }
    const report = await Effect.runPromise(publishReleaseSubjects({
      prepared: SubjectId.make("prepared:pypi-loss"),
      subjects: makePyPiSubjects(prepared.bundle, prepared.publication, http, mutation, claimStore())
    }).pipe(Effect.provideService(CredentialProvider, credentials)))
    expect(report.subjects[1]).toMatchObject({
      _tag: "ConvergedAfterMutation", attempt: { _tag: "OutcomeUnknown" },
      postObservations: [{ _tag: "PresentEquivalent" }]
    })
    expect(writes).toBe(1)
  })

  test("terminal CAS prevents a fresh-process blind replay when response loss remains absent", async () => {
    const prepared = fixture()
    const present = new Set<string>([prepared.publication.files[1]!.filename.toString()])
    const claims = claimStore()
    let writes = 0
    const http: HttpAuthorizerShape = { execute: () => Effect.succeed({
      status: 200, headers: { "content-type": "application/vnd.pypi.simple.v1+json" }, body: simple(prepared, present)
    }) }
    const mutation: AuthorizedMutationHttpShape = {
      execute: () => Effect.sync(() => { writes += 1 }).pipe(Effect.flatMap(() => Effect.fail({
        _tag: "CredentialPlatformError" as const,
        phase: "mutate" as const,
        commitment: "unknown" as const,
        reason: "protocol response lost before remote state was observable"
      })))
    }
    const firstSubject = makePyPiSubjects(prepared.bundle, prepared.publication, http, mutation, claims)[0]!
    const observationGrant = await Effect.runPromise(credentials.acquireForObservation(firstSubject.observationRequests[0]))
    const observation = await Effect.runPromise(firstSubject.observe(observationGrant, { phase: "pre-mutation" }))
    const decision = firstSubject.decide(observation)
    expect(decision._tag).toBe("NeedsMutation")
    if (decision._tag !== "NeedsMutation") throw new Error("expected exact PyPI file absence")
    await Effect.runPromise(firstSubject.claimMutation!(decision))
    const mutationGrant = await Effect.runPromise(credentials.acquireForMutation(firstSubject.mutationRequest, decision))
    expect(await Effect.runPromise(firstSubject.mutate(decision, mutationGrant).pipe(Effect.flip))).toMatchObject({
      _tag: "ReleaseSubjectError", commitment: "unknown"
    })
    // A fresh subject graph has no process memory from the first attempt. The
    // shared terminal store is the only state carried across this boundary.
    const second = await publishReleaseSubjects({
      prepared: SubjectId.make("prepared:pypi-terminal-claim"),
      subjects: makePyPiSubjects(prepared.bundle, prepared.publication, http, mutation, claims)
    }).pipe(Effect.provideService(CredentialProvider, credentials), Effect.runPromise)
    expect(second.subjects[1]).toMatchObject({
      _tag: "BlockedSubject", cause: { _tag: "Blocked" },
      observationAuthorities: [{ grantKind: "AnonymousAccess" }]
    })
    expect(writes).toBe(1)
  })

  test("old/malformed/unauthorized Simple responses never authorize upload", async () => {
    const prepared = fixture()
    for (const response of [
      ...[301, 302, 307, 308, 401, 403, 406, 408, 409, 422, 429, 500, 503].map((status) => ({
        status, headers: {}, body: "{}"
      })),
      { status: 404, headers: {}, body: "{}" },
      { status: 200, headers: { "content-type": "text/html" }, body: "<html/>" },
      { status: 200, headers: { "content-type": "application/vnd.pypi.simple.v1+json" }, body: "{" },
      { status: 200, headers: { "content-type": "application/vnd.pypi.simple.v1+json" }, body: JSON.stringify({ meta: { "api-version": "1.0" }, name: project, files: [] }) },
      { status: 200, headers: { "content-type": "application/vnd.pypi.simple.v1+json" }, body: JSON.stringify({ meta: { "api-version": "2.0" }, name: project, files: [] }) },
      { status: 200, headers: { "content-type": "application/vnd.pypi.simple.v1+json" }, body: JSON.stringify({
        meta: { "api-version": "1.1" }, name: project,
        files: [{ filename: prepared.publication.files[0]!.filename, hashes: {}, size: prepared.publication.files[0]!.size }]
      }) }
    ]) {
      let mutations = 0
      const subject = makePyPiSubjects(prepared.bundle, prepared.publication, {
        execute: () => Effect.succeed(response)
      }, {
        execute: () => Effect.sync(() => { mutations += 1; throw new Error("must not mutate") })
      }, claimStore())[0]!
      const grant = await Effect.runPromise(credentials.acquireForObservation(subject.observationRequests[0]))
      const observation = await Effect.runPromise(subject.observe(grant, { phase: "pre-mutation" }))
      expect(observation._tag).toBe("Inconclusive")
      expect(subject.decide(observation)._tag).toBe("Blocked")
      expect(mutations).toBe(0)
    }
  })

  test("exact filename conflicts on size, digest, or yanked state and unyanked equality is accepted", async () => {
    const prepared = fixture()
    const file = prepared.publication.files[0]!
    const subjectFor = (raw: Record<string, unknown>) => makePyPiSubjects(prepared.bundle, prepared.publication, {
      execute: () => Effect.succeed({
        status: 200,
        headers: { "content-type": "application/vnd.pypi.simple.v1+json; charset=UTF-8" },
        body: JSON.stringify({ meta: { "api-version": "1.4" }, name: project, files: [{
          filename: file.filename, url: "https://files.pythonhosted.org/file", hashes: { sha256: file.sha256.hex },
          size: file.size, yanked: false, ...raw
        }] })
      })
    }, { execute: () => Effect.die("conflicting/equivalent observations never mutate") }, claimStore())[0]!
    for (const raw of [
      { size: file.size + 1 },
      { hashes: { sha256: "f".repeat(64) } },
      { yanked: "withdrawn" },
      { yanked: true }
    ]) {
      const subject = subjectFor(raw)
      const grant = await Effect.runPromise(credentials.acquireForObservation(subject.observationRequests[0]))
      const observation = await Effect.runPromise(subject.observe(grant, { phase: "pre-mutation" }))
      expect(observation._tag).toBe("PresentDifferent")
      expect(subject.decide(observation)._tag).toBe("Conflict")
    }
    const subject = subjectFor({ yanked: false })
    const grant = await Effect.runPromise(credentials.acquireForObservation(subject.observationRequests[0]))
    expect((await Effect.runPromise(subject.observe(grant, { phase: "pre-mutation" })))._tag).toBe("PresentEquivalent")
  })

  test("PyPI and TestPyPI authority bind distinct Simple and upload origins", () => {
    const pypi = makePyPiPublicationAuthorityIntent({
      project, version, filename: "fixture-1.2.3.tar.gz", repository: "pypi", authentication,
      sourceCommit: "1".repeat(40)
    })
    const testpypi = makePyPiPublicationAuthorityIntent({
      project, version, filename: "fixture-1.2.3.tar.gz", repository: "testpypi", authentication,
      sourceCommit: "1".repeat(40)
    })
    expect(pypi.audience.toString()).toBe("https://upload.pypi.org/legacy/")
    expect(testpypi.audience.toString()).toBe("https://test.pypi.org/legacy/")
    expect(pypi.subject).not.toBe(testpypi.subject)
  })

  test("stock coordinator reports external PyPA Action trusted publishing before dispatch", async () => {
    const prepared = fixture()
    const external = PyPiExternalTrustedPublishingAuthentication.make({
      strategy: "trusted-publishing", owner: "external", action: "pypa/gh-action-pypi-publish@release/v1",
      repository: "owner/fixture", workflow: "release.yml", workflowRef: "refs/heads/main",
      environment: "pypi", projects: ["fixture"]
    })
    const files = prepared.publication.files.map((file) => PreparedPyPiFile.make({
      ...file,
      authority: makePyPiPublicationAuthorityIntent({
        project, version, filename: file.filename, repository: "pypi", authentication: external,
        sourceCommit: "1".repeat(40)
      })
    })) as [PreparedPyPiFile, PreparedPyPiFile]
    const publication = PreparedPyPiPublication.make({ ...prepared.publication, authentication: external, files })
    const bundle: PreparedBundle = {
      ...prepared.bundle,
      manifest: PreparedReleaseV2.make({ ...prepared.bundle.manifest, publications: [publication] })
    }
    let dispatched = 0
    const subjects = makePyPiSubjects(bundle, publication, {
      execute: () => Effect.succeed({
        status: 200, headers: { "content-type": "application/vnd.pypi.simple.v1+json" }, body: simple(prepared, new Set())
      })
    }, {
      execute: () => Effect.sync(() => { dispatched += 1; throw new Error("external OIDC must not dispatch") })
    }, claimStore())
    const report = await Effect.runPromise(publishReleaseSubjects({
      prepared: SubjectId.make("prepared:pypi-external"), subjects
    }).pipe(Effect.provideService(CredentialProvider, credentials)))
    expect(report.subjects[1]).toMatchObject({
      _tag: "BlockedSubject",
      cause: { _tag: "Blocked" }
    })
    expect(dispatched).toBe(0)
    expect(JSON.stringify(report)).not.toContain("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
  })
})
