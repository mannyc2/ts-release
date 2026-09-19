import type { TrustedPublisherHost } from "@mannyc1/ts-release/http"
import { expect, test } from "bun:test"
import { Effect, Redacted } from "effect"
import { Bundle, type ArtifactAccess } from "@mannyc1/ts-release/bundle"
import { ReleaseError, loadPlan, createPlan, type ProviderContext } from "@mannyc1/ts-release"
import {
  authorizeToken,
  authorizeTrusted,
  makeSigstoreAttester,
  createProvenance,
  TrustedAuthorization,
  ProvenanceSource,
  GitHubActionsProvenance,
  PublishIntent,
  publish,
  definitions,
  inspectTarball,
} from "../../../packages/npm/src/index.js"
import { scopeFor, readScope, endpointFor, encode } from "../../../packages/npm/src/Native.js"
import { statement, validateProvenance } from "../../../packages/npm/src/Auth.js"
import { artifact, accessFor, pack } from "./fixtures.js"

const source = () =>
  new ProvenanceSource({
    format: "npm-github-actions-provenance-source/v1",
    serverUrl: "https://github.com",
    repository: "fixture/package",
    workflow: ".github/workflows/release.yml",
    workflowRef: "refs/heads/main",
    sourceRef: "refs/heads/main",
    sourceCommit: "a".repeat(40),
    eventName: "workflow_dispatch",
    repositoryId: "1",
    repositoryOwnerId: "2",
    runnerEnvironment: "github-hosted",
    runId: "3",
    runAttempt: "1",
    repositoryVisibility: "public",
  })
const trusted = () =>
  new TrustedAuthorization({
    principal: "fixture-publisher",
    repository: "fixture/package",
    workflow: ".github/workflows/release.yml",
    workflowRef: "refs/heads/main",
    issuer: "https://token.actions.githubusercontent.com",
    audience: "npm:registry.npmjs.org",
  })
// Structural witness only: these bytes deliberately have no signature trust.
const structuralBundle = (payload: Uint8Array) =>
  encode({
    mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json",
    dsseEnvelope: {
      payloadType: "application/vnd.in-toto+json",
      payload: Buffer.from(payload).toString("base64"),
      signatures: [{ sig: "AA==" }],
    },
    verificationMaterial: {
      certificate: { rawBytes: "AA==" },
      tlogEntries: [
        {
          canonicalizedBody: "AA==",
          logId: { keyId: "AA==" },
          integratedTime: "1",
          logIndex: "0",
          kindVersion: { kind: "dsse", version: "0.0.1" },
          inclusionProof: {
            logIndex: "0",
            treeSize: "1",
            hashes: [],
            rootHash: Buffer.alloc(32).toString("base64"),
            checkpoint: {
              envelope: `untrusted-fixture\n1\n${Buffer.alloc(32).toString("base64")}\n\n`,
            },
          },
        },
      ],
    },
  })
const fixture = () => {
  const bytes = pack({ name: "@fixture/example", version: "1.2.3" })
  const f = accessFor(bytes)
  const payload = statement({ ...f.publication, source: source() }, bytes),
    provenance = structuralBundle(payload)
  const provenanceFile = artifact("provenance.sigstore", provenance)
  const publication = new PublishIntent({
    ...f.publication,
    authorization: trusted(),
    provenance: new GitHubActionsProvenance({
      source: source(),
      bundle: provenanceFile,
      mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json",
    }),
  })
  const access: ArtifactAccess = {
    bundle: new Bundle({
      format: "ts-release/bundle/2",
      artifacts: [publication.tarball, provenanceFile],
    }),
    readContent: (content) =>
      Effect.succeed(content.sha256 === provenanceFile.content.sha256 ? provenance : bytes),
  }
  const scope = scopeFor(publication)
  return {
    ...f,
    bytes,
    publication,
    access,
    payload,
    provenance,
    binding: {
      endpoint: endpointFor(readScope(scope)),
      principal: publication.authorization.principal,
      scope,
    },
  }
}

test("token authorization binds exact origin, scope and authorization mode before unwrapping", async () => {
  const f = accessFor(pack({ name: "@fixture/example", version: "1.2.3" }))
  const scope = scopeFor(f.publication),
    binding = {
      endpoint: endpointFor(readScope(scope)),
      principal: f.publication.authorization.principal,
      scope,
    }
  if (f.publication.authorization._tag !== "TokenAuthorization") throw new Error("token fixture")
  expect(
    await Effect.runPromise(
      authorizeToken({
        authorization: f.publication.authorization,
        binding,
        token: Redacted.make("test-token"),
      }),
    ),
  ).toEqual({ authorization: "Bearer test-token" })
  for (const changed of [
    { ...binding, endpoint: "https://evil.invalid" },
    { ...binding, principal: "different" },
    { ...binding, scope: binding.scope + " " },
  ])
    await expect(
      Effect.runPromise(
        authorizeToken({
          authorization: f.publication.authorization,
          binding: changed,
          token: Redacted.make("test-token"),
        }),
      ),
    ).rejects.toThrow()
  await expect(
    Effect.runPromise(
      authorizeToken({
        authorization: f.publication.authorization,
        binding,
        token: Redacted.make(""),
      }),
    ),
  ).rejects.toThrow()
})

test("trusted npm exchange captures package and methods before OIDC and validates lifetime", async () => {
  const f = fixture(),
    selected = { authorization: trusted(), packageName: f.publication.name, binding: f.binding }
  let calls = 0
  const host: { -readonly [K in keyof TrustedPublisherHost]: TrustedPublisherHost[K] } = {
    oidc: (request: unknown) =>
      Effect.sync(() => {
        expect(request).toEqual({
          issuer: trusted().issuer,
          audience: trusted().audience,
          repository: trusted().repository,
          workflow: trusted().workflow,
          workflowRef: trusted().workflowRef,
          expectedClaims: {},
        })
        selected.packageName = "wrong-package"
        host.exchange = () =>
          Effect.fail(new ReleaseError({ code: "replaced", message: "method replaced" }))
        return Redacted.make("identity-token")
      }),
    exchange: (request: {
      url: string
      headers: Readonly<Record<string, string>>
      body: Uint8Array
    }) =>
      Effect.sync(() => {
        calls++
        expect(request.url).toBe(
          "https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/%40fixture%2Fexample",
        )
        expect(request.headers).toEqual({ authorization: "Bearer identity-token" })
        const now = Date.now()
        return {
          status: 201,
          headers: {},
          body: encode({
            token_type: "oidc",
            token: "registry-token",
            created: new Date(now - 1000).toISOString(),
            expires: new Date(now + 60000).toISOString(),
          }),
        }
      }),
  }
  expect(await Effect.runPromise(authorizeTrusted(selected, host))).toEqual({
    authorization: "Bearer registry-token",
  })
  expect(calls).toBe(1)
  for (const status of [200, 400, 500])
    await expect(
      Effect.runPromise(
        authorizeTrusted(
          { ...selected, packageName: f.publication.name },
          {
            oidc: () => Effect.succeed(Redacted.make("identity-token")),
            exchange: () =>
              Effect.succeed({ status, headers: {}, body: encode({ secret: "not-retained" }) }),
          },
        ),
      ),
    ).rejects.toThrow("exchange was not accepted")
  await expect(
    Effect.runPromise(
      authorizeTrusted(
        { ...selected, packageName: f.publication.name },
        {
          oidc: () => Effect.succeed(Redacted.make("identity-token")),
          exchange: () =>
            Effect.succeed({
              status: 201,
              headers: {},
              body: encode({
                token_type: "oidc",
                token: "expired-token",
                created: "2000-01-01T00:00:00Z",
                expires: "2000-01-02T00:00:00Z",
              }),
            }),
        },
      ),
    ),
  ).rejects.toThrow("lifetime")
})

test("provenance creation owns exact statement bytes and rejects callback payload substitution", async () => {
  const f = fixture()
  const input = {
    authorize: true as const,
    name: f.publication.name,
    version: f.publication.version,
    tarball: f.publication.tarball,
    source: source(),
  }
  const created = await Effect.runPromise(
    createProvenance(input, {
      ...f.access,
      attest: ({ payload }) => Effect.succeed({ bundleBytes: structuralBundle(payload) }),
    }),
  )
  expect(created.bytes).toEqual(f.provenance)
  await expect(
    Effect.runPromise(
      createProvenance(input, {
        ...f.access,
        attest: ({ payload }) =>
          Effect.sync(() => {
            payload[0] = 0
            return { bundleBytes: structuralBundle(payload) }
          }),
      }),
    ),
  ).rejects.toThrow()
  const changed = encode(JSON.parse(new TextDecoder().decode(f.provenance)))
  expect(() => validateProvenance(changed, encode({ different: true }))).toThrow()
  const metadata = await Effect.runPromise(inspectTarball(f.publication.tarball, f.access))
  expect(metadata).toEqual({
    name: f.publication.name,
    version: f.publication.version,
    private: false,
    integrity: f.publication.integrity,
    shasum: f.publication.shasum,
  })
})

test("loaded structural provenance needs an explicit native trust verifier before any registry read", async () => {
  const f = fixture(),
    operation = await Effect.runPromise(publish(f.publication)),
    plan = await Effect.runPromise(createPlan("bundle-fixture", [operation]))
  let reads = 0,
    verified = 0
  const read = () =>
    Effect.sync(() => {
      reads++
      return { status: 404, headers: {}, body: encode({}) }
    })
  const absent = definitions({ ...f.access, read })
  await expect(Effect.runPromise(loadPlan(plan, absent))).rejects.toThrow()
  const context: ProviderContext = {
    own: { operation, receipts: [], observations: [] },
    dependencies: [],
  }
  const rejecting = definitions({
    ...f.access,
    read,
    verifyProvenance: () =>
      Effect.gen(function* () {
        verified++
        return yield* new ReleaseError({
          code: "untrusted",
          message: "Native signature is invalid",
        })
      }),
  })
  await expect(Effect.runPromise(rejecting[0]!.observe!(operation, context))).rejects.toThrow(
    "signature",
  )
  expect(verified).toBe(1)
  expect(reads).toBe(0)
  // Positive port conformance is deliberately not a native cryptographic witness.
  const accepting = definitions({
    ...f.access,
    read,
    verifyProvenance: ({ source: actualSource, bundleBytes }) =>
      Effect.sync(() => {
        expect(actualSource).toEqual(source())
        expect(bundleBytes).toEqual(f.provenance)
        bundleBytes[0] = 0
      }),
  })
  const prepared = await Effect.runPromise(accepting[0]!.prepare(operation, context))
  expect(accepting[0]!.ownsRequest(prepared)).toBe(true)
})

test("Sigstore rejects unrelated source and empty identity without reaching ambient signing", async () => {
  const f = fixture()
  let oidcCalls = 0
  const attest = makeSigstoreAttester({
    source: source(),
    fulcioUrl: "https://fulcio.sigstore.dev",
    rekorUrl: "https://rekor.sigstore.dev",
    tufRootPath: "/tmp/not-used-root.json",
    tufCachePath: "/tmp/not-used-cache",
    timeoutMilliseconds: 1,
    oidc: (request) =>
      Effect.sync(() => {
        oidcCalls++
        expect(request.expectedClaims).toEqual({
          sha: source().sourceCommit,
          ref: source().sourceRef,
          repository_id: "1",
          repository_owner_id: "2",
          repository_visibility: "public",
          runner_environment: "github-hosted",
          run_id: "3",
          run_attempt: "1",
          event_name: "workflow_dispatch",
        })
        return Redacted.make("")
      }),
  })
  await expect(
    Effect.runPromise(
      attest({ payloadType: "application/vnd.in-toto+json", payload: encode({ unrelated: true }) }),
    ),
  ).rejects.toThrow()
  expect(oidcCalls).toBe(0)
  const otherSource = new ProvenanceSource({ ...source(), runId: "999" })
  await expect(
    Effect.runPromise(
      attest({
        payloadType: "application/vnd.in-toto+json",
        payload: statement({ ...f.publication, source: otherSource }, f.bytes),
      }),
    ),
  ).rejects.toThrow("source")
  expect(oidcCalls).toBe(0)
  await expect(
    Effect.runPromise(attest({ payloadType: "application/vnd.in-toto+json", payload: f.payload })),
  ).rejects.toThrow("credential token")
  expect(oidcCalls).toBe(1)
})
