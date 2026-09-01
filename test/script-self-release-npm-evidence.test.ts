import { createHash } from "node:crypto"
import { describe, expect, test } from "bun:test"
import {
  selectSelfReleaseNpmInvocationMode,
  verifySelfReleaseFulcioEvidence,
  verifyPublishedInvocationRun,
  verifySelfReleaseNpmEvidence
} from "../apps/release-ts/scripts/verify-self-release-npm.js"

const bytes = new TextEncoder().encode("exact adopted npm tarball bytes\n")
const sha512Hex = createHash("sha512").update(bytes).digest("hex")
const integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`
const shasum = createHash("sha1").update(bytes).digest("hex")
const candidateSha = "c".repeat(40)
const adoptedReference = `prepared:gha:mannyc2/ts-release/runs/7/attempts/1/artifacts/ts-release-prepared-1-${"d".repeat(64)}#sha256-${"d".repeat(64)}`

const actionReport = (remoteTag: string, patch: Readonly<Record<string, unknown>> = {}) => ({
  schemaVersion: "ts-release-action-report/v2",
  command: "publish",
  status: "complete",
  prepared: adoptedReference,
  report: {
    status: "complete",
    subjects: [
      { _tag: "AlreadyEquivalent", subject: adoptedReference },
      { _tag: remoteTag, subject: "npm:@mannyc1/ts-release@0.3.0" }
    ]
  },
  ...patch
})

const fulcioEvidence = () => ({
  sigstoreVersion: "4.1.0",
  certificateIdentityUri: "https://github.com/mannyc2/ts-release/.github/workflows/release.yml@refs/heads/main",
  certificateIssuer: "https://token.actions.githubusercontent.com",
  extensions: {
    workflowTrigger: "workflow_dispatch",
    workflowSha: candidateSha,
    workflowName: "Release",
    workflowRepository: "mannyc2/ts-release",
    workflowRef: "refs/heads/main",
    buildSignerUri: "https://github.com/mannyc2/ts-release/.github/workflows/release.yml@refs/heads/main",
    buildSignerDigest: candidateSha,
    runnerEnvironment: "github-hosted",
    sourceRepositoryUri: "https://github.com/mannyc2/ts-release",
    sourceRepositoryDigest: candidateSha,
    sourceRepositoryRef: "refs/heads/main",
    sourceRepositoryIdentifier: "1271545637",
    sourceRepositoryOwnerUri: "https://github.com/mannyc2",
    sourceRepositoryOwnerIdentifier: "126291407",
    buildConfigUri: "https://github.com/mannyc2/ts-release/.github/workflows/release.yml@refs/heads/main",
    buildConfigDigest: candidateSha,
    trigger: "workflow_dispatch",
    runInvocationUri: "https://github.com/mannyc2/ts-release/actions/runs/42/attempts/1",
    sourceRepositoryVisibility: "public",
    sourceRepositorySubject: "repo:mannyc2@126291407/ts-release@1271545637:environment:npm"
  }
})

const provenance = (patch: Readonly<Record<string, unknown>> = {}) => ({
  _type: "https://in-toto.io/Statement/v1",
  subject: [{
    name: "pkg:npm/%40mannyc1/ts-release@0.3.0",
    digest: { sha512: sha512Hex }
  }],
  predicateType: "https://slsa.dev/provenance/v1",
  predicate: {
    buildDefinition: {
      buildType: "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1",
      externalParameters: {
        workflow: {
          ref: "refs/heads/main",
          repository: "https://github.com/mannyc2/ts-release",
          path: ".github/workflows/release.yml"
        }
      },
      internalParameters: {
        github: {
          event_name: "workflow_dispatch",
          repository_id: "1271545637",
          repository_owner_id: "126291407"
        }
      },
      resolvedDependencies: [{
        uri: "git+https://github.com/mannyc2/ts-release@refs/heads/main",
        digest: { gitCommit: candidateSha }
      }]
    },
    runDetails: {
      builder: { id: "https://github.com/actions/runner/github-hosted" },
      metadata: {
        invocationId: "https://github.com/mannyc2/ts-release/actions/runs/42/attempts/1"
      }
    }
  },
  ...patch
})

const bundle = (statement: unknown) => ({
  mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json",
  verificationMaterial: { certificate: { rawBytes: "certificate" }, tlogEntries: [{}] },
  dsseEnvelope: {
    payload: Buffer.from(JSON.stringify(statement)).toString("base64"),
    payloadType: "application/vnd.in-toto+json",
    signatures: [{ sig: "signature", keyid: "" }]
  }
})

const input = () => ({
  candidateBytes: bytes,
  tarballBytes: bytes,
  candidateSha,
  invocationMode: "current-run" as const,
  runId: "42",
  runAttempt: "1",
  repositoryId: "1271545637",
  repositoryOwnerId: "126291407",
  distTags: { latest: "0.3.0" },
  metadata: {
    name: "@mannyc1/ts-release",
    version: "0.3.0",
    dist: {
      integrity,
      shasum,
      tarball: "https://registry.npmjs.org/@mannyc1/ts-release/-/ts-release-0.3.0.tgz",
      attestations: {
        url: "https://registry.npmjs.org/-/npm/v1/attestations/@mannyc1%2fts-release@0.3.0",
        provenance: { predicateType: "https://slsa.dev/provenance/v1" }
      }
    }
  },
  attestations: {
    attestations: [
      { predicateType: "https://github.com/npm/attestation/tree/main/specs/publish/v0.1", bundle: bundle({}) },
      { predicateType: "https://slsa.dev/provenance/v1", bundle: bundle(provenance()) }
    ]
  }
})

describe("published self-release npm evidence", () => {
  test("binds the cryptographically verified Fulcio signer and GitHub extensions to the exact run", () => {
    const invocation = "https://github.com/mannyc2/ts-release/actions/runs/42/attempts/1"
    expect(() => verifySelfReleaseFulcioEvidence(
      fulcioEvidence(), candidateSha, invocation
    )).not.toThrow()

    const valid = fulcioEvidence()
    const hostile: ReadonlyArray<ReturnType<typeof fulcioEvidence>> = [
      { ...valid, certificateIdentityUri: "https://github.com/attacker/repo/.github/workflows/release.yml@refs/heads/main" },
      { ...valid, certificateIssuer: "https://issuer.example.invalid" },
      { ...valid, sigstoreVersion: "4.2.0" },
      {
        ...valid,
        extensions: {
          ...valid.extensions,
          sourceRepositorySubject: "repo:mannyc2/ts-release:ref:refs/heads/main"
        }
      },
      ...Object.keys(valid.extensions).map((name) => ({
        ...valid,
        extensions: { ...valid.extensions, [name]: "attacker-controlled" }
      }))
    ]
    // Even a cryptographically valid certificate around the same self-asserted
    // statement is rejected when its signer identity or run extensions differ.
    for (const evidence of hostile) {
      expect(() => verifySelfReleaseFulcioEvidence(evidence, candidateSha, invocation)).toThrow()
    }
  })

  test("selects same-run proof only for a fresh mutation and prior-run proof only for exact recovery", () => {
    expect(selectSelfReleaseNpmInvocationMode(
      actionReport("ConvergedAfterMutation"), adoptedReference
    )).toBe("current-run")
    expect(selectSelfReleaseNpmInvocationMode(
      actionReport("AlreadyEquivalent"), adoptedReference
    )).toBe("published-run")

    // Run A lost the provider response and cannot claim completion. Run B's
    // exact re-observation is the only path that may authenticate A's public
    // provenance instead of demanding impossible same-run provenance from B.
    expect(() => selectSelfReleaseNpmInvocationMode(
      actionReport("UncertainSubject", { status: "uncertain" }), adoptedReference
    )).toThrow()
    expect(selectSelfReleaseNpmInvocationMode(
      actionReport("AlreadyEquivalent"), adoptedReference
    )).toBe("published-run")
  })

  test("rejects malformed or differently bound report-aware publication evidence", () => {
    const reports: ReadonlyArray<unknown> = [
      actionReport("BlockedSubject"),
      actionReport("AlreadyEquivalent", { prepared: `${adoptedReference}-other` }),
      actionReport("AlreadyEquivalent", { command: "inspect" }),
      actionReport("AlreadyEquivalent", { unexpected: true }),
      { ...actionReport("AlreadyEquivalent"), report: { status: "complete", subjects: [] } },
      {
        ...actionReport("AlreadyEquivalent"),
        report: {
          status: "complete",
          subjects: [
            { _tag: "AlreadyEquivalent", subject: `${adoptedReference}-other` },
            { _tag: "AlreadyEquivalent", subject: "npm:@mannyc1/ts-release@0.3.0" }
          ]
        }
      }
    ]
    for (const report of reports) {
      expect(() => selectSelfReleaseNpmInvocationMode(report, adoptedReference)).toThrow()
    }
  })

  test("authenticates the exact canonical GitHub run attempt named by prior provenance", () => {
    const invocation = "https://github.com/mannyc2/ts-release/actions/runs/42/attempts/1"
    const response = {
      id: 42,
      run_attempt: 1,
      head_sha: candidateSha,
      head_branch: "main",
      path: ".github/workflows/release.yml",
      event: "workflow_dispatch",
      status: "completed",
      repository: { full_name: "mannyc2/ts-release" },
      head_repository: { full_name: "mannyc2/ts-release" }
    }
    expect(verifyPublishedInvocationRun({ invocation, candidateSha, response })).toEqual({
      runId: "42", runAttempt: "1"
    })
    for (const changed of [
      { ...response, id: 43 },
      { ...response, run_attempt: 2 },
      { ...response, head_sha: "e".repeat(40) },
      { ...response, head_branch: "feature" },
      { ...response, path: ".github/workflows/other.yml" },
      { ...response, event: "push" },
      { ...response, status: "in_progress" },
      { ...response, repository: { full_name: "attacker/ts-release" } },
      { ...response, head_repository: { full_name: "attacker/ts-release" } }
    ]) {
      expect(() => verifyPublishedInvocationRun({ invocation, candidateSha, response: changed })).toThrow()
    }
  })

  test("binds adopted bytes to registry integrity and one exact GitHub SLSA statement", () => {
    expect(verifySelfReleaseNpmEvidence(input())).toEqual({
      packageName: "@mannyc1/ts-release",
      version: "0.3.0",
      sha512: sha512Hex,
      sourceSha: candidateSha,
      workflow: "mannyc2/ts-release/.github/workflows/release.yml@refs/heads/main",
      invocation: "https://github.com/mannyc2/ts-release/actions/runs/42/attempts/1"
    })
  })

  test("rejects byte, subject, source, workflow, identity, or invocation drift", () => {
    const valid = input()
    const mutations: ReadonlyArray<unknown> = [
      { ...valid, tarballBytes: new TextEncoder().encode("different") },
      { ...valid, candidateSha: "e".repeat(40) },
      { ...valid, runId: "43" },
      { ...valid, repositoryId: "9" },
      { ...valid, metadata: { ...valid.metadata, version: "0.3.1" } },
      { ...valid, distTags: { latest: "0.2.2" } },
      {
        ...valid,
        attestations: { attestations: [
          ...valid.attestations.attestations,
          { predicateType: "https://slsa.dev/provenance/v1", bundle: bundle(provenance()) }
        ] }
      }
    ]
    for (const mutation of mutations) {
      expect(() => verifySelfReleaseNpmEvidence(mutation as ReturnType<typeof input>)).toThrow()
    }
  })

  test("final GitHub publication accepts only a canonical earlier release-workflow invocation", () => {
    const valid = input()
    expect(verifySelfReleaseNpmEvidence({
      ...valid,
      invocationMode: "published-run",
      runId: "999",
      runAttempt: "9"
    })).toHaveProperty("invocation", "https://github.com/mannyc2/ts-release/actions/runs/42/attempts/1")

    const statement = provenance()
    ;(statement.predicate.runDetails.metadata as { invocationId: string }).invocationId =
      "https://github.com/attacker/ts-release/actions/runs/42/attempts/1"
    const changed = input()
    changed.attestations.attestations[1] = {
      predicateType: "https://slsa.dev/provenance/v1",
      bundle: bundle(statement)
    }
    expect(() => verifySelfReleaseNpmEvidence({
      ...changed,
      invocationMode: "published-run"
    })).toThrow()
  })

  test("rejects a malformed, keyed, or unsigned provenance envelope", () => {
    for (const changed of [
      { ...bundle(provenance()), mediaType: "application/json" },
      { ...bundle(provenance()), dsseEnvelope: { ...bundle(provenance()).dsseEnvelope, payloadType: "text/plain" } },
      { ...bundle(provenance()), dsseEnvelope: { ...bundle(provenance()).dsseEnvelope, signatures: [] } },
      { ...bundle(provenance()), dsseEnvelope: { ...bundle(provenance()).dsseEnvelope, signatures: [{ sig: "signature", keyid: "registry-key" }] } }
    ]) {
      const valid = input()
      valid.attestations.attestations[1] = {
        predicateType: "https://slsa.dev/provenance/v1",
        bundle: changed
      }
      expect(() => verifySelfReleaseNpmEvidence(valid)).toThrow()
    }
  })
})
