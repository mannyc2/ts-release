import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import * as Effect from "effect/Effect"
import {
  CredentialRef,
  EnvironmentName,
  SubjectId
} from "../../../src/model/authority.js"
import { sha256Digest } from "../../../src/model/digest.js"
import { NonEmptyName, OutputId, SafeRelativePath, Version } from "../../../src/model/primitives.js"
import {
  CredentialProvider,
  makeCredentialProvider
} from "../../../src/publication/authority.js"
import { publishReleaseSubjects } from "../../../src/publication/coordinator.js"
import { makeNpmSubject } from "../../../src/publication/npm.js"
import type { MutationAttempt } from "../../../src/publication/report.js"
import {
  makeNpmPublicationAuthorityIntent
} from "../../../src/release/graph.js"
import {
  PreparedArtifact,
  PreparedNpmPublication,
  PreparedProject,
  PreparedReleaseV2,
  PreparedSource
} from "../../../src/release/prepared.js"
import type { PreparedBundle } from "../../../src/release/prepared-store.js"
import {
  CanonicalNpmRegistryEndpoint,
  NpmDistTag,
  NpmTokenAuthentication,
  NpmTrustedPublishingAuthentication
} from "../../../src/recipes/config.js"
import { encodeProtocolJsonLines, sanitizeProtocolEvents } from "../events.js"
import { npmProtocolContractV1 } from "./contract.js"
import { makeNpmProviderScenario } from "./scenario.js"
import {
  fixtureArtifactProvenance,
  fixturePreparedProvenance,
  fixtureStagingSnapshot
} from "../../fixtures/prepared-provenance.js"

const packageName = "@fixture/protocol"
const version = "1.2.3"
const registry = CanonicalNpmRegistryEndpoint.make("https://registry.example.test/")
const trustedRegistry = CanonicalNpmRegistryEndpoint.make("https://registry.npmjs.org/")
const sourceCommit = "c".repeat(40)
const tokenAuthentication = NpmTokenAuthentication.make({
  strategy: "token",
  credential: CredentialRef.make("FIXTURE_NPM_TOKEN")
})
const trustedAuthentication = NpmTrustedPublishingAuthentication.make({
  strategy: "trusted-publishing",
  attestation: {
    provider: "github-actions" as const,
    runner: "github-hosted" as const,
    repository: "fixture/protocol",
    workflow: "release.yml",
    workflowRef: "refs/heads/main",
    allowedAction: "npm-publish-direct" as const
  }
})

const fixture = (
  authentication: typeof tokenAuthentication | typeof trustedAuthentication = tokenAuthentication,
  provenance: "automatic" | "required" | "disabled" = "required"
): { readonly bundle: PreparedBundle, readonly publication: PreparedNpmPublication, readonly bytes: Uint8Array } => {
  const bytes = new TextEncoder().encode("exact protocol npm tarball\n")
  const digest = sha256Digest(bytes)
  const packageArtifact = OutputId.make("npm-package")
  const authority = makeNpmPublicationAuthorityIntent({
    packageName,
    version,
    registryUrl: authentication.strategy === "trusted-publishing" ? trustedRegistry : registry,
    distTag: "next",
    authentication,
    sourceCommit
  })
  const publication = PreparedNpmPublication.make({
    id: NonEmptyName.make("npm-release"),
    packageName: NonEmptyName.make(packageName),
    version: Version.make(version),
    registryUrl: authentication.strategy === "trusted-publishing" ? trustedRegistry : registry,
    artifactId: packageArtifact,
    distTag: NpmDistTag.make("next"),
    access: "public",
    authentication,
    provenance,
    authority
  })
  const artifact = PreparedArtifact.make({
    id: packageArtifact,
    path: SafeRelativePath.make("package.tgz"),
    kind: "package",
    size: bytes.length,
    digest,
    blob: digest,
    mediaType: "application/gzip",
    ...fixtureArtifactProvenance("npm-protocol-pack")
  })
  const manifest = PreparedReleaseV2.make({
    kind: "complete",
    schemaVersion: "prepared-release/v2",
    source: PreparedSource.make({
      commit: NonEmptyName.make(sourceCommit),
      tree: NonEmptyName.make("tree"),
      clean: true,
      packageManifestPath: SafeRelativePath.make("package.json"),
      packageManifestDigest: digest,
      materialized: fixtureStagingSnapshot
    }),
    project: PreparedProject.make({
      name: NonEmptyName.make("fixture"),
      packageName: NonEmptyName.make(packageName),
      version: Version.make(version),
      tag: NonEmptyName.make("v1.2.3")
    }),
    provenance: fixturePreparedProvenance,
    artifacts: [artifact],
    collections: [],
    publications: [publication]
  })
  return {
    bundle: {
      directory: "/protocol/prepared/npm",
      manifest,
      blobs: new Map([[packageArtifact.toString(), bytes]])
    },
    publication,
    bytes
  }
}

const credentials = makeCredentialProvider({
  acquire: (request) => Effect.succeed(request.strategy.kind === "anonymous"
    ? { _tag: "AnonymousAccess", purposes: ["observe"] as const }
    : request.strategy.kind === "token"
      ? {
        _tag: "ScopedSecret",
        purposes: [request.purpose] as [typeof request.purpose],
        ref: request.strategy.credential
      }
      : {
        _tag: "WorkloadIdentity",
        purposes: [request.purpose] as [typeof request.purpose],
        names: [
          EnvironmentName.make("ACTIONS_ID_TOKEN_REQUEST_URL"),
          EnvironmentName.make("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
        ] as const
      })
})

const golden = (name: string): string => readFileSync(
  join(import.meta.dir, "golden", `${name}.jsonl`),
  "utf8"
)

const run = async (
  prepared: ReturnType<typeof fixture>,
  initial: Parameters<typeof makeNpmProviderScenario>[0]["initial"],
  publishResult: Parameters<typeof makeNpmProviderScenario>[0]["publishResult"]
) => {
  const scenario = makeNpmProviderScenario({
    packageName,
    version,
    distTag: "next",
    bytes: prepared.bytes,
    initial,
    publishResult
  })
  const subject = makeNpmSubject(
    prepared.bundle,
    prepared.publication,
    scenario.http,
    scenario.userConfigs,
    scenario.publisher
  )
  const report = await Effect.runPromise(publishReleaseSubjects({
    prepared: SubjectId.make("prepared:sha256-protocol-npm"),
    subjects: [subject]
  }).pipe(Effect.provideService(CredentialProvider, credentials)))
  return { scenario, report, transcript: encodeProtocolJsonLines(scenario.events) }
}

const mutateOnce = async (
  prepared: ReturnType<typeof fixture>,
  publishResult: Parameters<typeof makeNpmProviderScenario>[0]["publishResult"]
) => {
  const scenario = makeNpmProviderScenario({
    packageName,
    version,
    distTag: "next",
    bytes: prepared.bytes,
    initial: { packageVisibility: "visible", versionState: "absent", distTagState: "missing" },
    publishResult
  })
  const subject = makeNpmSubject(
    prepared.bundle,
    prepared.publication,
    scenario.http,
    scenario.userConfigs,
    scenario.publisher
  )
  const observationGrant = await Effect.runPromise(
    credentials.acquireForObservation(subject.observationRequests[0])
  )
  const observation = await Effect.runPromise(subject.observe(observationGrant, { phase: "pre-mutation" }))
  const decision = subject.decide(observation)
  if (decision._tag !== "NeedsMutation") throw new Error("Expected an exact version-absence decision.")
  const mutationGrant = await Effect.runPromise(
    credentials.acquireForMutation(subject.mutationRequest, decision)
  )
  const attempt = await Effect.runPromise(subject.mutate(decision, mutationGrant))
  return { attempt, scenario }
}

describe("npm provider scenario protocol", () => {
  test("pins the versioned metadata and OIDC endpoint vectors", () => {
    expect(npmProtocolContractV1).toMatchObject({
      schemaVersion: "npm-protocol-contract/v1",
      verifiedOn: "2026-08-12",
      minimumNode: "22.14.0",
      minimumNpm: "11.5.1",
      registry: trustedRegistry,
      githubActionsEnvironment: {
        detection: "GITHUB_ACTIONS",
        oidcRequestValues: [
          "ACTIONS_ID_TOKEN_REQUEST_URL",
          "ACTIONS_ID_TOKEN_REQUEST_TOKEN"
        ],
        provenanceValues: [
          "GITHUB_WORKFLOW_REF",
          "GITHUB_REPOSITORY",
          "GITHUB_SERVER_URL",
          "GITHUB_EVENT_NAME",
          "GITHUB_REPOSITORY_ID",
          "GITHUB_REPOSITORY_OWNER_ID",
          "GITHUB_REF",
          "GITHUB_SHA",
          "RUNNER_ENVIRONMENT",
          "GITHUB_RUN_ID",
          "GITHUB_RUN_ATTEMPT"
        ]
      },
      endpoints: {
        packageMetadata: { method: "GET", path: "/{package}" },
        oidcExchange: {
          method: "POST",
          path: "/-/npm/v1/oidc/token/exchange/package/{escaped-package-name}",
          audience: "npm:registry.npmjs.org"
        }
      }
    })
  })

  test("npm provider subjects never request their publish token for observation", () => {
    const prepared = fixture(tokenAuthentication)
    const scenario = makeNpmProviderScenario({
      packageName,
      version,
      distTag: "next",
      bytes: prepared.bytes,
      initial: { packageVisibility: "visible", versionState: "absent", distTagState: "missing" },
      publishResult: "exit-0"
    })
    const subject = makeNpmSubject(
      prepared.bundle,
      prepared.publication,
      scenario.http,
      scenario.userConfigs,
      scenario.publisher
    )
    expect(subject.observationRequests).toHaveLength(1)
    expect(subject.observationRequests[0]).toMatchObject({
      purpose: "observe",
      strategy: { kind: "anonymous" }
    })
    expect(subject.mutationRequest).toMatchObject({
      purpose: "publish",
      strategy: { kind: "token", credential: "FIXTURE_NPM_TOKEN" }
    })
  })

  test("fresh visible-package publish uses the exact certified argv and converges only by reread", async () => {
    const prepared = fixture()
    const result = await run(prepared, {
      packageVisibility: "visible",
      versionState: "absent",
      distTagState: "missing"
    }, "exit-0")

    expect(result.report.subjects[1]).toMatchObject({
      _tag: "ConvergedAfterMutation",
      decision: { _tag: "NeedsMutation", precondition: { kind: "npm-visible-package-version-absent" } },
      attempt: { _tag: "OutcomeUnknown" },
      postObservations: [{ _tag: "PresentEquivalent" }]
    })
    expect(result.scenario.state.publishCount).toBe(1)
    expect(sanitizeProtocolEvents(result.scenario.events).map((event) => event._tag)).toEqual([
      "HttpExchange", "ProcessSpawn", "ProcessExit", "HttpExchange"
    ])
    const spawn = sanitizeProtocolEvents(result.scenario.events).find((event) => event._tag === "ProcessSpawn")
    expect(spawn?._tag === "ProcessSpawn" ? spawn.argv : []).toEqual([
      "npm", "publish", `/protocol/prepared/npm/blobs/${prepared.bundle.manifest.artifacts[0]!.blob.hex}`,
      "--ignore-scripts", "--registry", registry, "--tag", "next", "--access", "public",
      "--provenance", "--json"
    ])
    expect(result.transcript).not.toContain("FIXTURE_NPM_TOKEN")
    expect(result.transcript.trim().split("\n")).toHaveLength(4)
    expect(result.transcript).toBe(golden("fresh-publish"))
  })

  test("response loss never republishes and exact reread is the only convergence proof", async () => {
    const result = await run(fixture(), {
      packageVisibility: "visible",
      versionState: "absent",
      distTagState: "missing"
    }, "response-loss")

    expect(result.report.subjects[1]).toMatchObject({
      _tag: "ConvergedAfterMutation",
      attempt: { _tag: "OutcomeUnknown" },
      postObservations: [{ _tag: "PresentEquivalent" }]
    })
    expect(result.scenario.state.publishCount).toBe(1)
    expect(sanitizeProtocolEvents(result.scenario.events).map((event) => event._tag)).toEqual([
      "HttpExchange", "ProcessSpawn", "FaultInjected", "HttpExchange"
    ])
    expect(result.transcript).toContain('"commitment":"unknown"')
    expect(result.transcript).toBe(golden("response-loss"))
  })

  test("every non-success metadata status and redirect remains inconclusive without mutation", async () => {
    for (const status of [301, 302, 307, 308, 400, 401, 403, 404, 408, 409, 422, 429, 500, 503] as const) {
      const prepared = fixture()
      let reads = 0
      let publishes = 0
      const subject = makeNpmSubject(prepared.bundle, prepared.publication, {
        execute: () => Effect.sync(() => {
          reads += 1
          return { status, headers: status >= 300 && status < 400 ? { location: "https://elsewhere.invalid/" } : {}, body: "{}" }
        })
      }, {
        acquire: () => Effect.die("no npm user config may be acquired")
      }, {
        preflightTrustedNpm: () => Effect.die("no trusted preflight may run"),
        spawn: () => Effect.sync(() => { publishes += 1; throw new Error("no publish may run") })
      })
      const grant = await Effect.runPromise(credentials.acquireForObservation(subject.observationRequests[0]))
      const observation = await Effect.runPromise(subject.observe(grant, { phase: "pre-mutation" }))
      expect(observation._tag, `status ${status}`).toBe("Inconclusive")
      expect(subject.decide(observation)._tag).toBe("Blocked")
      expect(reads).toBe(1)
      expect(publishes).toBe(0)
    }
  })

  test("malformed packuments cannot prove absence, equality, or mutation authority", async () => {
    for (const body of [
      "",
      "{",
      "null",
      "[]",
      JSON.stringify({ name: packageName }),
      JSON.stringify({ name: packageName, versions: [], "dist-tags": {} }),
      JSON.stringify({ name: packageName, versions: {}, "dist-tags": [] })
    ]) {
      const prepared = fixture()
      const subject = makeNpmSubject(prepared.bundle, prepared.publication, {
        execute: () => Effect.succeed({ status: 200, headers: {}, body })
      }, {
        acquire: () => Effect.die("no npm user config may be acquired")
      }, {
        preflightTrustedNpm: () => Effect.die("no trusted preflight may run"),
        spawn: () => Effect.die("no publisher may run")
      })
      const grant = await Effect.runPromise(credentials.acquireForObservation(subject.observationRequests[0]))
      const observation = await Effect.runPromise(subject.observe(grant, { phase: "pre-mutation" }))
      expect(observation._tag).toBe("Inconclusive")
      expect(subject.decide(observation)._tag).toBe("Blocked")
    }
  })

  test("two actors observe version absence, one wins publish, and the loser reobserves without replay", async () => {
    const prepared = fixture()
    const scenario = makeNpmProviderScenario({
      packageName,
      version,
      distTag: "next",
      bytes: prepared.bytes,
      initial: {
        packageVisibility: "visible",
        versionState: "absent",
        distTagState: "missing"
      },
      publishResult: "exit-0"
    })
    const actors = [0, 1].map(() => makeNpmSubject(
      prepared.bundle,
      prepared.publication,
      scenario.http,
      scenario.userConfigs,
      scenario.publisher
    ))
    const grants = await Promise.all(actors.map((actor) => Effect.runPromise(
      credentials.acquireForObservation(actor.observationRequests[0])
    )))
    const before = await Promise.all(actors.map((actor, index) => Effect.runPromise(
      actor.observe(grants[index]!, { phase: "pre-mutation" })
    )))
    const decisions = actors.map((actor, index) => actor.decide(before[index]!))
    expect(decisions.map((decision) => decision._tag)).toEqual(["NeedsMutation", "NeedsMutation"])
    const mutationGrants = await Promise.all(actors.map((actor, index) => {
      const decision = decisions[index]!
      if (decision._tag !== "NeedsMutation") throw new Error("Expected version-absence mutation decision.")
      return Effect.runPromise(credentials.acquireForMutation(actor.mutationRequest, decision))
    }))
    const attempts: Array<MutationAttempt> = []
    for (const [index, actor] of actors.entries()) {
      const decision = decisions[index]!
      if (decision._tag !== "NeedsMutation") throw new Error("Expected version-absence mutation decision.")
      attempts.push(await Effect.runPromise(actor.mutate(decision, mutationGrants[index]!)))
    }
    const loserAfter = await Effect.runPromise(actors[1]!.observe(grants[1]!, {
      phase: "post-mutation",
      attempt: attempts[1]!
    }))

    expect(attempts.map((attempt) => attempt._tag)).toEqual(["OutcomeUnknown", "OutcomeUnknown"])
    expect(loserAfter._tag).toBe("PresentEquivalent")
    expect(scenario.state.publishCount).toBe(2)
    expect(sanitizeProtocolEvents(scenario.events).filter((event) =>
      event._tag === "ProcessExit").map((event) =>
        event._tag === "ProcessExit" ? event.exitCode : -1)).toEqual([0, 1])
  })

  test("delete-like absence never makes a consumed npm package version reusable", async () => {
    const prepared = fixture(trustedAuthentication, "automatic")
    const scenario = makeNpmProviderScenario({
      packageName,
      version,
      distTag: "next",
      bytes: prepared.bytes,
      initial: {
        packageVisibility: "missing",
        versionState: "absent",
        distTagState: "missing"
      },
      publishResult: "coordinate-consumed"
    })
    const subject = makeNpmSubject(
      prepared.bundle,
      prepared.publication,
      scenario.http,
      scenario.userConfigs,
      scenario.publisher
    )
    const observationGrant = await Effect.runPromise(
      credentials.acquireForObservation(subject.observationRequests[0])
    )
    const before = await Effect.runPromise(subject.observe(observationGrant, { phase: "pre-mutation" }))
    const decision = subject.decide(before)
    expect(decision._tag).toBe("ProviderAuthorizedCreate")
    if (decision._tag !== "ProviderAuthorizedCreate") throw new Error("Expected trusted create decision.")
    const mutationGrant = await Effect.runPromise(
      credentials.acquireForMutation(subject.mutationRequest, decision)
    )
    const attempt = await Effect.runPromise(subject.mutate(decision, mutationGrant))
    const after = await Effect.runPromise(subject.observe(observationGrant, {
      phase: "post-mutation",
      attempt
    }))

    expect(subject.recovery.identifierReuse).toBe("consumed-after-delete")
    expect(attempt._tag).toBe("OutcomeUnknown")
    expect(after._tag).toBe("VisibilityPending")
    expect(scenario.state.packageVisibility).toBe("missing")
    expect(scenario.state.publishCount).toBe(1)
  })

  test("an already equivalent version and dist-tag performs no mutation", async () => {
    const result = await run(fixture(), {
      packageVisibility: "visible",
      versionState: "equivalent",
      distTagState: "equivalent"
    }, "exit-0")

    expect(result.report.subjects[1]).toMatchObject({ _tag: "AlreadyEquivalent" })
    expect(result.scenario.state.publishCount).toBe(0)
    expect(sanitizeProtocolEvents(result.scenario.events).map((event) => event._tag)).toEqual([
      "HttpExchange"
    ])
    expect(result.transcript.trim().split("\n")).toHaveLength(1)
    expect(result.transcript).toBe(golden("already-equivalent"))
  })

  test("missing and wrong dist-tags conflict and never trigger tag repair or republish", async () => {
    for (const distTagState of ["missing", "different"] as const) {
      const result = await run(fixture(), {
        packageVisibility: "visible",
        versionState: "equivalent",
        distTagState
      }, "exit-0")
      expect(result.report.subjects[1]).toMatchObject({
        _tag: "BlockedSubject",
        cause: { _tag: "Conflict", differences: [{ field: "dist-tag" }] }
      })
      expect(result.scenario.state.publishCount).toBe(0)
      expect(result.transcript).not.toContain("dist-tag")
    }
  })

  test("required, disabled, and automatic provenance produce exact non-overridable argv", async () => {
    for (const row of [
      { prepared: fixture(tokenAuthentication, "required"), expected: ["--provenance"] },
      { prepared: fixture(tokenAuthentication, "disabled"), expected: ["--provenance=false"] },
      { prepared: fixture(trustedAuthentication, "automatic"), expected: [] }
    ] as const) {
      const result = await run(row.prepared, {
        packageVisibility: "visible",
        versionState: "absent",
        distTagState: "missing"
      }, "exit-0")
      const publish = sanitizeProtocolEvents(result.scenario.events).find((event) =>
        event._tag === "ProcessSpawn" && event.argv[0] === "npm" && event.argv[1] === "publish")
      expect(publish?._tag).toBe("ProcessSpawn")
      if (publish?._tag !== "ProcessSpawn") throw new Error("Expected the npm publish process event.")
      expect(publish.argv.filter((argument) => argument.startsWith("--provenance"))).toEqual([...row.expected])
      expect(publish.argv).toContain("--ignore-scripts")
      expect(publish.argv).toContain("--registry")
      expect(publish.argv).toContain("--tag")
      expect(publish.argv).toContain("--access")
    }
  })

  test("spawn refusal, nonzero exit, stream loss, and signal interruption preserve commitment", async () => {
    for (const row of [
      { result: "before-start", attempt: "RejectedBeforeDispatch", event: "FaultInjected" },
      { result: "exit-nonzero", attempt: "OutcomeUnknown", event: "ProcessExit" },
      { result: "stdout-failure", attempt: "OutcomeUnknown", event: "StreamFailure" },
      { result: "stderr-failure", attempt: "OutcomeUnknown", event: "StreamFailure" },
      { result: "signal", attempt: "OutcomeUnknown", event: "ProcessSignal" }
    ] as const) {
      const outcome = await mutateOnce(fixture(), row.result)
      expect(outcome.attempt._tag).toBe(row.attempt)
      expect(outcome.scenario.events.some((event) => event._tag === row.event)).toBe(true)
      expect(outcome.scenario.state.versionState).toBe("absent")
      expect(outcome.scenario.state.distTagState).toBe("missing")
    }
  })

  test("a visible version with different immutable bytes conflicts without publishing", async () => {
    const result = await run(fixture(), {
      packageVisibility: "visible",
      versionState: "different",
      distTagState: "equivalent"
    }, "exit-0")

    expect(result.report.subjects[1]).toMatchObject({
      _tag: "BlockedSubject",
      cause: { _tag: "Conflict" }
    })
    expect(result.scenario.state.publishCount).toBe(0)
  })

  test("only the exact trusted direct-publish attestation authorizes an unobservable namespace", async () => {
    const trusted = await run(fixture(trustedAuthentication, "automatic"), {
      packageVisibility: "missing",
      versionState: "absent",
      distTagState: "missing"
    }, "exit-0")
    expect(trusted.report.subjects[1]).toMatchObject({
      _tag: "ConvergedAfterMutation",
      decision: { _tag: "ProviderAuthorizedCreate", proof: { kind: "npm-trusted-direct-create" } }
    })
    expect(trusted.scenario.state.publishCount).toBe(1)

    const token = await run(fixture(tokenAuthentication), {
      packageVisibility: "missing",
      versionState: "absent",
      distTagState: "missing"
    }, "exit-0")
    expect(token.report.subjects[1]).toMatchObject({ _tag: "BlockedSubject" })
    expect(token.scenario.state.publishCount).toBe(0)
  })
})
