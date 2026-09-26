import { expect, onTestFinished, test } from "bun:test"
import { Cause, Deferred, Effect, Exit, Fiber, Result, Schema } from "effect"
import { TestClock } from "effect/testing"
import * as Runtime from "../../../packages/ts-release/src/Bun.js"
import { runApplication, FinalizedReport } from "../../../packages/ts-release/src/Bun.js"
import { finalize, encodeBundle } from "../../../packages/ts-release/src/Bundle.js"
import {
  createOperation,
  createPlan,
  type Operation,
  ReleaseError,
} from "../../../packages/ts-release/src/index.js"
import { sha256 } from "../../../packages/ts-release/src/internal/Identity.js"
import { MemoryJournal, providerFor } from "./fixtures.js"
import { createApplication } from "./application-fixture.js"

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

// Receipts cannot certify visibility; real observation work must consume the
// elapsed budget and settle before the one application scope is released.
test("bounded observation charges provider work and resumes visibility without publication", async () => {
  const input = await fixture()
  const acknowledged = await runApplication(path, input)
  expect(acknowledged.operations[0]?.status).toBe("Satisfied")
  input.lifecycle.length = 0
  let observations = 0,
    canceled = false,
    visible = false,
    authentication = 0,
    finishing = false
  let cleanupDefect: TypeError | undefined
  input.application.onRejected = () =>
    Effect.sync(() => {
      authentication++
      return true
    })
  const mode = {
    mode: "observe" as const,
    definitionIds: ["fixture.http"],
    budgetMilliseconds: 100,
    initialDelayMilliseconds: 10,
    maximumDelayMilliseconds: 20,
  }
  const root = Effect.runFork(
    Effect.gen(function* () {
      let started = yield* Deferred.make<void>()
      const provider = providerFor(() => ({
        status: visible ? "Satisfied" : "Absent",
        evidence: { visible },
      }))
      input.application.host.providers = [provider]
      yield* Runtime.runApplicationEffect(() => createApplication(input), input, "observe")
      input.lifecycle.length = 0
      input.application.host.providers = [
        {
          ...provider,
          observe: () =>
            Effect.gen(function* () {
              observations++
              yield* Deferred.succeed(started, undefined)
              if (!visible)
                return yield* Effect.never.pipe(
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
                )
              return {
                status: visible ? ("Satisfied" as const) : ("Absent" as const),
                evidence: { visible },
              }
            }),
        },
      ]
      const observing = yield* Effect.forkChild(
        Runtime.runApplicationEffect(() => createApplication(input), input, mode),
      )
      // Also release the baseline, which completes without attempting observation.
      yield* Effect.raceFirst(Deferred.await(started), Fiber.join(observing).pipe(Effect.asVoid))
      yield* TestClock.adjust(100)
      const pending = yield* Fiber.join(observing)
      expect(pending).toHaveProperty("visibility.status", "Pending")
      expect(pending).toHaveProperty("visibility.elapsedMilliseconds", 100)
      expect(pending).toHaveProperty("visibility.operations.0.status", "Pending")
      expect(pending).toHaveProperty("visibility.operations.0.lastObservation.status", "Absent")
      expect(pending.operations[0]?.status).toBe("Satisfied")
      expect(observations).toBe(1)
      expect(canceled).toBe(true)
      expect(input.lifecycle).toEqual(["acquire", "release"])
      visible = true
      const resumed = yield* Runtime.runApplicationEffect(
        () => createApplication(input),
        input,
        mode,
      )
      expect(resumed).toHaveProperty("visibility.status", "Satisfied")
      expect(resumed).toHaveProperty("visibility.operations.0.lastObservation.status", "Satisfied")
      expect(resumed.plan).toEqual(acknowledged.plan)
      expect(resumed.bundle).toEqual(acknowledged.bundle)
      expect(
        resumed.journal.events.filter((event) => event.body._tag === "DispatchStarted"),
      ).toHaveLength(1)
      expect(input.sends()).toBe(1)
      expect(authentication).toBe(0)
      expect(input.lifecycle).toEqual(["acquire", "release", "acquire", "release"])
      // rc.115 timeoutOption joins the losing fiber but discards its Exit;
      // cleanup defects must not become a successful visibility report.
      visible = false
      cleanupDefect = new TypeError("Observation cleanup failed")
      started = yield* Deferred.make<void>()
      const interruptedCleanup = yield* Effect.forkChild(
        Effect.exit(Runtime.runApplicationEffect(() => createApplication(input), input, mode)),
      )
      yield* Deferred.await(started)
      yield* TestClock.adjust(100)
      const cleanupExit = yield* Fiber.join(interruptedCleanup)
      expect(Exit.isFailure(cleanupExit)).toBe(true)
      if (!Exit.isFailure(cleanupExit)) throw new Error("Expected cleanup defect")
      const found = Cause.findDefect(cleanupExit.cause)
      expect(Result.isSuccess(found) && found.success).toBe(cleanupDefect)
      expect(Cause.hasFails(cleanupExit.cause)).toBe(false)
      expect(input.sends()).toBe(1)
    }).pipe(Effect.provide(TestClock.layer())),
  )
  onTestFinished(async () => {
    finishing = true
    await Effect.runPromise(Fiber.interrupt(root))
  })
  const exit = await Effect.runPromise(Fiber.await(root))
  if (!finishing) await Effect.runPromise(exit)
})

// Preserve the published 0.4.2 adapter while the new Effect entrypoint keeps defects.
test("Promise application preserves its legacy factory-throw projection", async () => {
  const input = await fixture()
  const expected = new ReleaseError({ code: "factory", message: "Expected factory refusal" })
  expect(runApplication(path, { ...input, constructionFailure: expected })).rejects.toBe(expected)
  expect(
    runApplication(path, { ...input, constructionFailure: new TypeError("private factory bug") }),
  ).rejects.toMatchObject({ code: "invalid-data", message: "Value could not be admitted" })
})

// The callback can throw before returning an Effect; generic Scope tests miss that seam.
test("Effect application defers factory throws into caller-owned cleanup", async () => {
  const defect = new TypeError("factory construction failed")
  const lifecycle: string[] = []
  const operation = Runtime.runApplicationEffect(() => {
    lifecycle.push("construct")
    throw defect
  }, undefined)
  expect(lifecycle).toEqual([])
  const exit = await Effect.runPromiseExit(
    Effect.scoped(
      Effect.gen(function* () {
        yield* Effect.addFinalizer(() => Effect.sync(() => lifecycle.push("release")))
        return yield* operation
      }),
    ),
  )
  if (!Exit.isFailure(exit)) throw new Error("Expected factory defect")
  const found = Cause.findDefect(exit.cause)
  expect(Result.isSuccess(found) && found.success).toBe(defect)
  expect(Cause.hasFails(exit.cause)).toBe(false)
  expect(lifecycle).toEqual(["construct", "release"])
})

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
  expect(runApplication(path, input)).rejects.toThrow("differs")
  expect(input.sends()).toBe(0)
  expect(input.lifecycle).toEqual(["acquire", "release"])
})

for (const outcome of ["failure", "interruption"] as const) {
  test(`application closes its scope on ${outcome}`, async () => {
    const input = await fixture()
    expect(runApplication(path, { ...input, outcome })).rejects.toThrow()
    expect(input.sends()).toBe(0)
    expect(input.lifecycle).toEqual(["acquire", "release"])
  })
}

test("application loading rejects missing exports and redacts native import diagnostics", async () => {
  expect(runApplication(`${import.meta.dir}/fixtures.ts`, {})).rejects.toThrow("must export")
  expect(runApplication("/absent/credential-in-path.ts", {})).rejects.toThrow(
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
      host.transport.send = replacement
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
  const [provider] = app.host.providers
  if (!provider) throw new Error("Missing fixture provider")
  const rejectionCodec = Schema.Struct({
    endpoint: Schema.String,
    requestDigest: Schema.String,
    terminal: Schema.Literal(true),
  })
  app.host.providers[0] = {
    ...provider,
    rejection: {
      version: "application-authentication-rejection/1",
      codec: rejectionCodec,
      corresponds: (_operation, request, value) => {
        const proof = Schema.decodeUnknownSync(rejectionCodec)(value)
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
      const [planned] = app.options.plan.operations
      if (!planned) throw new Error("Missing planned fixture operation")
      expect(operation.operationId).toBe(planned.operationId)
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
