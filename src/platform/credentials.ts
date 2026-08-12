import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import * as ChildProcess from "effect/unstable/process/ChildProcess"
import type { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import {
  EnvironmentName,
  type CanonicalAudience,
  type CredentialRef,
  type CredentialRequest,
  type SubjectId
} from "../model/authority.js"
import { redactOutput } from "../drivers/redact.js"
import {
  CredentialAudienceMismatch,
  CredentialProvider,
  CredentialPurposeMismatch,
  CredentialStrategyUnsupported,
  CredentialSubjectMismatch,
  CredentialUnavailable,
  type AnonymousAccess,
  type CredentialGrantAcquirer,
  type CredentialProviderShape,
  type ScopedSecret,
  type WorkloadIdentity,
  makeCredentialProvider,
  validateGrantForOperation
} from "../publication/authority.js"
import {
  AuthorizedMutationHttp,
  HttpAuthorizer,
  type AuthorizedMutationHttpShape,
  type HttpAuthorizerShape,
  type HttpObservationRequest,
  type HttpResponse,
  type MutationHttpRequest,
  type PublicationHttp
} from "../publication/http.js"
import {
  CertifiedPublisherSpawn,
  NpmUserConfigResource,
  PublisherExited,
  PublisherOutcomeUnknown,
  RejectedBeforeStart,
  makeNpmUserConfigHandle,
  type CertifiedPublisherResult,
  type CertifiedPublisherSpawnShape,
  type CertifiedPublisherSpec,
  type NpmPublishOperation,
  type NpmPublisherSpec,
  type NpmUserConfig,
  type NpmUserConfigInput,
  type NpmUserConfigResourceShape,
  type WorkloadPublisherSpec
} from "../publication/publisher.js"

export {
  AuthorizedMutationHttp,
  CertifiedPublisherSpawn,
  HttpAuthorizer,
  NpmUserConfigResource,
  PublisherExited,
  PublisherOutcomeUnknown,
  RejectedBeforeStart
}
export type {
  AuthorizedMutationHttpShape,
  CertifiedPublisherResult,
  CertifiedPublisherSpawnShape,
  CertifiedPublisherSpec,
  HttpAuthorizerShape,
  HttpObservationRequest,
  MutationHttpRequest,
  NpmPublishOperation,
  NpmPublisherSpec,
  NpmUserConfig,
  NpmUserConfigInput,
  NpmUserConfigResourceShape,
  WorkloadPublisherSpec
}

export class CredentialPlatformError
  extends Schema.TaggedErrorClass<CredentialPlatformError>()("CredentialPlatformError", {
    phase: Schema.Literals(["observe", "mutate", "resource", "spawn"]),
    commitment: Schema.Literals(["before-dispatch", "unknown"]),
    reason: Schema.NonEmptyString
  }) {}

export type CredentialPlatformServices =
  | CredentialProvider
  | HttpAuthorizer
  | AuthorizedMutationHttp
  | NpmUserConfigResource
  | CertifiedPublisherSpawn

// These are deliberately the only literal spellings in production code. The
// import-rules AST gate keeps OIDC request material in this host module.
const oidcRequestUrlName = EnvironmentName.make("ACTIONS_ID_TOKEN_REQUEST_URL")
const oidcRequestTokenName = EnvironmentName.make("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
const oidcNames = [oidcRequestUrlName, oidcRequestTokenName] as const

const portableEnvironmentName = /^[A-Za-z_][A-Za-z0-9_]*$/u
const certifiedWorkflow = /^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/u

type SecretVault = Map<string, Redacted.Redacted<string>>

type ObservationGrant = AnonymousAccess | ScopedSecret

type ObservationGrantMetadata =
  | {
    readonly _tag: "AnonymousAccess"
    readonly subject: SubjectId
    readonly audience: CanonicalAudience
    readonly purposes: ReadonlySet<"observe" | "publish" | "correct">
  }
  | {
    readonly _tag: "ScopedSecret"
    readonly subject: SubjectId
    readonly audience: CanonicalAudience
    readonly purposes: ReadonlySet<"observe" | "publish" | "correct">
    readonly ref: CredentialRef
  }

type ObservationGrantRegistry = WeakMap<ObservationGrant, ObservationGrantMetadata>

const rememberObservationGrant = (
  observationGrants: ObservationGrantRegistry,
  grant: ObservationGrant
): void => {
  observationGrants.set(grant, grant._tag === "AnonymousAccess"
    ? {
      _tag: grant._tag,
      subject: grant.subject,
      audience: grant.audience,
      purposes: new Set(grant.purposes)
    }
    : {
      _tag: grant._tag,
      subject: grant.subject,
      audience: grant.audience,
      purposes: new Set(grant.purposes),
      ref: grant.ref
    })
}

const vaultKey = (subject: SubjectId, name: string): string => `${subject}\u0000${name}`

const platformError = (
  phase: CredentialPlatformError["phase"],
  commitment: CredentialPlatformError["commitment"],
  reason: string
): CredentialPlatformError => new CredentialPlatformError({ phase, commitment, reason })

const unavailable = (request: CredentialRequest, reason: string): CredentialUnavailable =>
  new CredentialUnavailable({
    subject: request.subject,
    provider: request.provider,
    purpose: request.purpose,
    reason
  })

const unsupported = (request: CredentialRequest, reason: string): CredentialStrategyUnsupported =>
  new CredentialStrategyUnsupported({
    subject: request.subject,
    provider: request.provider,
    strategy: request.strategy.kind,
    reason
  })

const readSecret = (
  request: CredentialRequest,
  name: string
): Effect.Effect<Redacted.Redacted<string>, CredentialUnavailable> =>
  Config.redacted(name).pipe(
    Effect.mapError(() => unavailable(request, `Credential reference ${name} is unavailable.`))
  )

/**
 * A raw environment token has no host-verifiable downscope metadata. Treat it
 * conservatively as bundled provider authority instead of relabeling the same
 * bearer as a purpose-specific secret merely because one method requested it.
 */
const environmentTokenPurposes = (
  purpose: CredentialRequest["purpose"]
): readonly ["observe", "publish", ...Array<"correct">] => purpose === "correct"
  ? ["observe", "publish", "correct"]
  : ["observe", "publish"]

const makeEnvironmentAcquirer = (vault: SecretVault): CredentialGrantAcquirer => ({
  acquire: Effect.fn("EnvironmentCredentialProvider.acquire")(function*(request) {
    switch (request.strategy.kind) {
      case "anonymous":
        return { _tag: "AnonymousAccess", purposes: ["observe"] } as const
      case "token": {
        const name = request.strategy.credential.toString()
        if (!portableEnvironmentName.test(name)) {
          return yield* unsupported(request, "Token credential references must be portable environment names.")
        }
        const value = yield* readSecret(request, name)
        vault.set(vaultKey(request.subject, name), value)
        return {
          _tag: "ScopedSecret",
          purposes: environmentTokenPurposes(request.purpose),
          ref: request.strategy.credential
        } as const
      }
      case "trusted-publishing": {
        if (request.strategy.identityProvider !== "github-actions" ||
          request.strategy.runnerClass !== "github-hosted" ||
          !certifiedWorkflow.test(request.strategy.workflow)) {
          return yield* unsupported(
            request,
            "Trusted publishing requires a certified GitHub Actions identity on a GitHub-hosted runner."
          )
        }
        for (const name of oidcNames) {
          const value = yield* readSecret(request, name)
          vault.set(vaultKey(request.subject, name), value)
        }
        return {
          _tag: "WorkloadIdentity",
          purposes: [request.purpose],
          names: oidcNames
        } as const
      }
    }
  })
})

const makeProvider = (
  vault: SecretVault,
  observationGrants: ObservationGrantRegistry
): CredentialProviderShape => {
  const provider = makeCredentialProvider(makeEnvironmentAcquirer(vault))
  return {
    acquireForObservation: Effect.fn("EnvironmentCredentialProvider.acquireForObservation")(function*(request) {
      const grant = yield* provider.acquireForObservation(request)
      if (grant._tag !== "WorkloadIdentity") {
        rememberObservationGrant(observationGrants, grant)
      }
      return grant
    }),
    acquireForMutation: Effect.fn("EnvironmentCredentialProvider.acquireForMutation")(function*(request, decision) {
      const grant = yield* provider.acquireForMutation(request, decision)
      if (grant._tag === "ScopedSecret") {
        rememberObservationGrant(observationGrants, grant)
      }
      return grant
    })
  }
}

/** Environment-backed provider projection for hosts that need no sinks. */
export const makeEnvironmentCredentialProvider = (): CredentialProviderShape =>
  makeProvider(new Map(), new WeakMap())

const hasAuthorizationHeader = (headers: Readonly<Record<string, string>> | undefined): boolean =>
  headers !== undefined && Object.keys(headers).some((name) => name.toLowerCase() === "authorization")

const audienceAllows = (audience: CanonicalAudience, requested: string): boolean => {
  try {
    const expected = new URL(audience)
    const observed = new URL(requested)
    if (expected.protocol !== "https:" || observed.protocol !== "https:") return false
    if (expected.username !== "" || expected.password !== "" || expected.search !== "" || expected.hash !== "") return false
    if (expected.origin !== observed.origin) return false
    const base = expected.pathname.endsWith("/") ? expected.pathname : `${expected.pathname}/`
    return observed.pathname === expected.pathname || observed.pathname.startsWith(base)
  } catch {
    return false
  }
}

const githubUploadAudienceAllows = (audience: CanonicalAudience, requested: string): boolean => {
  try {
    const expected = new URL(audience)
    const observed = new URL(requested)
    if (expected.protocol !== "https:" || expected.hostname !== "api.github.com" ||
      expected.port !== "" || expected.username !== "" || expected.password !== "" ||
      expected.search !== "" || expected.hash !== "") return false
    if (observed.protocol !== "https:" || observed.hostname !== "uploads.github.com" ||
      observed.port !== "" || observed.username !== "" || observed.password !== "" ||
      observed.hash !== "") return false
    const repository = /^\/repos\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/u.exec(expected.pathname)?.[0]
    if (repository === undefined ||
      !new RegExp(`^${repository.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\/releases\/[1-9][0-9]*\/assets$`, "u")
        .test(observed.pathname)) return false
    const keys = [...observed.searchParams.keys()]
    return /^\?name=[^&]+(?:&label=[^&]*)?$/u.test(observed.search) &&
      new Set(keys).size === keys.length && observed.searchParams.get("name")!.length > 0
  } catch {
    return false
  }
}

const checkAudience = (
  subject: SubjectId,
  audience: CanonicalAudience,
  requested: string,
  allowGithubUpload = false
): Effect.Effect<void, CredentialAudienceMismatch> => audienceAllows(audience, requested) ||
  (allowGithubUpload && githubUploadAudienceAllows(audience, requested))
  ? Effect.void
  : Effect.fail(new CredentialAudienceMismatch({
    subject,
    expected: audience,
    observed: requested
  }))

const lookupToken = (
  vault: SecretVault,
  subject: SubjectId,
  ref: CredentialRef
): Effect.Effect<Redacted.Redacted<string>, CredentialUnavailable> => {
  const value = vault.get(vaultKey(subject, ref))
  return value === undefined
    ? Effect.fail(new CredentialUnavailable({
      subject,
      provider: "unknown",
      purpose: "unknown",
      reason: "The credential grant has no host-owned secret in this platform boundary."
    }))
    : Effect.succeed(value)
}

const validateObservationGrant = Effect.fn("HttpAuthorizer.validateGrant")(function*(
  input: HttpObservationRequest,
  grant: ObservationGrant,
  observationGrants: ObservationGrantRegistry
) {
  const issued = observationGrants.get(grant)
  if (issued === undefined) {
    return yield* new CredentialUnavailable({
      subject: input.subject,
      provider: "unknown",
      purpose: "observe",
      reason: "The supplied observation grant was not issued by this platform boundary."
    })
  }
  if (issued.subject !== input.subject) {
    return yield* new CredentialSubjectMismatch({
      expected: input.subject,
      observed: issued.subject
    })
  }
  if (!issued.purposes.has("observe")) {
    return yield* new CredentialPurposeMismatch({
      subject: input.subject,
      required: "observe",
      granted: [...issued.purposes]
    })
  }
  yield* checkAudience(input.subject, issued.audience, input.url)
  return issued
})

const sendAnonymous = (
  http: PublicationHttp,
  request: HttpObservationRequest
): Effect.Effect<HttpResponse, CredentialPlatformError> => {
  if (hasAuthorizationHeader(request.headers)) {
    return Effect.fail(platformError("observe", "before-dispatch", "Callers may not supply an Authorization header."))
  }
  return http.request({
    method: request.method,
    url: request.url,
    ...(request.headers === undefined ? {} : { headers: request.headers }),
    ...(request.body === undefined ? {} : { body: request.body })
  }).pipe(
    Effect.mapError(() => platformError("observe", "unknown", "Observation HTTP transport failed after dispatch."))
  )
}

const sendAuthorized = (
  http: PublicationHttp,
  request: HttpObservationRequest | MutationHttpRequest,
  token: Redacted.Redacted<string>,
  phase: "observe" | "mutate"
): Effect.Effect<HttpResponse, CredentialPlatformError> => {
  if (hasAuthorizationHeader(request.headers)) {
    return Effect.fail(platformError(phase, "before-dispatch", "Callers may not supply an Authorization header."))
  }
  const headers = {
    ...(request.headers ?? {}),
    authorization: `Bearer ${Redacted.value(token)}`
  }
  return http.request({
    method: request.method,
    url: request.url,
    headers,
    ...(request.body === undefined ? {} : { body: request.body })
  }).pipe(
    Effect.mapError(() => platformError(phase, "unknown", "Authorized HTTP transport failed after dispatch."))
  )
}

const makeHttpAuthorizer = (
  http: PublicationHttp,
  vault: SecretVault,
  observationGrants: ObservationGrantRegistry
): HttpAuthorizerShape => ({
  execute: Effect.fn("HttpAuthorizer.execute")(function*(input, grant) {
    const issued = yield* validateObservationGrant(input, grant, observationGrants)
    if (issued._tag === "AnonymousAccess") {
      return yield* sendAnonymous(http, input)
    }
    const token = yield* lookupToken(vault, issued.subject, issued.ref)
    return yield* sendAuthorized(http, input, token, "observe")
  })
})

const makeAuthorizedMutationHttp = (
  http: PublicationHttp,
  vault: SecretVault
): AuthorizedMutationHttpShape => ({
  execute: Effect.fn("AuthorizedMutationHttp.execute")(function*(operation, request, grant) {
    yield* validateGrantForOperation(operation, grant)
    yield* checkAudience(operation.subject, operation.audience, request.url, operation.provider === "github")
    const token = yield* lookupToken(vault, grant.subject, grant.ref)
    return yield* sendAuthorized(http, request, token, "mutate")
  })
})

type NpmUserConfigMetadata = {
  readonly directory: string
  readonly path: string
  readonly subject: SubjectId
  readonly grant: ScopedSecret
  readonly token: Redacted.Redacted<string>
}

const npmUserConfigs = new WeakMap<NpmUserConfig, NpmUserConfigMetadata>()

const npmAuthLine = (registryUrl: string, token: Redacted.Redacted<string>): string => {
  const registry = new URL(registryUrl)
  const pathname = registry.pathname.endsWith("/") ? registry.pathname : `${registry.pathname}/`
  return `//${registry.host}${pathname}:_authToken=${Redacted.value(token)}`
}

const makeNpmUserConfigResource = (
  vault: SecretVault,
  temporaryRoot?: string
): NpmUserConfigResourceShape => ({
  acquire: Effect.fn("NpmUserConfigResource.acquire")(function*(input, grant) {
    yield* validateGrantForOperation(input.operation, grant)
    if (input.operation.provider !== "npm") {
      return yield* platformError("resource", "before-dispatch", "npm user config accepts only the npm provider.")
    }
    yield* checkAudience(input.operation.subject, input.operation.audience, input.registryUrl)
    const token = yield* lookupToken(vault, grant.subject, grant.ref)
    const root = temporaryRoot ?? tmpdir()
    const handle = makeNpmUserConfigHandle()
    const acquired = Effect.tryPromise({
      try: async () => {
        await mkdir(root, { recursive: true, mode: 0o700 })
        const directory = await mkdtemp(join(root, "ts-release-npm-"))
        try {
          const path = join(directory, "userconfig")
          const contents = `${npmAuthLine(input.registryUrl, token)}\nignore-scripts=true\n`
          await writeFile(path, contents, { mode: 0o600, flag: "wx" })
          npmUserConfigs.set(handle, { directory, path, subject: input.operation.subject, grant, token })
          return handle
        } catch (cause) {
          await rm(directory, { recursive: true, force: true })
          throw cause
        }
      },
      catch: () => platformError("resource", "before-dispatch", "Unable to create the scoped npm user config.")
    })
    return yield* Effect.acquireRelease(acquired, (resource) => {
      const metadata = npmUserConfigs.get(resource)
      npmUserConfigs.delete(resource)
      return metadata === undefined
        ? Effect.void
        : Effect.tryPromise({
          try: () => rm(metadata.directory, { recursive: true, force: true }),
          catch: () => undefined
        }).pipe(Effect.catch(() => Effect.void))
    })
  })
})

const collect = (stream: Stream.Stream<Uint8Array, unknown>): Effect.Effect<string, unknown> =>
  Stream.mkString(Stream.decodeText(stream))

const minimumTrustedNode = [22, 14, 0] as const
const minimumTrustedNpm = [11, 5, 1] as const

const parseVersion = (value: string): readonly [number, number, number] | undefined => {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?\s*$/u.exec(value)
  if (match === null) return undefined
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

const versionAtLeast = (
  value: readonly [number, number, number],
  minimum: readonly [number, number, number]
): boolean => value[0] > minimum[0] ||
  (value[0] === minimum[0] && (value[1] > minimum[1] ||
    (value[1] === minimum[1] && value[2] >= minimum[2])))

const optionalPath = Config.option(Config.string("PATH")).pipe(
  Effect.map(Option.getOrUndefined),
  Effect.orElseSucceed(() => undefined)
)

const closedBaseEnvironment = (path: string | undefined): Record<string, string> =>
  path === undefined ? {} : { PATH: path }

const workloadEnvironment = Effect.fn("CertifiedPublisherSpawn.workloadEnvironment")(function*(
  vault: SecretVault,
  grant: WorkloadIdentity
) {
  if (grant.names.size !== oidcNames.length || oidcNames.some((name) => !grant.names.has(name))) {
    return yield* new CredentialStrategyUnsupported({
      subject: grant.subject,
      provider: grant.provider,
      strategy: "trusted-publishing",
      reason: "Workload identity lacks the exact certified GitHub Actions OIDC names."
    })
  }
  const path = yield* optionalPath
  const env = closedBaseEnvironment(path)
  for (const name of oidcNames) {
    const value = vault.get(vaultKey(grant.subject, name))
    if (value === undefined) {
      return yield* new CredentialUnavailable({
        subject: grant.subject,
        provider: grant.provider,
        purpose: "publish",
        reason: "Certified workload identity material is unavailable in this platform boundary."
      })
    }
    env[name] = Redacted.value(value)
  }
  env.NPM_CONFIG_IGNORE_SCRIPTS = "true"
  return env
})

const publisherEnvironment = Effect.fn("CertifiedPublisherSpawn.environment")(function*(
  vault: SecretVault,
  spec: CertifiedPublisherSpec,
  grant: ScopedSecret | WorkloadIdentity
) {
  if (spec._tag === "NpmPublisherSpec") {
    if (grant._tag !== "ScopedSecret") {
      return yield* new CredentialStrategyUnsupported({
        subject: spec.operation.subject,
        provider: spec.operation.provider,
        strategy: "trusted-publishing",
        reason: "A scoped npm user config requires a scoped-secret grant."
      })
    }
    const metadata = npmUserConfigs.get(spec.userConfig)
    if (metadata === undefined || metadata.subject !== spec.operation.subject || metadata.grant !== grant) {
      return yield* new CredentialUnavailable({
        subject: spec.operation.subject,
        provider: spec.operation.provider,
        purpose: spec.operation.purpose,
        reason: "The npm user config is not active for this exact operation and grant."
      })
    }
    const path = yield* optionalPath
    return {
      ...closedBaseEnvironment(path),
      NPM_CONFIG_USERCONFIG: metadata.path,
      NPM_CONFIG_IGNORE_SCRIPTS: "true"
    }
  }
  if (grant._tag !== "WorkloadIdentity") {
    return yield* new CredentialStrategyUnsupported({
      subject: spec.operation.subject,
      provider: spec.operation.provider,
      strategy: "token",
      reason: "The workload publisher requires a workload-identity grant."
    })
  }
  return yield* workloadEnvironment(vault, grant)
})

const redactPublisherOutput = (
  value: string,
  env: Readonly<Record<string, string>>,
  spec: CertifiedPublisherSpec
): string => {
  const metadata = spec._tag === "NpmPublisherSpec" ? npmUserConfigs.get(spec.userConfig) : undefined
  const known = metadata === undefined
    ? env
    : { ...env, PUBLISH_CREDENTIAL: Redacted.value(metadata.token) }
  return redactOutput(value, known)
}

const makeCertifiedPublisherSpawn = (
  spawner: ChildProcessSpawner["Service"],
  vault: SecretVault
): CertifiedPublisherSpawnShape => {
  const runClosed = Effect.fn("CertifiedPublisherSpawn.runClosed")(function*(
    argv: readonly [string, ...Array<string>]
  ) {
    const path = yield* optionalPath
    const command = ChildProcess.make(argv[0], [...argv.slice(1)], {
      env: closedBaseEnvironment(path),
      extendEnv: false,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe"
    })
    return yield* Effect.scoped(Effect.gen(function*() {
      const spawned = yield* Effect.exit(spawner.spawn(command))
      if (Exit.isFailure(spawned)) {
        return yield* platformError("spawn", "before-dispatch", "Trusted npm preflight could not start its version probe.")
      }
      const output = yield* Effect.exit(Effect.all({
        stdout: collect(spawned.value.stdout),
        stderr: collect(spawned.value.stderr),
        exitCode: spawned.value.exitCode
      }, { concurrency: "unbounded" }))
      if (Exit.isFailure(output)) {
        return yield* platformError("spawn", "before-dispatch", "Trusted npm preflight could not observe its version probe.")
      }
      if (Number(output.value.exitCode) !== 0) {
        return yield* platformError("spawn", "before-dispatch", "Trusted npm preflight version probe was rejected.")
      }
      return output.value.stdout
    }))
  })

  return {
  preflightTrustedNpm: Effect.fn("CertifiedPublisherSpawn.preflightTrustedNpm")(function*(operation, grant) {
    yield* validateGrantForOperation(operation, grant)
    if (grant._tag !== "WorkloadIdentity") {
      return yield* new CredentialStrategyUnsupported({
        subject: operation.subject,
        provider: operation.provider,
        strategy: "token",
        reason: "Trusted npm preflight requires a workload-identity grant."
      })
    }
    // Validate the exact host-held OIDC names before any provider authority is dispatched.
    yield* workloadEnvironment(vault, grant)
    const node = parseVersion(yield* runClosed(["node", "--version"]))
    const npm = parseVersion(yield* runClosed(["npm", "--version"]))
    if (node === undefined || !versionAtLeast(node, minimumTrustedNode) ||
      npm === undefined || !versionAtLeast(npm, minimumTrustedNpm)) {
      return yield* platformError(
        "spawn",
        "before-dispatch",
        "Trusted npm publishing requires Node >=22.14.0 and npm >=11.5.1."
      )
    }
  }),
  spawn: Effect.fn("CertifiedPublisherSpawn.spawn")(function*(spec, grant) {
    yield* validateGrantForOperation(spec.operation, grant)
    const env = yield* publisherEnvironment(vault, spec, grant)
    const command = ChildProcess.make(spec.argv[0], [...spec.argv.slice(1)], {
      cwd: spec.cwd,
      env,
      extendEnv: false,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe"
    })
    return yield* Effect.scoped(Effect.gen(function*() {
      const spawned = yield* Effect.exit(spawner.spawn(command))
      if (Exit.isFailure(spawned)) {
        return {
          _tag: "RejectedBeforeStart",
          commitment: "before-dispatch",
          reason: "The certified publisher process did not return a started handle."
        } satisfies CertifiedPublisherResult
      }
      const output = yield* Effect.exit(Effect.all({
        stdout: collect(spawned.value.stdout),
        stderr: collect(spawned.value.stderr),
        exitCode: spawned.value.exitCode
      }, { concurrency: "unbounded" }))
      if (Exit.isFailure(output)) {
        return {
          _tag: "PublisherOutcomeUnknown",
          commitment: "unknown",
          reason: "The certified publisher started, but its final outcome could not be observed."
        } satisfies CertifiedPublisherResult
      }
      return {
        _tag: "PublisherExited",
        commitment: "started",
        exitCode: Number(output.value.exitCode),
        stdout: redactPublisherOutput(output.value.stdout, env, spec),
        stderr: redactPublisherOutput(output.value.stderr, env, spec)
      } satisfies CertifiedPublisherResult
    }))
  })
  }
}

export interface EnvironmentCredentialPlatform {
  readonly credentialProvider: CredentialProviderShape
  readonly httpAuthorizer: HttpAuthorizerShape
  readonly authorizedMutationHttp: AuthorizedMutationHttpShape
  readonly npmUserConfigResource: NpmUserConfigResourceShape
  readonly certifiedPublisherSpawn: CertifiedPublisherSpawnShape
}

export interface EnvironmentCredentialPlatformOptions {
  readonly temporaryRoot?: string
}

/** All host sinks share one private vault; no secret is returned from it. */
export const makeEnvironmentCredentialPlatform = (
  http: PublicationHttp,
  spawner: ChildProcessSpawner["Service"],
  options: EnvironmentCredentialPlatformOptions = {}
): EnvironmentCredentialPlatform => {
  const vault: SecretVault = new Map()
  const observationGrants: ObservationGrantRegistry = new WeakMap()
  return {
    credentialProvider: makeProvider(vault, observationGrants),
    httpAuthorizer: makeHttpAuthorizer(http, vault, observationGrants),
    authorizedMutationHttp: makeAuthorizedMutationHttp(http, vault),
    npmUserConfigResource: makeNpmUserConfigResource(vault, options.temporaryRoot),
    certifiedPublisherSpawn: makeCertifiedPublisherSpawn(spawner, vault)
  }
}

export const makeEnvironmentCredentialPlatformLayer = (
  http: PublicationHttp,
  spawner: ChildProcessSpawner["Service"],
  options: EnvironmentCredentialPlatformOptions = {}
): Layer.Layer<CredentialPlatformServices> => {
  const platform = makeEnvironmentCredentialPlatform(http, spawner, options)
  return Layer.mergeAll(
    Layer.succeed(CredentialProvider)(platform.credentialProvider),
    Layer.succeed(HttpAuthorizer)(platform.httpAuthorizer),
    Layer.succeed(AuthorizedMutationHttp)(platform.authorizedMutationHttp),
    Layer.succeed(NpmUserConfigResource)(platform.npmUserConfigResource),
    Layer.succeed(CertifiedPublisherSpawn)(platform.certifiedPublisherSpawn)
  )
}
