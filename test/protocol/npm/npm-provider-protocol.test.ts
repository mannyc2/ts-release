import { describe, expect, test } from "bun:test"
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
import { makeNpmProviderScenario } from "./scenario.js"

const packageName = "@fixture/protocol"
const version = "1.2.3"
const registry = CanonicalNpmRegistryEndpoint.make("https://registry.example.test/")
const trustedRegistry = CanonicalNpmRegistryEndpoint.make("https://registry.npmjs.org/")
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
    authentication
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
    publicationMode: "direct",
    authority
  })
  const artifact = PreparedArtifact.make({
    id: packageArtifact,
    path: SafeRelativePath.make("package.tgz"),
    kind: "package",
    size: bytes.length,
    digest,
    blob: digest,
    mediaType: "application/gzip"
  })
  const manifest = PreparedReleaseV2.make({
    schemaVersion: "prepared-release/v2",
    source: PreparedSource.make({
      commit: NonEmptyName.make("commit"),
      tree: NonEmptyName.make("tree"),
      clean: true,
      packageManifestPath: SafeRelativePath.make("package.json"),
      packageManifestDigest: digest
    }),
    project: PreparedProject.make({
      name: NonEmptyName.make("fixture"),
      packageName: NonEmptyName.make(packageName),
      version: Version.make(version),
      tag: NonEmptyName.make("v1.2.3")
    }),
    artifacts: [artifact],
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

describe("npm provider scenario protocol", () => {
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
