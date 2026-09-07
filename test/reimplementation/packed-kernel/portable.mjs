import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect, Layer, Schema } from "effect"
import {
  Host,
  PROVIDER_CONTRACT,
  NoReplay,
  createOperation,
  createPlan,
  makeRequest,
  runRelease,
} from "@mannyc1/ts-release"
import { HttpReceipt, corresponds } from "@mannyc1/ts-release/http"
import { File, finalize, encodeBundle, loadBundle } from "@mannyc1/ts-release/bundle"
import { fileContentOwner } from "@mannyc1/ts-release/node"

const contentDirectory = await mkdtemp(join(tmpdir(), "packed-content-"))
try {
  const owner = fileContentOwner(contentDirectory)
  const input = new Uint8Array([1, 2, 3])
  const content = await Effect.runPromise(owner.putOwned(input))
  const file = new File({
    logicalName: "example.txt",
    content,
    deliveryMode: 0o644,
    executable: null,
    provenance: { _tag: "IntrinsicProvenance", producer: "packed-consumer/source-bytes" },
  })
  const bundle = await Effect.runPromise(finalize([file]))
  assert.deepEqual(await Effect.runPromise(loadBundle(owner, encodeBundle(bundle))), bundle)
  input[0] = 9
  assert.deepEqual(await Effect.runPromise(owner.read(content)), new Uint8Array([1, 2, 3]))
} finally {
  await rm(contentDirectory, { recursive: true, force: true })
}

const provider = {
  contract: PROVIDER_CONTRACT,
  definitionId: "consumer/publish",
  intentVersion: "1",
  intentCodec: Schema.Struct({ coordinate: Schema.String }),
  receiptVersion: "http/1",
  receiptCodec: HttpReceipt,
  receiptCorresponds: (_operation, request, receipt) => corresponds(request, receipt),
  classifyReceipt: () => "Satisfied",
  prepare: () =>
    makeRequest({
      transport: "core.http/1",
      endpoint: "https://consumer.invalid/package",
      method: "PUT",
      headers: [],
      body: new Uint8Array([1, 2, 3]),
      principal: "consumer",
      scope: "publish",
      replay: new NoReplay({}),
    }),
}
const operation = await Effect.runPromise(createOperation(provider, { coordinate: "example@1" }))
const plan = await Effect.runPromise(createPlan("consumer-bundle", [operation]))
const events = []
let sends = 0
const host = {
  providers: [provider],
  now: () => 1,
  uniqueId: () => crypto.randomUUID(),
  store: {
    read: () => Effect.succeed({ revision: events.length, events: [...events] }),
    append: (_journal, revision, event) =>
      Effect.sync(() => {
        if (revision !== events.length) return { _tag: "RevisionMismatch", revision: events.length }
        events.push(event)
        return { _tag: "Appended", revision: events.length }
      }),
  },
  transport: {
    send: (request) =>
      Effect.sync(() => {
        assert.equal(events.at(-1).body._tag, "DispatchStarted")
        sends++
        return {
          _tag: "Accepted",
          receipt: {
            status: 201,
            body: "ok",
            endpoint: request.facts.endpoint,
            method: request.facts.method,
            bodyDigest: request.facts.bodyDigest,
          },
        }
      }),
  },
}
for (let invocation = 0; invocation < 2; invocation++) {
  const report = await Effect.runPromise(
    runRelease({ plan, authorize: true }).pipe(Effect.provide(Layer.succeed(Host, host))),
  )
  assert.equal(report.operations[0].status, "Satisfied")
}
assert.equal(sends, 1)
assert.equal(events.length, 2)
console.log(
  JSON.stringify({ outcome: "Satisfied", sends, events: events.length, runtime: process.version }),
)
