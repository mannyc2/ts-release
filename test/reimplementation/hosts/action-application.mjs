import { createHash } from "node:crypto"
import { appendFile } from "node:fs/promises"
import { Effect, Schema } from "effect"
import {
  NoReplay,
  PROVIDER_CONTRACT,
  ReleaseError,
  createOperation,
  createPlan,
  makeRequest,
} from "@mannyc1/ts-release"
import { encodeBundle, finalize } from "@mannyc1/ts-release/bundle"
import { openGitJournal } from "@mannyc1/ts-release/node"

class Intent extends Schema.Class("ActionFixture.Intent")({
  endpoint: Schema.String,
  coordinate: Schema.String,
}) {}
class Receipt extends Schema.Class("ActionFixture.Receipt")({
  endpoint: Schema.String,
  bodyDigest: Schema.String,
  status: Schema.Literal(201),
}) {}
const descriptor = {
  definitionId: "fixture.action.publish",
  intentVersion: "1",
  intentCodec: Intent,
}
const io = (run) =>
  Effect.tryPromise({
    try: run,
    catch: () => new ReleaseError({ code: "action-fixture-io", message: "Fixture I/O failed" }),
  })

export const createApplication = (input) =>
  Effect.gen(function* () {
    if (input.marker)
      yield* Effect.acquireRelease(
        io(() => appendFile(input.marker, "acquire\n")),
        () => io(() => appendFile(input.marker, "release\n")),
      )
    if (input.failure)
      return yield* new ReleaseError({
        code: "action-fixture-private",
        message: "Private fixture diagnostic",
      })
    if (input.wait) return yield* Effect.never

    const bundle = yield* finalize([])
    const provider = {
      ...descriptor,
      contract: PROVIDER_CONTRACT,
      receiptVersion: "fixture.action.receipt/1",
      receiptCodec: Receipt,
      receiptCorresponds: (_operation, request, receipt) =>
        receipt.endpoint === request.endpoint && receipt.bodyDigest === request.bodyDigest,
      classifyReceipt: () => "Satisfied",
      prepare: (operation) =>
        makeRequest({
          transport: "core.http/1",
          endpoint: operation.intent.endpoint,
          method: "PUT",
          headers: [],
          body: new TextEncoder().encode(operation.intent.coordinate),
          principal: "action-fixture",
          scope: "release",
          replay: new NoReplay({}),
        }),
    }
    const operations = input.empty
      ? []
      : [
          yield* createOperation(
            descriptor,
            new Intent({ endpoint: "https://fixture.invalid/release", coordinate: "candidate" }),
          ),
        ]
    const plan = yield* createPlan(
      createHash("sha256").update(encodeBundle(bundle)).digest("hex"),
      operations,
    )
    const nativeStore = yield* openGitJournal({
      cacheDirectory: input.cacheDirectory,
      remote: input.journalRemote,
      principal: "action-journal",
      scope: "release",
      gitExecutable: input.gitExecutable,
      timeoutMilliseconds: 5000,
      maximumOutputBytes: 4 * 1024 * 1024,
      credentials: () => Effect.succeed({ _tag: "Anonymous" }),
    })
    const options = { plan, authorize: input.authorize === true, maxDispatches: 1 }
    let host
    const store = {
      append: nativeStore.append,
      read: (id) =>
        Effect.suspend(() => {
          if (input.hostile) {
            options.authorize = false
            host.providers.length = 0
            host.transport.send = () => Effect.die("retained alias replaced captured transport")
          }
          return nativeStore.read(id)
        }),
    }
    host = {
      store,
      providers: [provider],
      transport: {
        send: (request) =>
          io(() => appendFile(input.sendLog, `${request.facts.bodyDigest}\n`)).pipe(
            Effect.as({
              _tag: "Accepted",
              receipt: new Receipt({
                endpoint: request.facts.endpoint,
                bodyDigest: request.facts.bodyDigest,
                status: 201,
              }),
            }),
          ),
      },
      now: () => 1,
      uniqueId: () => crypto.randomUUID(),
    }
    return { bundle, options, host }
  })
