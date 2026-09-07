import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { createHash } from "node:crypto"
import { Effect, Schema, Layer } from "effect"
import * as PyPi from "@mannyc1/ts-release-pypi"
import { Content, File, Bundle } from "@mannyc1/ts-release/bundle"
import { Host, createPlan, runRelease } from "@mannyc1/ts-release"

const directory = process.argv[2]
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
      endpoint: new PyPi.PyPi({
        uploadUrl: "https://upload.pypi.org/legacy/",
        simpleUrl: "https://pypi.org/simple/",
      }),
      authorization: new PyPi.TokenAuthorization({ principal: "fixture", username: "__token__" }),
    }),
  )
}
let visible = false
const providers = PyPi.definitions({
  ...access,
  read: () =>
    Effect.succeed(
      visible
        ? {
            status: 200,
            headers: { "content-type": "application/vnd.pypi.simple.v1+json" },
            body: new TextEncoder().encode(
              JSON.stringify({
                meta: { "api-version": "1.4" },
                name: intents[0].project,
                files: intents.map((intent) => ({
                  filename: intent.filename,
                  url: `https://files.pythonhosted.org/${intent.filename}`,
                  hashes: { sha256: intent.distribution.content.sha256 },
                  size: Number(intent.distribution.content.bytes),
                  yanked: false,
                })),
              }),
            ),
          }
        : { status: 404, headers: {}, body: new Uint8Array() },
    ),
})
const plan = await Effect.runPromise(
  createPlan("packed-python-consumer", await Effect.runPromise(PyPi.author(intents))),
)
const events = []
let sends = 0
const store = {
  read: () => Effect.succeed({ revision: events.length, events: events.slice() }),
  append: (_id, revision, event) =>
    Effect.sync(() => {
      const prior = events.findIndex((entry) => entry.eventId === event.eventId)
      if (prior >= 0) {
        assert.deepEqual(events[prior], event)
        return { _tag: "AlreadyRecorded", revision: prior + 1 }
      }
      if (revision !== events.length) return { _tag: "RevisionMismatch", revision: events.length }
      events.push(event)
      return { _tag: "Appended", revision: events.length }
    }),
}
const host = {
  providers,
  store,
  now: Date.now,
  uniqueId: () => crypto.randomUUID(),
  transport: {
    send: (request) =>
      Effect.gen(function* () {
        assert.equal(providers[0].ownsRequest(request), true)
        const form = yield* Effect.promise(() =>
          new Response(request.body, {
            headers: Object.fromEntries(request.facts.headers),
          }).formData(),
        )
        const file = form.get("content"),
          native = intents.find((intent) => intent.filename === file.name)
        assert.equal(form.get("name"), native.project)
        const bytes = yield* Effect.promise(() => file.arrayBuffer())
        assert.equal(
          createHash("sha256").update(new Uint8Array(bytes)).digest("hex"),
          native.distribution.content.sha256,
        )
        sends++
        return yield* providers[0].decodeResponse(request, {
          status: 200,
          headers: {},
          body: new TextEncoder().encode("secret-must-not-persist"),
        })
      }),
  },
}
for (let attempt = 0; attempt < 3; attempt++) {
  visible = attempt === 2
  const report = await Effect.runPromise(
    runRelease({ plan: JSON.parse(JSON.stringify(plan)), authorize: true }).pipe(
      Effect.provide(Layer.succeed(Host, host)),
    ),
  )
  assert.equal(report.operations.length, 4)
  assert.ok(
    report.operations.every(
      (operation) => operation.status === (attempt === 1 ? "Pending" : "Satisfied"),
    ),
  )
  assert.equal(sends, 4)
}
assert.equal(sends, 4)
assert.equal(JSON.stringify(events).includes("secret-must-not-persist"), false)
// Installed private data/JS dependencies must admit the same native controls.
const oracle = JSON.parse(await readFile(join(directory, "metadata-oracle.json"), "utf8"))
for (const row of oracle.cases) {
  const bytes = new Uint8Array(Buffer.from(row.archiveBase64, "base64"))
  const file = Schema.decodeUnknownSync(File)({
    ...artifacts[0],
    logicalName: oracle.filename,
    content: new Content({ bytes: String(bytes.length), sha256: row.sha256 }),
  })
  const effect = PyPi.inspectDistribution(file, oracle.filename, {
    bundle: new Bundle({ format: "ts-release/bundle/1", artifacts: [file] }),
    readContent: () => Effect.succeed(bytes),
  })
  if (row.accepted) await Effect.runPromise(effect)
  else await assert.rejects(() => Effect.runPromise(effect))
}
console.log(
  JSON.stringify({
    runtime: process.version,
    bun: process.versions.bun ?? null,
    sends,
    events: events.length,
    outcome: "Satisfied",
    nativeMetadataControls: oracle.cases.length,
    exports: Object.keys(PyPi).sort(),
  }),
)
