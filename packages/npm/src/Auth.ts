import { Clock, Effect, Redacted, Schema } from "effect"
import * as NativeSigstore from "@sigstore/bundle"
import * as Sigstore from "sigstore"
import * as Bundle from "@mannyc1/ts-release/bundle"
import * as Http from "@mannyc1/ts-release/http"
import * as Model from "./Model.js"
import * as Native from "./Native.js"

const bearer = (value: Redacted.Redacted<string>): Http.CredentialHeaders =>
  Http.bearerCredentials(value, () => Native.invalid("credential-token"))
const admitBinding = (
  binding: Http.CredentialBinding,
  authorization: Model.TokenAuthorization | Model.TrustedAuthorization,
) => {
  const scope = Native.readScope(binding.scope)
  if (
    binding.principal !== authorization.principal ||
    !Http.sameData(scope.intent.authorization, authorization) ||
    ![Native.endpointFor(scope), Native.endpointFor(scope, true)].includes(binding.endpoint)
  )
    Native.invalid("credential-binding")
  return scope
}
export const authorizeToken = Effect.fn("npm.authorizeToken")(function* (input: {
  readonly authorization: Model.TokenAuthorization
  readonly binding: Http.CredentialBinding
  readonly token: Redacted.Redacted<string>
}) {
  return yield* Native.attempt(() => {
    const authorization = Native.own(Model.TokenAuthorization, input.authorization)
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
    readonly authorization: Model.TrustedAuthorization
    readonly packageName: string
    readonly binding: Http.CredentialBinding
  },
  host: Http.TrustedPublisherHost,
) {
  const selected = yield* Native.attempt(() => {
    const authorization = Native.own(Model.TrustedAuthorization, input.authorization)
    const scope = admitBinding(input.binding, authorization)
    if (scope.intent.name !== input.packageName) Native.invalid("credential-package")
    return {
      authorization,
      packageName: scope.intent.name,
      ...Http.captureTrustedPublisher(host),
    }
  })
  const { authorization, packageName, oidc, exchange } = selected
  const identity = yield* oidc(Http.oidcRequest(authorization))
  const response = yield* exchange({
    url: `https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/${encodeURIComponent(packageName)}`,
    headers: yield* Native.attempt(() => bearer(identity)),
    body: new Uint8Array(),
  })
  if (response.status !== 201)
    return yield* Native.reject("npm-oidc-exchange", "npm OIDC exchange was not accepted")
  const value = yield* Native.attempt(() =>
    Native.own(ExchangeResponse, Native.parseJson(response.body)),
  )
  const now = yield* Clock.currentTimeMillis
  return yield* Native.attempt(() => {
    const created = Date.parse(value.created),
      expires = Date.parse(value.expires)
    if (
      !Number.isFinite(created) ||
      !Number.isFinite(expires) ||
      created > now ||
      expires <= now ||
      expires <= created
    )
      Native.invalid("credential-lifetime")
    return bearer(Redacted.make(value.token))
  })
})

const statementWithDigest = (
  input: { name: string; version: string; source: Model.ProvenanceSource },
  sha512: string,
) => {
  const source = input.source,
    repositoryUrl = `${source.serverUrl}/${source.repository}`
  return Native.encode({
    _type: "https://in-toto.io/Statement/v1",
    subject: [
      {
        name: `pkg:npm/${input.name.replace(/^@/u, "%40")}@${input.version}`,
        digest: { sha512 },
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
export const statement = (
  input: { name: string; version: string; source: Model.ProvenanceSource },
  bytes: Uint8Array,
) => statementWithDigest(input, Native.digest("sha512", bytes))
const base64 = (input: unknown) => {
  if (typeof input !== "string" || !input) return Native.invalid("sigstore-base64")
  const bytes = Buffer.from(input, "base64")
  if (bytes.toString("base64") !== input) Native.invalid("sigstore-base64")
  return bytes
}
const decimal = (input: unknown) => {
  if (typeof input !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(input))
    Native.invalid("sigstore-decimal")
}
/** Structural/exact-byte admission only; signature trust belongs to Attest. */
export const validateProvenance = (
  bytes: Uint8Array,
  expected?: Uint8Array,
): { bundle: unknown; payload: Uint8Array } => {
  if (bytes.length > 1024 * 1024) return Native.invalid("sigstore-bound")
  const value = Native.object(Native.parseJson(bytes))
  if (!Buffer.from(Native.encode(value)).equals(bytes)) Native.invalid("sigstore-encoding")
  const bundle = NativeSigstore.bundleFromJSON(value)
  if (
    bundle.mediaType !== NativeSigstore.BUNDLE_V03_MEDIA_TYPE ||
    !NativeSigstore.isBundleWithDsseEnvelope(bundle) ||
    bundle.content.dsseEnvelope.payloadType !== "application/vnd.in-toto+json" ||
    (expected !== undefined && !bundle.content.dsseEnvelope.payload.equals(expected)) ||
    bundle.verificationMaterial.content.$case !== "certificate" ||
    bundle.verificationMaterial.tlogEntries.length === 0
  )
    return Native.invalid("sigstore-envelope")
  const envelope = Native.object(value.dsseEnvelope),
    verification = Native.object(value.verificationMaterial),
    entries = verification.tlogEntries
  base64(envelope.payload)
  base64(Native.object((envelope.signatures as Array<unknown>)[0]).sig)
  base64(Native.object(verification.certificate).rawBytes)
  if (!Array.isArray(entries)) return Native.invalid("sigstore-transparency")
  for (const [index, entry] of bundle.verificationMaterial.tlogEntries.entries()) {
    const raw = Native.object(entries[index]),
      rawProof = Native.object(raw.inclusionProof),
      rawKind = Native.object(raw.kindVersion),
      proof = entry.inclusionProof
    ;[raw.integratedTime, raw.logIndex, rawProof.logIndex, rawProof.treeSize].forEach(decimal)
    ;[
      raw.canonicalizedBody,
      Native.object(raw.logId).keyId,
      rawProof.rootHash,
      ...(rawProof.hashes as Array<unknown>),
    ].forEach(base64)
    if (
      !proof ||
      typeof rawKind.kind !== "string" ||
      !rawKind.kind ||
      typeof rawKind.version !== "string" ||
      !rawKind.version ||
      !Array.isArray(rawProof.hashes) ||
      typeof Native.object(rawProof.checkpoint).envelope !== "string" ||
      !proof.checkpoint?.envelope
    )
      return Native.invalid("sigstore-transparency")
    const checkpoint = proof.checkpoint.envelope.split("\n")
    if (
      proof.treeSize !== checkpoint[1] ||
      proof.rootHash.toString("base64") !== checkpoint[2] ||
      proof.rootHash.length !== 32 ||
      BigInt(proof.logIndex) >= BigInt(proof.treeSize)
    )
      Native.invalid("sigstore-proof-correspondence")
  }
  return {
    bundle: value,
    payload: new Uint8Array(bundle.content.dsseEnvelope.payload),
  }
}
export const createProvenance = Effect.fn("npm.createProvenance")(function* (
  input: {
    readonly authorize: true
    readonly name: string
    readonly version: string
    readonly tarball: Bundle.File
    readonly source: Model.ProvenanceSource
  },
  dependencies: Bundle.ArtifactAccess & { readonly attest: Model.Attest },
) {
  const selected = yield* Native.attempt(() => {
    if (input.authorize !== true) Native.invalid("attestation-authorization")
    return {
      ...Native.own(
        Schema.Struct({ name: Model.name, version: Model.version, source: Model.ProvenanceSource }),
        {
          name: input.name,
          version: input.version,
          source: input.source,
        },
      ),
      tarball: Native.own(Bundle.File, input.tarball),
      read: Native.captureArtifacts(dependencies).read,
      attest: dependencies.attest.bind(dependencies),
    }
  })
  const payload = statement(selected, yield* selected.read(selected.tarball))
  const expected = payload.slice()
  const result = yield* selected.attest({ payloadType: "application/vnd.in-toto+json", payload })
  const bytes = new Uint8Array(result.bundleBytes)
  yield* Native.attempt(() => validateProvenance(bytes, expected))
  return { mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json" as const, bytes }
})

export interface SigstoreTrustOptions {
  readonly tufRootPath: string
  readonly tufCachePath: string
  readonly timeoutMilliseconds: number
}
/** Actual native verification is repeatable for loaded owned provenance files. */
export const makeSigstoreVerifier = (input: SigstoreTrustOptions): Model.VerifyProvenance => {
  const { tufRootPath, tufCachePath, timeoutMilliseconds: timeout } = input
  if (!tufRootPath || !tufCachePath || !Number.isSafeInteger(timeout) || timeout <= 0)
    Native.invalid("sigstore-configuration")
  return Effect.fn("npm.verifySigstoreProvenance")(function* (input) {
    const { source, bundle } = yield* Native.attempt(() => {
      const source = Native.own(Model.ProvenanceSource, input.source),
        { bundle, payload } = validateProvenance(new Uint8Array(input.bundleBytes))
      admitStatementSource(payload, source)
      return { source, bundle }
    })
    const identity = `^${`${source.serverUrl}/${source.repository}/${source.workflow}@${source.workflowRef}`.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}$`
    const signer = yield* Effect.tryPromise({
      try: () =>
        Sigstore.verify(bundle as Sigstore.Bundle, {
          certificateIssuer: "https://token.actions.githubusercontent.com",
          certificateIdentityURI: identity,
          tufRootPath,
          tufCachePath,
          retry: 0,
          timeout,
        }),
      catch: () =>
        Native.failure("npm-sigstore-verify", "Sigstore native trust verification failed"),
    })
    // Fulcio's verified DER UTF8 extensions bind the signed source to its CI
    // identity, including the immutable commit and exact workflow invocation.
    yield* Native.attempt(() => {
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
        if (!actual || !der.equals(actual.value)) Native.invalid("sigstore-source-identity")
      }
    })
  })
}
const admitStatementSource = (bytes: Uint8Array, source: Model.ProvenanceSource) => {
  const value = Native.object(Native.parseJson(bytes))
  if (!Array.isArray(value.subject) || value.subject.length !== 1)
    return Native.invalid("statement-subject")
  const subject = Native.object(value.subject[0]),
    subjectDigest = Native.object(subject.digest),
    sha512 = subjectDigest.sha512
  if (
    typeof subject.name !== "string" ||
    !subject.name.startsWith("pkg:npm/") ||
    typeof sha512 !== "string" ||
    !/^[0-9a-f]{128}$/u.test(sha512)
  )
    Native.invalid("statement-subject")
  const purl = String(subject.name).slice(8),
    delimiter = purl.lastIndexOf("@")
  const packageName = Native.own(Model.name, purl.slice(0, delimiter).replace(/^%40/u, "@")),
    packageVersion = Native.own(Model.version, purl.slice(delimiter + 1))
  const expected = statementWithDigest(
    { name: packageName, version: packageVersion, source },
    sha512 as string,
  )
  if (!Buffer.from(expected).equals(bytes)) Native.invalid("statement-source")
}
export const makeSigstoreAttester = (input: {
  readonly source: Model.ProvenanceSource
  readonly oidc: Http.OidcTokenSource
  readonly fulcioUrl: "https://fulcio.sigstore.dev"
  readonly rekorUrl: "https://rekor.sigstore.dev"
  readonly tufRootPath: string
  readonly tufCachePath: string
  readonly timeoutMilliseconds: number
}): Model.Attest => {
  const source = Native.own(Model.ProvenanceSource, input.source),
    oidc = input.oidc.bind(input),
    verify = makeSigstoreVerifier(input)
  const { fulcioUrl, rekorUrl, timeoutMilliseconds: timeout } = input
  if (fulcioUrl !== "https://fulcio.sigstore.dev" || rekorUrl !== "https://rekor.sigstore.dev")
    Native.invalid("sigstore-configuration")
  return Effect.fn("npm.sigstoreAttest")(function* (request) {
    const payload = new Uint8Array(request.payload)
    if (request.payloadType !== "application/vnd.in-toto+json")
      return yield* Native.reject("npm-attestation-type", "Unsupported attestation payload type")
    yield* Native.attempt(() => admitStatementSource(payload, source))
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
    const identityToken = yield* Native.attempt(() => {
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
      catch: () => Native.failure("npm-sigstore-sign", "Sigstore attestation outcome is unknown"),
    })
    const bundleBytes = Native.encode(bundle)
    yield* verify({ source, bundleBytes })
    return { bundleBytes }
  })
}
