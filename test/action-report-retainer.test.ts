import { expect, test } from "bun:test"
import * as Result from "effect/Result"
import {
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, join } from "node:path"
import type { ActionArtifactTransport } from "../apps/ts-release-action/src/artifact-client.js"
import {
  retainSelfReleaseReport,
  type SelfReleaseReportKind,
  type SelfReleaseReportRetentionEnvironment
} from "../apps/ts-release-action/src/report-retainer.js"
import {
  npmOidcCertificationSchemaVersion,
  npmOidcCertificationScope,
  npmOidcCertificationStatus,
  type NpmOidcCertificationReceipt
} from "../apps/release-ts/scripts/npm-oidc-certification-contract.js"
import {
  CanonicalAudience,
  ProviderId,
  SubjectId
} from "../src/model/authority.js"
import { NonEmptyName } from "../src/model/primitives.js"
import {
  Difference,
  MutationPrecondition,
  NeedsMutation,
  PresentDifferent,
  PresentEquivalent,
  SafeReason,
  Started,
  makeAlreadyEquivalent,
  makeAuthorityAcquired,
  makeReleaseReport,
  makeUncertainSubject
} from "../src/publication/report.js"

const candidateSha = "c".repeat(40)
const digest = "a".repeat(64)
const prepared = `prepared:gha:mannyc2/ts-release/runs/334/attempts/1/artifacts/ts-release-prepared-1-${digest}#sha256-${digest}`
const artifactDigest = "d".repeat(64)

const reportPath = (root: string, kind: SelfReleaseReportKind): string => join(
  root,
  ".release",
  "ts-release",
  kind === "tag"
    ? "tag-report.json"
    : kind === "npm-oidc-certification"
      ? "npm-oidc-certification.json"
      : "action-report.json"
)

const jobFor = (kind: SelfReleaseReportKind): string => kind === "tag"
  ? "create-tag"
  : kind === "npm-oidc-certification"
    ? "certify-npm-oidc"
  : kind === "npm-publish"
    ? "publish-npm"
    : kind === "npm-inspect"
      ? "preflight-github"
      : "publish-github"

const environmentFor = (
  root: string,
  kind: SelfReleaseReportKind,
  patch: Readonly<Record<string, string | undefined>> = {}
): SelfReleaseReportRetentionEnvironment => ({
  GITHUB_WORKSPACE: realpathSync(root),
  GITHUB_REPOSITORY: "mannyc2/ts-release",
  GITHUB_REPOSITORY_ID: "1271545637",
  GITHUB_REPOSITORY_OWNER_ID: "126291407",
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_REF: "refs/heads/main",
  GITHUB_SHA: candidateSha,
  GITHUB_WORKFLOW: "Release",
  GITHUB_WORKFLOW_REF: "mannyc2/ts-release/.github/workflows/release.yml@refs/heads/main",
  GITHUB_WORKFLOW_SHA: candidateSha,
  GITHUB_RUN_ID: "992",
  GITHUB_RUN_ATTEMPT: "2",
  GITHUB_JOB: jobFor(kind),
  ...patch
})

const tagReport = (patch: Readonly<Record<string, unknown>> = {}) => ({
  schemaVersion: "ts-release/tag-convergence/v1",
  status: "complete",
  result: "created-and-observed",
  tag: "v0.3.0",
  candidateSha,
  mutationAttempts: 1,
  ...patch
})

const get = <A, E>(value: Result.Result<A, E>): A => Result.getOrThrow(value)
const equivalent = (subject: ReturnType<typeof SubjectId.make>) => PresentEquivalent.make({ subject })
const alreadyEquivalent = (subject: ReturnType<typeof SubjectId.make>) =>
  get(makeAlreadyEquivalent(subject, [equivalent(subject)], []))

const uncertainGitHubRelease = () => {
  const preparedSubject = SubjectId.make(prepared)
  const remoteSubject = SubjectId.make("github:mannyc2/ts-release#v0.3.0")
  const different = () => PresentDifferent.make({
    subject: remoteSubject,
    differences: [new Difference({
      field: NonEmptyName.make("draft"),
      expected: SafeReason.make("published immutable release"),
      observed: SafeReason.make("draft staging release")
    })]
  })
  const authority = get(makeAuthorityAcquired({
    subject: remoteSubject,
    provider: ProviderId.make("github"),
    audience: CanonicalAudience.make("https://api.github.com/repos/mannyc2/ts-release"),
    requestedPurpose: "publish",
    grantKind: "ScopedSecret",
    purposes: ["publish"]
  }))
  const remote = get(makeUncertainSubject({
    subject: remoteSubject,
    observationAuthorities: [],
    observations: [different()],
    decision: NeedsMutation.make({
      subject: remoteSubject,
      precondition: new MutationPrecondition({ kind: NonEmptyName.make("release-absent") })
    }),
    authority,
    attempt: Started.make({ subject: remoteSubject }),
    trace: [different()]
  }))
  return makeReleaseReport([alreadyEquivalent(preparedSubject), remote])
}

const actionReport = (
  kind: Exclude<SelfReleaseReportKind, "tag" | "npm-oidc-certification">,
  patch: Readonly<Record<string, unknown>> = {}
) => {
  if (kind === "npm-inspect") {
    return {
      schemaVersion: "ts-release-action-report/v2",
      command: "inspect",
      status: "complete",
      prepared,
      ...patch
    }
  }
  const report = kind === "github-publish"
    ? uncertainGitHubRelease()
    : makeReleaseReport([
      alreadyEquivalent(SubjectId.make(prepared)),
      alreadyEquivalent(SubjectId.make("npm:@mannyc1/ts-release@0.3.0"))
    ])
  return {
    schemaVersion: "ts-release-action-report/v2",
    command: "publish",
    status: report.status,
    prepared,
    report,
    ...patch
  }
}

const npmOidcReport = (): NpmOidcCertificationReceipt => {
  const snapshotDigest = "b".repeat(64)
  const snapshot = {
    packumentStatus: 200 as const,
    packumentSha256: snapshotDigest,
    distTagsStatus: 200 as const,
    distTagsSha256: snapshotDigest,
    latest: "0.2.2",
    versionStatus: 404 as const,
    versionSha256: snapshotDigest,
    attestationsStatus: 404 as const,
    attestationsSha256: snapshotDigest
  }
  return {
    schemaVersion: npmOidcCertificationSchemaVersion,
    status: npmOidcCertificationStatus,
    scope: npmOidcCertificationScope,
    candidateSha,
    prepared,
    package: {
      name: "@mannyc1/ts-release",
      version: "0.3.0",
      preparedDigest: digest,
      tarballSize: 123,
      tarballSha1: "c".repeat(40),
      tarballSha256: "d".repeat(64),
      tarballIntegrity: `sha512-${Buffer.alloc(64).toString("base64")}`
    },
    toolchain: { node: "22.22.2", bun: "1.3.14", npm: "11.11.0" },
    github: {
      repository: "mannyc2/ts-release",
      repositoryId: "1271545637",
      repositoryOwner: "mannyc2",
      repositoryOwnerId: "126291407",
      repositoryVisibility: "public",
      actor: "mannyc2",
      actorId: "126291407",
      refProtected: "true",
      workflow: "Release",
      workflowRef: "mannyc2/ts-release/.github/workflows/release.yml@refs/heads/main",
      workflowSha: candidateSha,
      directJobWorkflowClaims: "absent",
      ref: "refs/heads/main",
      eventName: "workflow_dispatch",
      environment: "npm",
      runnerEnvironment: "github-hosted",
      runId: "992",
      runAttempt: "2"
    },
    oidc: {
      issuer: "https://token.actions.githubusercontent.com",
      audience: "npm:registry.npmjs.org",
      subject: "repo:mannyc2@126291407/ts-release@1271545637:environment:npm",
      algorithm: "RS256"
    },
    registry: { before: snapshot, after: snapshot, unchanged: true },
    npmDryRun: {
      command: "npm publish exact.tgz --dry-run --ignore-scripts --registry https://registry.npmjs.org/ --tag latest --access public --json --loglevel verbose",
      tokenExchangeMarkers: 1,
      packageId: "@mannyc1/ts-release@0.3.0",
      packageSize: 123,
      claim: npmOidcCertificationScope,
      provenance: "not-certified"
    }
  }
}

interface StoredArtifact {
  readonly id: number
  readonly digest: string
  readonly files: Readonly<Record<string, Uint8Array>>
}

class MemoryArtifactTransport implements ActionArtifactTransport {
  uploadCalls = 0
  downloadCalls = 0
  artifact: StoredArtifact | undefined

  constructor(readonly fault: "none" | "response-loss" | "response-loss-and-absence" |
    "tamper" | "extra-file" | "wrong-identity" | "digest-mismatch" | "missing-digest-proof" = "none") {}

  readonly upload: ActionArtifactTransport["upload"] = async ({ files }) => {
    this.uploadCalls += 1
    const stored: StoredArtifact = {
      id: 71,
      digest: artifactDigest,
      files: Object.fromEntries(files.map((path) => [basename(path), new Uint8Array(readFileSync(path))]))
    }
    if (this.fault !== "response-loss-and-absence") this.artifact = stored
    if (this.fault === "response-loss" || this.fault === "response-loss-and-absence") {
      throw new Error("simulated response loss")
    }
    return { id: stored.id, digest: stored.digest }
  }

  readonly download: ActionArtifactTransport["download"] = async ({ destination }) => {
    this.downloadCalls += 1
    const artifact = this.artifact
    if (artifact === undefined) throw new Error("artifact not observable")
    for (const [name, bytes] of Object.entries(artifact.files)) {
      const value = this.fault === "tamper" && name === "report.json"
        ? new TextEncoder().encode("{}\n")
        : bytes
      writeFileSync(join(destination, name), value, { mode: 0o600 })
    }
    if (this.fault === "extra-file") writeFileSync(join(destination, "extra.json"), "{}\n", { mode: 0o600 })
    return {
      id: this.fault === "wrong-identity" ? artifact.id + 1 : artifact.id,
      digest: `sha256:${artifact.digest}`,
      path: destination,
      ...(this.fault === "missing-digest-proof"
        ? {}
        : { digestMismatch: this.fault === "digest-mismatch" })
    }
  }
}

const fixture = (
  kind: SelfReleaseReportKind,
  report: unknown,
  options: {
    readonly mode?: number
    readonly environment?: Readonly<Record<string, string | undefined>>
    readonly transport?: MemoryArtifactTransport
    readonly preparedReference?: string
  } = {}
) => {
  const root = mkdtempSync(join(tmpdir(), "ts-release-report-retainer-test-"))
  const path = reportPath(root, kind)
  mkdirSync(dirname(path), { recursive: true })
  const text = typeof report === "string" ? report : `${JSON.stringify(report, null, 2)}\n`
  writeFileSync(path, text, { mode: options.mode ?? 0o600 })
  const transport = options.transport ?? new MemoryArtifactTransport()
  return {
    root,
    path,
    text,
    transport,
    run: () => retainSelfReleaseReport({
      kind,
      candidateSha,
      prepared: kind === "tag" ? "" : (options.preparedReference ?? prepared),
      workspace: root,
      environment: environmentFor(root, kind, options.environment),
      artifacts: transport,
      temporaryRoot: root
    })
  }
}

test("retains one exact tag report and a run-attempt-bound canonical receipt", async () => {
  const current = fixture("tag", tagReport())
  try {
    const result = await current.run()
    expect(result).toMatchObject({
      schemaVersion: "ts-release/report-retention-result/v1",
      status: "uploaded-and-verified",
      artifactName: "ts-release-tag-report-2",
      artifactId: 71,
      artifactDigest: `sha256:${artifactDigest}`
    })
    expect(current.transport.uploadCalls).toBe(1)
    expect(current.transport.downloadCalls).toBe(1)
    const stored = current.transport.artifact!
    expect(new TextDecoder().decode(stored.files["report.json"]!)).toBe(current.text)
    const receipt = JSON.parse(new TextDecoder().decode(stored.files["receipt.json"]!)) as Record<string, unknown>
    expect(receipt).toEqual({
      schemaVersion: "ts-release/retained-report/v1",
      repository: "mannyc2/ts-release",
      repositoryId: "1271545637",
      repositoryOwnerId: "126291407",
      workflow: "Release",
      workflowRef: "mannyc2/ts-release/.github/workflows/release.yml@refs/heads/main",
      workflowSha: candidateSha,
      ref: "refs/heads/main",
      runId: "992",
      runAttempt: "2",
      reportKind: "tag",
      artifactName: "ts-release-tag-report-2",
      candidateSha,
      prepared: "",
      reportSha256: result.reportSha256
    })
  } finally {
    rmSync(current.root, { recursive: true, force: true })
  }
})

test("retains the expected uncertain GitHub staging report from a failed producer step", async () => {
  const current = fixture("github-publish", actionReport("github-publish"))
  try {
    const result = await current.run()
    expect(result.status).toBe("uploaded-and-verified")
    expect(current.transport.uploadCalls).toBe(1)
    const retained = JSON.parse(new TextDecoder().decode(
      current.transport.artifact!.files["report.json"]!
    )) as Record<string, unknown>
    expect(retained.status).toBe("uncertain")
    expect(retained).toHaveProperty("report.subjects.1._tag", "UncertainSubject")
  } finally {
    rmSync(current.root, { recursive: true, force: true })
  }
})

test("rereads once after upload response loss and never blindly resubmits", async () => {
  const transport = new MemoryArtifactTransport("response-loss")
  const current = fixture("npm-inspect", actionReport("npm-inspect"), { transport })
  try {
    expect(await current.run()).toMatchObject({ status: "recovered-after-upload-response-loss" })
    expect(transport.uploadCalls).toBe(1)
    expect(transport.downloadCalls).toBe(1)
  } finally {
    rmSync(current.root, { recursive: true, force: true })
  }
})

test("leaves an unobservable upload outcome unknown without a second mutation dispatch", async () => {
  const transport = new MemoryArtifactTransport("response-loss-and-absence")
  const current = fixture("npm-publish", actionReport("npm-publish"), { transport })
  try {
    await expect(current.run()).rejects.toThrow("outcome is unknown")
    expect(transport.uploadCalls).toBe(1)
    expect(transport.downloadCalls).toBe(1)
  } finally {
    rmSync(current.root, { recursive: true, force: true })
  }
})

test("rejects nonprivate, linked, oversized, non-strict, unredacted, or differently bound source reports", async () => {
  const cases: ReadonlyArray<{
    readonly name: string
    readonly make: () => ReturnType<typeof fixture>
    readonly mutate?: (current: ReturnType<typeof fixture>) => void
  }> = [
    { name: "public mode", make: () => fixture("tag", tagReport(), { mode: 0o644 }) },
    {
      name: "hard link",
      make: () => fixture("tag", tagReport()),
      mutate: (current) => linkSync(current.path, join(current.root, "report-alias.json"))
    },
    {
      name: "symbolic link",
      make: () => fixture("tag", tagReport()),
      mutate: (current) => {
        const target = join(current.root, "tag-target.json")
        writeFileSync(target, current.text, { mode: 0o600 })
        rmSync(current.path)
        symlinkSync(target, current.path)
      }
    },
    { name: "oversized", make: () => fixture("tag", `{"padding":"${"x".repeat(1024 * 1024)}"}\n`) },
    {
      name: "duplicate key",
      make: () => fixture("tag", `{"schemaVersion":"ts-release/tag-convergence/v1","schemaVersion":"duplicate"}\n`)
    },
    { name: "UTF-8 BOM", make: () => fixture("tag", `\ufeff${JSON.stringify(tagReport())}\n`) },
    { name: "token shape", make: () => fixture("tag", { ...tagReport(), note: "ghs_not_a_retained_secret" }) },
    {
      name: "live credential",
      make: () => fixture("tag", { ...tagReport(), note: "exact-live-secret-value" }, {
        environment: { ACTIONS_RUNTIME_TOKEN: "exact-live-secret-value" }
      })
    },
    {
      name: "GitHub mutation token",
      make: () => fixture("tag", tagReport(), { environment: { GITHUB_TOKEN: "forbidden-token" } })
    },
    {
      name: "OIDC request URL",
      make: () => fixture("npm-oidc-certification", npmOidcReport(), {
        environment: { ACTIONS_ID_TOKEN_REQUEST_URL: "https://example.invalid/oidc" }
      })
    },
    {
      name: "OIDC request token",
      make: () => fixture("npm-publish", actionReport("npm-publish"), {
        environment: { ACTIONS_ID_TOKEN_REQUEST_TOKEN: "forbidden-token" }
      })
    },
    { name: "candidate mismatch", make: () => fixture("tag", tagReport({ candidateSha: "e".repeat(40) })) },
    { name: "tag attempt mismatch", make: () => fixture("tag", tagReport({ mutationAttempts: 0 })) },
    { name: "excess key", make: () => fixture("tag", { ...tagReport(), extra: true }) },
    {
      name: "prepared mismatch",
      make: () => fixture("npm-inspect", actionReport("npm-inspect"), { preparedReference: prepared.replace(/a/gu, "e") })
    },
    {
      name: "wrong job",
      make: () => fixture("npm-publish", actionReport("npm-publish"), { environment: { GITHUB_JOB: "publish-github" } })
    }
  ]
  for (const entry of cases) {
    const current = entry.make()
    try {
      entry.mutate?.(current)
      await expect(current.run(), entry.name).rejects.toThrow()
      expect(current.transport.uploadCalls, `${entry.name} reached upload`).toBe(0)
    } finally {
      rmSync(current.root, { recursive: true, force: true })
    }
  }
})

test("rejects changed bytes, unexpected files, identity disagreement, and missing digest proof", async () => {
  for (const fault of [
    "tamper",
    "extra-file",
    "wrong-identity",
    "digest-mismatch",
    "missing-digest-proof"
  ] as const) {
    const transport = new MemoryArtifactTransport(fault)
    const current = fixture("npm-inspect", actionReport("npm-inspect"), { transport })
    try {
      await expect(current.run(), fault).rejects.toThrow()
      expect(transport.uploadCalls).toBe(1)
      expect(transport.downloadCalls).toBe(1)
    } finally {
      rmSync(current.root, { recursive: true, force: true })
    }
  }
})

test("accepts only all five exact report schemas", async () => {
  for (const [kind, report] of [
    ["tag", tagReport()],
    ["npm-oidc-certification", npmOidcReport()],
    ["npm-publish", actionReport("npm-publish")],
    ["npm-inspect", actionReport("npm-inspect")],
    ["github-publish", actionReport("github-publish")]
  ] as const) {
    const current = fixture(kind, report)
    try {
      expect((await current.run()).artifactName).toBe(`ts-release-${kind}-report-2`)
    } finally {
      rmSync(current.root, { recursive: true, force: true })
    }
  }
})
