import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import {
  AnonymousAuthStrategy,
  CanonicalAudience,
  CredentialRef,
  CredentialRequest,
  ProviderId,
  SubjectId,
  TokenAuthStrategy,
  TrustedPublishingAuthStrategy
} from "../../src/model/authority.js"
import { NonEmptyName } from "../../src/model/primitives.js"
import type { HttpRequest, PublicationHttp } from "../../src/publication/http.js"
import type {
  AnonymousAccess,
  PublisherOperation,
  ScopedSecret,
  WorkloadIdentity
} from "../../src/publication/authority.js"
import { MutationPrecondition, NeedsMutation } from "../../src/publication/report.js"
import {
  CredentialPlatformError,
  type EnvironmentCredentialPlatform,
  makeEnvironmentCredentialPlatform
} from "../../src/platform/credentials.js"
import { recordingSpawner } from "./host-doubles.js"

const subject = SubjectId.make("npm:@fixture/pkg@1.0.0")
const provider = ProviderId.make("npm")
const audience = CanonicalAudience.make("https://registry.npmjs.org/")
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

const trustedRequest = (runnerClass = "github-hosted") => CredentialRequest.make({
  subject,
  provider,
  audience,
  purpose: "publish",
  strategy: TrustedPublishingAuthStrategy.make({
    kind: "trusted-publishing",
    identityProvider: ProviderId.make("github-actions"),
    runnerClass,
    workflow: ".github/workflows/release.yml"
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
  AMBIENT_MUST_NOT_LEAK: "ambient-value"
}

const provideEnvironment = <A, E, R>(effect: Effect.Effect<A, E, R>) => effect.pipe(
  Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: environment })))
)

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
    expect("value" in grant).toBe(false)
    expect(JSON.stringify(grant)).not.toContain(secret)

    await expect(Effect.runPromise(provideEnvironment(
      platform.credentialProvider.acquireForMutation(trustedRequest("self-hosted"), decision)
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

  test("observation authorization validates audience and sends without returning credentials", async () => {
    const { platform, requests } = platformFixture()
    const grant = await acquireToken(platform, "observe")
    const response = await Effect.runPromise(platform.httpAuthorizer.execute({
      subject,
      method: "GET",
      url: "https://registry.npmjs.org/@fixture%2fpkg"
    }, grant))
    expect(response.status).toBe(200)
    expect(requests).toHaveLength(1)
    expect(requests[0]?.headers?.authorization).toBe(`Bearer ${secret}`)
    expect(JSON.stringify(response)).not.toContain(secret)

    await expect(Effect.runPromise(platform.httpAuthorizer.execute({
      subject,
      method: "GET",
      url: "https://registry.example.test/@fixture%2fpkg"
    }, grant))).rejects.toMatchObject({ _tag: "CredentialAudienceMismatch" })
    expect(requests).toHaveLength(1)

    const publishOnly = await acquireToken(platform)
    await expect(Effect.runPromise(platform.httpAuthorizer.execute({
      subject,
      method: "GET",
      url: "https://registry.npmjs.org/@fixture%2fpkg"
    }, publishOnly))).rejects.toMatchObject({ _tag: "CredentialPurposeMismatch" })
    expect(requests).toHaveLength(1)
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

  test("npm user config is mode-0600, scoped, opaque, and the spawn environment is closed", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-platform-test-"))
    try {
      const { platform, commands } = platformFixture(root, () => ({
        exitCode: 0,
        stdout: `published with ${secret}`,
        stderr: ""
      }))
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
          argv: ["npm", "publish", "fixture.tgz"],
          cwd: "/workspace",
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

  test("trusted publishing passes only certified OIDC names in a closed environment", async () => {
    const { platform, commands } = platformFixture(undefined, () => ({
      exitCode: 0,
      stdout: environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN
    }))
    const grant = await Effect.runPromise(provideEnvironment(
      platform.credentialProvider.acquireForMutation(trustedRequest(), decision).pipe(
        Effect.flatMap((value) => value._tag === "WorkloadIdentity"
          ? Effect.succeed(value as WorkloadIdentity)
          : Effect.die("expected workload identity")))
    ))
    const result = await Effect.runPromise(provideEnvironment(platform.certifiedPublisherSpawn.spawn({
      _tag: "WorkloadPublisherSpec",
      operation,
      argv: ["npm", "publish", "fixture.tgz"],
      cwd: "/workspace"
    }, grant)))
    expect(commands[0]?.env).toEqual({
      PATH: "/fixture/bin",
      ACTIONS_ID_TOKEN_REQUEST_URL: environment.ACTIONS_ID_TOKEN_REQUEST_URL,
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
      NPM_CONFIG_IGNORE_SCRIPTS: "true"
    })
    expect(result._tag === "PublisherExited" ? result.stdout : "").toContain("[redacted:ACTIONS_ID_TOKEN_REQUEST_TOKEN]")
    expect(JSON.stringify(result)).not.toContain(environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN)
  })
})
