import { expect, test } from "bun:test"
import { Cause, Effect, Layer } from "effect"
import {
  Host,
  ReleaseError,
  createPlan,
  runRelease,
} from "../../../packages/ts-release/src/index.js"
import { makeHttpRead, makeHttpTransport } from "../../../packages/ts-release/src/Node.js"
import type { ResolveCredentials } from "../../../packages/ts-release/src/Http.js"
import { MemoryJournal } from "../kernel/fixtures.js"
import { NoReplay, createOperation, makeRequest } from "../../../packages/ts-release/src/index.js"
import { providerFor } from "../kernel/fixtures.js"
import type { HttpProviderDefinition } from "../../../packages/ts-release/src/Http.js"

const endpoint = "https://credential-test.invalid/artifact"
const fixture = async (credentials: ResolveCredentials) => {
  const provider: HttpProviderDefinition = {
    ...providerFor(),
    prepare: () =>
      makeRequest({
        transport: "core.http/1",
        endpoint,
        method: "PUT",
        headers: [],
        body: new Uint8Array([1]),
        principal: "publisher",
        scope: "publish",
        replay: new NoReplay({}),
      }),
    ownsRequest: (request) => request.facts.endpoint === endpoint,
    decodeResponse: () => Effect.die("credential failure must prevent native HTTP"),
  }
  const operation = await Effect.runPromise(
    createOperation(provider, { coordinate: "artifact", endpoint, content: "one byte" }),
  )
  const plan = await Effect.runPromise(createPlan("credential-test", [operation]))
  const store = new MemoryJournal()
  const options = { credentials, timeoutMilliseconds: 100, maximumResponseBytes: 100 }
  const transport = makeHttpTransport({ ...options, providers: [provider] })
  const read = makeHttpRead(options)
  return {
    store,
    plan,
    read: read({ url: endpoint, method: "GET", headers: [], principal: "reader", scope: "read" }),
    run: runRelease({ plan, authorize: true }).pipe(
      Effect.provide(
        Layer.succeed(Host, {
          providers: [provider],
          store,
          transport,
          now: () => 1,
          uniqueId: () => "must-not-dispatch",
        }),
      ),
    ),
  }
}

test("HTTP credentials redact failures and defects while preserving resolver interruption", async () => {
  const secret = "synthetic-private-credential-marker"
  const error = new ReleaseError({ code: "secret-code", message: secret })
  const choices: ReadonlyArray<{ credentials: ResolveCredentials; interrupted: boolean }> = [
    { credentials: () => Effect.fail(error), interrupted: false },
    {
      credentials: () => {
        throw error
      },
      interrupted: false,
    },
    { credentials: () => Effect.die(error), interrupted: false },
    { credentials: () => Effect.interrupt, interrupted: true },
    {
      credentials: () => Effect.failCause(Cause.combine(Cause.interrupt(123), Cause.die(error))),
      interrupted: true,
    },
    {
      credentials: () => Effect.failCause(Cause.combine(Cause.interrupt(123), Cause.fail(error))),
      interrupted: true,
    },
  ]
  for (const { credentials, interrupted } of choices) {
    const input = await fixture(credentials)
    const operations: ReadonlyArray<Effect.Effect<unknown, ReleaseError>> = [input.read, input.run]
    for (const operation of operations) {
      const exit = await Effect.runPromiseExit(operation)
      expect(exit._tag).toBe("Failure")
      if (exit._tag === "Failure") {
        expect(Cause.hasInterrupts(exit.cause)).toBe(interrupted)
        expect(Cause.hasFails(exit.cause)).toBe(!interrupted)
        expect(Cause.hasDies(exit.cause)).toBe(false)
        expect(String(exit.cause)).not.toContain(secret)
        expect(String(exit.cause)).not.toContain("secret-code")
        if (!interrupted)
          expect(String(exit.cause)).toContain("HTTP credentials could not be acquired")
      }
    }
    expect((await Effect.runPromise(input.store.read(input.plan.journalId))).events).toEqual([])
  }
})

test("cancelling pending HTTP credentials waits for cleanup without authorizing dispatch", async () => {
  let started!: () => void
  const ready = new Promise<void>((resolve) => {
    started = resolve
  })
  let released = false
  const input = await fixture(() =>
    Effect.scoped(
      Effect.gen(function* () {
        yield* Effect.acquireRelease(
          Effect.sync(() => started()),
          () =>
            Effect.sync(() => {
              released = true
            }),
        )
        return yield* Effect.never
      }),
    ),
  )
  const controller = new AbortController()
  const running = Effect.runPromiseExit(input.run, { signal: controller.signal })
  await ready
  controller.abort()
  const exit = await running
  expect(exit._tag).toBe("Failure")
  if (exit._tag === "Failure") expect(Cause.hasInterruptsOnly(exit.cause)).toBe(true)
  expect(released).toBe(true)
  expect((await Effect.runPromise(input.store.read(input.plan.journalId))).events).toEqual([])
})
