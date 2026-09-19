import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Effect, Layer, Redacted } from "effect"
import { Host, createPlan, runRelease, type Transport, ReleaseError } from "@mannyc1/ts-release"
import { openSqliteJournal } from "@mannyc1/ts-release/bun"
import { publish, definitions, authorizeToken } from "../../../packages/npm/src/index.js"
import { accessFor } from "./fixtures.js"
const [root, origin, mode] = process.argv.slice(2) as [string, string, string]
const bytes = new Uint8Array(readFileSync(join(root, "package.tgz"))),
  { publication, access } = accessFor(bytes)
const native = (url: string) => `${origin}${new URL(url).pathname}`
const response = async (r: Response) => ({
  status: r.status,
  headers: Object.fromEntries(r.headers),
  body: new Uint8Array(await r.arrayBuffer()),
})
const providers = definitions({
  ...access,
  read: (request) =>
    Effect.tryPromise({
      try: async () => response(await fetch(native(request.url), { method: request.method })),
      catch: () =>
        new ReleaseError({ code: "test-read", message: "HTTP protocol double unavailable" }),
    }),
})
const plan = await Effect.runPromise(
  createPlan("npm-process-owned-fixture", [await Effect.runPromise(publish(publication))]),
)
const send =
  (headers: Readonly<Record<string, string>>): Transport["send"] =>
  (request) =>
    Effect.gen(function* () {
      const r = yield* Effect.tryPromise({
        try: async () =>
          response(
            await fetch(native(request.facts.endpoint), {
              method: request.facts.method,
              headers: { ...Object.fromEntries(request.facts.headers), ...headers },
              body: new Uint8Array(request.body),
            }),
          ),
        catch: () => new ReleaseError({ code: "test-http", message: "HTTP write outcome unknown" }),
      })
      if (mode === "kill-after-commit") process.kill(process.pid, "SIGKILL")
      return yield* providers[0]!.decodeResponse(request, r)
    })
const transport: Transport = {
  send: () =>
    Effect.fail(new ReleaseError({ code: "unprepared", message: "Credentials were not prepared" })),
  prepare: (request) =>
    Effect.gen(function* () {
      if (!providers[0]!.ownsRequest(request))
        return yield* new ReleaseError({ code: "unowned", message: "Native request differs" })
      if (publication.authorization._tag !== "TokenAuthorization")
        return yield* new ReleaseError({ code: "test-auth", message: "Unexpected authorization" })
      const headers = yield* authorizeToken({
        authorization: publication.authorization,
        binding: request.facts,
        token: Redacted.make("credential-fixture"),
      })
      return send(headers)
    }),
}
const report = await Effect.runPromise(
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
      }
    }),
  ),
)
console.log(JSON.stringify(report))
