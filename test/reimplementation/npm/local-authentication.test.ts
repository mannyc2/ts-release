import { fail } from "node:assert"
import { expect, onTestFinished, test } from "bun:test"
import { Schema, Effect, Fiber, Redacted, Cause, Exit, Result } from "effect"
import { TestClock } from "effect/testing"
import {
  Host,
  createPlan,
  runRelease,
  type PreparedRequest,
  type Transport,
} from "@mannyc1/ts-release"
import type { HttpResponse, HttpProviderDefinition } from "@mannyc1/ts-release/http"
import {
  definitions,
  publish,
  authenticationChallenge,
  authorizationBinding,
} from "../../../packages/npm/src/index.js"
import { makeLocalAuthenticationWith } from "../../../packages/npm/src/LocalAuthentication.js"
import { MemoryJournal } from "../kernel/fixtures.js"
import { accessFor, pack } from "./fixtures.js"

const loginToken = "npm-fixture-login-secret"
const otp = "fixture-browser-otp-secret"
const authUrl = "https://www.npmjs.com/auth/cli/fixture-secret-challenge"
const doneUrl = "https://registry.npmjs.org/-/v1/done/fixture-secret-poll"
const response = (
  status: number,
  value: unknown = {},
  headers: Record<string, string> = {},
): HttpResponse => ({ status, headers, body: Buffer.from(JSON.stringify(value)) })
const challenge = () => response(401, { authUrl, doneUrl }, { "www-authenticate": "OTP" })
const fixture = async () => {
  const f = accessFor(pack({ name: "@fixture/example", version: "1.2.3" }))
  if (f.publication.authorization._tag !== "TokenAuthorization") throw new Error("token fixture")
  const operation = await Effect.runPromise(publish(f.publication))
  const providers = definitions({ ...f.access, read: () => Effect.succeed(response(404)) })
  const request = await Effect.runPromise(
    (providers[0] ?? fail("Missing fixture providers[0]")).prepare(operation, {
      own: { operation, receipts: [], observations: [] },
      dependencies: [],
    }),
  )
  return { ...f, authorization: f.publication.authorization, operation, providers, request }
}
const config = `//registry.npmjs.org/:_authToken=${loginToken}\n`

test("only the exact native OTP rejection is admitted, independently of ephemeral browser URLs", async () => {
  const f = await fixture(),
    provider = f.providers[0] ?? fail("Missing fixture f.providers[0]")
  const rejected = await Effect.runPromise(provider.decodeResponse(f.request, challenge()))
  expect(rejected._tag).toBe("RejectedBeforeCommit")
  if (rejected._tag !== "RejectedBeforeCommit") throw new Error("rejection fixture")
  expect(
    (provider.rejection ?? fail("Missing fixture provider.rejection")).corresponds(
      f.operation,
      f.request.facts,
      rejected.proof,
    ),
  ).toBe(true)
  expect(
    (provider.rejection ?? fail("Missing fixture provider.rejection")).corresponds(
      f.operation,
      { ...f.request.facts, bodyDigest: "0".repeat(64) },
      rejected.proof,
    ),
  ).toBe(false)
  expect(JSON.stringify(rejected.proof)).not.toContain("fixture-secret")
  for (const value of [
    response(401, { error: "one-time password required", authUrl, doneUrl }),
    response(401, {}, { "www-authenticate": "OTP, Bearer" }),
    response(401, {}, { "www-authenticate": "OTP\r\n" }),
    response(401, {}, { "www-authenticate": "OTP", "WWW-Authenticate": "OTP" }),
    response(403, {}, { "www-authenticate": "OTP" }),
    response(500, {}, { "www-authenticate": "OTP" }),
  ]) {
    expect((await Effect.runPromise(provider.decodeResponse(f.request, value)))._tag).toBe(
      "Unknown",
    )
    expect(authenticationChallenge(f.request, value)).toBeUndefined()
  }
  expect(authenticationChallenge(f.request, challenge())).toBeDefined()
  for (const fields of [
    { authUrl: "http://www.npmjs.com/auth/cli/fixture", doneUrl },
    { authUrl: "https://www.npmjs.com.evil.invalid/auth", doneUrl },
    { authUrl, doneUrl: "https://registry.npmjs.org.evil.invalid/done" },
    { authUrl, doneUrl: "https://name:password@registry.npmjs.org/done" },
    { authUrl, doneUrl: doneUrl + "#fragment" },
  ])
    expect(
      authenticationChallenge(f.request, response(401, fields, { "www-authenticate": "OTP" })),
    ).toBeUndefined()
  expect(
    authenticationChallenge({ ...f.request, body: new Uint8Array() }, challenge()),
  ).toBeUndefined()
  const owned = await Effect.runPromise(authorizationBinding(f.request.facts))
  expect(owned).toEqual({ authorization: f.authorization, packageName: f.publication.name })
  expect(
    Effect.runPromise(authorizationBinding({ ...f.request.facts, principal: "foreign" })),
  ).rejects.toThrow()
})

for (const lostResponse of [false, true])
  test(`browser authentication preserves journal authority and exact write binding (lost response: ${lostResponse})`, async () => {
    const f = await fixture(),
      store = new MemoryJournal()
    const plan = await Effect.runPromise(
      createPlan("browser-authentication-fixture", [f.operation]),
    )
    let sends = 0,
      polls = 0,
      visible = false,
      finishing = false
    const notices: string[] = []
    const root = Effect.runFork(
      Effect.scoped(
        Effect.gen(function* () {
          const session = yield* makeLocalAuthenticationWith(
            {
              authorization: f.authorization,
              configFile: "/fixture/explicit.npmrc",
              notify: (url) =>
                Effect.sync(() => {
                  notices.push(Redacted.value(url))
                }),
              timeoutMilliseconds: 5000,
            },
            {
              readConfig: () => Effect.succeed(config),
              read: () => (request) =>
                Effect.sync(() => {
                  polls++
                  expect(request.url).toBe(doneUrl)
                  expect(request.method).toBe("GET")
                  expect(request.headers).toEqual([])
                  return polls === 1
                    ? response(202, {}, { "retry-after": "1" })
                    : response(200, { token: otp })
                }),
            },
          )
          const providers: readonly HttpProviderDefinition[] = definitions({
            ...f.access,
            read: () =>
              Effect.succeed(
                visible
                  ? response(200, {
                      name: f.publication.name,
                      versions: {
                        [f.publication.version]: {
                          name: f.publication.name,
                          version: f.publication.version,
                          dist: {
                            integrity: f.publication.integrity,
                            shasum: f.publication.shasum,
                          },
                        },
                      },
                      "dist-tags": { latest: f.publication.version },
                    })
                  : response(404),
              ),
          })
          const transport: Transport = {
            send: () => Effect.die("only the prepared core dispatch may send"),
            prepare: (request) =>
              Effect.gen(function* () {
                const headers = yield* session.credentials(request.facts)
                expect(headers.authorization).toBe(`Bearer ${loginToken}`)
                expect(headers["npm-auth-type"]).toBe("web")
                return (actual: PreparedRequest) =>
                  Effect.gen(function* () {
                    sends++
                    if (sends === 1) {
                      expect(headers["npm-otp"]).toBeUndefined()
                      const native = challenge()
                      session.capture(actual, native)
                      return yield* (
                        providers[0] ?? fail("Missing fixture providers[0]")
                      ).decodeResponse(actual, native)
                    }
                    expect(headers["npm-otp"]).toBe(otp)
                    if (lostResponse)
                      return { _tag: "Unknown" as const, reason: "authenticated response was lost" }
                    visible = true
                    return yield* (
                      providers[0] ?? fail("Missing fixture providers[0]")
                    ).decodeResponse(actual, response(201))
                  })
              }),
          }
          const run = () =>
            runRelease({ plan, authorize: true }).pipe(
              Effect.provideService(Host, {
                providers,
                store,
                transport,
                now: Date.now,
                uniqueId: () => crypto.randomUUID(),
              }),
            )
          const rejected = yield* run()
          expect(
            (rejected.operations[0] ?? fail("Missing fixture rejected.operations[0]")).status,
          ).toBe("Rejected")
          expect(sends).toBe(1)
          expect(
            (yield* store.read(plan.journalId)).events.some(
              (event) => event.body._tag === "DispatchRejectedBeforeCommit",
            ),
          ).toBe(true)
          expect(
            yield* session.complete({
              ...f.operation,
              intent: {
                ...(yield* Schema.decodeUnknownEffect(Schema.Record(Schema.String, Schema.Unknown))(
                  f.operation.intent,
                )),
                name: "different",
              },
            }),
          ).toBe(false)
          const completion = yield* Effect.forkChild(session.complete(f.operation))
          yield* TestClock.adjust(1000)
          expect(yield* Fiber.join(completion)).toBe(true)
          expect(sends).toBe(1)
          // Reads on the same origin/scope do not consume or receive the OTP or login token.
          for (const method of ["GET", "HEAD"])
            expect(yield* session.credentials({ ...f.request.facts, method })).toEqual({})
          expect(
            (yield* session.credentials({ ...f.request.facts, bodyDigest: "0".repeat(64) }))[
              "npm-otp"
            ],
          ).toBeUndefined()
          const published = yield* run()
          expect(
            (published.operations[0] ?? fail("Missing fixture published.operations[0]")).status,
          ).toBe(lostResponse ? "Inconclusive" : "Satisfied")
          expect(sends).toBe(2)
          expect(yield* session.complete(f.operation)).toBe(false)
          expect((yield* session.credentials(f.request.facts))["npm-otp"]).toBeUndefined()
          if (lostResponse) {
            expect(
              ((yield* run()).operations[0] ?? fail("Missing fixture (yield* run()).operations[0]"))
                .status,
            ).toBe("Inconclusive")
            expect(sends).toBe(2)
            visible = true
            expect(
              ((yield* run()).operations[0] ?? fail("Missing fixture (yield* run()).operations[0]"))
                .status,
            ).toBe("Satisfied")
            expect(sends).toBe(2)
          }
          const events = (yield* store.read(plan.journalId)).events
          const serialized = JSON.stringify({ plan, events, published })
          for (const secret of [loginToken, otp, authUrl, doneUrl])
            expect(serialized).not.toContain(secret)
          expect(events.filter((event) => event.body._tag === "DispatchStarted")).toHaveLength(2)
          expect(
            events.filter((event) => event.body._tag === "DispatchRejectedBeforeCommit"),
          ).toHaveLength(1)
          return session
        }),
      ).pipe(Effect.provide(TestClock.layer())),
    )
    onTestFinished(async () => {
      finishing = true
      await Effect.runPromise(Fiber.interrupt(root))
    })
    // Bun abandons the test Promise on timeout; await an Exit so joined cleanup
    // does not create a detached rejection after the runner has already failed.
    const exit = await Effect.runPromise(Fiber.await(root))
    if (finishing) return
    const result = await Effect.runPromise(exit)
    expect(polls).toBe(2)
    expect(notices).toEqual([authUrl])
    expect(Effect.runPromise(result.credentials(f.request.facts))).rejects.toThrow("closed")
  }, 10000)

test("local credentials require explicit literal registry config and PUT body identity", async () => {
  const f = await fixture()
  for (const contents of [
    "",
    "_authToken=unscoped-secret",
    "//other.invalid/:_authToken=wrong-origin",
    config + config,
    "//registry.npmjs.org/:_authToken=${NPM_TOKEN}",
    '//registry.npmjs.org/:_authToken="quoted"',
    "x".repeat(65537),
  ])
    expect(
      Effect.runPromise(
        Effect.scoped(
          makeLocalAuthenticationWith(
            {
              authorization: f.authorization,
              configFile: "/fixture/explicit.npmrc",
              notify: () => Effect.void,
            },
            {
              readConfig: () => Effect.succeed(contents),
              read: () => () => Effect.die("no network"),
            },
          ),
        ),
      ),
    ).rejects.toThrow()
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const session = yield* makeLocalAuthenticationWith(
          {
            authorization: f.authorization,
            configFile: "/fixture/explicit.npmrc",
            notify: () => Effect.void,
          },
          { readConfig: () => Effect.succeed(config), read: () => () => Effect.die("no network") },
        )
        for (const patch of [
          { method: "POST" },
          { method: "" },
          { bodyDigest: "" },
          { bodyDigest: "bad" },
          { principal: "other" },
        ])
          expect(
            (yield* Effect.exit(session.credentials({ ...f.request.facts, ...patch })))._tag,
          ).toBe("Failure")
        const { method: _, bodyDigest: __, ...legacy } = f.request.facts
        expect((yield* Effect.exit(session.credentials(legacy)))._tag).toBe("Failure")
        expect((yield* Effect.exit(session.credentials({ ...legacy, method: "PUT" })))._tag).toBe(
          "Failure",
        )
      }),
    ),
  )
})

test("a fresh scoped session requests a fresh challenge after a durable rejection", async () => {
  const f = await fixture(),
    store = new MemoryJournal()
  const plan = await Effect.runPromise(createPlan("browser-authentication-restart", [f.operation]))
  let sends = 0
  const runSession = (finish: boolean) =>
    Effect.scoped(
      Effect.gen(function* () {
        const session = yield* makeLocalAuthenticationWith(
          {
            authorization: f.authorization,
            configFile: "/fixture/explicit.npmrc",
            notify: () => Effect.void,
          },
          {
            readConfig: () => Effect.succeed(config),
            read: () => () => Effect.succeed(response(200, { token: otp })),
          },
        )
        const transport: Transport = {
          send: () => Effect.die("unprepared"),
          prepare: (request) =>
            Effect.gen(function* () {
              const headers = yield* session.credentials(request.facts)
              return (actual: PreparedRequest) =>
                Effect.gen(function* () {
                  sends++
                  const native = headers["npm-otp"] === otp ? response(201) : challenge()
                  session.capture(actual, native)
                  return yield* (
                    f.providers[0] ?? fail("Missing fixture f.providers[0]")
                  ).decodeResponse(actual, native)
                })
            }),
        }
        const run = () =>
          runRelease({ plan, authorize: true }).pipe(
            Effect.provideService(Host, {
              providers: f.providers,
              store,
              transport,
              now: Date.now,
              uniqueId: () => crypto.randomUUID(),
            }),
          )
        expect(
          ((yield* run()).operations[0] ?? fail("Missing fixture (yield* run()).operations[0]"))
            .status,
        ).toBe("Rejected")
        if (finish) {
          expect(yield* session.complete(f.operation)).toBe(true)
          expect(
            ((yield* run()).operations[0] ?? fail("Missing fixture (yield* run()).operations[0]"))
              .status,
          ).toBe("Satisfied")
        }
      }),
    )
  await Effect.runPromise(runSession(false))
  await Effect.runPromise(runSession(true))
  const events = (await Effect.runPromise(store.read(plan.journalId))).events
  expect(sends).toBe(3)
  expect(events.filter((event) => event.body._tag === "DispatchRejectedBeforeCommit")).toHaveLength(
    2,
  )
  expect(events.filter((event) => event.body._tag === "ReceiptAccepted")).toHaveLength(1)
})

test("browser completion refuses redirects, errors, malformed tokens and unbounded polling", async () => {
  const f = await fixture()
  for (const native of [
    response(302, {}, { location: "https://other.invalid" }),
    response(401),
    response(500),
    response(200, {}),
    response(200, { token: "" }),
    response(200, { token: "bad\nsecret" }),
    response(202, {}, { "retry-after": "0" }),
    response(202, {}, { "retry-after": "999" }),
    { ...response(200), body: new Uint8Array(65537) },
  ]) {
    let polls = 0
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const session = yield* makeLocalAuthenticationWith(
            {
              authorization: f.authorization,
              configFile: "/fixture/explicit.npmrc",
              notify: () => Effect.void,
            },
            {
              readConfig: () => Effect.succeed(config),
              read: () => () =>
                Effect.sync(() => {
                  polls++
                  return native
                }),
            },
          )
          session.capture(f.request, challenge())
          expect((yield* Effect.exit(session.complete(f.operation)))._tag).toBe("Failure")
          expect(yield* session.complete(f.operation)).toBe(false)
          expect((yield* session.credentials(f.request.facts))["npm-otp"]).toBeUndefined()
        }),
      ),
    )
    expect(polls).toBe(1)
  }
  let canceled = false,
    finishing = false
  let cleanupDefect: TypeError | undefined
  const root = Effect.runFork(
    Effect.scoped(
      Effect.gen(function* () {
        const session = yield* makeLocalAuthenticationWith(
          {
            authorization: f.authorization,
            configFile: "/fixture/explicit.npmrc",
            notify: () => Effect.void,
            timeoutMilliseconds: 20,
          },
          {
            readConfig: () => Effect.succeed(config),
            read: () => () =>
              Effect.never.pipe(
                Effect.ensuring(
                  Effect.sync(() => {
                    canceled = true
                  }).pipe(
                    Effect.andThen(
                      Effect.suspend(() =>
                        cleanupDefect ? Effect.die(cleanupDefect) : Effect.void,
                      ),
                    ),
                  ),
                ),
              ),
          },
        )
        session.capture(f.request, challenge())
        const completion = yield* Effect.forkChild(Effect.exit(session.complete(f.operation)))
        yield* TestClock.adjust(20)
        expect((yield* Fiber.join(completion))._tag).toBe("Failure")
        expect(yield* session.complete(f.operation)).toBe(false)
        // Deadline settlement must preserve a real cleanup defect, not replace
        // it with the ordinary authentication-timeout refusal.
        cleanupDefect = new TypeError("Authentication read cleanup failed")
        session.capture(f.request, challenge())
        const failingCleanup = yield* Effect.forkChild(Effect.exit(session.complete(f.operation)))
        yield* TestClock.adjust(20)
        const cleanupExit = yield* Fiber.join(failingCleanup)
        expect(Exit.isFailure(cleanupExit)).toBe(true)
        if (!Exit.isFailure(cleanupExit)) throw new Error("Expected cleanup defect")
        const found = Cause.findDefect(cleanupExit.cause)
        expect(Result.isSuccess(found) && found.success).toBe(cleanupDefect)
        expect(Cause.hasFails(cleanupExit.cause)).toBe(false)
        expect(yield* session.complete(f.operation)).toBe(false)
      }),
    ).pipe(Effect.provide(TestClock.layer())),
  )
  onTestFinished(async () => {
    finishing = true
    await Effect.runPromise(Fiber.interrupt(root))
  })
  const exit = await Effect.runPromise(Fiber.await(root))
  if (finishing) return
  await Effect.runPromise(exit)
  expect(canceled).toBe(true)
})
