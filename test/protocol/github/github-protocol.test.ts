import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import * as Effect from "effect/Effect"
import {
  formatGitHubSha256,
  sha256Digest
} from "../../../src/model/digest.js"
import { makeGithubSubjects } from "../../../src/publication/github.js"
import {
  encodeProtocolJsonLines,
  type HttpExchange
} from "../events.js"
import { githubProtocolContractV1 } from "./contract.js"
import {
  GithubProtocolScenarioSchemaVersion,
  makeGithubProtocolDouble,
  type GithubAssetStateV1,
  type GithubProtocolScenarioV1
} from "./double.js"
import {
  annotatedTagSha,
  githubProtocolCredentials,
  makeGithubFixture,
  nestedTagSha,
  preparedCommit,
  runGithubProtocol,
  wrongCommit,
  type GithubFixture
} from "./fixture.js"

const apiBase = "https://api.github.com/repos/owner/project"

const protocolScenario = (
  input: Omit<GithubProtocolScenarioV1, "schemaVersion" | "repository" | "tag" | "targetCommit">
): GithubProtocolScenarioV1 => ({
  schemaVersion: GithubProtocolScenarioSchemaVersion,
  repository: "owner/project",
  tag: "v1.0.0",
  targetCommit: preparedCommit,
  ...input
})

const protocolAsset = (
  fixture: GithubFixture,
  index: number,
  overrides: Partial<GithubAssetStateV1> = {}
): GithubAssetStateV1 => ({
  id: 100 + index,
  name: fixture.assets[index]!.name,
  mediaType: fixture.assets[index]!.mediaType,
  bytes: fixture.assets[index]!.bytes,
  digest: "present",
  ...overrides
})

const releaseState = (
  fixture: GithubFixture,
  assets = fixture.assets.map((_, index) => protocolAsset(fixture, index)),
  pageSize?: number
): NonNullable<GithubProtocolScenarioV1["release"]> => ({
  id: 700,
  tag: "v1.0.0",
  title: "Project 1.0.0",
  body: "release notes",
  draft: false,
  prerelease: false,
  assets,
  ...(pageSize === undefined ? {} : { pageSize })
})

const mutationEvents = (events: ReadonlyArray<{ readonly _tag: string }>): ReadonlyArray<HttpExchange> =>
  events.filter((event): event is HttpExchange => event._tag === "HttpExchange" &&
    (event as HttpExchange).phase === "mutate")

const golden = (name: string): string => readFileSync(
  join(import.meta.dir, "golden", `${name}.jsonl`),
  "utf8"
)

const acquire = async (
  fixture: GithubFixture,
  strategyIndex: 0 | 1
) => {
  const subject = makeGithubSubjects(
    fixture.bundle,
    fixture.publication,
    { execute: () => Effect.die("unused") },
    { execute: () => Effect.die("unused") }
  )[0]
  const credentials = githubProtocolCredentials()
  return Effect.runPromise(credentials.acquireForObservation(subject.observationRequests[strategyIndex]!))
}

describe("GitHub protocol contract v1", () => {
  test("pins official ref, tag, release, and asset wire evidence without a live mutation", () => {
    expect(githubProtocolContractV1).toMatchObject({
      schemaVersion: "github-protocol-contract/v1",
      verifiedOn: "2026-08-12",
      apiVersion: "2022-11-28"
    })
    expect(githubProtocolContractV1.sources.map((source) => source.url)).toEqual([
      "https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28",
      "https://docs.github.com/en/rest/git/refs?apiVersion=2022-11-28",
      "https://docs.github.com/en/rest/git/tags?apiVersion=2022-11-28",
      "https://docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28",
      "https://docs.github.com/en/rest/releases/assets?apiVersion=2022-11-28"
    ])
  })

  test("recursively peels annotated tags and conflicts on the wrong commit before release reads or writes", async () => {
    const fixture = makeGithubFixture()
    const double = makeGithubProtocolDouble(protocolScenario({
      tagRef: { type: "tag", sha: annotatedTagSha },
      tagObjects: {
        [annotatedTagSha]: { type: "tag", sha: nestedTagSha },
        [nestedTagSha]: { type: "commit", sha: wrongCommit }
      },
      release: releaseState(fixture)
    }))
    const report = await runGithubProtocol(fixture, double)

    expect(report.status).toBe("blocked")
    expect(report.subjects[1]).toMatchObject({
      _tag: "BlockedSubject",
      cause: { _tag: "Conflict", differences: [{ field: "tag.commit" }] }
    })
    expect(double.mutationCount()).toBe(0)
    expect(double.events.some((event) => event._tag === "HttpExchange" &&
      event.url.includes("/releases/tags/"))).toBe(false)
    expect(encodeProtocolJsonLines(double.events)).toBe(golden("wrong-annotated-tag"))
  })

  test("treats unreadable or malformed annotated-tag state as inconclusive and never mutates", async () => {
    const fixture = makeGithubFixture()
    const double = makeGithubProtocolDouble(protocolScenario({
      tagRef: { type: "tag", sha: annotatedTagSha },
      tagObjects: {},
      release: releaseState(fixture)
    }))
    const report = await runGithubProtocol(fixture, double)
    expect(report.subjects[1]).toMatchObject({
      _tag: "BlockedSubject",
      observations: [{ _tag: "Inconclusive" }, { _tag: "Inconclusive" }]
    })
    expect(double.mutationCount()).toBe(0)
  })

  test("treats a malformed exact-ref response as Inconclusive", async () => {
    const fixture = makeGithubFixture()
    const ref = `${apiBase}/git/ref/tags/v1.0.0`
    const double = makeGithubProtocolDouble(protocolScenario({
      release: releaseState(fixture),
      faults: [{
        phase: "observe",
        method: "GET",
        url: ref,
        outcome: {
          _tag: "HttpResponse",
          status: 200,
          body: { ref: "refs/tags/v1.0.0", object: { type: "commit", sha: "truncated" } }
        }
      }]
    }))
    const subject = makeGithubSubjects(fixture.bundle, fixture.publication, double.http, double.mutationHttp)[0]
    const grant = await acquire(fixture, 0)
    expect((await Effect.runPromise(subject.observe(grant, { phase: "pre-mutation" })))._tag).toBe("Inconclusive")
    expect(double.mutationCount()).toBe(0)
  })

  test("ignores target_commitish and requires a fully paginated exact asset set", async () => {
    const fixture = makeGithubFixture([
      { name: "one.zip" },
      { name: "two.zip" },
      { name: "three.zip" }
    ])
    const double = makeGithubProtocolDouble(protocolScenario({
      tagRef: { type: "commit", sha: preparedCommit },
      release: releaseState(fixture, fixture.assets.map((_, index) => protocolAsset(fixture, index)), 1)
    }))
    const report = await runGithubProtocol(fixture, double)
    expect(report.subjects[1]?._tag).toBe("AlreadyEquivalent")
    expect(double.events.filter((event): event is HttpExchange => event._tag === "HttpExchange" &&
      event.url.includes("per_page=100")).map((event) => event.url)).toEqual([
      `${apiBase}/releases/700/assets?per_page=100&page=1`,
      `${apiBase}/releases/700/assets?per_page=100&page=2`,
      `${apiBase}/releases/700/assets?per_page=100&page=3`
    ])
    expect(double.mutationCount()).toBe(0)
  })

  test("treats a later asset-page failure as Inconclusive instead of proving a truncated set", async () => {
    const fixture = makeGithubFixture([
      { name: "one.zip" },
      { name: "two.zip" }
    ])
    const secondPage = `${apiBase}/releases/700/assets?per_page=100&page=2`
    const double = makeGithubProtocolDouble(protocolScenario({
      tagRef: { type: "commit", sha: preparedCommit },
      release: releaseState(fixture, fixture.assets.map((_, index) => protocolAsset(fixture, index)), 1),
      faults: [{
        phase: "observe",
        method: "GET",
        url: secondPage,
        outcome: { _tag: "HttpStatus", status: 503 }
      }]
    }))
    const subject = makeGithubSubjects(fixture.bundle, fixture.publication, double.http, double.mutationHttp)[0]
    const grant = await acquire(fixture, 0)
    const observation = await Effect.runPromise(subject.observe(grant, { phase: "pre-mutation" }))
    expect(observation._tag).toBe("Inconclusive")
    expect(double.mutationCount()).toBe(0)
  })

  test("conflicts on duplicate and extra provider asset names", async () => {
    const fixture = makeGithubFixture()
    for (const assets of [
      [protocolAsset(fixture, 0), protocolAsset(fixture, 0, { id: 101 })],
      [protocolAsset(fixture, 0), protocolAsset(fixture, 0, { id: 101, name: "undeclared.zip" })]
    ]) {
      const double = makeGithubProtocolDouble(protocolScenario({
        tagRef: { type: "commit", sha: preparedCommit },
        release: releaseState(fixture, assets)
      }))
      const report = await runGithubProtocol(fixture, double)
      expect(report.subjects[1]).toMatchObject({
        _tag: "BlockedSubject",
        cause: { _tag: "Conflict" }
      })
      expect(double.mutationCount()).toBe(0)
    }
  })

  test("validates a missing API digest by downloading and hashing exact asset bytes", async () => {
    const fixture = makeGithubFixture()
    const exact = makeGithubProtocolDouble(protocolScenario({
      tagRef: { type: "commit", sha: preparedCommit },
      release: releaseState(fixture, [protocolAsset(fixture, 0, { digest: "missing" })])
    }))
    const exactReport = await runGithubProtocol(fixture, exact)
    expect(exactReport.subjects[1]?._tag).toBe("AlreadyEquivalent")
    expect(exact.events.some((event) => event._tag === "HttpExchange" &&
      event.url === `${apiBase}/releases/assets/100` &&
      event.requestHeaders?.accept === "application/octet-stream")).toBe(true)

    const different = new TextEncoder().encode("EXACT GitHub asset bytes\n")
    expect(different.length).toBe(fixture.assets[0]!.bytes.length)
    const mismatch = makeGithubProtocolDouble(protocolScenario({
      tagRef: { type: "commit", sha: preparedCommit },
      release: releaseState(fixture, [protocolAsset(fixture, 0, {
        bytes: different,
        digest: "missing"
      })])
    }))
    const mismatchReport = await runGithubProtocol(fixture, mismatch)
    expect(mismatchReport.subjects[1]).toMatchObject({
      _tag: "BlockedSubject",
      cause: { _tag: "Conflict", differences: [{ field: "asset.asset.zip.digest" }] }
    })
  })

  test("classifies a failed digest download as Inconclusive", async () => {
    const fixture = makeGithubFixture()
    const assetUrl = `${apiBase}/releases/assets/100`
    const double = makeGithubProtocolDouble(protocolScenario({
      tagRef: { type: "commit", sha: preparedCommit },
      release: releaseState(fixture, [protocolAsset(fixture, 0, { digest: "missing" })]),
      faults: [{
        phase: "observe",
        method: "GET",
        url: assetUrl,
        outcome: { _tag: "HttpStatus", status: 503 }
      }]
    }))
    const subject = makeGithubSubjects(fixture.bundle, fixture.publication, double.http, double.mutationHttp)[0]
    const grant = await acquire(fixture, 0)
    const observation = await Effect.runPromise(subject.observe(grant, { phase: "pre-mutation" }))
    expect(observation._tag).toBe("Inconclusive")
    expect(double.mutationCount()).toBe(0)
  })

  test("creates the release and uploads exact encoded names, content types, and bytes", async () => {
    const fixture = makeGithubFixture([
      { name: "asset one.zip", mediaType: "application/zip", contents: "asset one bytes\n" },
      { name: "checksums.txt", mediaType: "text/plain", contents: "checksum bytes\n" }
    ])
    const double = makeGithubProtocolDouble(protocolScenario({}))
    const report = await runGithubProtocol(fixture, double)

    expect(report.subjects[1]).toMatchObject({
      _tag: "ConvergedAfterMutation",
      decision: { _tag: "ProviderAuthorizedCreate" },
      attempt: { _tag: "Applied" }
    })
    expect(double.scenario.tagRef).toEqual({ type: "commit", sha: preparedCommit })
    expect(double.scenario.release?.assets.map((asset) => ({
      name: asset.name,
      mediaType: asset.mediaType,
      digest: formatGitHubSha256(sha256Digest(asset.bytes))
    }))).toEqual(fixture.assets.map((asset) => ({
      name: asset.name,
      mediaType: asset.mediaType,
      digest: formatGitHubSha256(sha256Digest(asset.bytes))
    })))
    const posts = mutationEvents(double.events)
    expect(posts.map((event) => event.url)).toEqual([
      `${apiBase}/releases`,
      "https://uploads.github.com/repos/owner/project/releases/700/assets?name=asset%20one.zip",
      "https://uploads.github.com/repos/owner/project/releases/700/assets?name=checksums.txt"
    ])
    expect(posts.slice(1).map((event) => event.requestHeaders?.["content-type"])).toEqual([
      "application/zip",
      "text/plain"
    ])
    expect(posts.slice(1).map((event) => event.requestBodyLength)).toEqual(
      fixture.assets.map((asset) => asset.bytes.length)
    )
    expect(encodeProtocolJsonLines(double.events)).toBe(golden("create-and-upload"))
  })

  test("reruns only missing uploads and preserves existing exact assets", async () => {
    const fixture = makeGithubFixture([
      { name: "existing.zip", mediaType: "application/zip" },
      { name: "missing.txt", mediaType: "text/plain" }
    ])
    const existing = protocolAsset(fixture, 0)
    const double = makeGithubProtocolDouble(protocolScenario({
      tagRef: { type: "commit", sha: preparedCommit },
      release: releaseState(fixture, [existing])
    }))
    const report = await runGithubProtocol(fixture, double)

    expect(report.subjects[1]).toMatchObject({
      _tag: "ConvergedAfterMutation",
      decision: { _tag: "NeedsMutation" },
      attempt: { _tag: "Applied" }
    })
    expect(mutationEvents(double.events)).toHaveLength(1)
    expect(mutationEvents(double.events)[0]?.url).toBe(
      "https://uploads.github.com/repos/owner/project/releases/700/assets?name=missing.txt"
    )
    expect(double.scenario.release?.assets[0]).toEqual(existing)
    expect(encodeProtocolJsonLines(double.events)).toBe(golden("partial-rerun"))
  })

  test("preserves unknown transport outcomes and converges by exact reobservation", async () => {
    const fixture = makeGithubFixture([])
    const createUrl = `${apiBase}/releases`
    const double = makeGithubProtocolDouble(protocolScenario({
      faults: [{
        phase: "mutate",
        method: "POST",
        url: createUrl,
        outcome: { _tag: "TransportUnknown", afterApply: true }
      }]
    }))
    const report = await runGithubProtocol(fixture, double)
    expect(report.subjects[1]).toMatchObject({
      _tag: "ConvergedAfterMutation",
      attempt: { _tag: "OutcomeUnknown" },
      postObservations: [{ _tag: "PresentEquivalent" }]
    })
    expect(double.mutationCount()).toBe(1)
  })

  test("classifies received statuses conservatively before any accepted write", async () => {
    for (const status of [401, 403, 404, 409, 422, 429, 500, 503] as const) {
      const fixture = makeGithubFixture([])
      const createUrl = `${apiBase}/releases`
      const double = makeGithubProtocolDouble(protocolScenario({
        faults: [{
          phase: "mutate",
          method: "POST",
          url: createUrl,
          outcome: { _tag: "HttpStatus", status }
        }]
      }))
      const subject = makeGithubSubjects(fixture.bundle, fixture.publication, double.http, double.mutationHttp)[0]
      const credentials = githubProtocolCredentials()
      const anonymous = await Effect.runPromise(credentials.acquireForObservation(subject.observationRequests[0]))
      const token = await Effect.runPromise(credentials.acquireForObservation(subject.observationRequests[1]!))
      expect((await Effect.runPromise(subject.observe(anonymous, { phase: "pre-mutation" })))._tag).toBe("Inconclusive")
      const absent = await Effect.runPromise(subject.observe(token, { phase: "pre-mutation" }))
      expect(absent._tag).toBe("AuthoritativelyAbsent")
      const decision = subject.decide(absent)
      expect(decision._tag).toBe("ProviderAuthorizedCreate")
      if (decision._tag !== "ProviderAuthorizedCreate") throw new Error("expected create decision")
      const mutationGrant = await Effect.runPromise(credentials.acquireForMutation(subject.mutationRequest, decision))
      const attempt = await Effect.runPromise(subject.mutate(decision, mutationGrant))
      expect(attempt._tag).toBe(status === 401 || status === 403
        ? "RejectedByProvider"
        : "OutcomeUnknown")
    }
  })
})
