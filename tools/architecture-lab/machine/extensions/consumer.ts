import { strict as assert } from "node:assert"
import { createHash } from "node:crypto"
import { createServer } from "node:http"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as core from "@lab/kernel"

const [mode = "P04", candidate = "M1"] = process.argv.slice(2)
assert(candidate === "M1" || candidate === "M2")
let sends = 0
let complete = false
let remoteDigest = ""
const server = createServer(async (request, response) => {
  if (request.method === "POST") {
    sends++
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    remoteDigest = createHash("sha256").update(Buffer.concat(chunks)).digest("hex")
    response.writeHead(202, { "content-type": "application/json" })
    response.end(JSON.stringify({ jobId: "native-job-1", digest: remoteDigest }))
  } else {
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify({ jobId: "native-job-1", digest: remoteDigest, state: complete ? "complete" : "queued" }))
  }
})
await new Promise<void>((resolve,reject) => { server.once("error",reject); server.listen(0,"127.0.0.1",resolve) })
const address = server.address()
assert(address && typeof address !== "string")
const endpoint = `http://127.0.0.1:${address.port}`
const Intent = Schema.Struct({ endpoint: Schema.String, value: Schema.String })
const Receipt = Schema.Struct({ status: Schema.Number, jobId: Schema.String, digest: Schema.String })
const Evidence = Schema.Struct({ jobId: Schema.String, digest: Schema.String, state: Schema.Literals(["absent","queued","complete"]) })
type NativeReceipt = typeof Receipt.Type
type NativeEvidence = typeof Evidence.Type
const delayedSemantics = { classifyReceipt: () => "Pending" as const }
const provider: core.ProviderDefinition = {
  ...delayedSemantics,
  definitionId: "fixture.delayed", intentVersion: "1", intentCodec: Intent,
  receiptVersion: "job-acceptance/1", receiptCodec: Receipt,
  receiptCorresponds: (_operation, request, native) => { const receipt = native as NativeReceipt; return receipt.status === 202 && receipt.jobId !== "" && receipt.digest === request.bodyDigest },
  observationVersion: "job-status/1", observationCodec: Evidence,
  classifyObservation: (_operation, input, receipts) => {
    const evidence = input as NativeEvidence
    if (evidence.state === "absent") return "Absent"
    if (!receipts.some((native) => { const receipt = native as NativeReceipt; return receipt.jobId === evidence.jobId && receipt.digest === evidence.digest })) return "Inconclusive"
    return evidence.state === "complete" ? "Satisfied" : "Pending"
  },
  prepare: (operation) => { const intent = operation.intent as typeof Intent.Type; return core.makeRequest({ transport: "core.http/1", endpoint: intent.endpoint, method: "POST", headers: [["content-type","application/octet-stream"]], body: new TextEncoder().encode(intent.value), principal: "fixture", scope: "queue", replay: new core.NoReplay({}) }) },
  observe: (_operation, context) => Effect.gen(function*() {
    if (context.own.receipts.length === 0) return { status: "Absent" as const, evidence: { jobId:"",digest:"",state:"absent" } }
    const response = yield* Effect.promise(() => fetch(endpoint))
    const evidence = yield* Effect.promise(() => response.json()) as Effect.Effect<NativeEvidence>
    return { status: provider.classifyObservation!(_operation,evidence,context.own.receipts), evidence }
  })
}
let history: core.JournalEvent[] = []
let serial = 0
const host: core.HostShape = {
  providers:[provider],now:()=>1000,uniqueId:()=>`event-${++serial}`,
  store: {
    read: () => Effect.succeed({ revision:history.length,events:history.slice() }),
    append: (_journalId,revision,event) => Effect.sync(() => {
      const existing = history.findIndex((prior)=>prior.eventId===event.eventId)
      if(existing>=0) { assert.equal(core.canonical(history[existing]),core.canonical(event)); return {_tag:"AlreadyRecorded" as const,revision:existing+1} }
      if(revision!==history.length)return {_tag:"RevisionMismatch" as const,revision:history.length}
      history.push(event);return {_tag:"Appended" as const,revision:history.length}
    })
  },
  transport: { send: (request) => Effect.gen(function*() {
    assert.equal(history.at(-1)?.body._tag,"DispatchStarted")
    const response = yield* Effect.promise(()=>fetch(request.facts.endpoint,{method:request.facts.method,body:new Uint8Array(request.body)}))
    const native = yield* Effect.promise(()=>response.json()) as Effect.Effect<{jobId:string;digest:string}>
    return {_tag:"Accepted" as const,receipt:{status:response.status,...native}}
  }) }
}
const execute = <A,E>(effect:Effect.Effect<A,E,core.Host>) => Effect.runPromise(Effect.provide(effect,Layer.succeed(core.Host,host)))
try {
  const operation = await Effect.runPromise(core.createOperation(provider,{endpoint,value:"exact delayed bytes"}))
  const plan = await Effect.runPromise(core.createPlan("delayed-owned-bundle",[operation]))
  if(mode==="P04") {
    const pending = await execute(core.runRelease({candidate,plan,authorize:true,observe:false}))
    assert.equal(pending.operations[0]?.status,"Pending","202 native acceptance must remain Pending until matching completion")
    assert.equal(sends,1)
    complete=true
    const resumed = await execute(core.runRelease({candidate,plan:JSON.parse(core.canonical(plan)),authorize:true}))
    assert.equal(resumed.operations[0]?.status,"Satisfied")
    assert.equal(resumed.operations[0]?.dispatches,1)
    assert.equal(sends,1)
  } else if(mode==="P09-live") {
    const report = await execute(core.runRelease({candidate,plan,authorize:true,observe:false,
      checkpoint:(stage)=>stage==="after-send"?core.supersedePlan({candidate,plan,authorize:true,reason:"replacement"}).pipe(Effect.asVoid,Effect.provide(Layer.succeed(core.Host,host))):Effect.void
    }))
    assert.equal(report.superseded,true)
    assert.equal(report.operations[0]?.receipts,1,"Late native acceptance must survive supersession")
    complete=true
    const observed=await execute(core.observeRelease({candidate,plan}))
    assert.equal(observed.operations[0]?.observations,1)
    await execute(core.runRelease({candidate,plan,authorize:true}))
    assert.equal(sends,1)
  } else if(mode==="P09-migrate") {
    await execute(core.runRelease({candidate,plan,authorize:true,observe:false}))
    await execute(core.supersedePlan({candidate,plan,authorize:true,reason:"reviewed old closure"}))
    const source=history.map(event=>({...event,format:"architecture-lab/event/1"}))
    const reviewedSourceSha256=await Effect.runPromise(core.hashCanonical("architecture-lab/recovery-import-source/1",source))
    const migrate=Reflect.get(core,"migrateRecoveryHistory") as undefined|((input:{plan:core.Plan;providers:readonly core.ProviderDefinition[];source:unknown;reviewedSourceSha256:string;authorize:boolean})=>Effect.Effect<readonly core.JournalEvent[],core.LabError>)
    assert.equal(typeof migrate,"function","Reviewed one-shot importer is part of this extension")
    await assert.rejects(Effect.runPromise(migrate!({plan,providers:[provider],source,reviewedSourceSha256:"wrong",authorize:true})),/source hash/)
    await assert.rejects(Effect.runPromise(migrate!({plan,providers:[provider],source,reviewedSourceSha256,authorize:false})),/explicit approval/)
    const prior=history
    history=[...await Effect.runPromise(migrate!({plan,providers:[provider],source,reviewedSourceSha256,authorize:true}))]
    assert.deepEqual(history.map(event=>({eventId:event.eventId,body:event.body})),prior.map(event=>({eventId:event.eventId,body:event.body})))
    assert(history.every(event=>String(event.format)==="architecture-lab/event/2"))
    complete=true
    const report=await execute(core.observeRelease({candidate,plan}))
    assert.equal(report.superseded,true)
    assert.equal(report.operations[0]?.observations,1)
    await execute(core.runRelease({candidate,plan,authorize:true}))
    assert.equal(sends,1)
    const valid=history
    history=source as unknown as core.JournalEvent[]
    await assert.rejects(execute(core.reportRelease({candidate,plan})),/architecture-lab\/event\/2/)
    history=valid
  } else throw Error(`Unknown mode ${mode}`)
  process.stdout.write(JSON.stringify({mode,candidate,sends,events:history.map(event=>event.body._tag),maxEventBytes:Math.max(...history.map(event=>Buffer.byteLength(core.canonical(event)))),status:"passed"}))
} finally {server.closeAllConnections();await new Promise<void>((resolve)=>server.close(()=>resolve()))}
