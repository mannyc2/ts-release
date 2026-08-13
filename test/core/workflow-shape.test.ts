import { expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"

const workflow = (name: string): string => readFileSync(`.github/workflows/${name}`, "utf8")
const reportUploads = (value: string): ReadonlyArray<string> =>
  [...value.matchAll(/path: \$\{\{ steps\.[a-z-]+\.outputs\.report-ref \}\}/gu)].map((match) => match[0])

interface ParsedWorkflow {
  readonly on?: Readonly<Record<string, {
    readonly inputs?: Readonly<Record<string, {
      readonly required?: boolean
      readonly default?: unknown
      readonly type?: string
    }>>
  } | null>>
  readonly jobs?: Readonly<Record<string, {
    readonly if?: string
    readonly permissions?: Readonly<Record<string, string>>
    readonly steps?: ReadonlyArray<{
      readonly uses?: unknown
      readonly env?: Readonly<Record<string, unknown>>
      readonly with?: Readonly<Record<string, unknown>>
    }>
  }>>
}

interface TrustedTemplateConfig {
  readonly publish: {
    readonly npm: {
      readonly authentication: {
        readonly attestation: {
          readonly provider: string
          readonly runner: string
          readonly repository: string
          readonly workflow: string
          readonly workflowRef: string
          readonly allowedAction: string
        }
      }
    }
  }
}

const trustedConfig = (name: string): TrustedTemplateConfig =>
  JSON.parse(readFileSync(`templates/npm-github/${name}`, "utf8")) as TrustedTemplateConfig

const automaticCommand = "${{ inputs.prepared_ref == '' && 'release' || 'publish' }}"
const automaticPrepared = "${{ inputs.prepared_ref }}"
const templateAdmission = "${{ github.ref == 'refs/heads/main' && github.sha == inputs.candidate_sha }}"
const repositoryAdmission = "${{ github.repository == 'mannyc2/ts-release' && github.ref == 'refs/heads/main' && github.sha == inputs.candidate_sha }}"

const parseWorkflow = (value: string): ParsedWorkflow => Bun.YAML.parse(value) as ParsedWorkflow

const expectDispatchInputs = (value: string, options: { readonly recovery: boolean }): void => {
  const parsed = parseWorkflow(value)
  expect(Object.keys(parsed.on ?? {})).toEqual(["workflow_dispatch"])
  const inputs = parsed.on?.workflow_dispatch?.inputs
  expect(inputs?.candidate_sha).toMatchObject({ required: true, type: "string" })
  if (options.recovery) {
    expect(inputs?.prepared_ref).toMatchObject({ required: false, default: "", type: "string" })
  } else {
    expect(inputs?.prepared_ref).toBeUndefined()
  }
}

const actionSteps = (value: string): ReadonlyArray<{
  readonly job: string
  readonly if?: string
  readonly permissions?: Readonly<Record<string, string>>
  readonly env?: Readonly<Record<string, unknown>>
  readonly with: Readonly<Record<string, unknown>>
}> => {
  const parsed = parseWorkflow(value)
  return Object.entries(parsed.jobs ?? {}).flatMap(([job, definition]) =>
    (definition.steps ?? []).flatMap((step) =>
      typeof step.uses === "string" && step.uses.includes("ts-release-action")
        ? [{
          job,
          ...(definition.if === undefined ? {} : { if: definition.if }),
          ...(definition.permissions === undefined ? {} : { permissions: definition.permissions }),
          ...(step.env === undefined ? {} : { env: step.env }),
          with: step.with ?? {}
        }]
        : []
    )
  )
}

const automaticSelection = (
  preparedRef: string,
  config: string
): { readonly command: "release" | "publish", readonly config: string, readonly prepared: string } =>
  preparedRef === ""
    ? { command: "release", config, prepared: "" }
    : { command: "publish", config: "", prepared: preparedRef }

const commandConfig = (value: string, command: string): unknown => {
  const parsed = parseWorkflow(value)
  return Object.values(parsed.jobs ?? {}).flatMap((job) => job.steps ?? [])
    .find((step) => step.with?.command === command)?.with?.config
}

const expectBunBeforeEveryActionInvocation = (value: string): void => {
  const parsed = parseWorkflow(value)
  for (const [jobName, job] of Object.entries(parsed.jobs ?? {})) {
    const steps = job.steps ?? []
    for (const [index, step] of steps.entries()) {
      if (typeof step.uses !== "string" || !step.uses.includes("ts-release-action")) continue
      expect(
        steps.slice(0, index).some((candidate) => candidate.uses === "oven-sh/setup-bun@v2"),
        `${jobName} must install Bun before invoking the composite ts-release Action.`
      ).toBe(true)
    }
  }
}

const expectOnlyRedactedReportUploads = (value: string, count: number): void => {
  expect(value.match(/uses: actions\/upload-artifact@v4/gu)?.length).toBe(count)
  expect(reportUploads(value)).toHaveLength(count)
  expect(value).not.toMatch(/path:.*prepared/iu)
  expect(value).not.toContain("actions/download-artifact@v4")
}

test("repository workflow topology has only CI and release", () => {
  expect(readdirSync(".github/workflows").filter((name) => name.endsWith(".yml")).sort()).toEqual(["ci.yml", "release.yml"])
})

test("CI delegates its required gate inventory to check:portable", () => {
  const ci = workflow("ci.yml")
  expect(ci.match(/bun run check:portable/gu)?.length).toBe(1)
  expect(ci).not.toMatch(/check:(?:versions|docs-claims|import-rules|tree-shaking|config-schema)/u)
})

test("repository release is a candidate-bound manual dispatch with one mutually exclusive automatic handoff", () => {
  const release = workflow("release.yml")
  expectDispatchInputs(release, { recovery: true })
  const parsed = parseWorkflow(release)
  expect(Object.keys(parsed.jobs ?? {})).toEqual(["release"])
  expect(parsed.jobs?.release?.if).toBe(repositoryAdmission)
  const [action] = actionSteps(release)
  expect(action).toMatchObject({
    job: "release",
    if: repositoryAdmission,
    permissions: { actions: "read", contents: "write", "id-token": "write" },
    env: { GITHUB_TOKEN: "${{ github.token }}" },
    with: {
      command: automaticCommand,
      config: "${{ inputs.prepared_ref == '' && 'apps/release-ts/release.config.json' || '' }}",
      prepared: automaticPrepared
    }
  })
  expect(actionSteps(release)).toHaveLength(1)
  expect(automaticSelection("", "apps/release-ts/release.config.json")).toEqual({
    command: "release",
    config: "apps/release-ts/release.config.json",
    prepared: ""
  })
  expect(automaticSelection("prepared:gha:recovery", "apps/release-ts/release.config.json")).toEqual({
    command: "publish",
    config: "",
    prepared: "prepared:gha:recovery"
  })
  expect(release).not.toContain("__ts_release_quarantined__")
  expect(release).not.toContain("${{ false }}")
  expectOnlyRedactedReportUploads(release, 1)
  expect(release).toContain("persist-credentials: false")
  expect(release).not.toMatch(/\benvironment:/u)
  expect(release).not.toMatch(/\b(?:plan|apply|doctor|reviewer|review_id|run_id|scope|resume|through)\b/iu)
  expect(release).not.toMatch(/bun run build/u)
  expectBunBeforeEveryActionInvocation(release)
})

test("user templates preserve the same handoff, with the environment gate only on publish", () => {
  const automatic = workflowTemplate("release.yml")
  const reviewed = workflowTemplate("reviewed-release.yml")
  for (const value of [automatic, reviewed]) {
    expect(value).toContain("mannyc2/ts-release/apps/ts-release-action@v0.2.0")
    expect(value).not.toContain("__TS_RELEASE_ACTION_REF__")
    expect(value).toContain("persist-credentials: false")
    expect(value).not.toContain("mannyc2/ts-release-action")
    expectBunBeforeEveryActionInvocation(value)
  }
  expectDispatchInputs(automatic, { recovery: true })
  expectDispatchInputs(reviewed, { recovery: false })
  expectOnlyRedactedReportUploads(automatic, 1)
  expectOnlyRedactedReportUploads(reviewed, 2)
  const automaticAction = actionSteps(automatic)
  expect(automaticAction).toHaveLength(1)
  expect(automaticAction[0]).toMatchObject({
    job: "release",
    if: templateAdmission,
    permissions: { actions: "read", contents: "write", "id-token": "write" },
    env: { GITHUB_TOKEN: "${{ github.token }}" },
    with: {
      command: automaticCommand,
      config: "${{ inputs.prepared_ref == '' && 'release.config.json' || '' }}",
      prepared: automaticPrepared
    }
  })
  expect(reviewed.match(/command: prepare/gu)?.length).toBe(1)
  expect(reviewed.match(/command: publish/gu)?.length).toBe(1)
  expect(reviewed).not.toContain("command: inspect")
  expect(reviewed).toContain("prepared: ${{ needs.prepare.outputs.prepared-ref }}")
  expect(automatic).not.toMatch(/\benvironment:/u)
  expect(reviewed.match(/\benvironment:/gu)?.length).toBe(1)
  const parsedReviewed = parseWorkflow(reviewed)
  expect(parsedReviewed.jobs?.prepare?.if).toBe(templateAdmission)
  expect(parsedReviewed.jobs?.publish?.if).toBe(templateAdmission)
  expect(parsedReviewed.jobs?.publish?.permissions?.actions).toBeUndefined()
  const reviewedPublish = reviewed.slice(reviewed.indexOf("  publish:"))
  expect(reviewedPublish).toContain("environment: release")
})

test("candidate mismatches are rejected at the job boundary before any Action step can run", () => {
  const candidate = "c".repeat(40)
  const admitted = (input: {
    readonly repository?: string
    readonly ref: string
    readonly sha: string
    readonly candidateSha: string
  }): boolean =>
    (input.repository === undefined || input.repository === "mannyc2/ts-release") &&
    input.ref === "refs/heads/main" &&
    input.sha === input.candidateSha

  expect(parseWorkflow(workflow("release.yml")).jobs?.release?.if).toBe(repositoryAdmission)
  for (const value of [
    { repository: "fork/ts-release", ref: "refs/heads/main", sha: candidate, candidateSha: candidate },
    { repository: "mannyc2/ts-release", ref: "refs/heads/evidence", sha: candidate, candidateSha: candidate },
    { repository: "mannyc2/ts-release", ref: "refs/heads/main", sha: candidate, candidateSha: "d".repeat(40) }
  ]) expect(admitted(value)).toBe(false)

  for (const name of ["release.yml", "reviewed-release.yml"]) {
    for (const action of actionSteps(workflowTemplate(name))) expect(action.if).toBe(templateAdmission)
  }
  expect(admitted({ ref: "refs/heads/evidence", sha: candidate, candidateSha: candidate })).toBe(false)
  expect(admitted({ ref: "refs/heads/main", sha: candidate, candidateSha: "d".repeat(40) })).toBe(false)
})

test("each trusted workflow loads the config that attests its exact host identity", () => {
  const automaticWorkflow = workflowTemplate("release.yml")
  const reviewedWorkflow = workflowTemplate("reviewed-release.yml")
  expect(actionSteps(automaticWorkflow)[0]?.with.config).toBe("${{ inputs.prepared_ref == '' && 'release.config.json' || '' }}")
  expect(commandConfig(reviewedWorkflow, "prepare")).toBe("reviewed-release.config.json")
  expect(commandConfig(reviewedWorkflow, "publish")).toBeUndefined()

  const automatic = trustedConfig("release.config.json")
  const reviewed = trustedConfig("reviewed-release.config.json")
  const automaticAttestation = automatic.publish.npm.authentication.attestation
  const reviewedAttestation = reviewed.publish.npm.authentication.attestation
  expect(automaticAttestation).toEqual({
    provider: "github-actions",
    runner: "github-hosted",
    repository: "owner/repo",
    workflow: "release.yml",
    workflowRef: "refs/heads/main",
    allowedAction: "npm-publish-direct"
  })
  expect(reviewedAttestation).toEqual({
    ...automaticAttestation,
    workflow: "reviewed-release.yml"
  })
  expect(reviewed).toEqual({
    ...automatic,
    publish: {
      ...automatic.publish,
      npm: {
        ...automatic.publish.npm,
        authentication: {
          ...automatic.publish.npm.authentication,
          attestation: reviewedAttestation
        }
      }
    }
  })
})

const workflowTemplate = (name: string): string => readFileSync(`templates/github-actions/${name}`, "utf8")
