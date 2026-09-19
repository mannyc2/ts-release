import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { Effect, Layer, Redacted, Schema } from "effect"
import { Host, loadPlan, runRelease, ReleaseError } from "@mannyc1/ts-release"
import { Bundle } from "@mannyc1/ts-release/bundle"
import { openGitJournal } from "@mannyc1/ts-release/node"
import * as GitHub from "@mannyc1/ts-release-github"
const [root, origin, mode] = process.argv.slice(2)
const config = JSON.parse(await readFile(join(root, "config.json"), "utf8"))
const repository = new GitHub.Repository(config.repository),
  token = Redacted.make("protocol-fixture-token")
const target = (value) => {
  const url = new URL(value)
  return origin + url.pathname + url.search
}
const envelope = async (response) => ({
  status: response.status,
  headers: Object.fromEntries(response.headers),
  body: new Uint8Array(await response.arrayBuffer()),
})
const exchange = (request, headers) =>
  Effect.tryPromise({
    try: async () =>
      envelope(
        await fetch(target(request.url), {
          method: request.method,
          headers: { ...Object.fromEntries(request.headers), ...headers },
          ...(request.body ? { body: new Uint8Array(request.body) } : {}),
          redirect: "manual",
        }),
      ),
    catch: () =>
      new ReleaseError({ code: "fixture-http", message: "Protocol HTTP response unavailable" }),
  })
const providers = GitHub.definitions({
  bundle: Schema.decodeUnknownSync(Bundle)(config.bundle),
  readContent: (content) =>
    Effect.succeed(new Uint8Array(Buffer.from(config.contents[content.sha256], "base64"))),
  read: (request) =>
    Effect.gen(function* () {
      const headers = yield* GitHub.authorizeToken({
        repository,
        binding: { endpoint: request.url, principal: request.principal, scope: request.scope },
        token,
      })
      return yield* exchange(request, headers)
    }),
})
const plan = await Effect.runPromise(loadPlan(config.plan, providers))
let uploaded = 0
// This fixture deliberately bridges logical GitHub URLs to a local HTTP peer.
// Real shared HTTP preparation and hosted GET/download have separate witnesses.
const transport = {
  send: () =>
    Effect.fail(
      new ReleaseError({ code: "fixture-unprepared", message: "Missing prepared protocol send" }),
    ),
  prepare: (request) =>
    Effect.gen(function* () {
      const owners = providers.filter((provider) => provider.ownsRequest(request))
      if (owners.length !== 1)
        return yield* new ReleaseError({
          code: "fixture-owner",
          message: "Native request ownership differs",
        })
      const headers = yield* GitHub.authorizeToken({
        repository,
        binding: {
          endpoint: request.facts.endpoint,
          principal: request.facts.principal,
          scope: request.facts.scope,
        },
        token,
      })
      return (input) =>
        Effect.gen(function* () {
          const response = yield* exchange(
            {
              method: input.facts.method,
              url: input.facts.endpoint,
              headers: input.facts.headers,
              body: input.body,
            },
            headers,
          )
          if (
            owners[0].definitionId === "github.asset" &&
            ++uploaded === 2 &&
            mode === "kill-after-second-asset"
          )
            process.kill(process.pid, "SIGKILL")
          return yield* owners[0].decodeResponse(input, response)
        })
    }),
}
const result = await Effect.runPromise(
  Effect.scoped(
    Effect.gen(function* () {
      const store = yield* openGitJournal({
        cacheDirectory: root,
        remote: pathToFileURL(join(root, "journal.git")).href,
        gitExecutable: config.gitExecutable,
        principal: "fixture-history",
        scope: "release",
        timeoutMilliseconds: 5000,
        maximumOutputBytes: 4 * 1024 * 1024,
        credentials: () => Effect.succeed({ _tag: "Anonymous" }),
      })
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
        runtime: process.versions.bun
          ? `Bun${process.versions.bun}`
          : `Node${process.versions.node}`,
        report,
        dispatches: snapshot.events.filter((event) => event.body._tag === "DispatchStarted").length,
        receipts: snapshot.events.filter((event) => event.body._tag === "ReceiptAccepted").length,
      }
    }),
  ),
)
process.stdout.write(JSON.stringify(result) + "\n")
