import { afterAll, describe, expect, test } from "bun:test"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as Sink from "effect/Sink"
import * as Stream from "effect/Stream"
import {
  ChildProcessSpawner,
  ExitCode,
  make as makeChildProcessSpawner,
  makeHandle,
  ProcessId
} from "effect/unstable/process/ChildProcessSpawner"
import {
  AnonymousAuthStrategy,
  CanonicalAudience,
  CredentialRef,
  CredentialRequest,
  ProviderId,
  SubjectId,
  TokenAuthStrategy,
  TrustedPublishingSourceCommit,
  TrustedPublishingAuthStrategy
} from "../../src/model/authority.js"
import { NonEmptyName, Version } from "../../src/model/primitives.js"
import type { HttpRequest, PublicationHttp } from "../../src/publication/http.js"
import type {
  AnonymousAccess,
  PublisherOperation,
  ScopedSecret,
  WorkloadIdentity
} from "../../src/publication/authority.js"
import { MutationPrecondition, NeedsMutation } from "../../src/publication/report.js"
import {
  CanonicalNpmRegistryEndpoint,
  NpmDistTag
} from "../../src/recipes/config.js"
import {
  CredentialPlatformError,
  type EnvironmentCredentialPlatform,
  makeEnvironmentCredentialPlatform
} from "../../src/platform/credentials.js"
import { recordingSpawner } from "./host-doubles.js"

const subject = SubjectId.make("npm:@fixture/pkg@1.0.0")
const provider = ProviderId.make("npm")
const audience = CanonicalAudience.make("https://registry.npmjs.org/")
const registryUrl = CanonicalNpmRegistryEndpoint.make("https://registry.npmjs.org/")
const packageName = NonEmptyName.make("@fixture/pkg")
const packageVersion = Version.make("1.0.0")
const publisherWorkspace = mkdtempSync(join(tmpdir(), "ts-release-publisher-workspace-"))
const tarballBytes = Buffer.from("fixture npm tarball bytes")
const tarballPath = join(publisherWorkspace, "blobs", "a".repeat(64))
mkdirSync(join(publisherWorkspace, "blobs"))
writeFileSync(tarballPath, tarballBytes)
afterAll(() => rmSync(publisherWorkspace, { recursive: true, force: true }))
const publisherFields = {
  cwd: publisherWorkspace,
  tarballPath,
  packageName,
  version: packageVersion,
  registryUrl,
  distTag: NpmDistTag.make("latest"),
  access: "public",
  provenance: "required"
} as const
const ref = CredentialRef.make("FIXTURE_NPM_TOKEN")
const secret = "sentinel-platform-secret-91b4"
const decision = NeedsMutation.make({
  subject,
  precondition: MutationPrecondition.make({ kind: NonEmptyName.make("version-absent") })
})
const operation: PublisherOperation = {
  _tag: "PublishOperation",
  subject,
  provider,
  audience,
  purpose: "publish",
  decision
}

const tokenRequest = (purpose: "observe" | "publish" = "publish") => CredentialRequest.make({
  subject,
  provider,
  audience,
  purpose,
  strategy: TokenAuthStrategy.make({ kind: "token", credential: ref })
})

const trustedRequest = () => CredentialRequest.make({
  subject,
  provider,
  audience,
  purpose: "publish",
  strategy: TrustedPublishingAuthStrategy.make({
    kind: "trusted-publishing",
    identityProvider: "github-actions",
    runnerClass: "github-hosted",
    repository: "owner/repository",
    workflow: ".github/workflows/release.yml",
    workflowRef: "refs/heads/main",
    sourceCommit: TrustedPublishingSourceCommit.make("c".repeat(40)),
    provenanceEnvironmentContract: "github-actions-npm-provenance-v1",
    allowedAction: "npm-publish-direct",
    publisherSink: "certified-npm-cli"
  })
})

const anonymousRequest = (
  requestedSubject: SubjectId = subject,
  requestedAudience: CanonicalAudience = audience
) => CredentialRequest.make({
  subject: requestedSubject,
  provider,
  audience: requestedAudience,
  purpose: "observe",
  strategy: AnonymousAuthStrategy.make({ kind: "anonymous" })
})

const environment = {
  PATH: "/fixture/bin",
  FIXTURE_NPM_TOKEN: secret,
  ACTIONS_ID_TOKEN_REQUEST_URL: "https://oidc.example.test/token",
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: "sentinel-oidc-request-token-73c1",
  GITHUB_ACTIONS: "true",
  GITHUB_REPOSITORY: "owner/repository",
  GITHUB_WORKFLOW_REF: "owner/repository/.github/workflows/release.yml@refs/heads/main",
  GITHUB_SERVER_URL: "https://github.com",
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_REPOSITORY_ID: "123456789",
  GITHUB_REPOSITORY_OWNER_ID: "1234567",
  GITHUB_REF: "refs/heads/main",
  GITHUB_SHA: "c".repeat(40),
  RUNNER_ENVIRONMENT: "github-hosted",
  GITHUB_RUN_ID: "987654321",
  GITHUB_RUN_ATTEMPT: "2",
  AMBIENT_MUST_NOT_LEAK: "ambient-value"
}

const provideEnvironmentValues = <A, E, R>(
  values: Readonly<Record<string, string>>,
  effect: Effect.Effect<A, E, R>
) => effect.pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: values }))))

const provideEnvironment = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  provideEnvironmentValues(environment, effect)

const spawnerService = (
  reply: Parameters<typeof recordingSpawner>[0]
): { readonly service: ChildProcessSpawner["Service"], readonly commands: ReturnType<typeof recordingSpawner>["commands"] } => {
  const recorder = recordingSpawner(reply)
  const service = Effect.runSync(Effect.scoped(Layer.build(recorder.layer).pipe(
    Effect.map((context) => Context.get(context, ChildProcessSpawner))
  )))
  return { service, commands: recorder.commands }
}

const httpRecorder = () => {
  const requests: Array<HttpRequest> = []
  const http: PublicationHttp = {
    request: (request) => Effect.sync(() => {
      requests.push(request)
      return { status: 200, headers: {}, body: "ok" }
    })
  }
  return { requests, http }
}

const platformFixture = (
  temporaryRoot?: string,
  reply: Parameters<typeof recordingSpawner>[0] = () => ({ exitCode: 0 })
): { readonly platform: EnvironmentCredentialPlatform, readonly requests: Array<HttpRequest>, readonly commands: ReturnType<typeof recordingSpawner>["commands"] } => {
  const recordedHttp = httpRecorder()
  const spawned = spawnerService(reply)
  return {
    platform: makeEnvironmentCredentialPlatform(
      recordedHttp.http,
      spawned.service,
      temporaryRoot === undefined ? {} : { temporaryRoot }
    ),
    requests: recordedHttp.requests,
    commands: spawned.commands
  }
}

const acquireToken = (
  platform: EnvironmentCredentialPlatform,
  purpose: "observe" | "publish" = "publish"
): Promise<ScopedSecret> => Effect.runPromise(provideEnvironment(
  purpose === "observe"
    ? platform.credentialProvider.acquireForObservation(tokenRequest(purpose)).pipe(
      Effect.flatMap((grant) => grant._tag === "ScopedSecret"
        ? Effect.succeed(grant)
        : Effect.die("expected scoped secret")))
    : platform.credentialProvider.acquireForMutation(tokenRequest(purpose), decision).pipe(
      Effect.flatMap((grant) => grant._tag === "ScopedSecret"
        ? Effect.succeed(grant)
        : Effect.die("expected scoped secret")))
))

describe("environment credential platform", () => {
  test("acquires only the exact requested host credential and keeps its value private", async () => {
    const { platform } = platformFixture()
    const anonymous = await Effect.runPromise(platform.credentialProvider.acquireForObservation(
      anonymousRequest()
    ))
    expect(anonymous._tag).toBe("AnonymousAccess")

    const grant = await acquireToken(platform)
    expect(grant).toMatchObject({ subject, provider, audience, ref })
    expect(grant.purposes).toEqual(new Set(["observe", "publish"]))
    expect("value" in grant).toBe(false)
    expect(JSON.stringify(grant)).not.toContain(secret)

    const wrongRunner = {
      ...trustedRequest(),
      strategy: { ...trustedRequest().strategy, runnerClass: "self-hosted" }
    } as unknown as CredentialRequest
    await expect(Effect.runPromise(provideEnvironment(
      platform.credentialProvider.acquireForMutation(wrongRunner, decision)
    ))).rejects.toMatchObject({ _tag: "CredentialStrategyUnsupported" })
  })

  test("anonymous observation dispatches without credentials and rejects forged or mismatched grants", async () => {
    const { platform, requests } = platformFixture()
    const grant = await Effect.runPromise(platform.credentialProvider.acquireForObservation(
      anonymousRequest()
    )).then((value) => value._tag === "AnonymousAccess"
      ? value
      : Promise.reject(new Error("expected anonymous access")))
    const request = {
      subject,
      method: "GET" as const,
      url: "https://registry.npmjs.org/@fixture%2fpkg",
      headers: { accept: "application/json" }
    }

    const response = await Effect.runPromise(platform.httpAuthorizer.execute(request, grant))
    expect(response.status).toBe(200)
    expect(requests).toHaveLength(1)
    expect(requests[0]?.headers).toEqual({ accept: "application/json" })
    expect(requests[0]?.headers).not.toHaveProperty("authorization")
    expect(JSON.stringify(requests[0])).not.toContain(secret)

    await expect(Effect.runPromise(platform.httpAuthorizer.execute({
      ...request,
      headers: { Authorization: "caller-controlled" }
    }, grant))).rejects.toBeInstanceOf(CredentialPlatformError)

    await expect(Effect.runPromise(platform.httpAuthorizer.execute({
      ...request,
      url: "https://attacker.example.test/collect"
    }, grant))).rejects.toMatchObject({ _tag: "CredentialAudienceMismatch" })

    const otherSubject = SubjectId.make("npm:@fixture/other@1.0.0")
    const otherGrant = await Effect.runPromise(platform.credentialProvider.acquireForObservation(
      anonymousRequest(otherSubject)
    )).then((value) => value._tag === "AnonymousAccess"
      ? value
      : Promise.reject(new Error("expected anonymous access")))
    await expect(Effect.runPromise(platform.httpAuthorizer.execute(request, otherGrant)))
      .rejects.toMatchObject({ _tag: "CredentialSubjectMismatch" })

    const forged = {
      _tag: "AnonymousAccess",
      subject,
      provider,
      audience,
      purposes: new Set(["observe"])
    } as unknown as AnonymousAccess
    await expect(Effect.runPromise(platform.httpAuthorizer.execute(request, forged)))
      .rejects.toMatchObject({ _tag: "CredentialUnavailable" })
    expect(requests).toHaveLength(1)

    if (false) {
      const workload = undefined as unknown as WorkloadIdentity
      // @ts-expect-error Workload identity cannot enter the observation HTTP sink.
      platform.httpAuthorizer.execute(request, workload)
    }
  })

  test("npm observation is anonymous-only while GitHub bundled token authority stays truthful", async () => {
    const { platform, requests } = platformFixture()
    await expect(acquireToken(platform, "observe")).rejects.toMatchObject({
      _tag: "CredentialStrategyUnsupported"
    })

    const bundledPublish = await acquireToken(platform)
    expect(bundledPublish.purposes).toEqual(new Set(["observe", "publish"]))
    await expect(Effect.runPromise(platform.httpAuthorizer.execute({
      subject,
      method: "GET",
      url: "https://registry.npmjs.org/@fixture%2fpkg"
    }, bundledPublish))).rejects.toMatchObject({ _tag: "CredentialUnavailable" })
    expect(requests).toHaveLength(0)

    const githubSubject = SubjectId.make("github:owner/repository#v1.0.0")
    const githubAudience = CanonicalAudience.make("https://api.github.com/repos/owner/repository")
    const githubRequest = CredentialRequest.make({
      subject: githubSubject,
      provider: ProviderId.make("github"),
      audience: githubAudience,
      purpose: "observe",
      strategy: TokenAuthStrategy.make({ kind: "token", credential: ref })
    })
    const githubGrant = await Effect.runPromise(provideEnvironment(
      platform.credentialProvider.acquireForObservation(githubRequest)
    )).then((value) => value._tag === "ScopedSecret"
      ? value
      : Promise.reject(new Error("expected bundled GitHub token")))
    expect(githubGrant.purposes).toEqual(new Set(["observe", "publish"]))
    await Effect.runPromise(platform.httpAuthorizer.execute({
      subject: githubSubject,
      method: "GET",
      url: "https://api.github.com/repos/owner/repository/releases/tags/v1.0.0"
    }, githubGrant))
    expect(requests).toHaveLength(1)
    expect(requests[0]?.headers?.authorization).toBe(`Bearer ${secret}`)
  })

  test("mutation HTTP rejects caller auth and audience mismatch before transport", async () => {
    const { platform, requests } = platformFixture()
    const grant = await acquireToken(platform)
    await expect(Effect.runPromise(platform.authorizedMutationHttp.execute(operation, {
      method: "POST",
      url: "https://registry.npmjs.org/@fixture/pkg",
      headers: { Authorization: "caller-controlled" }
    }, grant))).rejects.toBeInstanceOf(CredentialPlatformError)
    await expect(Effect.runPromise(platform.authorizedMutationHttp.execute(operation, {
      method: "POST",
      url: "https://attacker.example.test/collect"
    }, grant))).rejects.toMatchObject({ _tag: "CredentialAudienceMismatch" })
    expect(requests).toHaveLength(0)
  })

  test("mutation HTTP admits only an exact same-repository GitHub upload asset URL", async () => {
    const githubSubject = SubjectId.make("github:owner/project#v1.0.0")
    const githubProvider = ProviderId.make("github")
    const githubAudience = CanonicalAudience.make("https://api.github.com/repos/owner/project")
    const githubRef = CredentialRef.make("FIXTURE_NPM_TOKEN")
    const githubDecision = NeedsMutation.make({
      subject: githubSubject,
      precondition: MutationPrecondition.make({ kind: NonEmptyName.make("asset-absent") })
    })
    const githubOperation: PublisherOperation = {
      _tag: "PublishOperation",
      subject: githubSubject,
      provider: githubProvider,
      audience: githubAudience,
      purpose: "publish",
      decision: githubDecision
    }
    const githubRequest = CredentialRequest.make({
      subject: githubSubject,
      provider: githubProvider,
      audience: githubAudience,
      purpose: "publish",
      strategy: TokenAuthStrategy.make({ kind: "token", credential: githubRef })
    })
    const { platform, requests } = platformFixture()
    const grant = await Effect.runPromise(provideEnvironment(
      platform.credentialProvider.acquireForMutation(githubRequest, githubDecision).pipe(
        Effect.flatMap((value) => value._tag === "ScopedSecret"
          ? Effect.succeed(value)
          : Effect.die("expected scoped secret"))
      )
    ))

    await Effect.runPromise(platform.authorizedMutationHttp.execute(githubOperation, {
      method: "POST",
      url: "https://uploads.github.com/repos/owner/project/releases/17/assets?name=artifact.zip"
    }, grant))
    expect(requests).toHaveLength(1)

    const rejected = [
      "https://uploads.github.com/repos/owner/other/releases/17/assets?name=artifact.zip",
      "https://uploads.github.com/repos/owner/project/releases/not-numeric/assets?name=artifact.zip",
      "https://uploads.github.com/repos/owner/project/releases/17/other?name=artifact.zip",
      "https://uploads.github.com/repos/owner/project/releases/17/assets",
      "https://uploads.github.com/repos/owner/project/releases/17/assets?label=artifact",
      "https://uploads.github.com/repos/owner/project/releases/17/assets?name=artifact.zip&name=duplicate.zip",
      "https://uploads.github.com/repos/owner/project/releases/17/assets?name=artifact.zip&unexpected=true",
      "https://user@uploads.github.com/repos/owner/project/releases/17/assets?name=artifact.zip",
      "https://uploads.github.com/repos/owner/project/releases/17/assets?name=artifact.zip#fragment"
    ]
    for (const url of rejected) {
      await expect(Effect.runPromise(platform.authorizedMutationHttp.execute(githubOperation, {
        method: "POST",
        url
      }, grant))).rejects.toMatchObject({ _tag: "CredentialAudienceMismatch" })
    }
    expect(requests).toHaveLength(1)
  })

  test("npm user config is mode-0600, scoped, opaque, and the spawn environment is closed", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-platform-test-"))
    try {
      let transportPath = ""
      let transportMode = 0
      let transportedBytes = Buffer.alloc(0)
      const { platform, commands } = platformFixture(root, (command) => {
        transportPath = command.argv[2] ?? ""
        transportMode = statSync(transportPath).mode & 0o777
        transportedBytes = readFileSync(transportPath)
        return {
          exitCode: 0,
          stdout: `published with ${secret}`,
          stderr: ""
        }
      })
      const grant = await acquireToken(platform)
      let configPath = ""
      const result = await Effect.runPromise(provideEnvironment(Effect.scoped(Effect.gen(function*() {
        const userConfig = yield* platform.npmUserConfigResource.acquire({
          operation: operation as Extract<PublisherOperation, { readonly _tag: "PublishOperation" }>,
          registryUrl: audience
        }, grant)
        expect(Object.keys(userConfig)).toEqual(["_tag"])
        const outcome = yield* platform.certifiedPublisherSpawn.spawn({
          _tag: "NpmPublisherSpec",
          operation: operation as Extract<PublisherOperation, { readonly _tag: "PublishOperation" }>,
          ...publisherFields,
          userConfig
        }, grant)
        configPath = commands[0]?.env?.NPM_CONFIG_USERCONFIG ?? ""
        expect(configPath).not.toBe("")
        expect(statSync(configPath).mode & 0o777).toBe(0o600)
        expect(statSync(join(configPath, "..")).mode & 0o777).toBe(0o700)
        expect(readFileSync(configPath, "utf8")).toContain("ignore-scripts=true")
        return outcome
      }))))

      expect(result).toMatchObject({ _tag: "PublisherExited", commitment: "started", exitCode: 0 })
      expect(result._tag === "PublisherExited" ? result.stdout : "").toContain("[redacted:PUBLISH_CREDENTIAL]")
      expect(JSON.stringify(result)).not.toContain(secret)
      expect(existsSync(configPath)).toBe(false)
      expect(commands[0]?.env).toEqual({
        PATH: "/fixture/bin",
        NPM_CONFIG_USERCONFIG: configPath,
        NPM_CONFIG_IGNORE_SCRIPTS: "true"
      })
      expect(commands[0]?.env).not.toHaveProperty("AMBIENT_MUST_NOT_LEAK")
      expect(transportPath).toEndWith(".tgz")
      expect(transportPath).not.toBe(tarballPath)
      expect(transportMode).toBe(0o600)
      expect(transportedBytes).toEqual(tarballBytes)
      expect(existsSync(transportPath)).toBe(false)
      expect(readdirSync(root)).toEqual([])
      expect(commands[0]?.argv).toEqual([
        "npm", "publish", transportPath,
        "--ignore-scripts",
        "--registry", registryUrl,
        "--tag", "latest",
        "--access", "public",
        "--provenance",
        "--json"
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("npm user config finalizes on typed failure, defect, and interruption", async () => {
    const cases = [Effect.fail("typed"), Effect.die("defect")] as const
    for (const failure of cases) {
      const root = mkdtempSync(join(tmpdir(), "ts-release-platform-cleanup-"))
      try {
        const { platform } = platformFixture(root)
        const grant = await acquireToken(platform)
        const program = provideEnvironment(Effect.scoped(Effect.gen(function*() {
          yield* platform.npmUserConfigResource.acquire({
            operation: operation as Extract<PublisherOperation, { readonly _tag: "PublishOperation" }>,
            registryUrl: audience
          }, grant)
          return yield* failure
        })))
        await Effect.runPromise(Effect.exit(program))
        expect(readdirSync(root)).toEqual([])
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    }

    const root = mkdtempSync(join(tmpdir(), "ts-release-platform-interrupt-"))
    try {
      const { platform } = platformFixture(root)
      const grant = await acquireToken(platform)
      let signal!: () => void
      const acquired = new Promise<void>((resolve) => { signal = resolve })
      const program = provideEnvironment(Effect.scoped(Effect.gen(function*() {
        yield* platform.npmUserConfigResource.acquire({
          operation: operation as Extract<PublisherOperation, { readonly _tag: "PublishOperation" }>,
          registryUrl: audience
        }, grant)
        yield* Effect.sync(signal)
        return yield* Effect.never
      })))
      const fiber = Effect.runFork(program)
      await acquired
      expect(readdirSync(root)).toHaveLength(1)
      await Effect.runPromise(Fiber.interrupt(fiber))
      expect(readdirSync(root)).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("npm tarball transport finalizes when a running publisher is interrupted", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-platform-transport-interrupt-"))
    try {
      let transportPath = ""
      let signal!: () => void
      const started = new Promise<void>((resolve) => { signal = resolve })
      const spawner = makeChildProcessSpawner((command) => {
        if (command._tag !== "StandardCommand") return Effect.die("Piped commands are not used.")
        transportPath = command.args[1] ?? ""
        signal()
        return Effect.succeed(makeHandle({
          pid: ProcessId(1),
          exitCode: Effect.never,
          isRunning: Effect.succeed(true),
          kill: () => Effect.void,
          stdin: Sink.drain,
          stdout: Stream.never,
          stderr: Stream.never,
          all: Stream.never,
          getInputFd: () => Sink.drain,
          getOutputFd: () => Stream.never,
          unref: Effect.succeed(Effect.void)
        }))
      })
      const platform = makeEnvironmentCredentialPlatform(httpRecorder().http, spawner, { temporaryRoot: root })
      const grant = await Effect.runPromise(provideEnvironment(
        platform.credentialProvider.acquireForMutation(trustedRequest(), decision).pipe(
          Effect.flatMap((value) => value._tag === "WorkloadIdentity"
            ? Effect.succeed(value as WorkloadIdentity)
            : Effect.die("expected workload identity")))
      ))
      const fiber = Effect.runFork(provideEnvironment(platform.certifiedPublisherSpawn.spawn({
        _tag: "WorkloadPublisherSpec",
        operation,
        ...publisherFields
      }, grant)))
      await started
      expect(transportPath).toEndWith(".tgz")
      expect(existsSync(transportPath)).toBe(true)
      expect(readFileSync(transportPath)).toEqual(tarballBytes)
      await Effect.runPromise(Fiber.interrupt(fiber))
      expect(existsSync(transportPath)).toBe(false)
      expect(readdirSync(root)).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("trusted acquisition rejects every foreign host identity before reading OIDC material", async () => {
    const { platform, commands } = platformFixture()
    const { ACTIONS_ID_TOKEN_REQUEST_URL: _oidcUrl, ACTIONS_ID_TOKEN_REQUEST_TOKEN: _oidcToken,
      AMBIENT_MUST_NOT_LEAK: _ambient, ...hostOnly } = environment
    const baseRequest = trustedRequest()
    const requestWith = (overrides: Readonly<Record<string, unknown>>) => ({
      ...baseRequest,
      strategy: { ...baseRequest.strategy, ...overrides }
    }) as unknown as CredentialRequest
    const without = (name: string): Readonly<Record<string, string>> => Object.fromEntries(
      Object.entries(hostOnly).filter(([observed]) => observed !== name)
    )
    const requiredHostFacts = [
      "GITHUB_ACTIONS",
      "GITHUB_REPOSITORY",
      "GITHUB_WORKFLOW_REF",
      "GITHUB_SERVER_URL",
      "GITHUB_EVENT_NAME",
      "GITHUB_REPOSITORY_ID",
      "GITHUB_REPOSITORY_OWNER_ID",
      "GITHUB_REF",
      "GITHUB_SHA",
      "RUNNER_ENVIRONMENT",
      "GITHUB_RUN_ID",
      "GITHUB_RUN_ATTEMPT"
    ] as const
    const cases: ReadonlyArray<readonly [Readonly<Record<string, string>>, CredentialRequest]> = [
      ...requiredHostFacts.map((name) => [without(name), baseRequest] as const),
      [{ ...hostOnly, GITHUB_ACTIONS: "false" }, baseRequest],
      [{ ...hostOnly, GITHUB_REPOSITORY: "other/repository" }, baseRequest],
      [{ ...hostOnly,
        GITHUB_WORKFLOW_REF: "owner/repository/.github/workflows/other.yml@refs/heads/main" }, baseRequest],
      [{ ...hostOnly,
        GITHUB_WORKFLOW_REF: "owner/repository/.github/workflows/release.yml@refs/heads/other" }, baseRequest],
      [{ ...hostOnly, GITHUB_SERVER_URL: "https://github.enterprise.test" }, baseRequest],
      [{ ...hostOnly, GITHUB_EVENT_NAME: "workflow dispatch" }, baseRequest],
      [{ ...hostOnly, GITHUB_REPOSITORY_ID: "0123456789" }, baseRequest],
      [{ ...hostOnly, GITHUB_REPOSITORY_OWNER_ID: "owner-id" }, baseRequest],
      [{ ...hostOnly, GITHUB_REF: "refs/pull/1/merge" }, baseRequest],
      [{ ...hostOnly, GITHUB_SHA: "d".repeat(40) }, baseRequest],
      [{ ...hostOnly, RUNNER_ENVIRONMENT: "self-hosted" }, baseRequest],
      [{ ...hostOnly, GITHUB_RUN_ID: "0" }, baseRequest],
      [{ ...hostOnly, GITHUB_RUN_ATTEMPT: "02" }, baseRequest],
      [hostOnly, requestWith({ sourceCommit: "d".repeat(40) })],
      [hostOnly, requestWith({ provenanceEnvironmentContract: "generic-environment-v1" })],
      [hostOnly, requestWith({ allowedAction: "npm-stage-publish" })],
      [hostOnly, requestWith({ publisherSink: "generic-command" })]
    ]
    for (const [values, request] of cases) {
      await expect(Effect.runPromise(provideEnvironmentValues(
        values,
        platform.credentialProvider.acquireForMutation(request, decision)
      ))).rejects.toMatchObject({ _tag: "CredentialStrategyUnsupported" })
    }
    await expect(Effect.runPromise(provideEnvironmentValues(
      hostOnly,
      platform.credentialProvider.acquireForMutation(baseRequest, decision)
    ))).rejects.toMatchObject({ _tag: "CredentialUnavailable" })
    expect(commands).toHaveLength(0)
  })

  test("trusted publishing passes only certified OIDC and provenance facts in a closed environment", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-platform-workload-"))
    try {
      let transportPath = ""
      const { platform, commands } = platformFixture(root, (command) => {
        transportPath = command.argv[2] ?? ""
        expect(readFileSync(transportPath)).toEqual(tarballBytes)
        return {
          exitCode: 0,
          stdout: environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN
        }
      })
      const grant = await Effect.runPromise(provideEnvironment(
        platform.credentialProvider.acquireForMutation(trustedRequest(), decision).pipe(
          Effect.flatMap((value) => value._tag === "WorkloadIdentity"
            ? Effect.succeed(value as WorkloadIdentity)
            : Effect.die("expected workload identity")))
      ))
      const result = await Effect.runPromise(provideEnvironment(platform.certifiedPublisherSpawn.spawn({
        _tag: "WorkloadPublisherSpec",
        operation,
        ...publisherFields
      }, grant)))
      expect(commands[0]?.env).toEqual({
        PATH: "/fixture/bin",
        ACTIONS_ID_TOKEN_REQUEST_URL: environment.ACTIONS_ID_TOKEN_REQUEST_URL,
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
        GITHUB_ACTIONS: "true",
        GITHUB_REPOSITORY: environment.GITHUB_REPOSITORY,
        GITHUB_WORKFLOW_REF: environment.GITHUB_WORKFLOW_REF,
        GITHUB_SERVER_URL: environment.GITHUB_SERVER_URL,
        GITHUB_EVENT_NAME: environment.GITHUB_EVENT_NAME,
        GITHUB_REPOSITORY_ID: environment.GITHUB_REPOSITORY_ID,
        GITHUB_REPOSITORY_OWNER_ID: environment.GITHUB_REPOSITORY_OWNER_ID,
        GITHUB_REF: environment.GITHUB_REF,
        GITHUB_SHA: environment.GITHUB_SHA,
        RUNNER_ENVIRONMENT: environment.RUNNER_ENVIRONMENT,
        GITHUB_RUN_ID: environment.GITHUB_RUN_ID,
        GITHUB_RUN_ATTEMPT: environment.GITHUB_RUN_ATTEMPT,
        NPM_CONFIG_IGNORE_SCRIPTS: "true"
      })
      expect(result._tag === "PublisherExited" ? result.stdout : "")
        .toContain("[redacted:ACTIONS_ID_TOKEN_REQUEST_TOKEN]")
      expect(JSON.stringify(result)).not.toContain(environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN)
      expect(transportPath).toEndWith(".tgz")
      expect(commands[0]?.argv).toEqual([
        "npm", "publish", transportPath,
        "--ignore-scripts",
        "--registry", registryUrl,
        "--tag", "latest",
        "--access", "public",
        "--provenance",
        "--json"
      ])
      expect(existsSync(transportPath)).toBe(false)
      expect(readdirSync(root)).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("typed publisher specs reject argv and flag-value injection before either credential mode dispatches", async () => {
    const { platform, commands } = platformFixture()
    const workloadGrant = await Effect.runPromise(provideEnvironment(
      platform.credentialProvider.acquireForMutation(trustedRequest(), decision).pipe(
        Effect.flatMap((value) => value._tag === "WorkloadIdentity"
          ? Effect.succeed(value as WorkloadIdentity)
          : Effect.die("expected workload identity")))
    ))
    const tokenGrant = await acquireToken(platform)
    const hostileOverrides: ReadonlyArray<Readonly<Record<string, unknown>>> = [
      { argv: ["npm", "publish", tarballPath, "--registry", "https://evil.example/", "--tag", "evil"] },
      { registryUrl: "https://registry.npmjs.org/ --registry=https://evil.example/" },
      { registryUrl: "https://registry.example.test/" },
      { distTag: "latest --tag=evil" },
      { access: "public --access=restricted" },
      { provenance: "required --provenance=false" },
      { packageName: "@fixture/other" },
      { version: "2.0.0" },
      { cwd: "workspace" },
      { tarballPath: "/workspace/blobs/../hostile.tgz" }
    ]
    for (const override of hostileOverrides) {
      const spec = {
        _tag: "WorkloadPublisherSpec",
        operation,
        ...publisherFields,
        ...override
      } as unknown as Parameters<typeof platform.certifiedPublisherSpawn.spawn>[0]
      await expect(Effect.runPromise(provideEnvironment(
        platform.certifiedPublisherSpawn.spawn(spec, workloadGrant)
      ))).rejects.toMatchObject({ _tag: "CredentialStrategyUnsupported" })
    }
    let registryGetterReads = 0
    const accessorSpec = { _tag: "WorkloadPublisherSpec", operation, ...publisherFields }
    Object.defineProperty(accessorSpec, "registryUrl", {
      enumerable: true,
      get: () => {
        registryGetterReads += 1
        return registryGetterReads === 1 ? registryUrl : "https://evil.example/"
      }
    })
    await expect(Effect.runPromise(provideEnvironment(platform.certifiedPublisherSpawn.spawn(
      accessorSpec as unknown as Parameters<typeof platform.certifiedPublisherSpawn.spawn>[0],
      workloadGrant
    )))).rejects.toMatchObject({ _tag: "CredentialStrategyUnsupported" })
    expect(registryGetterReads).toBe(0)
    await Effect.runPromise(provideEnvironment(Effect.scoped(Effect.gen(function*() {
      const userConfig = yield* platform.npmUserConfigResource.acquire({
        operation: operation as Extract<PublisherOperation, { readonly _tag: "PublishOperation" }>,
        registryUrl: audience
      }, tokenGrant)
      for (const override of hostileOverrides) {
        const hostileTokenSpec = {
          _tag: "NpmPublisherSpec",
          operation,
          ...publisherFields,
          userConfig,
          ...override
        } as unknown as Parameters<typeof platform.certifiedPublisherSpawn.spawn>[0]
        yield* platform.certifiedPublisherSpawn.spawn(hostileTokenSpec, tokenGrant).pipe(
          Effect.flip,
          Effect.tap((error) => Effect.sync(() => expect(error).toMatchObject({
            _tag: "CredentialStrategyUnsupported"
          })))
        )
      }
    }))))
    expect(commands).toHaveLength(0)
  })

  test("trusted npm preflight requires Node 22.14 and npm 11.5.1 before publish dispatch", async () => {
    for (const fixture of [
      { node: "v22.13.9", npm: "11.5.1", accepted: false },
      { node: "v22.14.0", npm: "11.5.0", accepted: false },
      { node: "v22.14.0", npm: "11.5.1", accepted: true },
      { node: "v24.0.0", npm: "12.0.0", accepted: true }
    ] as const) {
      const { platform, commands } = platformFixture(undefined, (command) => ({
        exitCode: 0,
        stdout: command.argv[0] === "node" ? fixture.node : fixture.npm
      }))
      const grant = await Effect.runPromise(provideEnvironment(
        platform.credentialProvider.acquireForMutation(trustedRequest(), decision).pipe(
          Effect.flatMap((value) => value._tag === "WorkloadIdentity"
            ? Effect.succeed(value as WorkloadIdentity)
            : Effect.die("expected workload identity")))
      ))
      const preflight = provideEnvironment(platform.certifiedPublisherSpawn.preflightTrustedNpm(
        operation as Extract<PublisherOperation, { readonly _tag: "PublishOperation" }>,
        grant
      ))
      if (fixture.accepted) {
        await Effect.runPromise(preflight)
      } else {
        await expect(Effect.runPromise(preflight)).rejects.toMatchObject({
          _tag: "CredentialPlatformError",
          commitment: "before-dispatch"
        })
      }
      expect(commands.map((command) => command.argv)).toEqual([
        ["node", "--version"],
        ["npm", "--version"]
      ])
      for (const command of commands) {
        expect(command.env).toEqual({ PATH: "/fixture/bin" })
        expect(command.env).not.toHaveProperty("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
        expect(command.argv).not.toContain("publish")
      }
    }
  })
})
