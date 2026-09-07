import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { createHash } from "node:crypto"
import { Effect, Schema, Layer, Redacted } from "effect"
import * as PyPi from "@mannyc1/ts-release-pypi"
import { Content, File, Bundle } from "@mannyc1/ts-release/bundle"
import { Host, createPlan, runRelease } from "@mannyc1/ts-release"

import { pathToFileURL } from "node:url"
import { makeHttpRead, makeHttpTransport, openGitJournal } from "@mannyc1/ts-release/node"
const [root, mode, directory, gitExecutable] = process.argv.slice(2)
const config = JSON.parse(await readFile(join(root, "worker.json"), "utf8"))
const endpoint = Schema.decodeUnknownSync(PyPi.Endpoint)(config.endpoint)
const authorization = new PyPi.TokenAuthorization({
  principal: "fixture",
  username: config.username,
})
const build = JSON.parse(await readFile(join(directory, "build.json"), "utf8"))
const contents = new Map(),
  artifacts = []
for (const entry of build.files) {
  const bytes = new Uint8Array(await readFile(join(directory, "distributions", entry.filename)))
  assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256)
  contents.set(entry.sha256, bytes)
  artifacts.push(
    Schema.decodeUnknownSync(File)({
      _tag: "OwnedFile",
      logicalName: entry.filename,
      content: new Content({ bytes: String(bytes.length), sha256: entry.sha256 }),
      deliveryMode: 420,
      executable: null,
      provenance: { _tag: "IntrinsicProvenance", producer: "packed-python-consumer" },
    }),
  )
}
const access = {
  bundle: new Bundle({ format: "ts-release/bundle/1", artifacts }),
  readContent: (content) => Effect.succeed(new Uint8Array(contents.get(content.sha256))),
}
const intents = []
for (const distribution of artifacts) {
  const { kind, ...metadata } = await Effect.runPromise(
    PyPi.inspectDistribution(distribution, distribution.logicalName, access),
  )
  assert.equal(metadata.project, "ts-release-native-fixture")
  assert.equal(metadata.version, "1.2.3")
  intents.push(
    Schema.decodeUnknownSync(PyPi.UploadIntent)({
      _tag: kind === "wheel" ? "WheelUpload" : "SdistUpload",
      ...metadata,
      distribution,
      endpoint,
      authorization,
    }),
  )
}
const providers = PyPi.definitions({
  ...access,
  read: makeHttpRead({
    credentials: () => Effect.succeed({}),
    timeoutMilliseconds: 5000,
    maximumResponseBytes: 4 * 1024 * 1024,
  }),
})
const transport = makeHttpTransport({
  providers,
  credentials: (binding) =>
    PyPi.authorizeToken({
      authorization,
      endpoint,
      binding,
      token: Redacted.make(config.password),
    }),
  timeoutMilliseconds: 5000,
  maximumResponseBytes: 4 * 1024 * 1024,
})
const plan = await Effect.runPromise(
  createPlan("native-complete-host", await Effect.runPromise(PyPi.author(intents))),
)
const result = await Effect.runPromise(
  Effect.scoped(
    Effect.gen(function* () {
      const journal = yield* openGitJournal({
        cacheDirectory: root,
        remote: pathToFileURL(join(root, "journal.git")).href,
        principal: "journal",
        scope: "history",
        gitExecutable,
        timeoutMilliseconds: 5000,
        maximumOutputBytes: 4 * 1024 * 1024,
        credentials: () => Effect.succeed({ _tag: "Anonymous" }),
      })
      let acknowledgments = 0
      const store = {
        read: journal.read,
        append: (id, revision, event) =>
          Effect.gen(function* () {
            if (event.body._tag === "ReceiptAccepted" && ++acknowledgments === 2 && mode === "kill")
              process.kill(process.pid, "SIGKILL")
            return yield* journal.append(id, revision, event)
          }),
      }
      const report = yield* runRelease({ plan, authorize: true }).pipe(
        Effect.provide(
          Layer.succeed(Host, {
            store,
            transport,
            providers,
            now: Date.now,
            uniqueId: () => crypto.randomUUID(),
          }),
        ),
      )
      const history = yield* journal.read(plan.journalId)
      return {
        report,
        dispatches: history.events.filter((event) => event.body._tag === "DispatchStarted").length,
        receipts: history.events.filter((event) => event.body._tag === "ReceiptAccepted").length,
      }
    }),
  ),
)
process.stdout.write(JSON.stringify(result) + "\n")
