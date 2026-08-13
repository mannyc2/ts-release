import { describe, expect, test } from "bun:test"
import * as Schema from "effect/Schema"
import { githubRecoveryCapabilityProfile } from "../../src/publication/github.js"
import { npmRecoveryCapabilityProfile } from "../../src/publication/npm.js"
import { pypiRecoveryCapabilityProfile } from "../../src/publication/pypi.js"
import { catalogRecoveryCapabilityProfile } from "../../src/publication/catalog-git.js"
import { installedPublicationProfiles } from "../../src/publication/profiles.js"
import {
  RecoveryCapabilityProfile,
  RecoveryProfileRegistrationError,
  assertRecoveryProfileMatches,
  conservativeUnknownRecoveryProfile,
  makeRecoveryCapabilityProfile,
  recoveryCapabilityProfilesEqual,
  validatePublicationProfiles,
  validateRecoveryProfileSubjects
} from "../../src/publication/recovery.js"

const validProfile = (): Record<string, unknown> => ({
  observation: "exact",
  authoritativeAbsence: "proved",
  createAuthorization: "authenticated-namespace-and-unique-coordinate",
  replay: "coordinate-unique",
  identifierReuse: "consumed-after-delete",
  correction: ["deprecate"],
  exposure: "persistent-to-consumers",
  historyRequirement: "optional-evidence",
  readConvergence: {
    contract: {
      _tag: "documented",
      url: "https://provider.example.test/docs/convergence",
      date: "2026-08-12"
    },
    observationRetry: {
      maxAttempts: 3,
      backoff: { baseMs: 10, factor: 2, capMs: 20 },
      totalBudgetMs: 100
    },
    retryEligible: "VisibilityPending | Inconclusive",
    exhaustion: "UncertainSubject with full trace"
  }
})

describe("RecoveryCapabilityProfile", () => {
  test("round-trips every independent axis and its fixed convergence contract", () => {
    const profile = makeRecoveryCapabilityProfile(validProfile())
    const encoded = Schema.encodeSync(RecoveryCapabilityProfile)(profile)
    const decoded = Schema.decodeUnknownSync(RecoveryCapabilityProfile)(encoded)

    expect(decoded).toEqual(profile)
    expect(decoded).toMatchObject({
      observation: "exact",
      authoritativeAbsence: "proved",
      createAuthorization: "authenticated-namespace-and-unique-coordinate",
      replay: "coordinate-unique",
      identifierReuse: "consumed-after-delete",
      correction: ["deprecate"],
      exposure: "persistent-to-consumers",
      historyRequirement: "optional-evidence",
      readConvergence: {
        retryEligible: "VisibilityPending | Inconclusive",
        exhaustion: "UncertainSubject with full trace"
      }
    })
  })

  test.each([
    ["zero attempts", (profile: any) => { profile.readConvergence.observationRetry.maxAttempts = 0 }],
    ["excessive attempts", (profile: any) => { profile.readConvergence.observationRetry.maxAttempts = 101 }],
    ["noninteger attempts", (profile: any) => { profile.readConvergence.observationRetry.maxAttempts = 1.5 }],
    ["negative base backoff", (profile: any) => { profile.readConvergence.observationRetry.backoff.baseMs = -1 }],
    ["nonfinite factor", (profile: any) => { profile.readConvergence.observationRetry.backoff.factor = Infinity }],
    ["backoff cap below base", (profile: any) => { profile.readConvergence.observationRetry.backoff.capMs = 5 }],
    ["zero multi-attempt budget", (profile: any) => { profile.readConvergence.observationRetry.totalBudgetMs = 0 }],
    ["excessive total budget", (profile: any) => {
      profile.readConvergence.observationRetry.totalBudgetMs = 86_400_001
    }],
    ["unknown multi-attempt timing", (profile: any) => { profile.readConvergence.contract = { _tag: "unknown" } }],
    ["duplicate correction kinds", (profile: any) => { profile.correction = ["deprecate", "deprecate"] }],
    ["credential-bearing documentation URL", (profile: any) => {
      profile.readConvergence.contract.url = "https://user:password@provider.example.test/docs"
    }],
    ["invalid documentation date", (profile: any) => { profile.readConvergence.contract.date = "2026-02-30" }],
    ["provider-extensible retry set", (profile: any) => {
      profile.readConvergence.retryEligible = "Everything"
    }]
  ])("rejects %s", (_name, mutate) => {
    const profile = validProfile()
    mutate(profile)
    expect(() => makeRecoveryCapabilityProfile(profile)).toThrow()
  })

  test("requires one unknown attempt to carry no fictional timing policy", () => {
    expect(conservativeUnknownRecoveryProfile).toMatchObject({
      readConvergence: {
        contract: { _tag: "unknown" },
        observationRetry: {
          maxAttempts: 1,
          backoff: { baseMs: 0, factor: 1, capMs: 0 },
          totalBudgetMs: 0
        }
      }
    })
  })

  test("labels every installed provider numeric default ASSUMED/UNVERIFIED", () => {
    for (const profile of [npmRecoveryCapabilityProfile, pypiRecoveryCapabilityProfile, githubRecoveryCapabilityProfile]) {
      expect(profile.readConvergence.contract._tag).toBe("assumed")
      if (profile.readConvergence.contract._tag !== "assumed") throw new Error("Expected an assumed contract.")
      expect(profile.readConvergence.contract.basis).toContain("ASSUMED/UNVERIFIED")
      expect(profile.readConvergence.observationRetry.maxAttempts).toBeGreaterThan(1)
    }
    expect(npmRecoveryCapabilityProfile.readConvergence.observationRetry).toMatchObject({
      maxAttempts: 6,
      backoff: { baseMs: 2_000, factor: 2, capMs: 30_000 },
      totalBudgetMs: 120_000
    })
    expect(githubRecoveryCapabilityProfile.readConvergence.observationRetry).toMatchObject({
      maxAttempts: 5,
      backoff: { baseMs: 1_000, factor: 2, capMs: 15_000 },
      totalBudgetMs: 60_000
    })
    expect(pypiRecoveryCapabilityProfile.readConvergence.observationRetry).toMatchObject({
      maxAttempts: 6,
      backoff: { baseMs: 2_000, factor: 2, capMs: 30_000 },
      totalBudgetMs: 120_000
    })
  })

  test("registers exact provider profiles and only the catalog correction adapter", () => {
    expect(installedPublicationProfiles.npm).toMatchObject({
      id: "publish.npm",
      provider: "npm",
      preparedTag: "PreparedNpmPublication",
      correctionAdapters: []
    })
    expect(installedPublicationProfiles.github).toMatchObject({
      id: "publish.github",
      provider: "github",
      preparedTag: "PreparedGitHubPublication",
      correctionAdapters: []
    })
    expect(installedPublicationProfiles.pypi).toMatchObject({
      id: "publish.pypi",
      provider: "pypi",
      preparedTag: "PreparedPyPiPublication",
      correctionAdapters: []
    })
    expect(installedPublicationProfiles.catalogGit).toMatchObject({
      id: "publish.catalog-git",
      provider: "catalog-git",
      preparedTag: "PreparedCatalogPublication",
      correctionAdapters: ["forward-catalog-state"]
    })
    expect(installedPublicationProfiles.npm.recovery).toBe(npmRecoveryCapabilityProfile)
    expect(installedPublicationProfiles.github.recovery).toBe(githubRecoveryCapabilityProfile)
    expect(installedPublicationProfiles.pypi.recovery).toBe(pypiRecoveryCapabilityProfile)
    expect(installedPublicationProfiles.catalogGit.recovery).toBe(catalogRecoveryCapabilityProfile)
    expect(installedPublicationProfiles.npm.recovery.correction).toEqual([])
    expect(installedPublicationProfiles.github.recovery.correction).toEqual([])
    expect(installedPublicationProfiles.pypi.recovery.correction).toEqual([])
    expect(installedPublicationProfiles.catalogGit.recovery.correction).toEqual(["forward-catalog-state"])
  })

  test("fails registration when a profile and installed correction adapters disagree", () => {
    const recovery = makeRecoveryCapabilityProfile(validProfile())
    expect(() => validatePublicationProfiles({
      fixture: {
        id: "publish.fixture",
        provider: "fixture",
        preparedTag: "PreparedFixturePublication",
        recovery,
        correctionAdapters: [],
        evidence: {
          reviewedAt: "2026-08-12",
          observationSources: ["https://provider.example.test/observe"],
          correctionSources: ["https://provider.example.test/correct"],
          correctionFinding: "No conditional correction adapter is installed."
        }
      }
    })).toThrow(RecoveryProfileRegistrationError)
  })

  test("fails subject construction on any canonical profile mismatch", () => {
    const expected = makeRecoveryCapabilityProfile({ ...validProfile(), correction: [] })
    const actual = makeRecoveryCapabilityProfile({ ...validProfile(), correction: [], replay: "unsafe" })
    expect(recoveryCapabilityProfilesEqual(expected, { ...validProfile(), correction: [] })).toBe(true)
    expect(recoveryCapabilityProfilesEqual(expected, actual)).toBe(false)
    expect(() => assertRecoveryProfileMatches("publish.fixture", expected, actual)).toThrow(
      RecoveryProfileRegistrationError
    )
    expect(() => validateRecoveryProfileSubjects("publish.fixture", expected, [])).toThrow(
      RecoveryProfileRegistrationError
    )
    expect(() => validateRecoveryProfileSubjects("publish.fixture", expected, [expected, actual])).toThrow(
      RecoveryProfileRegistrationError
    )
  })
})
