import { readFile, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { Effect, Layer, Schema } from "effect"
import {
  Host, LabError, NoReplay, Plan, createOperation, createPlan, makeRequest, runRelease,
  type ProviderDefinition, type Transport, PROVIDER_CONTRACT } from "../machine/src/index.js"
import { evaluators, type EvaluatorName } from "../machine/test/fixtures.js"
import { SqliteJournal } from "../storage/sqlite.js"

const [endpoint, directory, candidate, stage] = process.argv.slice(2) as [string, string, EvaluatorName, string]
const run = Effect.runPromise
const nativeReceipt = Schema.Struct({ status: Schema.Number, endpoint: Schema.String,
  requestDigest: Schema.String, id: Schema.Number, tag: Schema.String, name: Schema.optionalKey(Schema.String) })
const common = {
  intentVersion: "1", receiptVersion: "native-release/1", receiptCodec: nativeReceipt,
  classifyReceipt: () => "Satisfied" as const,
  receiptCorresponds: (_: unknown, request: { endpoint: string; bodyDigest: string }, receipt: unknown) => {
    const value = receipt as typeof nativeReceipt.Type
    return value.status === 201 && value.endpoint === request.endpoint && value.requestDigest === request.bodyDigest
  }
}
const make = (path: string, body: unknown) => makeRequest({
  transport: "core.http/1", endpoint: `${endpoint}${path}`, method: "POST",
  headers: [["content-type", "application/json"]], principal: "research-owner",
  scope: "research-release", replay: new NoReplay({}), body: new TextEncoder().encode(JSON.stringify(body))
})
const create: ProviderDefinition = {
  ...common, contract: PROVIDER_CONTRACT, definitionId: "research.create-release",
  intentCodec: Schema.Struct({ tag: Schema.String }),
  prepare: operation => make("/releases", operation.intent)
}
const upload: ProviderDefinition = {
  ...common, contract: PROVIDER_CONTRACT, definitionId: "research.upload-asset",
  intentCodec: Schema.Struct({ parent: Schema.String, name: Schema.String }),
  prepare: Effect.fn("research.bindNativeReleaseId")(function*(operation, context) {
    const intent = operation.intent as { parent: string; name: string }
    if (!Object.isFrozen(context) || !Object.isFrozen(context.dependencies) || context.dependencies.length !== 1) {
      return yield* new LabError({ code: "dependency-context", message: "Expected one immutable, declared dependency" })
    }
    const dependency = context.dependencies[0]!
    if (dependency.operation.operationId !== intent.parent || dependency.receipts.length !== 1) {
      return yield* new LabError({ code: "native-parent", message: "Native parent receipt is unavailable" })
    }
    const parent = Schema.decodeUnknownSync(nativeReceipt)(dependency.receipts[0])
    const actual = yield* Effect.tryPromise({
      try: async () => await (await fetch(`${endpoint}/releases/by-tag/${encodeURIComponent(parent.tag)}`)).json() as { id: number },
      catch: error => new LabError({ code: "read", message: String(error) })
    })
    if (actual.id !== parent.id) return yield* new LabError({ code: "native-parent-changed", message: "Observed release ID differs from durable parent receipt" })
    return yield* make(`/releases/${parent.id}/assets`, { name: intent.name, tag: parent.tag })
  })
}
const transport: Transport = {
  send: request => Effect.tryPromise({ try: async () => {
    const response = await fetch(request.facts.endpoint, { method: request.facts.method,
      headers: new Headers(request.facts.headers as [string, string][]), body: new Uint8Array(request.body) })
    const native = await response.json() as { id: number; tag: string }
    return { _tag: "Accepted" as const, receipt: { ...native, status: response.status,
      endpoint: request.facts.endpoint, requestDigest: request.facts.bodyDigest } }
  }, catch: error => new LabError({ code: "send", message: String(error) }) })
}
const path = `${directory}/plan.json`
const plan = stage === "create" ? await run(Effect.gen(function*() {
  const parent = yield* createOperation(create, { tag: "v1.0.0" })
  const asset = yield* createOperation(upload, { parent: parent.operationId, name: "artifact.tgz" }, [parent.operationId])
  return yield* createPlan("owned-bundle-fixture", [parent, asset])
})) : Schema.decodeUnknownSync(Plan)(JSON.parse(await readFile(path, "utf8")))
if (stage === "create") await writeFile(path, JSON.stringify(Schema.encodeSync(Plan)(plan)))
const store = new SqliteJournal(`${directory}/journal.sqlite`)
try {
  const result = await run(runRelease({ plan, authorize: true, observe: false,
    maxDispatches: stage === "create" ? 1 : 2 }).pipe(Effect.provide(Layer.succeed(Host, {
      store, transport, providers: [create, upload], now: Date.now, uniqueId: randomUUID, machine: evaluators[candidate]
    }))))
  console.log(JSON.stringify(result))
} finally { store.close() }
