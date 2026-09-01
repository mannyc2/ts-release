import { describe, expect, test } from "bun:test"
import { STSClient, type STSClientConfig } from "@aws-sdk/client-sts"
import * as Effect from "effect/Effect"
import { makeAwsS3JournalBoundary } from "../../src/operation-journal/aws.js"
import { acquireAwsJournalSession, type AwsJournalOidcRuntime } from "../../src/operation-journal/aws/oidc.js"
import { awsAuthority, makeOidcJwt } from "./aws-fixture.js"

interface WireRequest {
  readonly method: string
  readonly hostname: string
  readonly path: string
  readonly headers: Readonly<Record<string, string>>
  readonly body?: unknown
}

const xmlResponse = (body: string) => ({
  response: {
    statusCode: 200,
    headers: { "content-type": "text/xml" },
    body: new TextEncoder().encode(body)
  }
})

const oidcResponse = (url: string, body: string, contentLength = Buffer.byteLength(body)): Response => {
  const value = new Response(body, {
    status: 200,
    headers: {
      "content-length": String(contentLength),
      "content-type": "application/json; charset=utf-8"
    }
  })
  Object.defineProperty(value, "url", { configurable: true, value: url })
  return value
}

const makeStsFactory = (
  requests: Array<WireRequest>,
  expiration: Date
): ((config: STSClientConfig) => STSClient) => (config) => new STSClient({
  ...config,
  requestHandler: {
    handle: async (request: WireRequest) => {
      requests.push(request)
      const body = String(request.body ?? "")
      const sessionName = "ts-release-journal-42-1"
      const arn = `arn:aws:sts::123456789012:assumed-role/fixture-operation-journal/${sessionName}`
      if (body.includes("Action=AssumeRoleWithWebIdentity")) {
        return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<AssumeRoleWithWebIdentityResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/">
  <AssumeRoleWithWebIdentityResult>
    <AssumedRoleUser><Arn>${arn}</Arn><AssumedRoleId>AROAFIXTURE:${sessionName}</AssumedRoleId></AssumedRoleUser>
    <Credentials>
      <AccessKeyId>ASIATEMPORARY</AccessKeyId>
      <SecretAccessKey>temporary-secret</SecretAccessKey>
      <SessionToken>temporary-session</SessionToken>
      <Expiration>${expiration.toISOString()}</Expiration>
    </Credentials>
  </AssumeRoleWithWebIdentityResult>
  <ResponseMetadata><RequestId>request-assume</RequestId></ResponseMetadata>
</AssumeRoleWithWebIdentityResponse>`)
      }
      return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<GetCallerIdentityResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/">
  <GetCallerIdentityResult>
    <Arn>${arn}</Arn><UserId>AROAFIXTURE:${sessionName}</UserId><Account>123456789012</Account>
  </GetCallerIdentityResult>
  <ResponseMetadata><RequestId>request-identity</RequestId></ResponseMetadata>
</GetCallerIdentityResponse>`)
    }
  } as never
})

describe("GitHub OIDC AWS journal session", () => {
  test("rejects a malformed activation authority before OIDC or client construction", async () => {
    const malformed = [
      { ...awsAuthority, region: "https://attacker.invalid" },
      { ...awsAuthority, roleArn: `${awsAuthority.roleArn}/` },
      {
        ...awsAuthority,
        oidc: { ...awsAuthority.oidc, runId: "1".repeat(21) }
      }
    ]
    for (const authority of malformed) {
      await expect(Effect.runPromise(makeAwsS3JournalBoundary({
        authority,
        rolePolicyName: "OperationalJournal"
      }))).rejects.toMatchObject({
        operation: "observe-authority",
        reason: "AWS journal activation contract is malformed."
      })
    }
  })

  test("serializes one unsigned web-identity exchange then re-observes the signed caller", async () => {
    const now = new Date("2026-09-01T12:00:00.000Z")
    const jwt = makeOidcJwt(now)
    const requests: Array<WireRequest> = []
    const oidcRequests: Array<{ readonly url: string, readonly authorization: string | null }> = []
    const factory = makeStsFactory(requests, new Date(now.getTime() + 15 * 60_000))
    const environment: Record<string, string | undefined> = {
      ACTIONS_ID_TOKEN_REQUEST_URL: "https://pipelines.actions.githubusercontent.com/token?api-version=2.0",
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: "runner-request-secret"
    }
    const runtime: AwsJournalOidcRuntime = {
      environment,
      fileExists: () => false,
      fetch: (async (input, init) => {
        const headers = new Headers(init?.headers)
        oidcRequests.push({ url: String(input), authorization: headers.get("authorization") })
        expect(headers.get("accept")).toBe("application/json")
        expect(headers.get("accept-encoding")).toBe("identity")
        expect(environment.ACTIONS_ID_TOKEN_REQUEST_URL).toBeUndefined()
        expect(environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN).toBeUndefined()
        return oidcResponse(String(input), JSON.stringify({ value: jwt }))
      }) as typeof fetch,
      now: () => now,
      makeAnonymousSts: factory,
      makeSessionSts: factory
    }
    const session = await Effect.runPromise(acquireAwsJournalSession(awsAuthority, runtime))
    expect(oidcRequests).toEqual([{
      url: "https://pipelines.actions.githubusercontent.com/token?api-version=2.0&audience=sts.amazonaws.com",
      authorization: "bearer runner-request-secret"
    }])
    expect(requests).toHaveLength(2)
    const exchange = requests[0]!
    expect(exchange.method).toBe("POST")
    expect(exchange.hostname).toBe("sts.us-east-1.amazonaws.com")
    expect(exchange.headers.authorization).toBeUndefined()
    const exchangeBody = new URLSearchParams(String(exchange.body))
    expect(exchangeBody.get("Action")).toBe("AssumeRoleWithWebIdentity")
    expect(exchangeBody.get("RoleArn")).toBe(awsAuthority.roleArn)
    expect(exchangeBody.get("RoleSessionName")).toBe("ts-release-journal-42-1")
    expect(exchangeBody.get("DurationSeconds")).toBe("900")
    expect(exchangeBody.get("WebIdentityToken")).toBe(jwt)
    const identity = requests[1]!
    expect(identity.headers.authorization).toContain("Credential=ASIATEMPORARY/")
    expect(identity.headers["x-amz-security-token"]).toBe("temporary-session")
    expect(String(identity.body)).toContain("Action=GetCallerIdentity")
    expect(session.oidc).toEqual(awsAuthority.oidc)
    expect(session.callerArn).toBe("arn:aws:sts::123456789012:assumed-role/fixture-operation-journal/ts-release-journal-42-1")
    expect(Object.keys(session)).not.toContain("webIdentityToken")
    expect(environment.ACTIONS_ID_TOKEN_REQUEST_URL).toBeUndefined()
    expect(environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN).toBeUndefined()
  })

  test("rejects ambient AWS configuration before requesting an OIDC token", async () => {
    let fetched = false
    const runtime: AwsJournalOidcRuntime = {
      environment: {
        ACTIONS_ID_TOKEN_REQUEST_URL: "https://pipelines.actions.githubusercontent.com/token",
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: "runner-request-secret",
        AWS_PROFILE: "forbidden"
      },
      fileExists: () => false,
      fetch: (async () => {
        fetched = true
        throw new Error("must not fetch")
      }) as unknown as typeof fetch,
      now: () => new Date("2026-09-01T12:00:00.000Z"),
      makeAnonymousSts: () => { throw new Error("must not create STS") },
      makeSessionSts: () => { throw new Error("must not create STS") }
    }
    try {
      await Effect.runPromise(acquireAwsJournalSession(awsAuthority, runtime))
      throw new Error("Expected ambient AWS rejection")
    } catch (cause) {
      expect(cause).toMatchObject({ reason: expect.stringContaining("AWS_PROFILE") })
    }
    expect(fetched).toBe(false)
  })

  test("rejects shared AWS files and network/runtime injection before OIDC", async () => {
    for (const forbidden of ["NODE_OPTIONS", "NODE_EXTRA_CA_CERTS", "HTTPS_PROXY", "all_proxy"]) {
      let fetched = false
      const runtime: AwsJournalOidcRuntime = {
        environment: {
          ACTIONS_ID_TOKEN_REQUEST_URL: "https://pipelines.actions.githubusercontent.com/token",
          ACTIONS_ID_TOKEN_REQUEST_TOKEN: "runner-request-secret",
          [forbidden]: "forbidden"
        },
        fileExists: () => false,
        fetch: (async () => {
          fetched = true
          throw new Error("must not fetch")
        }) as unknown as typeof fetch,
        now: () => new Date("2026-09-01T12:00:00.000Z"),
        makeAnonymousSts: () => { throw new Error("must not create STS") },
        makeSessionSts: () => { throw new Error("must not create STS") }
      }
      await expect(Effect.runPromise(acquireAwsJournalSession(awsAuthority, runtime))).rejects.toMatchObject({
        reason: expect.stringContaining(forbidden)
      })
      expect(fetched).toBe(false)
    }

    const shared: AwsJournalOidcRuntime = {
      environment: {
        HOME: "/fixture/home",
        ACTIONS_ID_TOKEN_REQUEST_URL: "https://pipelines.actions.githubusercontent.com/token",
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: "runner-request-secret"
      },
      fileExists: (path) => path === "/fixture/home/.aws/credentials",
      fetch: (async () => { throw new Error("must not fetch") }) as unknown as typeof fetch,
      now: () => new Date("2026-09-01T12:00:00.000Z"),
      makeAnonymousSts: () => { throw new Error("must not create STS") },
      makeSessionSts: () => { throw new Error("must not create STS") }
    }
    await expect(Effect.runPromise(acquireAwsJournalSession(awsAuthority, shared))).rejects.toMatchObject({
      reason: expect.stringContaining("shared credential")
    })
  })

  test("bounds the exact OIDC endpoint and response before JWT decoding", async () => {
    const now = new Date("2026-09-01T12:00:00.000Z")
    const makeRuntime = (
      requestUrl: string,
      fetchImpl: typeof fetch
    ): AwsJournalOidcRuntime => ({
      environment: {
        ACTIONS_ID_TOKEN_REQUEST_URL: requestUrl,
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: "runner-request-secret"
      },
      fileExists: () => false,
      fetch: fetchImpl,
      now: () => now,
      makeAnonymousSts: () => { throw new Error("must not create STS") },
      makeSessionSts: () => { throw new Error("must not create STS") }
    })
    let fetched = false
    await expect(Effect.runPromise(acquireAwsJournalSession(awsAuthority, makeRuntime(
      "https://pipelines.actions.githubusercontent.com:444/token",
      (async () => {
        fetched = true
        throw new Error("must not fetch")
      }) as unknown as typeof fetch
    )))).rejects.toMatchObject({ reason: expect.stringContaining("endpoint") })
    expect(fetched).toBe(false)

    await expect(Effect.runPromise(acquireAwsJournalSession(awsAuthority, makeRuntime(
      "https://pipelines.actions.githubusercontent.com/token",
      (async (input) => oidcResponse(String(input), "{}", 20_000)) as typeof fetch
    )))).rejects.toMatchObject({ reason: expect.stringContaining("byte bound") })
  })

  test("consumes and rejects oversized or control-bearing OIDC request coordinates before fetch", async () => {
    const oidcOrigin = "https://pipelines.actions.githubusercontent.com/"
    const cases = [
      {
        name: "oversized URL",
        requestUrl: `https://pipelines.actions.githubusercontent.com/${"a".repeat(4_096)}`,
        requestToken: "runner-request-secret"
      },
      {
        name: "audience-expanded URL",
        requestUrl: `${oidcOrigin}${"a".repeat(4_096 - oidcOrigin.length)}`,
        requestToken: "runner-request-secret"
      },
      {
        name: "control-bearing URL",
        requestUrl: "https://pipelines.actions.githubusercontent.com/token\r\nInjected:true",
        requestToken: "runner-request-secret"
      },
      {
        name: "oversized token",
        requestUrl: "https://pipelines.actions.githubusercontent.com/token",
        requestToken: "a".repeat(8_193)
      },
      {
        name: "control-bearing token",
        requestUrl: "https://pipelines.actions.githubusercontent.com/token",
        requestToken: "runner\r\nInjected:true"
      }
    ] as const
    for (const fixture of cases) {
      let fetched = false
      const environment: Record<string, string | undefined> = {
        ACTIONS_ID_TOKEN_REQUEST_URL: fixture.requestUrl,
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: fixture.requestToken
      }
      const runtime: AwsJournalOidcRuntime = {
        environment,
        fileExists: () => false,
        fetch: (async () => {
          fetched = true
          throw new Error("must not fetch")
        }) as unknown as typeof fetch,
        now: () => new Date("2026-09-01T12:00:00.000Z"),
        makeAnonymousSts: () => { throw new Error("must not create STS") },
        makeSessionSts: () => { throw new Error("must not create STS") }
      }
      await expect(Effect.runPromise(acquireAwsJournalSession(awsAuthority, runtime)), fixture.name)
        .rejects.toMatchObject({ reason: expect.stringContaining("canonical bounds") })
      expect(fetched, fixture.name).toBe(false)
      expect(environment.ACTIONS_ID_TOKEN_REQUEST_URL, fixture.name).toBeUndefined()
      expect(environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN, fixture.name).toBeUndefined()
    }
  })

  test("rejects mismatched immutable subject IDs before OIDC", async () => {
    let fetched = false
    const subject = "repo:fixture@7654321/consumer@123456789:environment:certification"
    const runtime: AwsJournalOidcRuntime = {
      environment: {
        ACTIONS_ID_TOKEN_REQUEST_URL: "https://pipelines.actions.githubusercontent.com/token",
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: "runner-request-secret"
      },
      fileExists: () => false,
      fetch: (async () => {
        fetched = true
        throw new Error("must not fetch")
      }) as unknown as typeof fetch,
      now: () => new Date("2026-09-01T12:00:00.000Z"),
      makeAnonymousSts: () => { throw new Error("must not create STS") },
      makeSessionSts: () => { throw new Error("must not create STS") }
    }
    await expect(Effect.runPromise(acquireAwsJournalSession({
      ...awsAuthority,
      oidc: { ...awsAuthority.oidc, subject },
      oidcTrust: { ...awsAuthority.oidcTrust, subject }
    }, runtime))).rejects.toMatchObject({ reason: "AWS journal activation contract is malformed." })
    expect(fetched).toBe(false)
  })

  test("requires hosted dispatch, branch, and public-repository claims before STS", async () => {
    const now = new Date("2026-09-01T12:00:00.000Z")
    const hostileClaims = [
      ["event_name", "push"],
      ["event_name", undefined],
      ["ref_type", "tag"],
      ["ref_type", undefined],
      ["repository_visibility", "private"],
      ["repository_visibility", undefined],
      ["runner_environment", "self-hosted"],
      ["runner_environment", undefined]
    ] as const
    for (const [claim, value] of hostileClaims) {
      let madeSts = false
      const jwt = makeOidcJwt(now, awsAuthority.oidc, { [claim]: value })
      const runtime: AwsJournalOidcRuntime = {
        environment: {
          ACTIONS_ID_TOKEN_REQUEST_URL: "https://pipelines.actions.githubusercontent.com/token",
          ACTIONS_ID_TOKEN_REQUEST_TOKEN: "runner-request-secret"
        },
        fileExists: () => false,
        fetch: (async (input) => oidcResponse(String(input), JSON.stringify({ value: jwt }))) as typeof fetch,
        now: () => now,
        makeAnonymousSts: () => {
          madeSts = true
          throw new Error("must not create STS")
        },
        makeSessionSts: () => { throw new Error("must not create STS") }
      }
      await expect(Effect.runPromise(acquireAwsJournalSession(awsAuthority, runtime)), `${claim}=${String(value)}`)
        .rejects.toMatchObject({ operation: "observe-authority" })
      expect(madeSts, claim).toBe(false)
    }
  })

  test("aborts and returns when an AWS SDK send never settles", async () => {
    const now = new Date("2026-09-01T12:00:00.000Z")
    const jwt = makeOidcJwt(now)
    let signal: AbortSignal | undefined
    const hanging = {
      send: (_command: unknown, options?: { readonly abortSignal?: AbortSignal }) => {
        signal = options?.abortSignal
        return new Promise<never>(() => undefined)
      }
    } as unknown as STSClient
    const runtime: AwsJournalOidcRuntime = {
      environment: {
        ACTIONS_ID_TOKEN_REQUEST_URL: "https://pipelines.actions.githubusercontent.com/token",
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: "runner-request-secret"
      },
      fileExists: () => false,
      fetch: (async (input) => oidcResponse(String(input), JSON.stringify({ value: jwt }))) as typeof fetch,
      now: () => now,
      makeAnonymousSts: () => hanging,
      makeSessionSts: () => { throw new Error("must not create authenticated STS") },
      networkDeadlineMilliseconds: 10
    }
    await expect(Effect.runPromise(acquireAwsJournalSession(awsAuthority, runtime))).rejects.toMatchObject({
      reason: "GitHub OIDC to AWS STS journal authentication failed."
    })
    expect(signal?.aborted).toBe(true)
  })

  test("rejects a mutable called-workflow ref before any AWS exchange", async () => {
    const now = new Date("2026-09-01T12:00:00.000Z")
    const jwt = makeOidcJwt(now, {
      ...awsAuthority.oidc,
      jobWorkflowRef: "fixture/owner/.github/workflows/journal.yml@refs/heads/main"
    })
    let madeSts = false
    const runtime: AwsJournalOidcRuntime = {
      environment: {
        ACTIONS_ID_TOKEN_REQUEST_URL: "https://pipelines.actions.githubusercontent.com/token",
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: "runner-request-secret"
      },
      fileExists: () => false,
      fetch: (async (input) => oidcResponse(String(input), JSON.stringify({ value: jwt }))) as typeof fetch,
      now: () => now,
      makeAnonymousSts: () => {
        madeSts = true
        throw new Error("must not create STS")
      },
      makeSessionSts: () => { throw new Error("must not create STS") }
    }
    await expect(Effect.runPromise(acquireAwsJournalSession(awsAuthority, runtime))).rejects.toMatchObject({
      reason: expect.stringContaining("not pinned")
    })
    expect(madeSts).toBe(false)
  })

  test("stops on claim drift without retaining either bearer token", async () => {
    const now = new Date("2026-09-01T12:00:00.000Z")
    const jwt = makeOidcJwt(now, { ...awsAuthority.oidc, repository: "fixture/wrong" })
    const runtime: AwsJournalOidcRuntime = {
      environment: {
        ACTIONS_ID_TOKEN_REQUEST_URL: "https://pipelines.actions.githubusercontent.com/token",
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: "runner-request-secret"
      },
      fileExists: () => false,
      fetch: (async (input) => oidcResponse(String(input), JSON.stringify({ value: jwt }))) as typeof fetch,
      now: () => now,
      makeAnonymousSts: () => { throw new Error("must not create STS") },
      makeSessionSts: () => { throw new Error("must not create STS") }
    }
    try {
      await Effect.runPromise(acquireAwsJournalSession(awsAuthority, runtime))
      throw new Error("Expected claim drift failure")
    } catch (cause) {
      const rendered = JSON.stringify(cause)
      expect(cause).toMatchObject({ reason: expect.stringContaining("claims drifted") })
      expect(rendered).not.toContain(jwt)
      expect(rendered).not.toContain("runner-request-secret")
    }
  })
})
