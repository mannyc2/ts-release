import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import {
  AnonymousAuthStrategy,
  CanonicalAudience,
  CredentialRef,
  CredentialRequest,
  EnvironmentName,
  ProviderId,
  SubjectId,
  TokenAuthStrategy,
  TrustedPublishingAuthStrategy,
  TrustedPublishingSourceCommit
} from "../../src/model/authority.js"
import { NonEmptyName } from "../../src/model/primitives.js"
import {
  CredentialPurposeMismatch,
  CredentialStrategyUnsupported,
  CredentialSubjectMismatch,
  makeCredentialProvider,
  makePublisherSink,
  validateGrantForOperation,
  type CredentialGrant,
  type MutationCredentialGrant,
  type PublisherOperation,
  type WorkloadIdentity
} from "../../src/publication/authority.js"
import {
  MutationPrecondition,
  NeedsMutation
} from "../../src/publication/report.js"

const subject = SubjectId.make("npm:@fixture/pkg@1.0.0")
const otherSubject = SubjectId.make("npm:@fixture/other@1.0.0")
const provider = ProviderId.make("npm")
const audience = CanonicalAudience.make("https://registry.npmjs.org/")
const ref = CredentialRef.make("NPM_TOKEN")
const decision = NeedsMutation.make({
  subject,
  precondition: MutationPrecondition.make({ kind: NonEmptyName.make("version-absent") })
})

const tokenRequest = (purpose: "observe" | "publish" | "correct" = "publish") =>
  CredentialRequest.make({
    subject,
    provider,
    audience,
    purpose,
    strategy: TokenAuthStrategy.make({ kind: "token", credential: ref })
  })

describe("opaque mutation authority", () => {
  test("acquires a subject-scoped grant only after a matching mutation decision", async () => {
    const requests: Array<CredentialRequest> = []
    const credentials = makeCredentialProvider({
      acquire: (request) => Effect.sync(() => {
        requests.push(request)
        return { _tag: "ScopedSecret" as const, purposes: ["publish"] as const, ref }
      })
    })

    await expect(Effect.runPromise(credentials.acquireForMutation(
      tokenRequest(),
      NeedsMutation.make({
        subject: otherSubject,
        precondition: MutationPrecondition.make({ kind: NonEmptyName.make("version-absent") })
      })
    ))).rejects.toBeInstanceOf(CredentialSubjectMismatch)
    expect(requests).toHaveLength(0)

    const grant = await Effect.runPromise(credentials.acquireForMutation(tokenRequest(), decision))
    expect(grant).toMatchObject({
      _tag: "ScopedSecret",
      subject,
      provider,
      audience,
      ref
    })
    expect(grant.purposes).toEqual(new Set(["publish"]))
    expect(requests).toHaveLength(1)
  })

  test("keeps raw secret access out of every grant variant", async () => {
    const credentials = makeCredentialProvider({
      acquire: () => Effect.succeed({ _tag: "ScopedSecret", purposes: ["publish"], ref } as const)
    })
    const grant = await Effect.runPromise(credentials.acquireForMutation(tokenRequest(), decision))
    expect("value" in grant).toBe(false)
    expect("useSecret" in grant).toBe(false)
    expect(JSON.stringify(grant)).not.toContain("secret")
  })

  test("validates exact credential refs and purpose membership before minting", async () => {
    const wrongRef = makeCredentialProvider({
      acquire: () => Effect.succeed({
        _tag: "ScopedSecret",
        purposes: ["publish"],
        ref: CredentialRef.make("OTHER_TOKEN")
      } as const)
    })
    await expect(Effect.runPromise(wrongRef.acquireForMutation(tokenRequest(), decision)))
      .rejects.toBeInstanceOf(CredentialStrategyUnsupported)

    const wrongPurpose = makeCredentialProvider({
      acquire: () => Effect.succeed({ _tag: "ScopedSecret", purposes: ["observe"], ref } as const)
    })
    await expect(Effect.runPromise(wrongPurpose.acquireForMutation(tokenRequest(), decision)))
      .rejects.toBeInstanceOf(CredentialPurposeMismatch)
  })

  test("anonymous access is observe-only and workload identity retains safe prepared sink intent", async () => {
    const anonymousRequest = CredentialRequest.make({
      subject,
      provider,
      audience,
      purpose: "observe",
      strategy: AnonymousAuthStrategy.make({ kind: "anonymous" })
    })
    const anonymous = makeCredentialProvider({
      acquire: () => Effect.succeed({ _tag: "AnonymousAccess", purposes: ["observe"] } as const)
    })
    const readGrant = await Effect.runPromise(anonymous.acquireForObservation(anonymousRequest))
    expect(readGrant).toMatchObject({ _tag: "AnonymousAccess" })

    const names = [
      EnvironmentName.make("ACTIONS_ID_TOKEN_REQUEST_URL"),
      EnvironmentName.make("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
    ] as const
    const trustedRequest = CredentialRequest.make({
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
    const trusted = makeCredentialProvider({
      acquire: () => Effect.succeed({ _tag: "WorkloadIdentity", purposes: ["publish"], names } as const)
    })
    const identity = await Effect.runPromise(trusted.acquireForMutation(trustedRequest, decision))
    expect(identity).toMatchObject({ _tag: "WorkloadIdentity" })
    expect(identity._tag === "WorkloadIdentity" ? identity.names : undefined).toEqual(new Set(names))
    expect(identity._tag === "WorkloadIdentity" ? identity.strategy : undefined).toMatchObject({
      repository: "owner/repository",
      workflow: ".github/workflows/release.yml",
      workflowRef: "refs/heads/main",
      sourceCommit: TrustedPublishingSourceCommit.make("c".repeat(40)),
      provenanceEnvironmentContract: "github-actions-npm-provenance-v1",
      allowedAction: "npm-publish-direct",
      publisherSink: "certified-npm-cli"
    })
    expect("value" in identity).toBe(false)
  })

  test("the host-owned publisher sink rechecks audience and purpose before dispatch", async () => {
    let dispatches = 0
    const credentials = makeCredentialProvider({
      acquire: () => Effect.succeed({ _tag: "ScopedSecret", purposes: ["publish"], ref } as const)
    })
    const grant = await Effect.runPromise(credentials.acquireForMutation(tokenRequest(), decision))
    const sink = makePublisherSink({
      dispatch: () => Effect.sync(() => { dispatches += 1 })
    })
    const operation: PublisherOperation = {
      _tag: "PublishOperation",
      subject,
      provider,
      audience,
      purpose: "publish",
      decision
    }
    await Effect.runPromise(sink.dispatch(operation, grant))
    expect(dispatches).toBe(1)

    await expect(Effect.runPromise(sink.dispatch({
      ...operation,
      audience: CanonicalAudience.make("https://registry.example.test/")
    }, grant))).rejects.toMatchObject({ _tag: "CredentialAudienceMismatch" })
    expect(dispatches).toBe(1)
  })

  test("a structurally forged grant is rejected by private issuance metadata", async () => {
    const forged = {
      _tag: "ScopedSecret",
      subject,
      provider,
      audience,
      purposes: new Set(["publish"]),
      ref
    } as unknown as MutationCredentialGrant
    await expect(Effect.runPromise(validateGrantForOperation({
      _tag: "PublishOperation",
      subject,
      provider,
      audience,
      purpose: "publish",
      decision
    }, forged))).rejects.toMatchObject({ _tag: "CredentialUnavailable" })
  })

  test("grant variants cannot be interchanged with incompatible sinks at type level", () => {
    const tokenOnly = (_grant: Extract<MutationCredentialGrant, { readonly _tag: "ScopedSecret" }>) => undefined
    const genericCommand = (_argv: ReadonlyArray<string>) => undefined
    const identity = undefined as unknown as WorkloadIdentity
    const anyGrant = undefined as unknown as CredentialGrant

    if (false) {
      // @ts-expect-error Workload identity is not accepted by a token-only sink.
      tokenOnly(identity)
      // @ts-expect-error Generic preparation commands accept no authority grant.
      genericCommand(["build"], anyGrant)
    }
    expect(true).toBe(true)
  })
})
