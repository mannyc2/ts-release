import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Effect, Layer, Redacted, Schema } from "effect"
import { Host, ReleaseError, createPlan, runRelease, type Transport } from "@mannyc1/ts-release"
import { openSqliteJournal } from "@mannyc1/ts-release/bun"
import * as PyPi from "@mannyc1/ts-release-pypi"
import { fixture } from "./fixtures.js"

const [root, mode] = process.argv.slice(2) as [string, string]
const config = JSON.parse(readFileSync(join(root, "worker.json"), "utf8"))
const endpoint = Schema.decodeUnknownSync(PyPi.Endpoint)(config.endpoint)
const f = await fixture(endpoint)
const authorization = new PyPi.TokenAuthorization({
  principal: "fixture",
  username: config.username,
})
const selected = f.intents
  .filter((intent) => config.filenames.includes(intent.filename))
  .map((intent) => Schema.decodeUnknownSync(PyPi.UploadIntent)({ ...intent, authorization }))
const response = async (r: Response) => ({
  status: r.status,
  headers: Object.fromEntries(r.headers),
  body: new Uint8Array(await r.arrayBuffer()),
})
const ca = readFileSync(join(root, "cert.pem"), "utf8")
const providers = PyPi.definitions({
  ...f.access,
  read: (request) =>
    Effect.tryPromise({
      try: async () =>
        response(
          await fetch(request.url, {
            method: request.method,
            headers: Object.fromEntries(request.headers),
            redirect: "manual",
            tls: { ca },
          }),
        ),
      catch: () =>
        new ReleaseError({ code: "fixture-read", message: "Native index read unavailable" }),
    }),
})
let sends = 0
const transport: Transport = {
  send: () =>
    Effect.fail(new ReleaseError({ code: "unprepared", message: "Credentials must be prepared" })),
  prepare: (request) =>
    Effect.gen(function* () {
      if (!providers[0]!.ownsRequest(request))
        return yield* new ReleaseError({ code: "unowned", message: "Native request differs" })
      const credentials = yield* PyPi.authorizeToken({
        authorization,
        endpoint,
        binding: request.facts,
        token: Redacted.make(config.password),
      })
      return (prepared) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: async () =>
              response(
                await fetch(prepared.facts.endpoint, {
                  method: prepared.facts.method,
                  headers: { ...Object.fromEntries(prepared.facts.headers), ...credentials },
                  body: new Uint8Array(prepared.body),
                  redirect: "manual",
                  tls: { ca },
                }),
              ),
            catch: () =>
              new ReleaseError({ code: "fixture-write", message: "Native upload outcome unknown" }),
          })
          sends++
          if (mode === "kill-after-two-commits" && sends === 2 && result.status === 200)
            process.kill(process.pid, "SIGKILL")
          return yield* providers[0]!.decodeResponse(prepared, result)
        })
    }),
}
const plan = await Effect.runPromise(
  createPlan("warehouse-native-process-fixture", await Effect.runPromise(PyPi.author(selected))),
)
const result = await Effect.runPromise(
  Effect.scoped(
    Effect.gen(function* () {
      const store = yield* openSqliteJournal(join(root, "journal.sqlite"))
      const report = yield* runRelease({ plan, authorize: true }).pipe(
        Effect.provide(
          Layer.succeed(Host, {
            store,
            providers,
            transport,
            now: Date.now,
            uniqueId: () => crypto.randomUUID(),
          }),
        ),
      )
      const snapshot = yield* store.read(plan.journalId)
      return {
        report,
        dispatches: snapshot.events.filter((e) => e.body._tag === "DispatchStarted").length,
        receipts: snapshot.events.filter((e) => e.body._tag === "ReceiptAccepted").length,
        sends,
      }
    }),
  ),
)
console.log(JSON.stringify(result))
