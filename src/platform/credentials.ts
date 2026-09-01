import { Buffer } from "node:buffer"
import { chmod, copyFile, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, isAbsolute, join, resolve } from "node:path"
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
import * as Semver from "semver"
import {
  EnvironmentName,
  type CanonicalAudience,
  type CredentialRef,
  type CredentialRequest,
  type SubjectId,
  type ResolvedTrustedPublishingAuthStrategy
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
  type MutationCredentialGrant,
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
  npmPublishArgv,
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
import { canonicalizeRegistryUrl } from "../release/graph.js"

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
const githubActionsName = "GITHUB_ACTIONS"
const githubRepositoryName = "GITHUB_REPOSITORY"
const githubWorkflowRefName = "GITHUB_WORKFLOW_REF"
const githubServerUrlName = "GITHUB_SERVER_URL"
const githubEventName = "GITHUB_EVENT_NAME"
const githubRepositoryIdName = "GITHUB_REPOSITORY_ID"
const githubRepositoryOwnerIdName = "GITHUB_REPOSITORY_OWNER_ID"
const githubRefName = "GITHUB_REF"
const githubShaName = "GITHUB_SHA"
const runnerEnvironmentName = "RUNNER_ENVIRONMENT"
const githubRunIdName = "GITHUB_RUN_ID"
const githubRunAttemptName = "GITHUB_RUN_ATTEMPT"

const portableEnvironmentName = /^[A-Za-z_][A-Za-z0-9_]*$/u
const certifiedWorkflow = /^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/u
const certifiedRepository = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/u
const certifiedWorkflowRef = /^(?:refs\/(?:heads|tags)\/[A-Za-z0-9][A-Za-z0-9._/-]*|[a-f0-9]{40}(?:[a-f0-9]{24})?)$/u
const certifiedSourceCommit = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u
const certifiedEvent = /^[a-z][a-z0-9_]*$/u
const certifiedDecimalId = /^[1-9][0-9]*$/u
const certifiedSourceRef = /^refs\/(?:heads|tags)\/[A-Za-z0-9][A-Za-z0-9._/-]*$/u

type SecretVault = Map<string, Redacted.Redacted<string>>

interface TrustedHostSnapshot {
  readonly GITHUB_ACTIONS: "true"
  readonly GITHUB_REPOSITORY: string
  readonly GITHUB_WORKFLOW_REF: string
  readonly GITHUB_SERVER_URL: "https://github.com"
  readonly GITHUB_EVENT_NAME: string
  readonly GITHUB_REPOSITORY_ID: string
  readonly GITHUB_REPOSITORY_OWNER_ID: string
  readonly GITHUB_REF: string
  readonly GITHUB_SHA: string
  readonly RUNNER_ENVIRONMENT: "github-hosted"
  readonly GITHUB_RUN_ID: string
  readonly GITHUB_RUN_ATTEMPT: string
}

interface TrustedWorkloadMaterial {
  readonly snapshot: TrustedHostSnapshot
  readonly oidc: ReadonlyMap<EnvironmentName, Redacted.Redacted<string>>
}

type TrustedWorkloadVault = WeakMap<WorkloadIdentity, TrustedWorkloadMaterial>

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

const trustedStrategyIssue = (request: CredentialRequest): string | undefined => {
  const strategy = request.strategy
  if (strategy.kind !== "trusted-publishing") return "The request does not carry trusted-publishing intent."
  if (request.provider !== "npm" || request.audience !== "https://registry.npmjs.org/" ||
    request.purpose !== "publish") {
    return "Trusted publishing is certified only for npm publish at the canonical npm registry."
  }
  if (strategy.identityProvider !== "github-actions" || strategy.runnerClass !== "github-hosted" ||
    !certifiedRepository.test(strategy.repository) || !certifiedWorkflow.test(strategy.workflow) ||
    !certifiedWorkflowRef.test(strategy.workflowRef) ||
    !certifiedSourceCommit.test(strategy.sourceCommit) ||
    strategy.provenanceEnvironmentContract !== "github-actions-npm-provenance-v1" ||
    strategy.allowedAction !== "npm-publish-direct" || strategy.publisherSink !== "certified-npm-cli") {
    return "Trusted publishing requires one exact GitHub-hosted workflow/ref, source commit, provenance environment contract, and certified direct npm sink."
  }
  return undefined
}

/** Validate non-secret GitHub host facts before either OIDC request value is read. */
const verifyTrustedHostIdentity = Effect.fn("EnvironmentCredentialProvider.verifyTrustedHostIdentity")(
  function*(request: CredentialRequest) {
    const issue = trustedStrategyIssue(request)
    if (issue !== undefined) return yield* unsupported(request, issue)
    if (request.strategy.kind !== "trusted-publishing") return yield* unsupported(request, issue ?? "Invalid strategy.")
    const expected: ReadonlyArray<readonly [string, string]> = [
      [githubActionsName, "true"],
      [githubRepositoryName, request.strategy.repository],
      [githubWorkflowRefName,
        `${request.strategy.repository}/${request.strategy.workflow}@${request.strategy.workflowRef}`],
      [githubServerUrlName, "https://github.com"],
      [githubShaName, request.strategy.sourceCommit],
      [runnerEnvironmentName, "github-hosted"]
    ]
    const values: Record<string, string> = {}
    for (const [name, value] of expected) {
      const observed = yield* Config.string(name).pipe(
        Effect.mapError(() => unsupported(request, `Trusted publishing host identity ${name} is unavailable.`))
      )
      if (observed !== value) {
        return yield* unsupported(request, `Trusted publishing host identity ${name} does not match prepared intent.`)
      }
      values[name] = observed
    }
    const shaped: ReadonlyArray<readonly [string, RegExp, string]> = [
      [githubEventName, certifiedEvent, "a canonical GitHub event name"],
      [githubRepositoryIdName, certifiedDecimalId, "a canonical positive decimal repository ID"],
      [githubRepositoryOwnerIdName, certifiedDecimalId, "a canonical positive decimal repository-owner ID"],
      [githubRefName, certifiedSourceRef, "a canonical heads/tags source ref"],
      [githubRunIdName, certifiedDecimalId, "a canonical positive decimal run ID"],
      [githubRunAttemptName, certifiedDecimalId, "a canonical positive decimal run attempt"]
    ]
    for (const [name, pattern, description] of shaped) {
      const observed = yield* Config.string(name).pipe(
        Effect.mapError(() => unsupported(request, `Trusted publishing provenance fact ${name} is unavailable.`))
      )
      if (!pattern.test(observed)) {
        return yield* unsupported(request, `Trusted publishing provenance fact ${name} is not ${description}.`)
      }
      values[name] = observed
    }
    return Object.freeze({
      GITHUB_ACTIONS: values[githubActionsName] as "true",
      GITHUB_REPOSITORY: values[githubRepositoryName]!,
      GITHUB_WORKFLOW_REF: values[githubWorkflowRefName]!,
      GITHUB_SERVER_URL: values[githubServerUrlName] as "https://github.com",
      GITHUB_EVENT_NAME: values[githubEventName]!,
      GITHUB_REPOSITORY_ID: values[githubRepositoryIdName]!,
      GITHUB_REPOSITORY_OWNER_ID: values[githubRepositoryOwnerIdName]!,
      GITHUB_REF: values[githubRefName]!,
      GITHUB_SHA: values[githubShaName]!,
      RUNNER_ENVIRONMENT: values[runnerEnvironmentName] as "github-hosted",
      GITHUB_RUN_ID: values[githubRunIdName]!,
      GITHUB_RUN_ATTEMPT: values[githubRunAttemptName]!
    }) satisfies TrustedHostSnapshot
  }
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

const makeEnvironmentAcquirer = (
  vault: SecretVault,
  onTrustedWorkload?: (material: TrustedWorkloadMaterial) => void
): CredentialGrantAcquirer => ({
  acquire: Effect.fn("EnvironmentCredentialProvider.acquire")(function*(request) {
    switch (request.strategy.kind) {
      case "anonymous":
        return { _tag: "AnonymousAccess", purposes: ["observe"] } as const
      case "token": {
        if (request.provider === "npm" && request.purpose === "observe") {
          return yield* unsupported(
            request,
            "Authenticated npm observation is unsupported without a distinct typed read credential."
          )
        }
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
        if (onTrustedWorkload === undefined) {
          return yield* unsupported(request, "Trusted workload acquisition requires a private host-material binding.")
        }
        const snapshot = yield* verifyTrustedHostIdentity(request)
        const oidcValues = new Map<EnvironmentName, Redacted.Redacted<string>>()
        for (const name of oidcNames) {
          const value = yield* readSecret(request, name)
          oidcValues.set(name, value)
        }
        onTrustedWorkload(Object.freeze({ snapshot, oidc: oidcValues }))
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
  trustedWorkloads: TrustedWorkloadVault,
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
      let grant: MutationCredentialGrant
      if (request.strategy.kind === "trusted-publishing") {
        let material: TrustedWorkloadMaterial | undefined
        const trustedProvider = makeCredentialProvider(makeEnvironmentAcquirer(
          vault,
          (acquired) => { material = acquired }
        ))
        grant = yield* trustedProvider.acquireForMutation(request, decision)
        if (grant._tag !== "WorkloadIdentity" || material === undefined) {
          return yield* unavailable(request, "Trusted publishing host evidence was not bound to its workload grant.")
        }
        trustedWorkloads.set(grant, material)
      } else {
        grant = yield* provider.acquireForMutation(request, decision)
      }
      // npm publication tokens never become observation capabilities. GitHub
      // retains its truthfully bundled installation-token read/write model.
      if (grant._tag === "ScopedSecret" && request.provider !== "npm") {
        rememberObservationGrant(observationGrants, grant)
      }
      return grant
    })
  }
}

/** Environment-backed provider projection for hosts that need no sinks. */
export const makeEnvironmentCredentialProvider = (): CredentialProviderShape =>
  makeProvider(new Map(), new WeakMap(), new WeakMap())

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
  phase: "observe" | "mutate",
  credentialScheme: "bearer" | "pypi-token-basic" = "bearer"
): Effect.Effect<HttpResponse, CredentialPlatformError> => {
  if (hasAuthorizationHeader(request.headers)) {
    return Effect.fail(platformError(phase, "before-dispatch", "Callers may not supply an Authorization header."))
  }
  const headers = {
    ...(request.headers ?? {}),
    authorization: credentialScheme === "pypi-token-basic"
      ? `Basic ${Buffer.from(`__token__:${Redacted.value(token)}`, "utf8").toString("base64")}`
      : `Bearer ${Redacted.value(token)}`
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
    if ((operation.provider === "pypi") !== (request.credentialScheme === "pypi-token-basic")) {
      return yield* platformError(
        "mutate", "before-dispatch",
        "The PyPI Basic credential projection is accepted only for typed PyPI mutations and is mandatory for them."
      )
    }
    yield* checkAudience(operation.subject, operation.audience, request.url, operation.provider === "github")
    const token = yield* lookupToken(vault, grant.subject, grant.ref)
    return yield* sendAuthorized(http, request, token, "mutate", request.credentialScheme)
  })
})

type NpmUserConfigMetadata = {
  readonly directory: string
  readonly path: string
  readonly globalConfigPath: string
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
          const globalConfigPath = join(directory, "globalconfig")
          const contents = `${npmAuthLine(input.registryUrl, token)}\nignore-scripts=true\n`
          await writeFile(path, contents, { mode: 0o600, flag: "wx" })
          await writeFile(globalConfigPath, "", { mode: 0o600, flag: "wx" })
          npmUserConfigs.set(handle, {
            directory,
            path,
            globalConfigPath,
            subject: input.operation.subject,
            grant,
            token
          })
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

const optionalReleaseHome = Config.option(Config.string("TS_RELEASE_HOME")).pipe(
  Effect.map(Option.getOrUndefined),
  Effect.orElseSucceed(() => undefined)
)

const privateTrustedNpmEnvironment = Effect.fn("CertifiedPublisherSpawn.privateTrustedNpmEnvironment")(
  function*(grant: WorkloadIdentity) {
    const configured = yield* optionalReleaseHome
    if (configured === undefined || !isAbsolute(configured) || resolve(configured) !== configured) {
      return yield* new CredentialUnavailable({
        subject: grant.subject,
        provider: grant.provider,
        purpose: "publish",
        reason: "Trusted npm publishing requires one canonical absolute TS_RELEASE_HOME."
      })
    }
    return yield* Effect.tryPromise({
      try: async () => {
        const canonicalHome = await realpath(configured)
        if (canonicalHome !== configured) throw new Error("TS_RELEASE_HOME is not canonical.")
        const homeMetadata = await stat(canonicalHome)
        const owner = typeof process.getuid === "function" ? process.getuid() : undefined
        if (!homeMetadata.isDirectory() || (homeMetadata.mode & 0o077) !== 0 ||
          (owner !== undefined && homeMetadata.uid !== owner)) {
          throw new Error("TS_RELEASE_HOME is not one private caller-owned directory.")
        }
        const userConfig = join(canonicalHome, "npm-userconfig")
        const globalConfig = join(canonicalHome, "npm-globalconfig")
        for (const path of [userConfig, globalConfig]) {
          if (await realpath(path) !== path) throw new Error("A trusted npm config path is not canonical.")
          const metadata = await stat(path)
          if (!metadata.isFile() || (metadata.mode & 0o777) !== 0o600 ||
            (owner !== undefined && metadata.uid !== owner) || (await readFile(path)).length !== 0) {
            throw new Error("A trusted npm config is not an empty private caller-owned file.")
          }
        }
        return {
          HOME: canonicalHome,
          NPM_CONFIG_USERCONFIG: userConfig,
          NPM_CONFIG_GLOBALCONFIG: globalConfig
        }
      },
      catch: () => new CredentialUnavailable({
        subject: grant.subject,
        provider: grant.provider,
        purpose: "publish",
        reason: "Trusted npm publishing requires validated empty private npm configuration files."
      })
    })
  }
)

const workloadEnvironment = Effect.fn("CertifiedPublisherSpawn.workloadEnvironment")(function*(
  trustedWorkloads: TrustedWorkloadVault,
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
  const material = trustedWorkloads.get(grant)
  if (material === undefined) {
    return yield* new CredentialUnavailable({
      subject: grant.subject,
      provider: grant.provider,
      purpose: "publish",
      reason: "Certified GitHub Actions provenance facts are unavailable in this platform boundary."
    })
  }
  const path = yield* optionalPath
  const privateEnvironment = yield* privateTrustedNpmEnvironment(grant)
  const env: Record<string, string> = {
    ...closedBaseEnvironment(path),
    ...privateEnvironment
  }
  for (const name of oidcNames) {
    const value = material.oidc.get(name)
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
  // npm's OIDC exchange consumes the two host-held request values. Its
  // libnpmpublish provenance builder separately consumes this exact validated
  // non-secret GitHub run snapshot. No ambient environment is inherited.
  Object.assign(env, material.snapshot)
  env.NPM_CONFIG_IGNORE_SCRIPTS = "true"
  return env
})

const validateTrustedNpmOperation = Effect.fn("CertifiedPublisherSpawn.validateTrustedNpmOperation")(
  function*(operation: NpmPublishOperation, grant: WorkloadIdentity) {
    if (operation.provider !== "npm" || operation.purpose !== "publish" ||
      operation.audience !== "https://registry.npmjs.org/" ||
      grant.strategy.identityProvider !== "github-actions" ||
      grant.strategy.runnerClass !== "github-hosted" ||
      grant.strategy.allowedAction !== "npm-publish-direct" ||
      grant.strategy.publisherSink !== "certified-npm-cli") {
      return yield* new CredentialStrategyUnsupported({
        subject: operation.subject,
        provider: operation.provider,
        strategy: "trusted-publishing",
        reason: "The workload grant is not bound to the certified direct npm publisher sink."
      })
    }
  }
)

const publisherSpecKeys = Object.freeze({
  NpmPublisherSpec: [
    "_tag", "access", "cwd", "distTag", "operation", "packageName", "provenance",
    "registryUrl", "tarballPath", "userConfig", "version"
  ],
  WorkloadPublisherSpec: [
    "_tag", "access", "cwd", "distTag", "operation", "packageName", "provenance",
    "registryUrl", "tarballPath", "version"
  ]
} satisfies Record<CertifiedPublisherSpec["_tag"], ReadonlyArray<string>>)

const sameKeys = (value: object, expected: ReadonlyArray<string>): boolean => {
  const observed = Object.keys(value).sort()
  return observed.length === expected.length && observed.every((key, index) => key === expected[index])
}

const certifiedNpmSpecIssue = (spec: CertifiedPublisherSpec): string | undefined => {
  const tagDescriptor = Object.getOwnPropertyDescriptor(spec, "_tag")
  const tag: unknown = tagDescriptor !== undefined && "value" in tagDescriptor
    ? tagDescriptor.value
    : undefined
  if (tag !== "NpmPublisherSpec" && tag !== "WorkloadPublisherSpec") {
    return "The certified npm publisher accepts only its two closed typed spec variants."
  }
  const expectedKeys = publisherSpecKeys[tag]
  const descriptors = Object.getOwnPropertyDescriptors(spec)
  if (!sameKeys(spec, expectedKeys) || expectedKeys.some((key) => {
    const descriptor = descriptors[key]
    return descriptor === undefined || !("value" in descriptor)
  })) {
    return "The certified npm publisher accepts only its exact typed fields; generic argv and override fields are forbidden."
  }
  const operation = spec.operation
  if (operation._tag !== "PublishOperation" || operation.provider !== "npm" || operation.purpose !== "publish") {
    return "The certified npm publisher accepts only an npm publish operation."
  }
  if (typeof spec.packageName !== "string" || spec.packageName.length === 0 ||
      typeof spec.version !== "string" || Semver.valid(spec.version) !== spec.version) {
    return "The certified npm publisher requires one nonempty package name and canonical semantic version."
  }
  if (operation.subject !== `npm:${spec.packageName}@${spec.version}`) {
    return "The certified npm publisher package and version do not match the authorized operation subject."
  }
  try {
    if (canonicalizeRegistryUrl(spec.registryUrl) !== spec.registryUrl ||
        operation.audience.toString() !== spec.registryUrl.toString()) {
      return "The certified npm publisher registry does not match the authorized canonical audience."
    }
  } catch {
    return "The certified npm publisher requires a canonical registry and npm distribution tag."
  }
  if (Semver.validRange(spec.distTag) !== null || spec.distTag.trim() !== spec.distTag ||
      encodeURIComponent(spec.distTag) !== spec.distTag) {
    return "The certified npm publisher requires a canonical registry and npm distribution tag."
  }
  if ((spec.access !== "public" && spec.access !== "restricted") ||
      (spec.provenance !== "required" && spec.provenance !== "automatic" && spec.provenance !== "disabled") ||
      (spec._tag === "NpmPublisherSpec" && spec.provenance === "automatic") ||
      (spec.access === "restricted" && !spec.packageName.startsWith("@")) ||
      (Semver.prerelease(spec.version) !== null && spec.distTag === "latest")) {
    return "The certified npm publisher access, provenance, or dist-tag policy is not an allowed canonical value."
  }
  try {
    const fileName = basename(spec.tarballPath)
    if (!isAbsolute(spec.cwd) || resolve(spec.cwd) !== spec.cwd ||
        !/^[a-f0-9]{64}$/u.test(fileName) ||
        resolve(spec.cwd, "blobs", fileName) !== spec.tarballPath) {
      return "The certified npm publisher tarball must be the canonical prepared-store blob path."
    }
  } catch {
    return "The certified npm publisher tarball must be the canonical prepared-store blob path."
  }
  return undefined
}

const validateCertifiedNpmSpec = Effect.fn("CertifiedPublisherSpawn.validateCertifiedNpmSpec")(
  function*(spec: CertifiedPublisherSpec) {
    const issue = certifiedNpmSpecIssue(spec)
    if (issue !== undefined) {
      return yield* new CredentialStrategyUnsupported({
        subject: spec.operation.subject,
        provider: spec.operation.provider,
        strategy: spec._tag === "WorkloadPublisherSpec" ? "trusted-publishing" : "token",
        reason: issue
      })
    }
  }
)

/** Snapshot caller data once so accessors or concurrent mutation cannot change the admitted command after validation. */
const snapshotCertifiedNpmSpec = (spec: CertifiedPublisherSpec): CertifiedPublisherSpec => {
  const operation = Object.freeze({
    ...spec.operation,
    decision: Object.freeze({ ...spec.operation.decision })
  }) as NpmPublishOperation
  return Object.freeze({ ...spec, operation }) as CertifiedPublisherSpec
}

const publisherEnvironment = Effect.fn("CertifiedPublisherSpawn.environment")(function*(
  vault: SecretVault,
  trustedWorkloads: TrustedWorkloadVault,
  spec: CertifiedPublisherSpec,
  grant: ScopedSecret | WorkloadIdentity
) {
  yield* validateCertifiedNpmSpec(spec)
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
      HOME: metadata.directory,
      NPM_CONFIG_USERCONFIG: metadata.path,
      NPM_CONFIG_GLOBALCONFIG: metadata.globalConfigPath,
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
  yield* validateTrustedNpmOperation(spec.operation, grant)
  return yield* workloadEnvironment(trustedWorkloads, grant)
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

interface NpmPublishTransport {
  readonly directory: string
  readonly path: string
}

/**
 * npm classifies a suffixless local path as a package directory. Prepared
 * artifacts deliberately use digest-only blob names, so expose the already
 * admitted bytes through a private `.tgz` transport name only while npm runs.
 */
const makeNpmPublishTransport = (
  sourcePath: string,
  temporaryRoot?: string
) => {
  const root = temporaryRoot ?? tmpdir()
  const acquired = Effect.tryPromise({
    try: async () => {
      await mkdir(root, { recursive: true, mode: 0o700 })
      const directory = await mkdtemp(join(root, "ts-release-npm-tarball-"))
      try {
        const path = join(directory, "package.tgz")
        await copyFile(sourcePath, path)
        await chmod(path, 0o600)
        return { directory, path }
      } catch (cause) {
        await rm(directory, { recursive: true, force: true })
        throw cause
      }
    },
    catch: () => platformError(
      "resource",
      "before-dispatch",
      "Unable to materialize the verified npm tarball transport path."
    )
  })
  return Effect.acquireRelease(acquired, ({ directory }) => Effect.tryPromise({
    try: () => rm(directory, { recursive: true, force: true }),
    catch: () => undefined
  }).pipe(Effect.catch(() => Effect.void)))
}

const makeCertifiedPublisherSpawn = (
  spawner: ChildProcessSpawner["Service"],
  vault: SecretVault,
  trustedWorkloads: TrustedWorkloadVault,
  temporaryRoot?: string
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
    yield* validateTrustedNpmOperation(operation, grant)
    // Validate the exact host-held OIDC names before any provider authority is dispatched.
    yield* workloadEnvironment(trustedWorkloads, grant)
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
  spawn: Effect.fn("CertifiedPublisherSpawn.spawn")(function*(inputSpec, grant) {
    yield* validateGrantForOperation(inputSpec.operation, grant)
    yield* validateCertifiedNpmSpec(inputSpec)
    const spec = snapshotCertifiedNpmSpec(inputSpec)
    const env = yield* publisherEnvironment(vault, trustedWorkloads, spec, grant)
    return yield* Effect.scoped(Effect.gen(function*() {
      const transport = yield* makeNpmPublishTransport(spec.tarballPath, temporaryRoot)
      const argv = npmPublishArgv({ ...spec, tarballPath: transport.path })
      const command = ChildProcess.make(argv[0], [...argv.slice(1)], {
        cwd: spec.cwd,
        env,
        extendEnv: false,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe"
      })
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
  const trustedWorkloads: TrustedWorkloadVault = new WeakMap()
  const observationGrants: ObservationGrantRegistry = new WeakMap()
  return {
    credentialProvider: makeProvider(vault, trustedWorkloads, observationGrants),
    httpAuthorizer: makeHttpAuthorizer(http, vault, observationGrants),
    authorizedMutationHttp: makeAuthorizedMutationHttp(http, vault),
    npmUserConfigResource: makeNpmUserConfigResource(vault, options.temporaryRoot),
    certifiedPublisherSpawn: makeCertifiedPublisherSpawn(spawner, vault, trustedWorkloads, options.temporaryRoot)
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
