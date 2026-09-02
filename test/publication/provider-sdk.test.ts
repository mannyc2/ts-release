import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { existsSync, readFileSync } from "node:fs"
import {
  AnonymousAuthStrategy,
  CanonicalAudience,
  CredentialRef,
  CredentialRequest,
  ProviderId,
  SubjectId,
  TokenAuthStrategy
} from "../../src/model/authority.js"
import { CredentialProvider, makeCredentialProvider } from "../../src/publication/authority.js"
import { publishReleaseSubjects, type ReleaseSubject } from "../../src/publication/coordinator.js"
import {
  PresentEquivalent,
  ProviderAlreadyEquivalent
} from "../../src/publication/report.js"
import {
  conservativeUnknownRecoveryProfile,
  makeRecoveryCapabilityProfile,
  type PublicationProfileRegistration
} from "../../src/publication/recovery.js"
import {
  ProviderAdapterContract,
  indexProviderAdapters,
  makeProviderAdapter,
  validateProviderSubjects
} from "../../src/publication/provider.js"
import { builtinProviderAdapters } from "../../src/capabilities/registry.js"
import { AuthoredConfig } from "../../src/resolve/authored.js"

const provider = ProviderId.make("fixture-observer")
const audience = CanonicalAudience.make("https://provider.example.test/releases/")
const subjectId = SubjectId.make("fixture-observer:release@1.0.0")
const contract = ProviderAdapterContract.make({
  schemaVersion: "ts-release/provider-adapter-contract/v1",
  preparedSubject: "typed-canonical-data",
  identity: "canonical-subject-id",
  observation: "exact-equality-and-authoritative-absence",
  mutation: "typed-precondition-and-commitment",
  credentials: "audience-and-purpose-scoped",
  recovery: "coordinator-profile",
  certification: "provider-protocol-and-public-boundary-tests"
})
const profile: PublicationProfileRegistration<"PreparedFixtureObserver"> = {
  id: "publish.fixture-observer",
  provider: provider.toString(),
  preparedTag: "PreparedFixtureObserver",
  recovery: conservativeUnknownRecoveryProfile,
  correctionAdapters: [] as const,
  evidence: {
    reviewedAt: "2026-08-13",
    observationSources: ["https://provider.example.test/docs/observation"],
    correctionSources: ["https://provider.example.test/docs/correction"],
    correctionFinding: "The example installs observation only and no correction adapter."
  }
}
const subject = (): ReleaseSubject => ({
  id: subjectId,
  recovery: conservativeUnknownRecoveryProfile,
  observationRequests: [CredentialRequest.make({
    subject: subjectId,
    provider,
    audience,
    purpose: "observe",
    strategy: AnonymousAuthStrategy.make({ kind: "anonymous" })
  })],
  mutationRequest: CredentialRequest.make({
    subject: subjectId,
    provider,
    audience,
    purpose: "publish",
    strategy: TokenAuthStrategy.make({ kind: "token", credential: CredentialRef.make("FIXTURE_TOKEN") })
  }),
  observe: () => Effect.succeed(PresentEquivalent.make({ subject: subjectId })),
  decide: () => ProviderAlreadyEquivalent.make({ subject: subjectId }),
  mutate: () => Effect.die("Equivalent observer must never mutate.")
})

describe("the one provider adapter contract", () => {
  test("a third-party adapter passes the shared validation path into the unchanged coordinator", async () => {
    const adapter = makeProviderAdapter({ contract, profile, subjects: () => [subject()] })
    expect(adapter.id.toString()).toBe("publish.fixture-observer")
    expect(adapter.profile.preparedTag).toBe("PreparedFixtureObserver")
    const subjects = [subject()]
    validateProviderSubjects(adapter, subjects, new Set())
    const credentials = makeCredentialProvider({
      acquire: () => Effect.succeed({ _tag: "AnonymousAccess", purposes: ["observe"] as const })
    })
    const report = await Effect.runPromise(publishReleaseSubjects({
      prepared: SubjectId.make("prepared:fixture-sdk"),
      subjects
    }).pipe(Effect.provideService(CredentialProvider, credentials)))
    expect(report.status).toBe("complete")
    expect(report.subjects[1]?._tag).toBe("AlreadyEquivalent")
  })

  test("rejects missing contract claims, recovery mismatch, foreign credential authority, and silent subjects", () => {
    expect(() => makeProviderAdapter({
      contract: { ...contract, observation: "boolean-success" } as never,
      profile,
      subjects: () => [subject()]
    })).toThrow()

    const adapter = makeProviderAdapter({ contract, profile, subjects: () => [subject()] })
    expect(() => validateProviderSubjects(adapter, [{
      ...subject(),
      recovery: makeRecoveryCapabilityProfile({
        ...conservativeUnknownRecoveryProfile,
        replay: "conditional"
      })
    }], new Set())).toThrow()

    expect(() => validateProviderSubjects(adapter, [{
      ...subject(),
      mutationRequest: CredentialRequest.make({
        ...subject().mutationRequest,
        provider: ProviderId.make("foreign-provider")
      })
    }], new Set())).toThrow("foreign provider")

    expect(() => validateProviderSubjects(adapter, [], new Set())).toThrow()
    expect(() => validateProviderSubjects(adapter, [subject()], new Set([subjectId.toString()])))
      .toThrow("repeats subject")
  })

  test("indexing refuses colliding registrations, including shadowing a first-party adapter", () => {
    const adapter = makeProviderAdapter({ contract, profile, subjects: () => [subject()] })
    expect(indexProviderAdapters([...builtinProviderAdapters, adapter]).size).toBe(5)
    expect(() => indexProviderAdapters([adapter, adapter])).toThrow("repeat registration id")
    const shadow = makeProviderAdapter({
      contract,
      profile: { ...profile, id: "publish.fixture-shadow" },
      subjects: () => [subject()]
    })
    expect(() => indexProviderAdapters([adapter, shadow])).toThrow("repeat prepared publication tag")
    const npmShadow = makeProviderAdapter({
      contract,
      profile: { ...profile, id: "publish.npm-shadow", preparedTag: "PreparedNpmPublication" },
      subjects: () => [subject()]
    })
    expect(() => indexProviderAdapters([...builtinProviderAdapters, npmShadow]))
      .toThrow("repeat prepared publication tag")
  })

  test("stock authored config rejects dynamic adapters, remote commands, ambient secrets, and supply-chain hooks", () => {
    const decode = Schema.decodeUnknownSync(AuthoredConfig, { onExcessProperty: "error" })
    const base = { project: { name: "fixture", version: "1.0.0", tag: "v1.0.0" } }
    for (const input of [
      { ...base, providerAdapters: ["unbundled-package"] },
      { ...base, publish: { custom: { run: ["upload"] } } },
      { ...base, environment: { SIGNING_KEY: { inherit: true } } },
      { ...base, signing: { command: ["sign"] } },
      { ...base, notarize: { command: ["notarize"] } },
      { ...base, announcements: { webhook: "https://example.test" } }
    ]) expect(() => decode(input)).toThrow()
  })

  test("stock workflows retain credentials only in provider sinks and no root plugin owner exists", () => {
    for (const path of [
      ".github/workflows/release.yml",
      "templates/github-actions/release.yml",
      "templates/github-actions/reviewed-release.yml"
    ]) {
      const workflow = readFileSync(path, "utf8")
      expect(workflow).toContain("persist-credentials: false")
    }
    expect(existsSync("plugins")).toBe(false)
    expect(existsSync(".claude-plugin")).toBe(false)
    expect(existsSync(".codex-plugin")).toBe(false)
    expect(readFileSync("src/recipes/config.ts", "utf8")).not.toMatch(/publish\.custom|remote.*command|pluginPackage/iu)
  })
})
