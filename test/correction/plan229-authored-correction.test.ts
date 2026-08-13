import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { bindAuthoredCorrection, correctPreparedRelease, verifyCorrectionIntent } from "../../src/correction/coordinator.js"
import {
  decodeAuthoredCorrection,
  decodeCorrectionIntent,
  makeCorrectionIntent
} from "../../src/correction/intent.js"
import { encodeCanonicalJson } from "../../src/model/canonical.js"
import { CredentialRef } from "../../src/model/authority.js"
import { digestEquals, sha256Digest } from "../../src/model/digest.js"
import { NonEmptyName, OutputId, SafeRelativePath, Version } from "../../src/model/primitives.js"
import { installedPublicationProfiles } from "../../src/publication/profiles.js"
import {
  CanonicalNpmRegistryEndpoint,
  NpmDistTag,
  NpmTokenAuthentication
} from "../../src/recipes/config.js"
import {
  makeGitHubPublicationAuthorityIntent,
  makeNpmPublicationAuthorityIntent
} from "../../src/release/graph.js"
import {
  PreparedArtifact,
  PreparedGitHubPublication,
  PreparedNpmPublication,
  PreparedProject,
  PreparedPublication,
  PreparedReleaseV2,
  PreparedSource,
  encodePreparedRelease
} from "../../src/release/prepared.js"
import type { PreparedBundle } from "../../src/release/prepared-store.js"
import {
  fixtureArtifactProvenance,
  fixturePreparedProvenance,
  fixtureStagingSnapshot
} from "../fixtures/prepared-provenance.js"

const fixture = (): PreparedBundle => {
  const bytes = new TextEncoder().encode("exact npm correction tarball\n")
  const digest = sha256Digest(bytes)
  const artifactId = OutputId.make("npm-package")
  const registryUrl = CanonicalNpmRegistryEndpoint.make("https://registry.example.test/")
  const authentication = NpmTokenAuthentication.make({
    strategy: "token",
    credential: CredentialRef.make("FIXTURE_NPM_TOKEN")
  })
  const npm = PreparedNpmPublication.make({
    id: NonEmptyName.make("npm-release"),
    artifactId,
    packageName: NonEmptyName.make("@fixture/package"),
    version: Version.make("1.0.0"),
    registryUrl,
    distTag: NpmDistTag.make("latest"),
    access: "public",
    authentication,
    provenance: "disabled",
    authority: makeNpmPublicationAuthorityIntent({
      packageName: "@fixture/package",
      version: "1.0.0",
      registryUrl,
      distTag: "latest",
      authentication
    })
  })
  const github = PreparedGitHubPublication.make({
    id: NonEmptyName.make("github-release"),
    repository: "owner/repository",
    tag: NonEmptyName.make("v1.0.0"),
    title: NonEmptyName.make("Fixture 1.0.0"),
    body: "Release notes.",
    draft: false,
    prerelease: false,
    targetCommit: NonEmptyName.make("commit"),
    assets: [],
    authority: makeGitHubPublicationAuthorityIntent({
      repository: "owner/repository",
      tag: "v1.0.0"
    })
  })
  const artifact = PreparedArtifact.make({
    id: artifactId,
    path: SafeRelativePath.make("package.tgz"),
    kind: "package",
    size: bytes.length,
    digest,
    blob: digest,
    mediaType: "application/gzip",
    ...fixtureArtifactProvenance("plan229-npm-pack")
  })
  const manifest = PreparedReleaseV2.make({
    kind: "complete",
    schemaVersion: "prepared-release/v2",
    source: PreparedSource.make({
      commit: NonEmptyName.make("commit"),
      tree: NonEmptyName.make("tree"),
      clean: true,
      packageManifestPath: SafeRelativePath.make("package.json"),
      packageManifestDigest: digest,
      materialized: fixtureStagingSnapshot
    }),
    project: PreparedProject.make({
      name: NonEmptyName.make("fixture"),
      packageName: NonEmptyName.make("@fixture/package"),
      version: Version.make("1.0.0"),
      tag: NonEmptyName.make("v1.0.0"),
      repository: "owner/repository"
    }),
    provenance: fixturePreparedProvenance,
    artifacts: [artifact],
    collections: [],
    publications: [npm, github]
  })
  return {
    directory: "/prepared/plan229",
    manifest,
    blobs: new Map([[artifactId.toString(), bytes]])
  }
}

const subjectBaseline = (publication: PreparedPublication): ReturnType<typeof sha256Digest> =>
  sha256Digest(new TextEncoder().encode(
    encodeCanonicalJson(Schema.encodeSync(PreparedPublication)(publication))
  ))

describe("Plan 229 authored correction boundary", () => {
  test("derives stable canonical ids and exact per-subject baselines after bundle load", () => {
    const bundle = fixture()
    const npmAuthored = decodeAuthoredCorrection({
      provider: "npm",
      kind: "deprecate",
      publicationId: "npm-release",
      message: "Use 1.0.1."
    })
    const githubAuthored = decodeAuthoredCorrection({
      provider: "github",
      kind: "amend-release-metadata",
      publicationId: "github-release",
      message: "Use v1.0.1."
    })
    const npmFirst = bindAuthoredCorrection(bundle, npmAuthored)
    const npmSecond = bindAuthoredCorrection(bundle, npmAuthored)
    const github = bindAuthoredCorrection(bundle, githubAuthored)
    const npmPublication = bundle.manifest.publications[0]!
    const githubPublication = bundle.manifest.publications[1]!

    expect(digestEquals(npmFirst.correctionId, npmSecond.correctionId)).toBe(true)
    expect(npmFirst.correction._tag).toBe("NpmDeprecationCorrection")
    expect(github.correction._tag).toBe("GithubReleaseCorrection")
    if (npmFirst.correction._tag !== "NpmDeprecationCorrection" ||
      github.correction._tag !== "GithubReleaseCorrection") throw new Error("Unexpected correction variant.")
    expect(digestEquals(npmFirst.correction.baselineDigest, subjectBaseline(npmPublication))).toBe(true)
    expect(digestEquals(github.correction.baselineDigest, subjectBaseline(githubPublication))).toBe(true)
    expect(npmFirst.correction).toMatchObject({
      registryUrl: "https://registry.example.test/",
      packageName: "@fixture/package",
      version: "1.0.0"
    })
    expect(github.correction).toMatchObject({
      repository: "owner/repository",
      tag: "v1.0.0"
    })
    expect(() => decodeAuthoredCorrection({
      provider: "npm",
      kind: "deprecate",
      message: "Use 1.0.1.",
      baselineDigest: npmFirst.correction.baselineDigest,
      registryUrl: "https://attacker.example.test/"
    })).toThrow()
  })

  test("rejects a newly canonicalized intent whose destination or subject baseline was changed", () => {
    const bundle = fixture()
    const bound = bindAuthoredCorrection(bundle, decodeAuthoredCorrection({
      provider: "github",
      kind: "amend-release-metadata",
      publicationId: "github-release",
      message: "Use v1.0.1."
    }))
    if (bound.correction._tag !== "GithubReleaseCorrection") throw new Error("Expected GitHub correction.")
    const wrongDestination = makeCorrectionIntent({
      schemaVersion: "correction-intent/v2",
      preparedDigest: bound.preparedDigest,
      correction: { ...bound.correction, repository: "attacker/repository" }
    })
    const wrongBaseline = makeCorrectionIntent({
      schemaVersion: "correction-intent/v2",
      preparedDigest: bound.preparedDigest,
      correction: {
        ...bound.correction,
        baselineDigest: sha256Digest(new TextEncoder().encode("another subject"))
      }
    })
    const npmBound = bindAuthoredCorrection(bundle, decodeAuthoredCorrection({
      provider: "npm",
      kind: "deprecate",
      publicationId: "npm-release",
      message: "Use 1.0.1."
    }))
    if (npmBound.correction._tag !== "NpmDeprecationCorrection") throw new Error("Expected npm correction.")
    const wrongNpmBaseline = makeCorrectionIntent({
      schemaVersion: "correction-intent/v2",
      preparedDigest: npmBound.preparedDigest,
      correction: {
        ...npmBound.correction,
        baselineDigest: sha256Digest(new TextEncoder().encode("another npm subject"))
      }
    })
    expect(() => verifyCorrectionIntent(bundle, wrongDestination)).toThrow("exact GitHub publication")
    expect(() => verifyCorrectionIntent(bundle, wrongBaseline)).toThrow("baseline digest")
    expect(() => verifyCorrectionIntent(bundle, wrongNpmBaseline)).toThrow("baseline digest")
  })

  test("npm deprecation produces only an exact proposal when no conditional adapter is installed", async () => {
    const bundle = fixture()
    const before = encodePreparedRelease(bundle.manifest)
    const intent = bindAuthoredCorrection(bundle, decodeAuthoredCorrection({
      provider: "npm",
      kind: "deprecate",
      publicationId: "npm-release",
      message: "Use 1.0.1."
    }))
    const outcome = await Effect.runPromise(correctPreparedRelease({ bundle, intent }))

    expect(installedPublicationProfiles.npm.correctionAdapters).toEqual([])
    expect(installedPublicationProfiles.npm.recovery.correction).toEqual([])
    expect(outcome).toMatchObject({
      _tag: "CorrectionUnsupported",
      provider: "npm"
    })
    expect(outcome.reason).toContain("no proved conditional deprecation write")
    if (outcome.proposal === undefined) throw new Error("Expected an exact npm operator proposal.")
    expect(decodeCorrectionIntent(new TextEncoder().encode(outcome.proposal))).toEqual(intent)
    expect(encodePreparedRelease(bundle.manifest)).toEqual(before)
  })

  test("two correction actors get distinct canonical proposals and neither can dispatch", async () => {
    const bundle = fixture()
    const preparedBefore = encodePreparedRelease(bundle.manifest)
    const intents = ["Use v1.0.1.", "Use v1.0.2."].map((message) =>
      bindAuthoredCorrection(bundle, decodeAuthoredCorrection({
        provider: "github",
        kind: "amend-release-metadata",
        publicationId: "github-release",
        message
      })))
    const outcomes = await Effect.runPromise(Effect.all(
      intents.map((intent) => correctPreparedRelease({ bundle, intent })),
      { concurrency: "unbounded" }
    ))

    expect(installedPublicationProfiles.github.correctionAdapters).toEqual([])
    expect(installedPublicationProfiles.github.recovery.correction).toEqual([])
    expect(outcomes.map((outcome) => outcome._tag)).toEqual([
      "CorrectionUnsupported",
      "CorrectionUnsupported"
    ])
    const proposals = outcomes.map((outcome) => {
      if (outcome.proposal === undefined) throw new Error("Expected an exact operator proposal.")
      return decodeCorrectionIntent(new TextEncoder().encode(outcome.proposal))
    })
    expect(digestEquals(proposals[0]!.correctionId, proposals[1]!.correctionId)).toBe(false)
    expect(encodePreparedRelease(bundle.manifest)).toEqual(preparedBefore)
  })
})
