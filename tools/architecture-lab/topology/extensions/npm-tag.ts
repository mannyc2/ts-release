import { Effect, Schema } from "effect"
import { LabError, NoReplay, makeRequest, type ProviderDefinition } from "@lab/kernel"
import { HttpReceipt, corresponds } from "./http-evidence.js"

export class NpmTagIntent extends Schema.Class<NpmTagIntent>("NpmTagIntent")({
  registry: Schema.String, packageName: Schema.String, tag: Schema.String, version: Schema.String
}) {}
const decodeTag = Schema.decodeUnknownSync(NpmTagIntent, { onExcessProperty: "error" })
const TagValues=Schema.Record(Schema.String,Schema.String)
const TagObservation=Schema.Union([Schema.Struct({status:Schema.Number}),TagValues])
export const npmTag: ProviderDefinition = {
  definitionId: "npm.set-dist-tag", intentVersion: "1", intentCodec: NpmTagIntent,
  receiptVersion:"1",receiptCodec:HttpReceipt,receiptCorresponds:(_operation,request,receipt)=>corresponds(request,receipt),classifyReceipt:()=>"Satisfied",
  observationVersion:"1",observationCodec:TagObservation,
  classifyObservation:(operation,evidence)=>{
    const intent=decodeTag(operation.intent);const value=Schema.decodeUnknownSync(TagObservation)(evidence)
    if(typeof value.status==="number")return value.status===404?"Absent":"Inconclusive"
    const tags=Schema.decodeUnknownSync(TagValues)(value)
    return tags[intent.tag]===undefined?"Absent":tags[intent.tag]===intent.version?"Satisfied":"Conflict"
  },
  prepare: Effect.fn("NpmTag.prepare")(function*(operation) {
    const intent = decodeTag(operation.intent)
    return yield* makeRequest({
      transport: "core.http/1", endpoint: `${intent.registry}/-/package/${encodeURIComponent(intent.packageName)}/dist-tags/${encodeURIComponent(intent.tag)}`,
      method: "PUT", headers: [["content-type", "application/json"]],
      body: new TextEncoder().encode(JSON.stringify(intent.version)),
      principal: "local-protocol-fixture", scope: "npm:tag", replay: new NoReplay({})
    })
  }),
  observe: Effect.fn("NpmTag.observe")(function*(operation) {
    const intent = decodeTag(operation.intent)
    return yield* Effect.tryPromise({
      try: async () => {
        const response = await fetch(`${intent.registry}/-/package/${encodeURIComponent(intent.packageName)}/dist-tags`)
        if (response.status === 404) return { status: "Absent" as const, evidence: { status: 404 } }
        const evidence = await response.json() as Record<string, string>
        return { status: evidence[intent.tag] === undefined ? "Absent" as const : evidence[intent.tag] === intent.version ? "Satisfied" as const : "Conflict" as const, evidence }
      }, catch: cause => new LabError({ code: "npm.tag-observe", message: String(cause) })
    })
  })
}
