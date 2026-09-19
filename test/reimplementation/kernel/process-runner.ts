import { readFileSync } from "node:fs"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { SqliteJournal } from "./sqlite-fixture.js"
import {
  ReleaseError,
  parseCanonical,
  runRelease,
  sha256,
  type HostShape,
  type Plan,
} from "./kernel.js"
import {
  FixtureIntent,
  evaluators,
  providerFor,
  runWithHost,
  measureStore,
  type EvaluatorName,
} from "./fixtures.js"
import { CachingJournalStore } from "./witnesses/caching-store.js"

const [planPath, databasePath, candidate, fault, observe] = process.argv.slice(2)
if (!planPath || !databasePath || !candidate) throw new Error("Missing worker arguments")
const plan = parseCanonical(readFileSync(planPath, "utf8")) as Plan
const intent = plan.operations[0]!.intent as FixtureIntent
const expectedDigest = await Effect.runPromise(sha256(new TextEncoder().encode(intent.content)))
const provider = {
  ...providerFor(),
  observationVersion: "http-bytes/1",
  observationCodec: Schema.Struct({ status: Schema.Number, bodyDigest: Schema.String }),
  classifyObservation: (_operation: unknown, evidence: unknown) => {
    const native = evidence as { status: number; bodyDigest: string }
    return native.status === 404
      ? ("Absent" as const)
      : native.status === 200 && native.bodyDigest === expectedDigest
        ? ("Satisfied" as const)
        : ("Conflict" as const)
  },
  observe: () =>
    Effect.gen(function* () {
      const response = yield* Effect.tryPromise({
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
  machine: evaluators[candidate as EvaluatorName],
  transport: {
    send: (request) =>
      Effect.gen(function* () {
        const response = yield* Effect.tryPromise({
          try: () =>
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
