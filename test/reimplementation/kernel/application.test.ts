import { expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { runApplication, FinalizedReport } from "../../../packages/ts-release/src/Bun.js"
import { finalize, encodeBundle } from "../../../packages/ts-release/src/Bundle.js"
import {
  createOperation,
  createPlan,
  type Operation,
  type ReleaseError,
} from "../../../packages/ts-release/src/index.js"
import { sha256 } from "../../../packages/ts-release/src/internal/Identity.js"
import { MemoryJournal, providerFor } from "./fixtures.js"

const path = `${import.meta.dir}/application-fixture.ts`
async function fixture() {
  const bundle = await Effect.runPromise(finalize([]))
  const provider = providerFor()
  const operation = await Effect.runPromise(
    createOperation(provider, {
      coordinate: "application-fixture",
      endpoint: "https://fixture.invalid",
      content: "owned fixture",
    }),
  )
  const plan = await Effect.runPromise(
    createPlan(await Effect.runPromise(sha256(encodeBundle(bundle))), [operation]),
  )
  const store = new MemoryJournal()
  let sends = 0
  const application = {
    bundle,
    options: { plan, authorize: true, maxDispatches: 1 },
    onRejected: (_operation: Operation): Effect.Effect<boolean, ReleaseError> =>
      Effect.succeed(false),
    host: {
      store,
      providers: [provider],
      now: () => 1,
      uniqueId: () => crypto.randomUUID(),
      transport: {
        send: (
          request: import("../../../packages/ts-release/src/index.js").PreparedRequest,
        ): Effect.Effect<import("../../../packages/ts-release/src/index.js").SendResult> =>
          Effect.sync(() => {
            sends++
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
    },
  }
  return { application, lifecycle: [] as string[], sends: () => sends }
}

test("application emits the complete derived report and closes its scope", async () => {
  const input = await fixture()
  const report = await runApplication(path, input)
  expect(input.lifecycle).toEqual(["acquire", "release"])
  expect(input.sends()).toBe(1)
  expect(report.bundle).toEqual(input.application.bundle)
  expect(report.plan).toEqual(input.application.options.plan)
  expect(report.journal.events).toEqual(
    (await Effect.runPromise(input.application.host.store.read(report.plan.journalId))).events,
  )
  expect(report.operations[0]?.status).toBe("Satisfied")
  expect(Schema.decodeUnknownSync(FinalizedReport)(JSON.parse(JSON.stringify(report)))).toEqual(
    report,
  )
  expect(Object.isFrozen(report)).toBe(true)
  const resumed = await runApplication(path, input)
  expect(resumed).toEqual(report)
  expect(input.sends()).toBe(1)
  expect(input.lifecycle).toEqual(["acquire", "release", "acquire", "release"])
})

test("application rejects a foreign Bundle before any send and closes its scope", async () => {
  const input = await fixture()
  const wrong = await Effect.runPromise(
    createPlan("foreign-bundle", input.application.options.plan.operations),
  )
  input.application.options.plan = wrong
  await expect(runApplication(path, input)).rejects.toThrow("differs")
  expect(input.sends()).toBe(0)
  expect(input.lifecycle).toEqual(["acquire", "release"])
})

for (const outcome of ["failure", "interruption"] as const) {
  test(`application closes its scope on ${outcome}`, async () => {
    const input = await fixture()
    await expect(runApplication(path, { ...input, outcome })).rejects.toThrow()
    expect(input.sends()).toBe(0)
    expect(input.lifecycle).toEqual(["acquire", "release"])
  })
}

test("application loading rejects missing exports and redacts native import diagnostics", async () => {
  await expect(runApplication(`${import.meta.dir}/fixtures.ts`, {})).rejects.toThrow("must export")
  await expect(runApplication("/absent/credential-in-path.ts", {})).rejects.toThrow(
    "Application module could not be loaded",
  )
})

test("application captures authority and host capabilities before asynchronous admission", async () => {
  const input = await fixture()
  const { host, options } = input.application
  let substitutedSends = 0
  const read = host.store.read
  const replacement = () =>
    Effect.sync(() => {
      substitutedSends++
      return { _tag: "Unknown" as const, reason: "substituted" }
    })
  host.store.read = (id) =>
    Effect.suspend(() => {
      // A caller retains these aliases while the loader validates the journal.
      options.authorize = false
      options.maxDispatches = 0
      host.transport.send = replacement as typeof host.transport.send
      host.providers.length = 0
      host.now = () => -1
      return read(id)
    })
  const report = await runApplication(path, input)
  expect(report.operations[0]?.status).toBe("Satisfied")
  expect(input.sends()).toBe(1)
  expect(substitutedSends).toBe(0)
  expect(input.lifecycle).toEqual(["acquire", "release"])
})

test("application cannot gain authorization from a retained caller alias", async () => {
  const input = await fixture()
  input.application.options.authorize = false
  const read = input.application.host.store.read
  input.application.host.store.read = (id) =>
    Effect.suspend(() => {
      input.application.options.authorize = true
      return read(id)
    })
  const report = await runApplication(path, input)
  expect(input.sends()).toBe(0)
  expect(report.journal.revision).toBe(0)
})

async function challenged(outcome: "accepted" | "rejected" | "unknown" = "accepted") {
  const input = await fixture()
  const app = input.application
  app.options.maxDispatches = 2
  app.host.providers[0] = {
    ...app.host.providers[0]!,
    rejection: {
      version: "application-authentication-rejection/1",
      codec: Schema.Struct({
        endpoint: Schema.String,
        requestDigest: Schema.String,
        terminal: Schema.Literal(true),
      }),
      corresponds: (_operation, request, value) => {
        const proof = value as { endpoint: string; requestDigest: string }
        return proof.endpoint === request.endpoint && proof.requestDigest === request.bodyDigest
      },
    },
  }
  let attempts = 0,
    completed = 0
  app.host.transport.send = (request) =>
    Effect.sync(() => {
      attempts++
      if (outcome === "unknown") return { _tag: "Unknown", reason: "response lost" }
      if (attempts === 1 || outcome === "rejected")
        return {
          _tag: "RejectedBeforeCommit",
          proof: {
            endpoint: request.facts.endpoint,
            requestDigest: request.facts.bodyDigest,
            terminal: true,
          },
        }
      return {
        _tag: "Accepted",
        receipt: {
          status: 201,
          endpoint: request.facts.endpoint,
          bodyDigest: request.facts.bodyDigest,
        },
      }
    })
  app.onRejected = (operation) =>
    Effect.gen(function* () {
      const snapshot = yield* app.host.store.read(app.options.plan.journalId)
      expect(snapshot.events.at(-1)?.body._tag).toBe("DispatchRejectedBeforeCommit")
      expect(operation.operationId).toBe(app.options.plan.operations[0]!.operationId)
      completed++
      return true
    })
  return { ...input, attempts: () => attempts, completed: () => completed }
}

test("application completes authentication only after durable noncommit and re-enters the kernel", async () => {
  const input = await challenged()
  const report = await runApplication(path, input)
  expect(report.operations[0]).toMatchObject({ status: "Satisfied", dispatches: 2, receipts: 1 })
  expect(input.completed()).toBe(1)
  const starts = report.journal.events.filter((event) => event.body._tag === "DispatchStarted")
  expect(starts[1]?.body).toMatchObject({ basis: { _tag: "NonCommit" } })
  expect(input.lifecycle).toEqual(["acquire", "release"])
  expect((await runApplication(path, input)).operations[0]?.status).toBe("Satisfied")
  expect(input.attempts()).toBe(2)
  expect(input.completed()).toBe(1)
})

test("application authentication continuation is bounded and respects the total explicit dispatch limit", async () => {
  const input = await challenged("rejected")
  input.application.options.maxDispatches = 10
  expect((await runApplication(path, input)).operations[0]?.status).toBe("Rejected")
  expect(input.attempts()).toBe(2)
  expect(input.completed()).toBe(1)
  const limited = await challenged()
  limited.application.options.maxDispatches = 1
  expect((await runApplication(path, limited)).operations[0]?.status).toBe("Rejected")
  expect(limited.attempts()).toBe(1)
  expect(limited.completed()).toBe(0)
})

test("observe and unauthorized application runs never complete authentication", async () => {
  const input = await challenged()
  input.application.options.maxDispatches = 1
  await runApplication(path, input)
  input.application.options.maxDispatches = 2
  await runApplication(path, input, undefined, "observe")
  input.application.options.authorize = false
  await runApplication(path, input)
  expect(input.attempts()).toBe(1)
  expect(input.completed()).toBe(0)
})

test("unknown writes never invoke authentication continuation or resend on restart", async () => {
  const input = await challenged("unknown")
  expect((await runApplication(path, input)).operations[0]?.status).toBe("Inconclusive")
  expect((await runApplication(path, input)).operations[0]?.status).toBe("Inconclusive")
  expect(input.attempts()).toBe(1)
  expect(input.completed()).toBe(0)
})

test("declining authentication continuation leaves the durable rejected attempt intact", async () => {
  const input = await challenged()
  input.application.onRejected = () => Effect.succeed(false)
  expect((await runApplication(path, input)).operations[0]?.status).toBe("Rejected")
  expect(input.attempts()).toBe(1)
})
