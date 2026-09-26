import { readFileSync } from "node:fs"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { SqliteJournal } from "./sqlite-fixture.js"
import { ReleaseError, parseCanonical, runRelease, sha256, type HostShape, Plan } from "./kernel.js"
import { FixtureIntent, evaluators, providerFor, runWithHost, measureStore } from "./fixtures.js"
import { CachingJournalStore } from "./witnesses/caching-store.js"

const [planPath, databasePath, candidate, fault, observe] = process.argv.slice(2)
if (!planPath || !databasePath || !candidate) throw new Error("Missing worker arguments")
const plan = Schema.decodeUnknownSync(Plan)(parseCanonical(readFileSync(planPath, "utf8")))
const intent = Schema.decodeUnknownSync(FixtureIntent)(plan.operations[0]?.intent)
if (candidate !== "M1" && candidate !== "M2" && candidate !== "M3")
  throw new Error("Unknown evaluator")
const expectedDigest = await Effect.runPromise(sha256(new TextEncoder().encode(intent.content)))
const observationCodec = Schema.Struct({ status: Schema.Finite, bodyDigest: Schema.String })
const provider = {
  ...providerFor(),
  observationVersion: "http-bytes/1",
  observationCodec,
  classifyObservation: (_operation: unknown, evidence: unknown) => {
    const native = Schema.decodeUnknownSync(observationCodec)(evidence)
    return native.status === 404
      ? ("Absent" as const)
      : native.status === 200 && native.bodyDigest === expectedDigest
        ? ("Satisfied" as const)
        : ("Conflict" as const)
  },
  observe: () =>
    Effect.gen(function* () {
      const response = yield* Effect.tryPromise({
        // @effect-diagnostics-next-line globalFetchInEffect:off -- Independent worker exercises the native process/network boundary; it is not a production HTTP service.
        try: () => fetch(`${intent.endpoint}/${intent.coordinate}`),
        catch: () =>
          new ReleaseError({ code: "fixture-http", message: "Observation request failed" }),
      })
      const bytes = yield* Effect.promise(() => response.arrayBuffer())
      const evidence = { status: response.status, bodyDigest: yield* sha256(new Uint8Array(bytes)) }
      return { status: provider.classifyObservation(undefined, evidence), evidence }
    }),
}
const store = new SqliteJournal(databasePath)
const measured = measureStore(store, "sqlite-process")
const host: HostShape = {
  store: process.env.LAB_CACHE ? new CachingJournalStore(measured) : measured,
  providers: [provider],
  now: () => Date.now(),
  uniqueId: () => crypto.randomUUID(),
  machine: evaluators[candidate],
  transport: {
    send: (request) =>
      Effect.gen(function* () {
        const response = yield* Effect.tryPromise({
          try: () =>
            // @effect-diagnostics-next-line globalFetchInEffect:off -- Keep the independent fault-process oracle on its native HTTP edge.
            fetch(request.facts.endpoint, {
              method: request.facts.method,
              body: new Uint8Array(request.body),
            }),
          catch: () =>
            new ReleaseError({ code: "fixture-http", message: "Mutation request failed" }),
        })
        return {
          _tag: "Accepted" as const,
          receipt: {
            status: response.status,
            endpoint: request.facts.endpoint,
            bodyDigest: request.facts.bodyDigest,
          },
        }
      }),
  },
}
try {
  const result = await runWithHost(
    host,
    runRelease({
      plan,
      authorize: true,
      observe: observe === "true",
      checkpoint: (stage) => (stage === fault ? Effect.sync(() => process.exit(70)) : Effect.void),
    }),
  )
  process.stdout.write(JSON.stringify(result))
} finally {
  store.close()
}
