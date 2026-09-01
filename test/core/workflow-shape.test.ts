import { expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { spawnSync } from "node:child_process"

const workflow = (name: string): string => readFileSync(`.github/workflows/${name}`, "utf8")
const reportUploads = (value: string): ReadonlyArray<string> =>
  [...value.matchAll(/path: \$\{\{ steps\.[a-z-]+\.outputs\.report-ref \}\}/gu)].map((match) => match[0])

interface ParsedWorkflow {
  readonly permissions?: Readonly<Record<string, string>>
  readonly on?: Readonly<Record<string, {
    readonly inputs?: Readonly<Record<string, {
      readonly description?: string
      readonly required?: boolean
      readonly default?: unknown
      readonly type?: string
      readonly options?: ReadonlyArray<string>
    }>>
  } | null>>
  readonly jobs?: Readonly<Record<string, {
    readonly if?: string
    readonly environment?: string
    readonly permissions?: Readonly<Record<string, string>>
    readonly "runs-on"?: string
    readonly steps?: ReadonlyArray<{
      readonly name?: unknown
      readonly if?: unknown
      readonly run?: unknown
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
const repositoryPrepareAdmission = "${{ github.repository == 'mannyc2/ts-release' && github.ref == 'refs/heads/main' && github.sha == inputs.candidate_sha && inputs.mode == 'prepare-exact-sha' }}"
const repositoryTagAdmission = "${{ github.repository == 'mannyc2/ts-release' && github.ref == 'refs/heads/main' && github.sha == inputs.candidate_sha && inputs.mode == 'create-tag' }}"
const repositoryNpmAdmission = "${{ github.repository == 'mannyc2/ts-release' && github.ref == 'refs/heads/main' && github.sha == inputs.candidate_sha && inputs.mode == 'publish-npm' }}"
const repositoryGitHubAdmission = "${{ github.repository == 'mannyc2/ts-release' && github.ref == 'refs/heads/main' && github.sha == inputs.candidate_sha && inputs.mode == 'publish-github' }}"
const freshDispatch = "${{ inputs.prepared_ref == '' }}"
const cachePrimeCommand = "bun install --frozen-lockfile --ignore-scripts --no-save --linker=hoisted"
const dependencyCleanupCommand = "bun --no-env-file --no-install -e 'await (await import(\"node:fs/promises\")).rm(\"node_modules\", { recursive: true, force: true })'"
const cachePrimeRun = `${cachePrimeCommand}\n${dependencyCleanupCommand}`

const parseWorkflow = (value: string): ParsedWorkflow => Bun.YAML.parse(value) as ParsedWorkflow

const actionPins = new Map([
  ["actions/checkout", "11d5960a326750d5838078e36cf38b85af677262"],
  ["actions/setup-node", "49933ea5288caeca8642d1e84afbd3f7d6820020"],
  ["actions/cache", "0057852bfaa89a56745cba8c7296529d2fc39830"],
  ["actions/upload-artifact", "ea165f8d65b6e75b540449e92b4886f43607fa02"],
  ["actions/download-artifact", "d3f86a106a0bac45b974a628896c90dbdf5c8093"],
  ["oven-sh/setup-bun", "0c5077e51419868618aeaa5fe8019c62421857d6"],
  ["pypa/gh-action-pypi-publish", "dc37677b2e1c63e2034f94d8a5b11f265b73ba33"]
])

const expectPinnedInfrastructure = (value: string): void => {
  const parsed = parseWorkflow(value)
  for (const [jobName, job] of Object.entries(parsed.jobs ?? {})) {
    expect(["ubuntu-24.04", "macos-15"], `${jobName} uses a floating runner label`).toContain(job["runs-on"]!)
    for (const step of job.steps ?? []) {
      if (typeof step.uses !== "string" || step.uses.startsWith("./") ||
          step.uses.startsWith("mannyc2/ts-release/apps/ts-release-action@v")) continue
      const [ownerAndRepository, ref] = step.uses.split("@")
      expect(ref, `${step.uses} is not pinned to one full commit`).toMatch(/^[0-9a-f]{40}$/u)
      const expected = actionPins.get(ownerAndRepository!)
      if (expected !== undefined) expect(ref!).toBe(expected)
    }
  }
}

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
        steps.slice(0, index).some((candidate) =>
          (typeof candidate.uses === "string" && candidate.uses.startsWith("oven-sh/setup-bun@")) ||
          (typeof candidate.run === "string" && candidate.run.includes("bootstrap-self-release-tools.sh"))),
        `${jobName} must install Bun before invoking the native ts-release Action.`
      ).toBe(true)
    }
  }
}

const expectIsolatedCacheBeforePreparingActions = (value: string): void => {
  const parsed = parseWorkflow(value)
  for (const [jobName, job] of Object.entries(parsed.jobs ?? {})) {
    const steps = job.steps ?? []
    for (const [index, step] of steps.entries()) {
      if (typeof step.uses !== "string" || !step.uses.includes("ts-release-action")) continue
      const before = steps.slice(0, index)
      const command = step.with?.command
      if (command === "publish" || command === "inspect") {
        expect(before.some((candidate) => typeof candidate.run === "string" && candidate.run.includes("bun install")),
          `${jobName} publish recovery must not materialize workspace dependencies.`
        ).toBe(false)
        continue
      }
      const prime = before.filter((candidate) => candidate.name === "Prime isolated Bun dependency cache")
      expect(prime, `${jobName} must prime the cache exactly once before preparation.`).toHaveLength(1)
      expect(prime[0]?.run).toBe(cachePrimeRun)
      expect(prime[0]?.if).toBe(command === automaticCommand ? freshDispatch : undefined)
      expect(before.some((candidate) =>
        typeof candidate.uses === "string" && candidate.uses.startsWith("actions/setup-node@")),
        `${jobName} must install the pinned Node runtime before preparation.`
      ).toBe(true)
      expect(before.some((candidate) => candidate.run === "bun add --global npm@11.11.0"),
        `${jobName} must install the pinned npm CLI before preparation.`
      ).toBe(true)
      expect(before.filter((candidate) => typeof candidate.run === "string" && candidate.run.includes("bun install"))).toHaveLength(1)
    }
  }
}

const expectOnlyRedactedReportUploads = (value: string, count: number): void => {
  const parsed = parseWorkflow(value)
  const uploaded = Object.values(parsed.jobs ?? {}).flatMap((job) => job.steps ?? [])
    .filter((step) => typeof step.uses === "string" && step.uses.startsWith("actions/upload-artifact@"))
  expect(uploaded).toHaveLength(count)
  expect(reportUploads(value)).toHaveLength(count)
  expect(value).not.toMatch(/path:.*prepared/iu)
  expect(value).not.toMatch(/actions\/download-artifact@/u)
}

test("repository workflow topology has CI, two release paths, and the inert journal interface", () => {
  expect(readdirSync(".github/workflows").filter((name) => name.endsWith(".yml")).sort()).toEqual([
    "ci.yml",
    "operational-journal.yml",
    "pypi-release.yml",
    "release.yml"
  ])
})

test("CI separates portable gates from installed agent-host validation", () => {
  const ci = workflow("ci.yml")
  expect(ci.match(/bun run check:portable/gu)?.length).toBe(1)
  expect(ci.match(/bun run check:agents/gu)?.length).toBe(1)
  expect(ci).not.toMatch(/check:(?:versions|docs-claims|import-rules|tree-shaking|config-schema)/u)
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    readonly scripts: Readonly<Record<string, string>>
  }
  expect(packageJson.scripts["check:portable"]).not.toContain("check:agents")
  expect(packageJson.scripts["check:release-candidate"]).toContain("bun run check:portable && bun run check:agents")
})

test("repository release hard-cuts prepare, tag, npm, and GitHub authorities", () => {
  const release = workflow("release.yml")
  expectDispatchInputs(release, { recovery: true })
  const parsed = parseWorkflow(release)
  expect(parsed.permissions).toEqual({})
  expect(parsed.on?.workflow_dispatch?.inputs?.mode).toEqual({
    description: "Exact self-release authority",
    required: true,
    type: "choice",
    options: ["prepare-exact-sha", "create-tag", "publish-npm", "publish-github"]
  })
  expect(parsed.on?.workflow_dispatch?.inputs?.npm_prepared_ref).toMatchObject({
    required: false, default: "", type: "string"
  })
  expect(Object.keys(parsed.jobs ?? {})).toEqual(["prepare", "create-tag", "publish-npm", "publish-github"])
  expect(parsed.jobs?.prepare).toMatchObject({
    if: repositoryPrepareAdmission,
    permissions: { contents: "read" },
    "runs-on": "ubuntu-24.04"
  })
  expect(parsed.jobs?.prepare?.environment).toBeUndefined()
  expect(parsed.jobs?.["create-tag"]).toMatchObject({
    if: repositoryTagAdmission,
    environment: "github-tag",
    permissions: { contents: "write" },
    "runs-on": "ubuntu-24.04"
  })
  expect(parsed.jobs?.["publish-npm"]).toMatchObject({
    if: repositoryNpmAdmission,
    environment: "npm",
    permissions: { actions: "read", contents: "read", "id-token": "write" },
    "runs-on": "ubuntu-24.04"
  })
  expect(parsed.jobs?.["publish-github"]).toMatchObject({
    if: repositoryGitHubAdmission,
    environment: "github-release",
    permissions: { actions: "read", contents: "write" },
    "runs-on": "ubuntu-24.04"
  })
  expect(parsed.jobs?.["publish-github"]?.permissions?.["id-token"]).toBeUndefined()
  expect(parsed.jobs?.["publish-npm"]?.permissions?.contents).not.toBe("write")

  const actions = actionSteps(release)
  expect(actions.map(({ job, with: inputs }) => ({
    job,
    command: inputs.command,
    config: inputs.config,
    prepared: inputs.prepared
  }))).toEqual([
    { job: "prepare", command: "prepare", config: "apps/release-ts/github-release.config.json", prepared: undefined },
    { job: "prepare", command: "prepare", config: "apps/release-ts/npm-release.config.json", prepared: undefined },
    { job: "publish-npm", command: "publish", config: undefined, prepared: "${{ inputs.prepared_ref }}" },
    { job: "publish-github", command: "inspect", config: undefined, prepared: "${{ inputs.npm_prepared_ref }}" },
    { job: "publish-github", command: "publish", config: undefined, prepared: "${{ inputs.prepared_ref }}" }
  ])
  for (const action of actions.filter(({ job }) => job === "prepare")) {
    expect(action.env?.GITHUB_TOKEN).toBeUndefined()
  }
  for (const action of actions.filter(({ job }) => job !== "prepare")) {
    expect(action.env?.GITHUB_TOKEN).toBe("${{ github.token }}")
  }
  expect(release.match(/install-self-release-npm\.ts/gu)?.length).toBe(1)
  expect(release.match(/bootstrap-self-release-tools\.sh/gu)?.length).toBe(3)
  expect(release).not.toContain("bun add --global npm@")
  expect(release.match(/node-version: "22\.22\.2"/gu)?.length).toBe(1)
  expect(release.match(/bun-version: 1\.3\.14/gu)?.length).toBe(1)
  expect(release.match(/check-self-release-dispatch\.ts/gu)?.length).toBe(2)
  expect(release.match(/TS_RELEASE_DISPATCH_BIN/gu)?.length).toBe(4)
  expect(release.match(/TS_RELEASE_NPM_VERIFIER_BIN/gu)?.length).toBe(2)
  expectOnlyRedactedReportUploads(release, 2)
  expect(release).toContain("persist-credentials: false")
  expect(release).not.toMatch(/\bNPM_(?:TOKEN|ID_TOKEN)\b/u)
  expect(release).not.toMatch(/\bNODE_AUTH_TOKEN\b/u)

  for (const jobName of ["create-tag", "publish-npm", "publish-github"] as const) {
    const job = parsed.jobs?.[jobName]
    const external = (job?.steps ?? []).filter((step) => typeof step.uses === "string")
    for (const step of external) {
      expect(step.uses).toBe("./apps/ts-release-action")
    }
    expect((job?.steps ?? []).some((step) =>
      typeof step.uses === "string" && /^(?:actions|oven-sh)\//u.test(step.uses)
    )).toBe(false)
  }
  const tagTokenSteps = parsed.jobs?.["create-tag"]?.steps?.filter((step) => step.env?.GITHUB_TOKEN !== undefined) ?? []
  expect(tagTokenSteps).toHaveLength(1)
  expect(tagTokenSteps[0]?.name).toBe("Converge exact lightweight v0.3.0 tag")
  const npmTokenSteps = parsed.jobs?.["publish-npm"]?.steps?.filter((step) => step.env?.GITHUB_TOKEN !== undefined) ?? []
  expect(npmTokenSteps.map((step) => ({ name: step.name, uses: step.uses }))).toEqual([
    { name: undefined, uses: "./apps/ts-release-action" },
    { name: "Verify exact public npm bytes and report-bound provenance", uses: undefined }
  ])
  const githubTokenSteps = parsed.jobs?.["publish-github"]?.steps?.filter((step) => step.env?.GITHUB_TOKEN !== undefined) ?? []
  expect(githubTokenSteps.map((step) => ({ name: step.name, uses: step.uses }))).toEqual([
    { name: undefined, uses: "./apps/ts-release-action" },
    { name: "Verify npm is already public with exact bytes and provenance", uses: undefined },
    { name: undefined, uses: "./apps/ts-release-action" }
  ])
  expect(release).toContain('action-report "$ACTION_REPORT"')
  expect(release).toContain("ACTION_REPORT: ${{ steps.npm-publish.outputs.report-ref }}")
  expectPinnedInfrastructure(release)
})

test("credentialed self-release bootstraps one exact detached candidate before local mutation code", () => {
  const bootstrap = readFileSync("apps/release-ts/scripts/bootstrap-self-release-tools.sh", "utf8")
  for (const required of [
    "/usr/bin/env -i",
    "/usr/bin/git",
    "GIT_CONFIG_GLOBAL=/dev/null",
    "GIT_CONFIG_NOSYSTEM=1",
    "ls-remote --refs origin refs/heads/main",
    "fetch --quiet --no-tags --depth=1 origin refs/heads/main",
    "checkout --quiet --detach FETCH_HEAD",
    "status --porcelain=v1 --untracked-files=all",
    'candidate_tools="$GITHUB_WORKSPACE/apps/release-ts/release-tools"'
  ]) expect(bootstrap).toContain(required)
  expect(bootstrap).not.toContain("raw.githubusercontent.com/mannyc2/ts-release/$candidate_sha/apps/release-ts/release-tools")

  const parsed = parseWorkflow(workflow("release.yml"))
  for (const jobName of ["create-tag", "publish-npm", "publish-github"] as const) {
    const steps = parsed.jobs?.[jobName]?.steps ?? []
    const bootstrapIndex = steps.findIndex((step) => typeof step.run === "string" &&
      step.run.includes("bootstrap-self-release-tools.sh"))
    expect(bootstrapIndex).toBe(0)
    for (const step of steps.slice(bootstrapIndex + 1)) {
      if (typeof step.uses === "string") expect(step.uses).toBe("./apps/ts-release-action")
    }
  }
})

test("every self-release job refuses hostile tool transport before checkout, network, or publication", () => {
  const jobs = parseWorkflow(workflow("release.yml")).jobs ?? {}
  for (const [jobName, job] of Object.entries(jobs)) {
    const first = job.steps?.[0]
    expect(first?.uses, `${jobName} must begin with repository-owned admission`).toBeUndefined()
    expect(first?.run).toBeString()
    const source = first!.run as string
    const guard = source.includes("\nbootstrap=") ? source.slice(0, source.indexOf("\nbootstrap=")) : source
    expect(guard).toContain("git_*")
    expect(guard).toContain("npm_config_*")
    expect(guard).toContain("node_options")
    expect(spawnSync("/bin/bash", ["-c", guard], {
      env: { LANG: "C", PATH: "/usr/bin:/bin" }, encoding: "utf8", stdio: "pipe"
    }).status).toBe(0)
    for (const [name, value] of [
      ["GIT_EXEC_PATH", "/tmp/hostile"],
      ["gIt_DiR", "/tmp/hostile"],
      ["NODE_OPTIONS", "--require=/tmp/hostile"],
      ["Https_Proxy", "http://hostile.invalid"],
      ["BUN_CONFIG_PRELOAD", "/tmp/hostile"]
    ] as const) {
      expect(spawnSync("/bin/bash", ["-c", guard], {
        env: { LANG: "C", PATH: "/usr/bin:/bin", [name]: value },
        encoding: "utf8", stdio: "pipe"
      }).status, `${jobName} admitted ${name}`).not.toBe(0)
    }
  }
})

test("user templates preserve the same handoff, with the environment gate only on publish", () => {
  const automatic = workflowTemplate("release.yml")
  const reviewed = workflowTemplate("reviewed-release.yml")
  for (const value of [automatic, reviewed]) {
    expect(value).toContain("mannyc2/ts-release/apps/ts-release-action@v0.3.0")
    expect(value).not.toContain("__TS_RELEASE_ACTION_REF__")
    expect(value).toContain("persist-credentials: false")
    expect(value).not.toContain("mannyc2/ts-release-action")
    expectBunBeforeEveryActionInvocation(value)
    expectIsolatedCacheBeforePreparingActions(value)
    expectPinnedInfrastructure(value)
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

  const repositoryJobs = parseWorkflow(workflow("release.yml")).jobs ?? {}
  expect(repositoryJobs.prepare?.if).toBe(repositoryPrepareAdmission)
  expect(repositoryJobs["create-tag"]?.if).toBe(repositoryTagAdmission)
  expect(repositoryJobs["publish-npm"]?.if).toBe(repositoryNpmAdmission)
  expect(repositoryJobs["publish-github"]?.if).toBe(repositoryGitHubAdmission)
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
