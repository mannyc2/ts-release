import { describe, expect, it } from "@effect/bun-test"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as TestClock from "effect/testing/TestClock"
import { readFileSync } from "node:fs"
import {
  EnvironmentName,
  type CredentialRequest
} from "../../src/model/authority.js"
import { sha256Digest } from "../../src/model/digest.js"
import {
  CredentialProvider,
  makeCredentialProvider,
  type CredentialGrantDescriptor
} from "../../src/publication/authority.js"
import {
  publishPreparedRelease,
  subjectsForPreparedRelease
} from "../../src/publication/adapter.js"
import {
  AuthorizedMutationHttp,
  HttpAuthorizer
} from "../../src/publication/http.js"
import {
  CertifiedPublisherSpawn,
  makeNpmUserConfigHandle,
  NpmUserConfigResource,
  RejectedBeforeStart
} from "../../src/publication/publisher.js"
import {
  decodePreparedRelease,
  encodePreparedRelease,
  type PreparedGitHubPublication,
  type PreparedNpmPublication
} from "../../src/release/prepared.js"
import type { PreparedBundle } from "../../src/release/prepared-store.js"
import {
  makePrepackedMultipackageFixture,
  prepackedPackages,
  type PrepackedMultipackageFixture
} from "../fixtures/prepacked-multipackage-release.js"
import {
  GithubProtocolScenarioSchemaVersion,
  makeGithubProtocolDouble,
  type GithubProtocolDouble,
  type GithubProtocolScenarioV1
} from "../protocol/github/double.js"
import {
  makeNpmProviderScenario,
  type NpmProviderScenarioInput,
  type NpmProviderScenarioState
} from "../protocol/npm/scenario.js"

type NpmInitial = NpmProviderScenarioInput["initial"]
type NpmPublishResult = NpmProviderScenarioState["publishResult"]

const equivalent: NpmInitial = {
  packageVisibility: "visible",
  versionState: "equivalent",
  distTagState: "equivalent"
}

const absent: NpmInitial = {
  packageVisibility: "visible",
  versionState: "absent",
  distTagState: "missing"
}

const different: NpmInitial = {
  packageVisibility: "visible",
  versionState: "different",
  distTagState: "equivalent"
}

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

const credentials = makeCredentialProvider({
  acquire: (request) => Effect.succeed(descriptorFor(request))
})

const npmPublications = (bundle: PreparedBundle): ReadonlyArray<PreparedNpmPublication> =>
  bundle.manifest.publications.filter((publication): publication is PreparedNpmPublication =>
    publication._tag === "PreparedNpmPublication")

const githubPublication = (bundle: PreparedBundle): PreparedGitHubPublication => {
  const publication = bundle.manifest.publications.find((candidate): candidate is PreparedGitHubPublication =>
    candidate._tag === "PreparedGitHubPublication")
  if (publication === undefined) throw new Error("Five-package fixture omitted GitHub publication.")
  return publication
}

const githubScenario = (
  fixture: PrepackedMultipackageFixture,
  state: "absent" | "equivalent"
): GithubProtocolScenarioV1 => {
  const publication = githubPublication(fixture.bundle)
  return {
    schemaVersion: GithubProtocolScenarioSchemaVersion,
    repository: publication.repository,
    tag: publication.tag.toString(),
    targetCommit: publication.targetCommit.toString(),
    ...(state === "absent"
      ? {}
      : {
        tagRef: { type: "commit" as const, sha: publication.targetCommit.toString() },
        release: {
          id: 700,
          tag: publication.tag.toString(),
          title: publication.title.toString(),
          body: publication.body ?? "",
          draft: publication.draft,
          prerelease: publication.prerelease,
          assets: publication.assets.map((asset, index) => ({
            id: 100 + index,
            name: asset.name,
            mediaType: asset.mediaType,
            bytes: fixture.bundle.blobs.get(asset.artifactId.toString())!,
            digest: "present" as const
          }))
        }
      })
  }
}

interface CapturedPublish {
  readonly packageName: string
  readonly path: string
  readonly bytes: Uint8Array
}

const harness = (
  fixture: PrepackedMultipackageFixture,
  options: {
    readonly initial: (packageName: string, index: number) => NpmInitial
    readonly result?: (packageName: string, index: number) => NpmPublishResult
    readonly github?: "absent" | "equivalent"
    readonly rejectBeforeStartOnce?: string
  }
) => {
  const publications = npmPublications(fixture.bundle)
  const npm = new Map(publications.map((publication, index) => {
    const packageName = publication.packageName.toString()
    const artifactBytes = fixture.bundle.blobs.get(publication.artifactId.toString())!
    return [publication.authority.subject.toString(), makeNpmProviderScenario({
      packageName,
      version: publication.version.toString(),
      distTag: publication.distTag.toString(),
      bytes: artifactBytes,
      initial: options.initial(packageName, index),
      publishResult: options.result?.(packageName, index) ?? "exit-0"
    })] as const
  }))
  const github = makeGithubProtocolDouble(githubScenario(fixture, options.github ?? "equivalent"))
  const captured: Array<CapturedPublish> = []
  const events: Array<string> = []
  const rejected = new Set<string>()
  const http: HttpAuthorizer["Service"] = {
    execute: (request, grant) => {
      const scenario = npm.get(request.subject.toString())
      if (scenario !== undefined) {
        const packageName = request.subject.toString().slice("npm:".length, -"@0.3.0".length)
        events.push(`npm:observe:${packageName}`)
        return scenario.http.execute(request, grant)
      }
      events.push("github:observe")
      return github.http.execute(request, grant)
    }
  }
  const mutationHttp: AuthorizedMutationHttp["Service"] = {
    execute: (operation, request, grant) => {
      events.push(`github:mutate:${request.method}`)
      return github.mutationHttp.execute(operation, request, grant)
    }
  }
  const publisher: CertifiedPublisherSpawn["Service"] = {
    preflightTrustedNpm: () => Effect.die("Five-package fixture uses token publishing only."),
    spawn: (spec, grant) => {
      const packageName = spec.packageName.toString()
      const exactBytes = new Uint8Array(readFileSync(spec.tarballPath))
      captured.push({ packageName, path: spec.tarballPath, bytes: exactBytes })
      events.push(`npm:mutate:${packageName}`)
      if (options.rejectBeforeStartOnce === packageName && !rejected.has(packageName)) {
        rejected.add(packageName)
        return Effect.succeed(RejectedBeforeStart.make({
          commitment: "before-dispatch",
          reason: "fixture rejected before process start"
        }))
      }
      const publication = publications.find((candidate) => candidate.packageName.toString() === packageName)!
      return npm.get(publication.authority.subject.toString())!.publisher.spawn(spec, grant)
    }
  }
  const userConfigs: NpmUserConfigResource["Service"] = {
    acquire: () => Effect.acquireRelease(
      Effect.succeed(makeNpmUserConfigHandle()),
      () => Effect.void
    )
  }
  const subjects = subjectsForPreparedRelease(fixture.bundle).pipe(
    Effect.provideService(HttpAuthorizer, http),
    Effect.provideService(AuthorizedMutationHttp, mutationHttp),
    Effect.provideService(NpmUserConfigResource, userConfigs),
    Effect.provideService(CertifiedPublisherSpawn, publisher)
  )
  const publish = publishPreparedRelease(fixture.bundle).pipe(
    Effect.provideService(HttpAuthorizer, http),
    Effect.provideService(AuthorizedMutationHttp, mutationHttp),
    Effect.provideService(NpmUserConfigResource, userConfigs),
    Effect.provideService(CertifiedPublisherSpawn, publisher),
    Effect.provideService(CredentialProvider, credentials)
  )
  return {
    npm,
    github,
    captured,
    events,
    subjects,
    publish
  }
}

const expectedPackageNames = prepackedPackages.map(({ packageName }) => packageName)

const expectExactCapturedBytes = (
  fixture: PrepackedMultipackageFixture,
  captured: ReadonlyArray<CapturedPublish>
): void => {
  for (const item of captured) {
    const expected = fixture.subjects.find((subject) => subject.packageName === item.packageName)!
    expect(item.bytes).toEqual(expected.bytes)
    expect(item.path.endsWith(sha256Digest(expected.bytes).hex)).toBe(true)
  }
}

describe("ordered exact prepacked multi-package release", () => {
  it("preserves five authored blobs and subjects through preparation, reload, and the real adapter", async () => {
    const fixture = await makePrepackedMultipackageFixture()
    try {
      expect(fixture.preparationCommands).toBe(0)
      expect(fixture.bundle.blobs.size).toBe(5)
      expect(fixture.bundle.manifest.artifacts).toHaveLength(5)
      expect(fixture.bundle.manifest.publications.map((publication) => publication.id.toString())).toEqual([
        ...prepackedPackages.map(({ id }) => `npm:${id}`),
        "github:github-release"
      ])
      const decoded = decodePreparedRelease(encodePreparedRelease(fixture.bundle.manifest))
      expect(decoded.publications.map((publication) => publication.id.toString())).toEqual(
        fixture.bundle.manifest.publications.map((publication) => publication.id.toString())
      )
      for (const subject of fixture.subjects) {
        expect(fixture.bundle.blobs.get(subject.artifactId)).toEqual(subject.bytes)
      }
      const runtime = harness(fixture, { initial: () => equivalent })
      const subjects = await Effect.runPromise(runtime.subjects)
      expect(subjects.map((subject) => subject.id.toString())).toEqual([
        ...expectedPackageNames.map((packageName) => `npm:${packageName}@0.3.0`),
        "github:owner/project#v0.3.0"
      ])
      expect(subjects.map((subject) => subject.prerequisites?.map(String) ?? [])).toEqual(
        subjects.map((_, index) => subjects.slice(0, index).map((subject) => subject.id.toString()))
      )
    } finally {
      fixture.cleanup()
    }
  })

  it("publishes all five exact tarball bytes in authored order before creating GitHub last", async () => {
    const fixture = await makePrepackedMultipackageFixture()
    try {
      const runtime = harness(fixture, { initial: () => absent, github: "absent" })
      const report = await Effect.runPromise(runtime.publish)
      expect(report.status).toBe("complete")
      expect(report.subjects.slice(1).map((subject) => subject._tag)).toEqual(
        Array.from({ length: 6 }, () => "ConvergedAfterMutation")
      )
      expect(runtime.captured.map(({ packageName }) => packageName)).toEqual(expectedPackageNames)
      expectExactCapturedBytes(fixture, runtime.captured)
      const firstGithubMutation = runtime.events.findIndex((event) => event.startsWith("github:mutate:"))
      const lastNpmMutation = runtime.events.reduce((last, event, index) =>
        event.startsWith("npm:mutate:") ? index : last, -1)
      expect(firstGithubMutation).toBeGreaterThan(lastNpmMutation)
      expect(runtime.github.mutationCount()).toBe(6)
      expect(runtime.github.scenario.release?.assets.map((asset) => asset.name)).toEqual(
        fixture.subjects.map((subject) => `${subject.packageName}.tgz`)
      )
      expect(runtime.github.scenario.release?.assets.map((asset) => asset.bytes)).toEqual(
        fixture.subjects.map((subject) => subject.bytes)
      )
    } finally {
      fixture.cleanup()
    }
  })

  it("resumes without republishing equivalent predecessors", async () => {
    const fixture = await makePrepackedMultipackageFixture()
    try {
      for (const equivalentCount of [1, 2, 3, 4]) {
        const runtime = harness(fixture, {
          initial: (_packageName, index) => index < equivalentCount ? equivalent : absent
        })
        const report = await Effect.runPromise(runtime.publish)
        expect(report.status).toBe("complete")
        expect(runtime.captured.map(({ packageName }) => packageName)).toEqual(
          expectedPackageNames.slice(equivalentCount)
        )
        expect(report.subjects.slice(1, equivalentCount + 1).every((subject) => subject._tag === "AlreadyEquivalent"))
          .toBe(true)
        expectExactCapturedBytes(fixture, runtime.captured)
        expect(runtime.github.mutationCount()).toBe(0)
      }
    } finally {
      fixture.cleanup()
    }
  })

  it("stops at every conflicting package and never reaches later npm or GitHub subjects", async () => {
    const fixture = await makePrepackedMultipackageFixture()
    try {
      for (let conflictIndex = 0; conflictIndex < expectedPackageNames.length; conflictIndex += 1) {
        const runtime = harness(fixture, {
          initial: (_packageName, index) => index < conflictIndex
            ? equivalent
            : index === conflictIndex ? different : absent
        })
        const report = await Effect.runPromise(runtime.publish)
        expect(report.status).toBe("blocked")
        expect(report.subjects[conflictIndex + 1]).toMatchObject({
          _tag: "BlockedSubject",
          cause: { _tag: "Conflict" }
        })
        expect(report.subjects.slice(conflictIndex + 2).every((subject) => subject._tag === "NotReached")).toBe(true)
        expect(runtime.captured).toEqual([])
        expect(runtime.github.mutationCount()).toBe(0)
        expect(runtime.npm.get(`npm:${expectedPackageNames[conflictIndex]}@0.3.0`)?.state.observationCount).toBe(1)
        expect(expectedPackageNames.slice(conflictIndex + 1).every((packageName) =>
          runtime.npm.get(`npm:${packageName}@0.3.0`)?.state.observationCount === 0)).toBe(true)
      }
    } finally {
      fixture.cleanup()
    }
  })

  it("retries only after a separate invocation when one publisher rejects before dispatch", async () => {
    const fixture = await makePrepackedMultipackageFixture()
    try {
      const rejectedPackage = expectedPackageNames[2]!
      const runtime = harness(fixture, {
        initial: () => absent,
        rejectBeforeStartOnce: rejectedPackage
      })
      const first = await Effect.runPromise(runtime.publish)
      expect(first.status).toBe("blocked")
      expect(first.subjects[3]).toMatchObject({
        _tag: "BlockedSubject",
        cause: { _tag: "AuthorityAcquiredButMutationNotDispatched" }
      })
      expect(first.subjects.slice(4).every((subject) => subject._tag === "NotReached")).toBe(true)
      expect(runtime.captured.map(({ packageName }) => packageName)).toEqual(expectedPackageNames.slice(0, 3))

      const second = await Effect.runPromise(runtime.publish)
      expect(second.status).toBe("complete")
      expect(runtime.captured.map(({ packageName }) => packageName)).toEqual([
        ...expectedPackageNames.slice(0, 3),
        ...expectedPackageNames.slice(2)
      ])
      const repeated = runtime.captured.filter(({ packageName }) => packageName === rejectedPackage)
      expect(repeated).toHaveLength(2)
      expect(repeated[0]!.bytes).toEqual(repeated[1]!.bytes)
      expectExactCapturedBytes(fixture, runtime.captured)
    } finally {
      fixture.cleanup()
    }
  })

  it("reobserves a response-loss outcome before advancing and never republishes it", async () => {
    const fixture = await makePrepackedMultipackageFixture()
    try {
      const uncertainPackage = expectedPackageNames[2]!
      const nextPackage = expectedPackageNames[3]!
      const runtime = harness(fixture, {
        initial: () => absent,
        result: (packageName) => packageName === uncertainPackage ? "response-loss" : "exit-0"
      })
      const report = await Effect.runPromise(runtime.publish)
      expect(report.status).toBe("complete")
      expect(report.subjects[3]).toMatchObject({
        _tag: "ConvergedAfterMutation",
        attempt: { _tag: "OutcomeUnknown" },
        postObservations: [{ _tag: "PresentEquivalent" }]
      })
      expect(runtime.captured.filter(({ packageName }) => packageName === uncertainPackage)).toHaveLength(1)
      const mutation = runtime.events.indexOf(`npm:mutate:${uncertainPackage}`)
      const reobservation = runtime.events.indexOf(`npm:observe:${uncertainPackage}`, mutation + 1)
      const nextObservation = runtime.events.indexOf(`npm:observe:${nextPackage}`, reobservation + 1)
      const nextMutation = runtime.events.indexOf(`npm:mutate:${nextPackage}`, nextObservation + 1)
      expect(mutation).toBeLessThan(reobservation)
      expect(reobservation).toBeLessThan(nextObservation)
      expect(nextObservation).toBeLessThan(nextMutation)
      expectExactCapturedBytes(fixture, runtime.captured)
    } finally {
      fixture.cleanup()
    }
  })

  it.effect("keeps an unknown nonconvergent package uncertain and does not reach later subjects", () =>
    Effect.acquireUseRelease(
      Effect.promise(makePrepackedMultipackageFixture),
      (fixture) => Effect.gen(function*() {
        const uncertainPackage = expectedPackageNames[2]!
        const runtime = harness(fixture, {
          initial: (_packageName, index) => index < 2 ? equivalent : absent,
          result: (packageName) => packageName === uncertainPackage ? "stdout-failure" : "exit-0"
        })
        const fiber = yield* runtime.publish.pipe(Effect.forkChild)
        yield* TestClock.adjust(Duration.seconds(120))
        const report = yield* Fiber.join(fiber)
        expect(report.status).toBe("uncertain")
        expect(report.subjects[3]).toMatchObject({
          _tag: "UncertainSubject",
          attempt: { _tag: "OutcomeUnknown" },
          trace: Array.from({ length: 6 }, () => ({ _tag: "VisibilityPending" }))
        })
        expect(report.subjects.slice(4).every((subject) => subject._tag === "NotReached")).toBe(true)
        expect(runtime.captured.map(({ packageName }) => packageName)).toEqual([uncertainPackage])
        expect(runtime.github.mutationCount()).toBe(0)
      }),
      (fixture) => Effect.sync(() => fixture.cleanup())
    ))

  it("publishes GitHub and its five original blobs last when every npm subject is already equivalent", async () => {
    const fixture = await makePrepackedMultipackageFixture()
    try {
      const runtime = harness(fixture, {
        initial: () => equivalent,
        github: "absent"
      })
      const report = await Effect.runPromise(runtime.publish)
      expect(report.status).toBe("complete")
      expect(report.subjects.slice(1, 6).every((subject) => subject._tag === "AlreadyEquivalent")).toBe(true)
      expect(report.subjects[6]?._tag).toBe("ConvergedAfterMutation")
      expect(runtime.captured).toEqual([])
      expect(runtime.github.mutationCount()).toBe(6)
      expect(runtime.github.scenario.release?.assets.map((asset) => asset.bytes)).toEqual(
        fixture.subjects.map((subject) => subject.bytes)
      )
    } finally {
      fixture.cleanup()
    }
  })
})
