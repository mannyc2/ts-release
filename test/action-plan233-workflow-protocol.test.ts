import { describe, expect, test } from "bun:test"
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs"
import { dirname, join } from "node:path"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  makePreparedReferenceChannel,
  runAction,
  type ActionOutput,
  type ActionRuntime
} from "../apps/ts-release-action/src/commands.js"
import {
  makeActionPreparedReleaseStore,
  type ActionArtifactTransport,
  type ActionProducerContext,
  type ActionRunAttemptAuthenticator
} from "../apps/ts-release-action/src/prepared-store.js"
import { makeReleaseApi } from "../src/api/api.js"
import { ReleaseRuntime, type ReleaseRuntimeShape } from "../src/api/runtime.js"
import type { ReleaseApiLayer } from "../src/api/types.js"
import type { RunCommand } from "../src/drivers/process.js"
import { decodeConfig } from "../src/config/config.js"
import type { CredentialRequest } from "../src/model/authority.js"
import {
  CredentialProvider,
  type CredentialGrant,
  type MutationCredentialGrant,
  type CredentialProviderShape
} from "../src/publication/authority.js"
import {
  AuthorizedMutationHttp,
  HttpAuthorizer,
  type AuthorizedMutationHttpShape,
  type HttpAuthorizerShape
} from "../src/publication/http.js"
import {
  CertifiedPublisherSpawn,
  NpmUserConfigResource,
  npmPublishArgv,
  type CertifiedPublisherSpawnShape,
  type NpmUserConfigResourceShape
} from "../src/publication/publisher.js"
import type {
  PreparedGitHubPublication,
  PreparedNpmPublication
} from "../src/release/prepared.js"
import {
  decodeCompletePreparedReleaseRef,
  encodeCompletePreparedReleaseRef
} from "../src/release/prepared-ref.js"
import {
  PreparedReleaseStore,
  type PreparedBundle,
  type PreparedReleaseStoreShape
} from "../src/release/prepared-store.js"
import {
  encodeProtocolJsonLines
} from "./protocol/events.js"
import {
  GithubProtocolScenarioSchemaVersion,
  makeGithubProtocolDouble,
  type GithubProtocolDouble
} from "./protocol/github/double.js"
import { makeNpmProviderScenario } from "./protocol/npm/scenario.js"
import { contextFor, materializeFixtureWorkspace } from "./core/runtime-fixture.js"
import { makeEnvironmentCredentialProvider } from "../src/platform/credentials.js"

const candidateCommit = "c".repeat(40)
const reportRelativePath = ".release/ts-release/action-report.json"

const sentinels = Object.freeze({
  github: "ghp_plan233_private_provider_sentinel_0123456789",
  oidcUrl: "https://oidc.example.test/private-plan233-sentinel",
  oidcToken: "plan233_oidc_private_sentinel_0123456789"
})

const configForWorkflow = (workflow: "release.yml" | "reviewed-release.yml") => ({
  project: {
    name: "fixture",
    packageName: "fixture",
    repository: "owner/project",
    version: "1.0.0",
    tag: "v1.0.0"
  },
  npmPackage: { path: "." },
  artifacts: [{ id: "release-asset", path: "release-asset.txt", format: "file" }],
  publish: {
    npm: {
      registry: "https://registry.npmjs.org/",
      authentication: {
        strategy: "trusted-publishing",
        attestation: {
          provider: "github-actions",
          runner: "github-hosted",
          repository: "owner/project",
          workflow,
          workflowRef: "refs/heads/main",
          allowedAction: "npm-publish-direct"
        }
      },
      access: "public",
      provenance: "automatic"
    },
    github: {
      repository: "owner/project",
      tokenEnv: "PLAN233_GITHUB_TOKEN",
      draft: false,
      prerelease: false,
      ids: ["release-asset"]
    }
  }
} as const)

interface WorkflowStep {
  readonly id?: string
  readonly name?: string
  readonly uses?: string
  readonly if?: string
  readonly env?: Readonly<Record<string, string>>
  readonly with?: Readonly<Record<string, string>>
}

interface WorkflowJob {
  readonly if?: string
  readonly permissions?: Readonly<Record<string, string>>
  readonly steps?: ReadonlyArray<WorkflowStep>
}

interface WorkflowDocument {
  readonly on?: Readonly<Record<string, {
    readonly inputs?: Readonly<Record<string, {
      readonly required?: boolean
      readonly default?: unknown
      readonly type?: string
    }>>
  } | null>>
  readonly jobs?: Readonly<Record<string, WorkflowJob>>
}

interface ParsedActionStep {
  readonly job: string
  readonly id: string
  readonly command: "release" | "prepare" | "publish"
  readonly config?: string
  readonly prepared?: string
  readonly rawCommand: string
  readonly rawConfig?: string
  readonly rawPrepared?: string
  readonly reportUploadPath: string
}

const automaticCommand = "${{ inputs.prepared_ref == '' && 'release' || 'publish' }}"
const automaticConfig = "${{ inputs.prepared_ref == '' && 'release.config.json' || '' }}"
const automaticPrepared = "${{ inputs.prepared_ref }}"
const templateAdmission = "${{ github.ref == 'refs/heads/main' && github.sha == inputs.candidate_sha }}"

const parseWorkflow = (name: string): {
  readonly source: string
  readonly actions: ReadonlyArray<ParsedActionStep>
} => {
  const source = readFileSync(join("templates", "github-actions", name), "utf8")
  const parsed = Bun.YAML.parse(source) as WorkflowDocument
  const actions: Array<ParsedActionStep> = []
  for (const [jobName, job] of Object.entries(parsed.jobs ?? {})) {
    const steps = job.steps ?? []
    for (const [index, step] of steps.entries()) {
      if (typeof step.uses !== "string" || !step.uses.includes("ts-release-action")) continue
      const rawCommand = step.with?.command
      if (typeof rawCommand !== "string") {
        throw new Error(`${name}:${jobName} carries no Action command.`)
      }
      const command = rawCommand === automaticCommand ? "release" : rawCommand
      if (command !== "release" && command !== "prepare" && command !== "publish") {
        throw new Error(`${name}:${jobName} carries an invalid Action command.`)
      }
      if (step.id === undefined) throw new Error(`${name}:${jobName}:${command} has no step id.`)
      const upload = steps.slice(index + 1).find((candidate) =>
        candidate.uses === "actions/upload-artifact@v4" &&
        candidate.with?.path === `\${{ steps.${step.id}.outputs.report-ref }}`
      )
      if (upload?.with?.path === undefined || upload.if?.includes("always()") !== true) {
        throw new Error(`${name}:${jobName}:${command} has no always-on redacted report upload.`)
      }
      actions.push({
        job: jobName,
        id: step.id,
        command,
        rawCommand,
        ...(step.with?.config === undefined ? {} : {
          config: rawCommand === automaticCommand ? "release.config.json" : step.with.config,
          rawConfig: step.with.config
        }),
        ...(step.with?.prepared === undefined ? {} : {
          ...(rawCommand === automaticCommand ? {} : { prepared: step.with.prepared }),
          rawPrepared: step.with.prepared
        }),
        reportUploadPath: upload.with.path
      })
    }
  }
  return { source, actions }
}

const artifactTransport = (
  root: string,
  events: Array<string>
): ActionArtifactTransport => ({
  upload: async ({ name, rootDirectory }) => {
    events.push(`artifact:upload:${name}`)
    mkdirSync(root, { recursive: true })
    cpSync(rootDirectory, join(root, name), { recursive: true })
    return { id: 233, digest: "e".repeat(64) }
  },
  download: async ({ name, destination, findBy }) => {
    events.push(`artifact:download:${name}:${findBy?.workflowRunId ?? "current"}`)
    cpSync(join(root, name), destination, { recursive: true })
    return { path: destination, digestMismatch: false }
  }
})

interface ActionExecution {
  readonly outputs: Record<string, string>
  readonly summaries: Array<string>
  readonly runtime: ActionRuntime
}

const actionRuntime = (
  workspace: string,
  inputs: Readonly<Record<string, string>>,
  events: Array<string>
): ActionExecution => {
  const outputs: Record<string, string> = {}
  const summaries: Array<string> = []
  const output = (name: ActionOutput, value: string): void => {
    outputs[name] = value
    events.push(`action:output:${name}`)
  }
  const summarize = async (message: string): Promise<void> => {
    summaries.push(message)
    events.push("action:summary")
  }
  const preparedReference = makePreparedReferenceChannel({ output, summarize })
  return {
    outputs,
    summaries,
    runtime: {
      workspace,
      input: (name) => inputs[name] ?? "",
      output,
      read: (path) => readFileSync(path, "utf8"),
      write: (path, value) => {
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, value)
      },
      preparedReference,
      summarize
    }
  }
}

type NpmScenario = ReturnType<typeof makeNpmProviderScenario>

interface ProtocolHarness {
  readonly credentials: CredentialProvider["Service"]
  readonly http: HttpAuthorizerShape
  readonly mutationHttp: AuthorizedMutationHttpShape
  readonly userConfigs: NpmUserConfigResourceShape
  readonly publisher: CertifiedPublisherSpawnShape
  readonly consumedSecrets: ReadonlyArray<string>
  readonly events: Array<string>
  readonly install: (bundle: PreparedBundle) => void
  readonly transcripts: () => { readonly github: string, readonly npm: string }
}

const makeProtocolHarness = (
  workflow: "release.yml" | "reviewed-release.yml",
  runAttempt = "1"
): ProtocolHarness => {
  let github: GithubProtocolDouble | undefined
  let npm: NpmScenario | undefined
  const consumedSecrets: Array<string> = []
  const events: Array<string> = []
  const required = () => {
    if (github === undefined || npm === undefined) {
      throw new Error("Provider protocol doubles were not installed from the durable prepared bundle.")
    }
    return { github, npm }
  }
  const platformCredentials = makeEnvironmentCredentialProvider()
  const hostEnvironment = ConfigProvider.layer(ConfigProvider.fromEnv({ env: {
    PLAN233_GITHUB_TOKEN: sentinels.github,
    GITHUB_ACTIONS: "true",
    GITHUB_REPOSITORY: "owner/project",
    GITHUB_WORKFLOW_REF: `owner/project/.github/workflows/${workflow}@refs/heads/main`,
    GITHUB_SERVER_URL: "https://github.com",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REPOSITORY_ID: "123456789",
    GITHUB_REPOSITORY_OWNER_ID: "1234567",
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: candidateCommit,
    RUNNER_ENVIRONMENT: "github-hosted",
    GITHUB_RUN_ID: "23301",
    GITHUB_RUN_ATTEMPT: runAttempt,
    ACTIONS_ID_TOKEN_REQUEST_URL: sentinels.oidcUrl,
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: sentinels.oidcToken
  } }))
  const recordGrant = (request: CredentialRequest, grant: CredentialGrant): void => {
    if (grant._tag === "ScopedSecret") consumedSecrets.push(sentinels.github)
    if (grant._tag === "WorkloadIdentity") consumedSecrets.push(sentinels.oidcUrl, sentinels.oidcToken)
    events.push(`credential:${request.provider}:${request.purpose}:${grant._tag}`)
  }
  const credentials: CredentialProviderShape = {
    acquireForObservation: (request) => platformCredentials.acquireForObservation(request).pipe(
      Effect.tap((grant: CredentialGrant) => Effect.sync(() => recordGrant(request, grant))),
      Effect.provide(hostEnvironment)
    ),
    acquireForMutation: (request, decision) => platformCredentials.acquireForMutation(request, decision).pipe(
      Effect.tap((grant: MutationCredentialGrant) => Effect.sync(() => recordGrant(request, grant))),
      Effect.provide(hostEnvironment)
    )
  }
  const http: HttpAuthorizerShape = {
    execute: (request, grant) => {
      const installed = required()
      return request.url.startsWith("https://registry.npmjs.org/")
        ? installed.npm.http.execute(request, grant)
        : installed.github.http.execute(request, grant)
    }
  }
  const mutationHttp: AuthorizedMutationHttpShape = {
    execute: (operation, request, grant) => Effect.sync(() => {
      events.push(`provider:github:mutate:${request.url}`)
      return required().github.mutationHttp.execute(operation, request, grant)
    }).pipe(Effect.flatten)
  }
  const userConfigs: NpmUserConfigResourceShape = {
    acquire: (input, grant) => required().npm.userConfigs.acquire(input, grant)
  }
  const publisher: CertifiedPublisherSpawnShape = {
    preflightTrustedNpm: (operation, grant) => required().npm.publisher.preflightTrustedNpm(operation, grant),
    spawn: (spec, grant) => Effect.sync(() => {
      events.push(`provider:npm:mutate:${npmPublishArgv(spec).join(" ")}`)
      return required().npm.publisher.spawn(spec, grant)
    }).pipe(Effect.flatten)
  }

  return {
    credentials,
    http,
    mutationHttp,
    userConfigs,
    publisher,
    consumedSecrets,
    events,
    install: (bundle) => {
      if (github !== undefined || npm !== undefined) {
        throw new Error("Provider protocol doubles may be installed only once per prepared release.")
      }
      const npmPublication = bundle.manifest.publications.find((publication): publication is PreparedNpmPublication =>
        publication._tag === "PreparedNpmPublication")
      const githubPublication = bundle.manifest.publications.find((publication): publication is PreparedGitHubPublication =>
        publication._tag === "PreparedGitHubPublication")
      if (npmPublication === undefined || githubPublication === undefined) {
        throw new Error("Prepared workflow fixture must contain npm and GitHub publications.")
      }
      const npmBytes = bundle.blobs.get(npmPublication.artifactId.toString())
      if (npmBytes === undefined) throw new Error("Prepared workflow fixture omitted npm tarball bytes.")
      npm = makeNpmProviderScenario({
        packageName: npmPublication.packageName.toString(),
        version: npmPublication.version.toString(),
        distTag: npmPublication.distTag.toString(),
        bytes: npmBytes,
        initial: {
          packageVisibility: "visible",
          versionState: "absent",
          distTagState: "missing"
        },
        publishResult: "exit-0"
      })
      github = makeGithubProtocolDouble({
        schemaVersion: GithubProtocolScenarioSchemaVersion,
        repository: githubPublication.repository,
        tag: githubPublication.tag.toString(),
        targetCommit: githubPublication.targetCommit.toString()
      })
      events.push("provider:installed-from-prepared")
    },
    transcripts: () => {
      const installed = required()
      return {
        github: encodeProtocolJsonLines(installed.github.events),
        npm: encodeProtocolJsonLines(installed.npm.events)
      }
    }
  }
}

const preparationRuntime = (counts: { preparations: number }): ReleaseRuntimeShape => ({
  source: {
    observe: (workspace) => Effect.succeed(contextFor(workspace.toString(), candidateCommit)),
    materialize: materializeFixtureWorkspace
  },
  run: (({ argv, cwd }) => Effect.sync(() => {
    if (argv[0] === "test") return { exitCode: 0, stdout: "", stderr: "" }
    const tool = {
      protocol: "ts-release-executable/v1" as const,
      command: "npm",
      sha256: "233".padEnd(64, "0")
    }
    if (argv[0] === "npm" && argv[1] === "--version") {
      return { exitCode: 0, stdout: "10.9.4\n", stderr: "", tool }
    }
    if (argv[0] !== "npm" || argv[1] !== "pack") {
      throw new Error(`Unexpected workflow preparation command: ${argv.join(" ")}`)
    }
    counts.preparations += 1
    const destinationIndex = argv.indexOf("--pack-destination")
    if (destinationIndex < 0 || argv[destinationIndex + 1] === undefined) {
      throw new Error("npm pack fixture omitted its private destination.")
    }
    const destination = join(cwd, argv[destinationIndex + 1]!)
    mkdirSync(destination, { recursive: true })
    writeFileSync(join(destination, "fixture-1.0.0.tgz"), "deterministic plan233 package bytes\n")
    const files = ["index.js", "package.json"].map((path) => ({
      path,
      size: statSync(join(cwd, path)).size,
      mode: 0o644
    }))
    return { exitCode: 0, stdout: JSON.stringify([{ files }]), stderr: "", tool }
  })) satisfies RunCommand
})

const actionLayer = (
  store: PreparedReleaseStoreShape,
  runtime: ReleaseRuntimeShape,
  protocol: ProtocolHarness
): ReleaseApiLayer => Layer.mergeAll(
  Layer.succeed(ReleaseRuntime, runtime),
  Layer.succeed(PreparedReleaseStore, store),
  Layer.succeed(CredentialProvider, protocol.credentials),
  Layer.succeed(HttpAuthorizer, protocol.http),
  Layer.succeed(AuthorizedMutationHttp, protocol.mutationHttp),
  Layer.succeed(NpmUserConfigResource, protocol.userConfigs),
  Layer.succeed(CertifiedPublisherSpawn, protocol.publisher)
)

const preparedStore = (input: {
  readonly workspace: string
  readonly context: ActionProducerContext
  readonly transport: ActionArtifactTransport
  readonly protocol: ProtocolHarness
  readonly preparedReference: ReturnType<typeof makePreparedReferenceChannel>
}): PreparedReleaseStoreShape => {
  const actionStore = makeActionPreparedReleaseStore({
    workspace: input.workspace,
    context: input.context,
    artifacts: input.transport,
    onCommit: (reference) => input.preparedReference.emit(encodeCompletePreparedReleaseRef(reference))
  })
  return {
    commit: (manifest, blobs) => actionStore.commit(manifest, blobs).pipe(
      Effect.tap((committed) => Effect.sync(() => input.protocol.install(committed.bundle)))
    ),
    load: actionStore.load
  }
}

const initializeWorkspace = (
  workspace: string,
  workflow: "release.yml" | "reviewed-release.yml",
  configPath: string
): void => {
  mkdirSync(workspace, { recursive: true })
  writeFileSync(join(workspace, "package.json"), `${JSON.stringify({
    name: "fixture",
    version: "1.0.0",
    files: ["index.js"]
  })}\n`)
  writeFileSync(join(workspace, "index.js"), "export const fixture = true\n")
  writeFileSync(join(workspace, "release-asset.txt"), "exact plan233 GitHub asset bytes\n")
  writeFileSync(join(workspace, configPath), `${JSON.stringify(configForWorkflow(workflow))}\n`)
}

const readReport = (workspace: string): Readonly<Record<string, unknown>> => JSON.parse(
  readFileSync(join(workspace, reportRelativePath), "utf8")
) as Readonly<Record<string, unknown>>

const runWithDiagnostics = async (
  api: Parameters<typeof runAction>[0],
  runtime: ActionRuntime,
  events: ReadonlyArray<string>
): Promise<void> => {
  try {
    await runAction(api, runtime)
  } catch (cause) {
    const path = join(runtime.workspace, reportRelativePath)
    const report = existsSync(path) ? readFileSync(path, "utf8") : "<no Action report>"
    throw new Error([
      cause instanceof Error ? cause.message : String(cause),
      report,
      JSON.stringify(events)
    ].join("\n"))
  }
}

const assertNoLeak = (value: unknown): void => {
  const encoded = typeof value === "string" ? value : JSON.stringify(value)
  for (const secret of Object.values(sentinels)) expect(encoded).not.toContain(secret)
}

describe("Plan 233 advertised workflow protocol", () => {
  test("template YAML defines the exact Action handoffs and installs Bun before every invocation", () => {
    const automatic = parseWorkflow("release.yml")
    const reviewed = parseWorkflow("reviewed-release.yml")
    const parsedAutomatic = Bun.YAML.parse(automatic.source) as WorkflowDocument
    const parsedReviewed = Bun.YAML.parse(reviewed.source) as WorkflowDocument
    expect(parsedAutomatic.on?.workflow_dispatch?.inputs?.prepared_ref).toMatchObject({
      required: false,
      default: "",
      type: "string"
    })
    expect(parsedAutomatic.jobs?.release?.permissions?.actions).toBe("read")
    expect(parsedAutomatic.jobs?.release?.steps?.find((step) =>
      step.uses?.includes("ts-release-action"))?.env?.GITHUB_TOKEN).toBe("${{ github.token }}")
    expect(parsedReviewed.on?.workflow_dispatch?.inputs?.prepared_ref).toBeUndefined()
    expect(parsedReviewed.jobs?.publish?.permissions?.actions).toBeUndefined()
    expect(automatic.actions.map(({ job, command }) => ({ job, command }))).toEqual([
      { job: "release", command: "release" }
    ])
    expect(reviewed.actions.map(({ job, command }) => ({ job, command }))).toEqual([
      { job: "prepare", command: "prepare" },
      { job: "publish", command: "publish" }
    ])
    expect(automatic.actions[0]?.config).toBe("release.config.json")
    expect(automatic.actions[0]).toMatchObject({
      rawCommand: automaticCommand,
      rawConfig: automaticConfig,
      rawPrepared: automaticPrepared
    })
    expect(reviewed.actions[0]?.config).toBe("reviewed-release.config.json")
    expect(reviewed.actions[1]?.config).toBeUndefined()
    expect(reviewed.actions[1]?.prepared).toBe("${{ needs.prepare.outputs.prepared-ref }}")
    for (const workflow of [automatic, reviewed]) {
      const parsed = Bun.YAML.parse(workflow.source) as WorkflowDocument
      for (const job of Object.values(parsed.jobs ?? {})) {
        const steps = job.steps ?? []
        for (const [index, step] of steps.entries()) {
          if (typeof step.uses !== "string" || !step.uses.includes("ts-release-action")) continue
          expect(steps.slice(0, index).some((candidate) => candidate.uses === "oven-sh/setup-bun@v2")).toBe(true)
        }
      }
    }
  })

  test("candidate mismatch leaves every advertised Action step unreachable", () => {
    const candidate = "c".repeat(40)
    const reachableActions = (
      name: "release.yml" | "reviewed-release.yml",
      context: { readonly ref: string, readonly sha: string, readonly candidateSha: string }
    ): ReadonlyArray<string> => {
      const workflow = parseWorkflow(name)
      const parsed = Bun.YAML.parse(workflow.source) as WorkflowDocument
      return Object.entries(parsed.jobs ?? {}).flatMap(([jobName, job]) => {
        if (job.if !== templateAdmission) throw new Error(`${name}:${jobName} lacks the canonical candidate admission.`)
        const admitted = context.ref === "refs/heads/main" && context.sha === context.candidateSha
        return admitted
          ? (job.steps ?? []).flatMap((step) =>
            typeof step.uses === "string" && step.uses.includes("ts-release-action") ? [jobName] : [])
          : []
      })
    }

    for (const name of ["release.yml", "reviewed-release.yml"] as const) {
      const parsed = Bun.YAML.parse(parseWorkflow(name).source) as WorkflowDocument
      expect(Object.keys(parsed.on ?? {})).toEqual(["workflow_dispatch"])
      expect(parsed.on?.workflow_dispatch?.inputs?.candidate_sha).toMatchObject({ required: true, type: "string" })
      expect(reachableActions(name, {
        ref: "refs/heads/evidence",
        sha: candidate,
        candidateSha: candidate
      })).toEqual([])
      expect(reachableActions(name, {
        ref: "refs/heads/main",
        sha: candidate,
        candidateSha: "d".repeat(40)
      })).toEqual([])
    }
  })

  test("automatic fresh/recovery dispatches and reviewed same-run rerun traverse real boundaries", async () => {
    await Effect.runPromise(decodeConfig(configForWorkflow("release.yml")))
    await Effect.runPromise(decodeConfig(configForWorkflow("reviewed-release.yml")))
    const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-action-plan233-"))
    const executions: Array<{
      readonly name: string
      readonly outputs: Record<string, string>
      readonly summaries: Array<string>
      readonly reports: ReadonlyArray<Readonly<Record<string, unknown>>>
      readonly events: ReadonlyArray<string>
      readonly transcripts: { readonly github: string, readonly npm: string }
      readonly consumedSecrets: ReadonlyArray<string>
    }> = []
    try {
      for (const mode of ["automatic", "reviewed"] as const) {
        const workflow = mode === "automatic" ? "release.yml" : "reviewed-release.yml"
        const advertised = parseWorkflow(workflow)
        const configPath = advertised.actions.find(({ command }) =>
          command === (mode === "automatic" ? "release" : "prepare"))?.config
        if (configPath === undefined) throw new Error(`${workflow} has no advertised config input.`)
        const modeRoot = join(root, mode)
        const artifactRoot = join(modeRoot, "artifacts")
        const events: Array<string> = []
        const protocol = makeProtocolHarness(workflow, mode === "reviewed" ? "2" : "1")
        const counts = { preparations: 0 }
        const runtime = preparationRuntime(counts)
        const runId = mode === "automatic" ? "23301" : "23302"
        const producer: ActionProducerContext = {
          repository: "owner/project",
          workflowRef: `owner/project/.github/workflows/${workflow}@refs/heads/main`,
          workflowSha: mode === "automatic" ? candidateCommit : "d".repeat(40),
          runId,
          runAttempt: "1",
          candidateCommit
        }
        const transport = artifactTransport(artifactRoot, events)
        const apis: Array<ReturnType<typeof makeReleaseApi>> = []
        try {
          if (mode === "automatic") {
            const workspace = join(modeRoot, "release")
            initializeWorkspace(workspace, workflow, configPath)
            const action = actionRuntime(workspace, {
              command: "release",
              config: configPath
            }, events)
            const store = preparedStore({
              workspace,
              context: producer,
              transport,
              protocol,
              preparedReference: action.runtime.preparedReference
            })
            const api = makeReleaseApi(actionLayer(store, runtime, protocol))
            apis.push(api)
            await runWithDiagnostics(api, action.runtime, events)
            expect(action.outputs["report-ref"]).toBe(reportRelativePath)
            expect(action.outputs["prepared-ref"]).toMatch(/^prepared:gha:/u)
            const report = readReport(workspace)
            expect(report).toMatchObject({ command: "release", status: "complete" })
            const prepared = action.outputs["prepared-ref"]!
            const preparationsAfterRelease = counts.preparations
            const mutationsAfterRelease = protocol.events.filter((event) => event.includes(":mutate:")).length

            const recoveryWorkspace = join(modeRoot, "recovery")
            initializeWorkspace(recoveryWorkspace, workflow, configPath)
            const recoveryAction = actionRuntime(recoveryWorkspace, {
              command: "publish",
              prepared
            }, events)
            const recoveryContext: ActionProducerContext = {
              ...producer,
              runId: "23303",
              runAttempt: "1"
            }
            const runAttempts: ActionRunAttemptAuthenticator = {
              authenticate: async ({ reference, current, token }) => {
                events.push(`artifact:authenticate:${reference.runId}:${reference.attempt}`)
                expect(current).toEqual(recoveryContext)
                expect(token).toBe(sentinels.github)
                return {
                  repository: producer.repository,
                  workflowPath: producer.workflowRef,
                  runId: reference.runId.toString(),
                  runAttempt: reference.attempt.toString(),
                  headSha: candidateCommit
                }
              }
            }
            const recoveryStore = makeActionPreparedReleaseStore({
              workspace: recoveryWorkspace,
              context: recoveryContext,
              artifacts: transport,
              token: sentinels.github,
              runAttempts
            })
            const recoveryApi = makeReleaseApi(actionLayer(recoveryStore, runtime, protocol))
            apis.push(recoveryApi)
            await runWithDiagnostics(recoveryApi, recoveryAction.runtime, events)
            expect(recoveryAction.outputs).toMatchObject({
              "prepared-ref": prepared,
              "report-ref": reportRelativePath
            })
            expect(readReport(recoveryWorkspace)).toMatchObject({
              command: "publish",
              status: "complete",
              prepared
            })
            expect(counts.preparations).toBe(preparationsAfterRelease)
            expect(protocol.events.filter((event) => event.includes(":mutate:")).length).toBe(mutationsAfterRelease)
            expect(events).toContain("artifact:authenticate:23301:1")
            expect(events.some((event) => event.endsWith(":23301") && event.startsWith("artifact:download:"))).toBe(true)
            executions.push({
              name: mode,
              outputs: { ...action.outputs, ...recoveryAction.outputs },
              summaries: [...action.summaries, ...recoveryAction.summaries],
              reports: [report, readReport(recoveryWorkspace)],
              events: [...events, ...protocol.events],
              transcripts: protocol.transcripts(),
              consumedSecrets: protocol.consumedSecrets
            })
          } else {
            const prepareWorkspace = join(modeRoot, "prepare")
            const publishWorkspace = join(modeRoot, "publish")
            initializeWorkspace(prepareWorkspace, workflow, configPath)
            initializeWorkspace(publishWorkspace, workflow, configPath)
            const prepareAction = actionRuntime(prepareWorkspace, {
              command: "prepare",
              config: configPath
            }, events)
            const prepareStore = preparedStore({
              workspace: prepareWorkspace,
              context: producer,
              transport,
              protocol,
              preparedReference: prepareAction.runtime.preparedReference
            })
            const prepareApi = makeReleaseApi(actionLayer(prepareStore, runtime, protocol))
            apis.push(prepareApi)
            await runWithDiagnostics(prepareApi, prepareAction.runtime, events)
            const prepared = prepareAction.outputs["prepared-ref"]!
            expect(prepareAction.outputs["report-ref"]).toBe(reportRelativePath)
            expect(readReport(prepareWorkspace)).toMatchObject({ command: "prepare", status: "complete" })
            const reference = await Effect.runPromise(decodeCompletePreparedReleaseRef(prepared))
            expect(reference).toMatchObject({ scheme: "gha", runId, attempt: "1" })
            const preparationsAfterPrepare = counts.preparations

            const publishAction = actionRuntime(publishWorkspace, {
              command: "publish",
              prepared
            }, events)
            const publishStore = makeActionPreparedReleaseStore({
              workspace: publishWorkspace,
              context: { ...producer, runAttempt: "2" },
              artifacts: transport
            })
            const publishApi = makeReleaseApi(actionLayer(publishStore, runtime, protocol))
            apis.push(publishApi)
            await runWithDiagnostics(publishApi, publishAction.runtime, events)
            expect(publishAction.outputs).toMatchObject({
              "prepared-ref": prepared,
              "report-ref": reportRelativePath
            })
            expect(counts.preparations).toBe(preparationsAfterPrepare)
            expect(events.filter((event) => event.startsWith("artifact:upload:"))).toHaveLength(1)
            expect(events.filter((event) => event.startsWith("artifact:download:"))).toHaveLength(2)
            const prepareReport = readReport(prepareWorkspace)
            const publishReport = readReport(publishWorkspace)
            expect(publishReport).toMatchObject({ command: "publish", status: "complete", prepared })
            executions.push({
              name: mode,
              outputs: { ...prepareAction.outputs, ...publishAction.outputs },
              summaries: [...prepareAction.summaries, ...publishAction.summaries],
              reports: [prepareReport, publishReport],
              events: [...events, ...protocol.events],
              transcripts: protocol.transcripts(),
              consumedSecrets: protocol.consumedSecrets
            })
          }

          expect(counts.preparations).toBe(1)
          const mutationProviders = protocol.events
            .filter((event) => event.startsWith("provider:") && event.includes(":mutate:"))
            .map((event) => event.split(":")[1])
          expect(mutationProviders[0]).toBe("github")
          expect(mutationProviders.at(-1)).toBe("npm")
          expect(mutationProviders.indexOf("npm")).toBeGreaterThan(mutationProviders.lastIndexOf("github"))
          expect(protocol.consumedSecrets).toContain(sentinels.github)
          expect(protocol.consumedSecrets).toContain(sentinels.oidcToken)
        } finally {
          await Promise.all(apis.map((api) => api.dispose()))
        }
      }

      expect(executions.map((execution) => execution.name)).toEqual(["automatic", "reviewed"])
      for (const execution of executions) {
        expect(execution.reports.every((report) => report.status === "complete")).toBe(true)
        assertNoLeak({
          outputs: execution.outputs,
          summaries: execution.summaries,
          reports: execution.reports,
          events: execution.events,
          transcripts: execution.transcripts
        })
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 30_000)
})
