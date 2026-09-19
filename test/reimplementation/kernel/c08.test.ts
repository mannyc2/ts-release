import { expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import {
  createOperation,
  createPlan,
  makeRequest,
  runRelease,
} from "../../../packages/ts-release/src/index.js"
import { requestFingerprint } from "../../../packages/ts-release/src/Provider.js"
import { NoReplay } from "../../../packages/ts-release/src/index.js"
import { MemoryJournal, providerFor, runWithHost } from "./fixtures.js"

// A public provider binds native configuration at its codec boundary. This is
// external composition, not a core allowlist or an extra persisted request plan.
const Intent = Schema.Struct({
  endpoint: Schema.String,
  principal: Schema.String,
  scope: Schema.String,
  fingerprint: Schema.String,
})

test("C08: configured request mismatch is rejected before observation on an empty journal", async () => {
  const request = await Effect.runPromise(
    makeRequest({
      transport: "core.http/1",
      endpoint: "https://staging.fixture.invalid/package-1",
      method: "PUT",
      headers: [],
      principal: "staging-publisher",
      scope: "package-1:write",
      replay: new NoReplay({}),
      body: new TextEncoder().encode("exact artifact bytes"),
    }),
  )
  const expected = {
    endpoint: request.facts.endpoint,
    principal: request.facts.principal,
    scope: request.facts.scope,
    fingerprint: await Effect.runPromise(requestFingerprint(request.facts)),
  }
  let observations = 0,
    dispatches = 0
  const base = {
    ...providerFor(() => {
      observations++
      return { status: "Absent", evidence: { visible: false } }
    }),
    intentCodec: Intent,
  }
  const configured = {
    ...base,
    intentCodec: Intent.check(
      Schema.makeFilter(
        (intent) =>
          intent.endpoint === expected.endpoint &&
          intent.principal === expected.principal &&
          intent.scope === expected.scope &&
          intent.fingerprint === expected.fingerprint,
      ),
    ),
    prepare: () => Effect.succeed(request),
  }
  const store = new MemoryJournal()
  const host = {
    store,
    providers: [configured],
    now: () => 1,
    uniqueId: () => crypto.randomUUID(),
    transport: {
      send: () =>
        Effect.sync(() => {
          dispatches++
          return {
            _tag: "Accepted" as const,
            receipt: {
              status: 201,
              endpoint: request.facts.endpoint,
              bodyDigest: request.facts.bodyDigest,
            },
          }
        }),
    },
  }
  // Each input has a valid canonical Operation/Plan identity. It disagrees with
  // the actual host's native configuration, independently of identity integrity.
  for (const mismatch of [
    { fingerprint: "0".repeat(64) },
    { endpoint: "https://production.fixture.invalid/package-1" },
    { principal: "production-publisher" },
    { scope: "package-2:write" },
  ]) {
    const operation = await Effect.runPromise(createOperation(base, { ...expected, ...mismatch }))
    const plan = await Effect.runPromise(createPlan("c08-owned-fixture", [operation]))
    await expect(runWithHost(host, runRelease({ plan, authorize: true }))).rejects.toThrow()
    expect(await Effect.runPromise(store.read(plan.journalId))).toEqual({ revision: 0, events: [] })
    expect(observations).toBe(0)
    expect(dispatches).toBe(0)
  }
  const operation = await Effect.runPromise(createOperation(base, expected))
  const plan = await Effect.runPromise(createPlan("c08-owned-fixture", [operation]))
  expect(
    (await runWithHost(host, runRelease({ plan, authorize: true }))).operations[0]?.status,
  ).toBe("Satisfied")
  expect(observations).toBe(1)
  expect(dispatches).toBe(1)
})
