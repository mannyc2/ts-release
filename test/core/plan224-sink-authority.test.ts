import { describe, expect, test } from "bun:test"
import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import {
  AnonymousAuthStrategy,
  CanonicalAudience,
  CredentialRef,
  CredentialRequest,
  ProviderId,
  SubjectId,
  TokenAuthStrategy
} from "../../src/model/authority.js"
import { NonEmptyName, Version } from "../../src/model/primitives.js"
import {
  makeCredentialProvider,
  makePublisherSink,
  type PublisherOperation,
  type ScopedSecret,
  type WorkloadIdentity
} from "../../src/publication/authority.js"
import type { HttpRequest, PublicationHttp } from "../../src/publication/http.js"
import { MutationPrecondition, NeedsMutation } from "../../src/publication/report.js"
import type { NpmPublisherSpec, WorkloadPublisherSpec } from "../../src/publication/publisher.js"
import { makeEnvironmentCredentialPlatform } from "../../src/platform/credentials.js"
import { CanonicalNpmRegistryEndpoint, NpmDistTag } from "../../src/recipes/config.js"
import { recordingSpawner } from "./host-doubles.js"

const subject = SubjectId.make("npm:@fixture/plan224-sinks@1.0.0")
const provider = ProviderId.make("npm")
const audience = CanonicalAudience.make("https://registry.npmjs.org/")
const wrongAudience = CanonicalAudience.make("https://registry.example.test/")
const ref = CredentialRef.make("PLAN224_SINK_TOKEN")
const publisherFields = {
  cwd: "/workspace",
  tarballPath: `/workspace/blobs/${"a".repeat(64)}`,
  packageName: NonEmptyName.make("@fixture/plan224-sinks"),
  version: Version.make("1.0.0"),
  registryUrl: CanonicalNpmRegistryEndpoint.make("https://registry.npmjs.org/"),
  distTag: NpmDistTag.make("latest"),
  access: "public",
  provenance: "required"
} as const
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

const requestFor = (purpose: "observe" | "publish" | "correct") => CredentialRequest.make({
  subject,
  provider,
  audience,
  purpose,
  strategy: TokenAuthStrategy.make({ kind: "token", credential: ref })
})

const anonymousRequest = CredentialRequest.make({
  subject,
  provider,
  audience,
  purpose: "observe",
  strategy: AnonymousAuthStrategy.make({ kind: "anonymous" })
})

const environment = {
  PATH: "/fixture/bin",
  PLAN224_SINK_TOKEN: "plan224-secret-value"
}

const withEnvironment = <A, E, R>(effect: Effect.Effect<A, E, R>) => effect.pipe(
  Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: environment })))
)

const asScopedSecret = <E, R>(
  effect: Effect.Effect<ScopedSecret | WorkloadIdentity, E, R>
): Effect.Effect<ScopedSecret, E, R> => effect.pipe(Effect.flatMap((grant) =>
  grant._tag === "ScopedSecret" ? Effect.succeed(grant) : Effect.die("Expected a scoped secret.")))

const correctionOnlyGrant = (): Promise<ScopedSecret> => {
  const credentials = makeCredentialProvider({
    acquire: () => Effect.succeed({
      _tag: "ScopedSecret",
      purposes: ["correct"],
      ref
    } as const)
  })
  return Effect.runPromise(asScopedSecret(credentials.acquireForMutation(requestFor("correct"), decision)))
}

describe("Plan 224 host sink authority", () => {
  test("token-only positions reject WorkloadIdentity at compile time", () => {
    const http: PublicationHttp = {
      request: () => Effect.succeed({ status: 200, headers: {}, body: "ok" })
    }
    const recorder = recordingSpawner(() => ({ exitCode: 0 }))
    const spawner = Effect.runSync(Effect.scoped(Layer.build(recorder.layer).pipe(
      Effect.map((context) => Context.get(context, ChildProcessSpawner))
    )))
    const platform = makeEnvironmentCredentialPlatform(http, spawner)
    const workload = undefined as unknown as WorkloadIdentity
    const npmInput = {
      operation: operation as Extract<PublisherOperation, { readonly _tag: "PublishOperation" }>,
      registryUrl: audience
    }
    const observationInput = { subject, method: "GET" as const, url: audience }

    if (false) {
      // @ts-expect-error WorkloadIdentity cannot enter NpmUserConfigResource.acquire.
      platform.npmUserConfigResource.acquire(npmInput, workload)
      // @ts-expect-error WorkloadIdentity cannot enter the observation HTTP sink.
      platform.httpAuthorizer.execute(observationInput, workload)
      const tokenSpec = undefined as unknown as NpmPublisherSpec
      const workloadSpec = undefined as unknown as WorkloadPublisherSpec
      // @ts-expect-error Certified token publishers never accept caller-authored argv.
      tokenSpec.argv
      // @ts-expect-error Certified workload publishers never accept caller-authored argv.
      workloadSpec.argv
    }
    expect(recorder.commands).toEqual([])
  })

  test("every host elimination sink rejects purpose or audience mismatch before side effects", async () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), "ts-release-plan224-sinks-"))
    try {
      const requests: Array<HttpRequest> = []
      const http: PublicationHttp = {
        request: (request) => Effect.sync(() => {
          requests.push(request)
          return { status: 200, headers: {}, body: "ok" }
        })
      }
      const recorder = recordingSpawner(() => ({ exitCode: 0 }))
      const spawner = Effect.runSync(Effect.scoped(Layer.build(recorder.layer).pipe(
        Effect.map((context) => Context.get(context, ChildProcessSpawner))
      )))
      const platform = makeEnvironmentCredentialPlatform(http, spawner, { temporaryRoot })
      const publishGrant = await Effect.runPromise(withEnvironment(asScopedSecret(
        platform.credentialProvider.acquireForMutation(requestFor("publish"), decision)
      )))
      const observeGrant = await Effect.runPromise(withEnvironment(
        platform.credentialProvider.acquireForObservation(anonymousRequest).pipe(
          Effect.flatMap((grant) => grant._tag === "AnonymousAccess"
            ? Effect.succeed(grant)
            : Effect.die("Expected anonymous access."))
        )
      ))
      const wrongPurposeGrant = await correctionOnlyGrant()

      await expect(Effect.runPromise(platform.httpAuthorizer.execute({
        subject,
        method: "GET",
        url: wrongAudience
      }, observeGrant))).rejects.toMatchObject({ _tag: "CredentialAudienceMismatch" })

      await expect(Effect.runPromise(platform.authorizedMutationHttp.execute(operation, {
        method: "POST",
        url: wrongAudience
      }, publishGrant))).rejects.toMatchObject({ _tag: "CredentialAudienceMismatch" })
      await expect(Effect.runPromise(platform.authorizedMutationHttp.execute(operation, {
        method: "POST",
        url: audience
      }, wrongPurposeGrant))).rejects.toMatchObject({ _tag: "CredentialPurposeMismatch" })

      const npmInput = {
        operation: operation as Extract<PublisherOperation, { readonly _tag: "PublishOperation" }>,
        registryUrl: wrongAudience
      }
      await expect(Effect.runPromise(withEnvironment(Effect.scoped(
        platform.npmUserConfigResource.acquire(npmInput, publishGrant)
      )))).rejects.toMatchObject({ _tag: "CredentialAudienceMismatch" })
      await expect(Effect.runPromise(withEnvironment(Effect.scoped(
        platform.npmUserConfigResource.acquire({ ...npmInput, registryUrl: audience }, wrongPurposeGrant)
      )))).rejects.toMatchObject({ _tag: "CredentialPurposeMismatch" })

      const workloadSpec = {
        _tag: "WorkloadPublisherSpec" as const,
        operation,
        ...publisherFields
      }
      await expect(Effect.runPromise(withEnvironment(platform.certifiedPublisherSpawn.spawn({
        ...workloadSpec,
        operation: { ...operation, audience: wrongAudience }
      }, publishGrant)))).rejects.toMatchObject({ _tag: "CredentialAudienceMismatch" })
      await expect(Effect.runPromise(withEnvironment(platform.certifiedPublisherSpawn.spawn(
        workloadSpec,
        wrongPurposeGrant
      )))).rejects.toMatchObject({ _tag: "CredentialPurposeMismatch" })

      let genericDispatches = 0
      const genericSink = makePublisherSink({
        dispatch: () => Effect.sync(() => { genericDispatches += 1 })
      })
      await expect(Effect.runPromise(genericSink.dispatch({
        ...operation,
        audience: wrongAudience
      }, publishGrant))).rejects.toMatchObject({ _tag: "CredentialAudienceMismatch" })
      await expect(Effect.runPromise(genericSink.dispatch(operation, wrongPurposeGrant)))
        .rejects.toMatchObject({ _tag: "CredentialPurposeMismatch" })

      expect(requests).toEqual([])
      expect(readdirSync(temporaryRoot)).toEqual([])
      expect(recorder.commands).toEqual([])
      expect(genericDispatches).toBe(0)
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true })
    }
  })
})
