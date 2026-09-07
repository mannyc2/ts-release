import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { Effect, Schema, Layer } from "effect"
import * as Npm from "@mannyc1/ts-release-npm"
import { Content, File, Bundle } from "@mannyc1/ts-release/bundle"
import { Host, createPlan, runRelease } from "@mannyc1/ts-release"
const bytes = new Uint8Array(await readFile(process.argv[2]))
const content = new Content({
  bytes: String(bytes.length),
  sha256: createHash("sha256").update(bytes).digest("hex"),
})
const file = Schema.decodeUnknownSync(File)({
  _tag: "OwnedFile",
  logicalName: "fixture.tgz",
  content,
  deliveryMode: 420,
  executable: null,
  provenance: { _tag: "IntrinsicProvenance", producer: "packed-native-consumer" },
})
const access = {
  bundle: new Bundle({ format: "ts-release/bundle/1", artifacts: [file] }),
  readContent: () => Effect.succeed(bytes),
}
const metadata = await Effect.runPromise(Npm.inspectTarball(file, access))
assert.equal(metadata.name, process.argv[3] ?? "@fixture/packed-npm")
const intent = new Npm.PublishIntent({
  registry: "https://registry.npmjs.org/",
  name: metadata.name,
  version: metadata.version,
  tarball: file,
  integrity: metadata.integrity,
  shasum: metadata.shasum,
  access: "public",
  initialTag: "latest",
  authorization: new Npm.TokenAuthorization({ principal: "consumer" }),
  provenance: new Npm.NoProvenance({}),
})
const operation = await Effect.runPromise(Npm.publish(intent)),
  plan = await Effect.runPromise(createPlan("packed-owned-fixture", [operation]))
const providers = Npm.definitions({
  ...access,
  read: () => Effect.succeed({ status: 404, headers: {}, body: new Uint8Array() }),
})
const events = []
let sends = 0
const store = {
  read: () => Effect.succeed({ revision: events.length, events: events.slice() }),
  append: (_id, revision, event) =>
    Effect.sync(() => {
      const prior = events.find((item) => item.eventId === event.eventId)
      if (prior) {
        assert.deepEqual(prior, event)
        return { _tag: "AlreadyRecorded", revision: events.indexOf(prior) + 1 }
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
        sends++
        assert.equal(providers[0].ownsRequest(request), true)
        const body = JSON.parse(new TextDecoder().decode(request.body))
        assert.equal(body.name, metadata.name)
        return yield* providers[0].decodeResponse(request, {
          status: 201,
          headers: {},
          body: new TextEncoder().encode('{"token":"must-not-be-retained"}'),
        })
      }),
  },
}
for (let attempt = 0; attempt < 2; attempt++) {
  const report = await Effect.runPromise(
    runRelease({ plan: JSON.parse(JSON.stringify(plan)), authorize: true }).pipe(
      Effect.provide(Layer.succeed(Host, host)),
    ),
  )
  assert.equal(report.operations[0].status, "Satisfied")
}
assert.equal(sends, 1)
assert.equal(JSON.stringify(events).includes("must-not-be-retained"), false)
console.log(
  JSON.stringify({
    runtime: process.version,
    bun: process.versions.bun ?? null,
    sends,
    events: events.length,
    outcome: "Satisfied",
    package: metadata.name,
    exports: Object.keys(Npm).sort(),
  }),
)
