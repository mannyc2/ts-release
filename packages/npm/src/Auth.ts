import * as Effect from "effect/Effect"
import * as Clock from "effect/Clock"
import * as Redacted from "effect/Redacted"
import * as Schema from "effect/Schema"
import * as Sigstore from "sigstore"
import { ReleaseError } from "@mannyc1/ts-release"
import { File, type ArtifactAccess } from "@mannyc1/ts-release/bundle"
import type {
  CredentialBinding,
  CredentialHeaders,
  TrustedPublisherHost,
  OidcTokenSource,
} from "@mannyc1/ts-release/http"
import {
  TokenAuthorization,
  TrustedAuthorization,
  ProvenanceSource,
  type Attest,
  type VerifyProvenance,
  name,
  version,
} from "./Model.js"
import {
  attempt,
  own,
  invalid,
  encode,
  parseJson,
  object,
  digest,
  captureArtifacts,
  readScope,
  endpointFor,
} from "./Native.js"

const bearer = (value: Redacted.Redacted<string>): CredentialHeaders => {
  const token = Redacted.value(value)
  if (!token || token.length > 65536 || /[^\x21-\x7e]/u.test(token)) invalid("credential-token")
  return Object.freeze({ authorization: `Bearer ${token}` })
}
const admitBinding = (
  binding: CredentialBinding,
  authorization: TokenAuthorization | TrustedAuthorization,
) => {
  const scope = readScope(binding.scope)
  if (
    binding.principal !== authorization.principal ||
    JSON.stringify(scope.authorization) !== JSON.stringify(authorization) ||
    ![endpointFor(scope), endpointFor(scope, true)].includes(binding.endpoint)
  )
    invalid("credential-binding")
  return scope
}
export const authorizeToken = Effect.fn("npm.authorizeToken")(function* (input: {
  readonly authorization: TokenAuthorization
  readonly binding: CredentialBinding
  readonly token: Redacted.Redacted<string>
}) {
  return yield* attempt(() => {
    const authorization = own(TokenAuthorization, input.authorization)
    admitBinding(input.binding, authorization)
    return bearer(input.token)
  })
})
const ExchangeResponse = Schema.Struct({
  token_type: Schema.Literal("oidc"),
  token: Schema.String,
  created: Schema.String,
  expires: Schema.String,
})
export const authorizeTrusted = Effect.fn("npm.authorizeTrusted")(function* (
  input: {
    readonly authorization: TrustedAuthorization
    readonly packageName: string
    readonly binding: CredentialBinding
  },
  host: TrustedPublisherHost,
) {
  const selected = yield* attempt(() => {
    const authorization = own(TrustedAuthorization, input.authorization)
    const scope = admitBinding(input.binding, authorization)
    if (scope.name !== input.packageName) invalid("credential-package")
    return {
      authorization,
      packageName: scope.name,
      oidc: host.oidc.bind(host),
      exchange: host.exchange.bind(host),
    }
  })
  const { authorization, packageName, oidc, exchange } = selected
  const identity = yield* oidc({
    issuer: authorization.issuer,
    audience: authorization.audience,
    repository: authorization.repository,
    workflow: authorization.workflow,
    workflowRef: authorization.workflowRef,
    expectedClaims: {},
  })
  const response = yield* exchange({
    url: `https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/${encodeURIComponent(packageName)}`,
    headers: yield* attempt(() => bearer(identity)),
    body: new Uint8Array(),
  })
  if (response.status !== 201)
    return yield* new ReleaseError({
      code: "npm-oidc-exchange",
      message: "npm OIDC exchange was not accepted",
    })
  const value = yield* attempt(() => own(ExchangeResponse, parseJson(response.body)))
  const now = yield* Clock.currentTimeMillis
  return yield* attempt(() => {
    const created = Date.parse(value.created),
      expires = Date.parse(value.expires)
    if (
      !Number.isFinite(created) ||
      !Number.isFinite(expires) ||
      created > now ||
      expires <= now ||
      expires <= created
    )
      invalid("credential-lifetime")
    return bearer(Redacted.make(value.token))
  })
})

export const statement = (
  input: { name: string; version: string; source: ProvenanceSource },
  bytes: Uint8Array,
) => {
  const source = input.source,
    repositoryUrl = `${source.serverUrl}/${source.repository}`
  return encode({
    _type: "https://in-toto.io/Statement/v1",
    subject: [
      {
        name: `pkg:npm/${input.name.replace(/^@/u, "%40")}@${input.version}`,
        digest: { sha512: digest("sha512", bytes) },
      },
    ],
    predicateType: "https://slsa.dev/provenance/v1",
    predicate: {
      buildDefinition: {
        buildType: "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1",
        externalParameters: {
          workflow: { ref: source.workflowRef, repository: repositoryUrl, path: source.workflow },
        },
        internalParameters: {
          github: {
            event_name: source.eventName,
            repository_id: source.repositoryId,
            repository_owner_id: source.repositoryOwnerId,
          },
        },
        resolvedDependencies: [
          {
            uri: `git+${repositoryUrl}@${source.sourceRef}`,
            digest: { gitCommit: source.sourceCommit },
          },
        ],
      },
      runDetails: {
        builder: { id: `https://github.com/actions/runner/${source.runnerEnvironment}` },
        metadata: {
          invocationId: `${repositoryUrl}/actions/runs/${source.runId}/attempts/${source.runAttempt}`,
        },
      },
    },
  })
}
const base64 = (input: unknown) => {
  if (typeof input !== "string" || !input) return invalid("sigstore-base64")
  const bytes = Buffer.from(input, "base64")
  if (bytes.toString("base64") !== input) invalid("sigstore-base64")
  return bytes
}
const decimal = (input: unknown) => {
  if (typeof input !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(input)) invalid("sigstore-decimal")
}
/** Structural/exact-byte admission only; signature trust belongs to Attest. */
export const validateProvenance = (bytes: Uint8Array, expected: Uint8Array) => {
  const value = object(parseJson(bytes)),
    envelope = object(value.dsseEnvelope),
    verification = object(value.verificationMaterial)
  if (
    value.mediaType !== "application/vnd.dev.sigstore.bundle.v0.3+json" ||
    envelope.payloadType !== "application/vnd.in-toto+json" ||
    !base64(envelope.payload).equals(expected) ||
    !Array.isArray(envelope.signatures) ||
    envelope.signatures.length !== 1
  )
    return invalid("sigstore-envelope")
  base64(object(envelope.signatures[0]).sig)
  base64(object(verification.certificate).rawBytes)
  if (!Array.isArray(verification.tlogEntries) || !verification.tlogEntries.length)
    return invalid("sigstore-transparency")
  for (const raw of verification.tlogEntries) {
    const entry = object(raw),
      proof = object(entry.inclusionProof),
      kind = object(entry.kindVersion)
    base64(entry.canonicalizedBody)
    base64(object(entry.logId).keyId)
    decimal(entry.integratedTime)
    decimal(entry.logIndex)
    decimal(proof.logIndex)
    decimal(proof.treeSize)
    if (
      typeof kind.kind !== "string" ||
      !kind.kind ||
      typeof kind.version !== "string" ||
      !kind.version ||
      !Array.isArray(proof.hashes) ||
      typeof object(proof.checkpoint).envelope !== "string" ||
      !object(proof.checkpoint).envelope
    )
      return invalid("sigstore-transparency")
    const checkpoint = String(object(proof.checkpoint).envelope).split("\n")
    if (
      proof.treeSize !== checkpoint[1] ||
      proof.rootHash !== checkpoint[2] ||
      base64(proof.rootHash).length !== 32 ||
      BigInt(String(proof.logIndex)) >= BigInt(String(proof.treeSize))
    )
      invalid("sigstore-proof-correspondence")
    proof.hashes.forEach(base64)
  }
  if (!Buffer.from(encode(value)).equals(bytes)) invalid("sigstore-encoding")
  return value
}
export const createProvenance = Effect.fn("npm.createProvenance")(function* (
  input: {
    readonly authorize: true
    readonly name: string
    readonly version: string
    readonly tarball: File
    readonly source: ProvenanceSource
  },
  dependencies: ArtifactAccess & { readonly attest: Attest },
) {
  const selected = yield* attempt(() => {
    if (input.authorize !== true) invalid("attestation-authorization")
    return {
      ...own(Schema.Struct({ name, version, source: ProvenanceSource }), {
        name: input.name,
        version: input.version,
        source: input.source,
      }),
      tarball: own(File, input.tarball),
      read: captureArtifacts(dependencies).read,
      attest: dependencies.attest.bind(dependencies),
    }
  })
  const payload = statement(selected, yield* selected.read(selected.tarball))
  const expected = payload.slice()
  const result = yield* selected.attest({ payloadType: "application/vnd.in-toto+json", payload })
  const bytes = new Uint8Array(result.bundleBytes)
  yield* attempt(() => validateProvenance(bytes, expected))
  return { mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json" as const, bytes }
})

export interface SigstoreTrustOptions {
  readonly tufRootPath: string
  readonly tufCachePath: string
  readonly timeoutMilliseconds: number
}
/** Actual native verification is repeatable for loaded owned provenance files. */
export const makeSigstoreVerifier = (input: SigstoreTrustOptions): VerifyProvenance => {
  const { tufRootPath, tufCachePath, timeoutMilliseconds: timeout } = input
  if (!tufRootPath || !tufCachePath || !Number.isSafeInteger(timeout) || timeout <= 0)
    invalid("sigstore-configuration")
  return Effect.fn("npm.verifySigstoreProvenance")(function* (input) {
    const { source, bundle } = yield* attempt(() => {
      const source = own(ProvenanceSource, input.source),
        bundle = SigstoreBundle(input.bundleBytes)
      const payload = base64(bundle.dsseEnvelope?.payload)
      validateProvenance(new Uint8Array(input.bundleBytes), payload)
      admitStatementSource(payload, source)
      return { source, bundle }
    })
    const identity = `^${`${source.serverUrl}/${source.repository}/${source.workflow}@${source.workflowRef}`.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}$`
    const signer = yield* Effect.tryPromise({
      try: () =>
        Sigstore.verify(bundle, {
          certificateIssuer: "https://token.actions.githubusercontent.com",
          certificateIdentityURI: identity,
          tufRootPath,
          tufCachePath,
          retry: 0,
          timeout,
        }),
      catch: () =>
        new ReleaseError({
          code: "npm-sigstore-verify",
          message: "Sigstore native trust verification failed",
        }),
    })
    // Fulcio's verified DER UTF8 extensions bind the signed source to its CI
    // identity, including the immutable commit and exact workflow invocation.
    yield* attempt(() => {
      const repositoryUrl = `${source.serverUrl}/${source.repository}`
      const expected: Record<string, string> = {
        11: source.runnerEnvironment,
        12: repositoryUrl,
        13: source.sourceCommit,
        14: source.sourceRef,
        15: source.repositoryId,
        16: `${source.serverUrl}/${source.repository.split("/")[0]}`,
        17: source.repositoryOwnerId,
        18: `${repositoryUrl}/${source.workflow}@${source.workflowRef}`,
        20: source.eventName,
        21: `${repositoryUrl}/actions/runs/${source.runId}/attempts/${source.runAttempt}`,
        22: source.repositoryVisibility,
      }
      for (const [suffix, value] of Object.entries(expected)) {
        const actual = signer.identity?.oids?.find(
          (entry) => entry.oid?.id.join(".") === `1.3.6.1.4.1.57264.1.${suffix}`,
        )
        const bytes = Buffer.from(value),
          hex = bytes.length.toString(16),
          length = Buffer.from(hex.padStart(Math.ceil(hex.length / 2) * 2, "0"), "hex")
        const der = Buffer.concat([
          Buffer.from([12]),
          bytes.length < 128
            ? Buffer.from([bytes.length])
            : Buffer.concat([Buffer.from([128 + length.length]), length]),
          bytes,
        ])
        if (!actual || !der.equals(actual.value)) invalid("sigstore-source-identity")
      }
    })
  })
}
const SigstoreBundle = (bytes: Uint8Array): Sigstore.Bundle => {
  if (bytes.length > 1024 * 1024) return invalid("sigstore-bound")
  // Sigstore owns its full native schema validation. The cast crosses only its
  // declared JSON input; it does not stand in for the verify call above.
  return object(parseJson(new Uint8Array(bytes))) as unknown as Sigstore.Bundle
}
const admitStatementSource = (bytes: Uint8Array, source: ProvenanceSource) => {
  const value = object(parseJson(bytes))
  if (!Array.isArray(value.subject) || value.subject.length !== 1)
    return invalid("statement-subject")
  const subject = object(value.subject[0]),
    subjectDigest = object(subject.digest)
  if (
    typeof subject.name !== "string" ||
    !subject.name.startsWith("pkg:npm/") ||
    typeof subjectDigest.sha512 !== "string" ||
    !/^[0-9a-f]{128}$/u.test(subjectDigest.sha512)
  )
    invalid("statement-subject")
  const purl = String(subject.name).slice(8),
    delimiter = purl.lastIndexOf("@")
  const packageName = own(name, purl.slice(0, delimiter).replace(/^%40/u, "@")),
    packageVersion = own(version, purl.slice(delimiter + 1))
  const expected = object(
    parseJson(statement({ name: packageName, version: packageVersion, source }, new Uint8Array())),
  )
  expected.subject = [
    {
      name: `pkg:npm/${packageName.replace(/^@/u, "%40")}@${packageVersion}`,
      digest: { sha512: subjectDigest.sha512 },
    },
  ]
  if (!Buffer.from(encode(expected)).equals(bytes)) invalid("statement-source")
}
export const makeSigstoreAttester = (input: {
  readonly source: ProvenanceSource
  readonly oidc: OidcTokenSource
  readonly fulcioUrl: "https://fulcio.sigstore.dev"
  readonly rekorUrl: "https://rekor.sigstore.dev"
  readonly tufRootPath: string
  readonly tufCachePath: string
  readonly timeoutMilliseconds: number
}): Attest => {
  const source = own(ProvenanceSource, input.source),
    oidc = input.oidc.bind(input),
    verify = makeSigstoreVerifier(input)
  const { fulcioUrl, rekorUrl, timeoutMilliseconds: timeout } = input
  if (fulcioUrl !== "https://fulcio.sigstore.dev" || rekorUrl !== "https://rekor.sigstore.dev")
    invalid("sigstore-configuration")
  return Effect.fn("npm.sigstoreAttest")(function* (request) {
    const payload = new Uint8Array(request.payload)
    if (request.payloadType !== "application/vnd.in-toto+json")
      return yield* new ReleaseError({
        code: "npm-attestation-type",
        message: "Unsupported attestation payload type",
      })
    yield* attempt(() => admitStatementSource(payload, source))
    const token = yield* oidc({
      issuer: "https://token.actions.githubusercontent.com",
      audience: "sigstore",
      repository: source.repository,
      workflow: source.workflow,
      workflowRef: source.workflowRef,
      expectedClaims: {
        sha: source.sourceCommit,
        ref: source.sourceRef,
        repository_id: source.repositoryId,
        repository_owner_id: source.repositoryOwnerId,
        repository_visibility: source.repositoryVisibility,
        runner_environment: source.runnerEnvironment,
        run_id: source.runId,
        run_attempt: source.runAttempt,
        event_name: source.eventName,
      },
    })
    const identityToken = yield* attempt(() => {
      bearer(token)
      return Redacted.value(token)
    })
    const bundle = yield* Effect.tryPromise({
      try: () =>
        Sigstore.attest(Buffer.from(payload), "application/vnd.in-toto+json", {
          identityToken,
          fulcioURL: fulcioUrl,
          rekorURL: rekorUrl,
          tlogUpload: true,
          legacyCompatibility: false,
          retry: 0,
          timeout,
        }),
      catch: () =>
        new ReleaseError({
          code: "npm-sigstore-sign",
          message: "Sigstore attestation outcome is unknown; no retry was attempted",
        }),
    })
    const bundleBytes = encode(bundle)
    yield* verify({ source, bundleBytes })
    return { bundleBytes }
  })
}
