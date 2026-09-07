import { Effect, Schema } from "effect"
import { appendFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { createOperation, createPlan, PROVIDER_CONTRACT, ReleaseError } from "@mannyc1/ts-release"
import { finalize, encodeBundle } from "@mannyc1/ts-release/bundle"

export const createApplication = (input) =>
  Effect.gen(function* () {
    if (input.log) yield* Effect.logInfo("fixture-application-log")
    if (input.marker) {
      yield* Effect.acquireRelease(
        Effect.promise(() => appendFile(input.marker, "acquire\n")),
        () =>
          Effect.sleep(30).pipe(
            Effect.andThen(Effect.promise(() => appendFile(input.marker, "release\n"))),
          ),
      )
    }
    if (input.wait) return yield* Effect.never
    if (input.failure) return yield* Effect.die(new Error("fixture-private-diagnostic"))
    const bundle = yield* finalize([])
    const provider = {
      contract: PROVIDER_CONTRACT,
      definitionId: "fixture.cli",
      intentVersion: "1",
      intentCodec: Schema.String,
      receiptVersion: "1",
      receiptCodec: Schema.Number,
      receiptCorresponds: () => true,
      classifyReceipt: () => "Satisfied",
      prepare: () => Effect.fail(new ReleaseError({ code: "fixture", message: "No send" })),
    }
    const operations = input.unresolved
      ? [yield* createOperation(provider, "x".repeat(input.large ? 1024 * 1024 : 1))]
      : []
    const plan = yield* createPlan(
      createHash("sha256").update(encodeBundle(bundle)).digest("hex"),
      operations,
    )
    return {
      bundle,
      options: { plan, authorize: false },
      host: {
        providers: [provider],
        now: Date.now,
        uniqueId: () => crypto.randomUUID(),
        store: {
          read: () => Effect.succeed({ revision: 0, events: [] }),
          append: () => Effect.die("Fixture must not append"),
        },
        transport: { send: () => Effect.die("Fixture must not send") },
      },
    }
  })
