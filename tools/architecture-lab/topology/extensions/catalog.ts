import { Effect, Schema } from "effect"
import { LabError, NoReplay, makeRequest, type ProviderDefinition , HttpReceipt, corresponds } from "@lab/kernel"

export class CatalogIntent extends Schema.Class<CatalogIntent>("CatalogIntent")({
  endpoint: Schema.String, channel: Schema.String, digest: Schema.String
}) {}
const decode = Schema.decodeUnknownSync(CatalogIntent, { onExcessProperty: "error" })
const CatalogObservation=Schema.Union([Schema.Struct({status:Schema.Number}),Schema.Struct({digest:Schema.String})])
export const catalog: ProviderDefinition = {
  definitionId: "catalog.replace-channel", intentVersion: "1", intentCodec: CatalogIntent,
  receiptVersion:"1",receiptCodec:HttpReceipt,receiptCorresponds:(_operation,request,receipt)=>corresponds(request,receipt),classifyReceipt:()=>"Satisfied",
  observationVersion:"1",observationCodec:CatalogObservation,
  classifyObservation:(operation,evidence)=>{
    const intent=decode(operation.intent);const value=Schema.decodeUnknownSync(CatalogObservation)(evidence)
    return "status" in value ? value.status===404?"Absent":"Inconclusive" : value.digest===intent.digest?"Satisfied":"Conflict"
  },
  prepare: Effect.fn("Catalog.prepare")(function*(operation) {
    const intent = decode(operation.intent)
    return yield* makeRequest({
      transport: "core.http/1", endpoint: `${intent.endpoint}/catalog/${encodeURIComponent(intent.channel)}`,
      method: "PUT", headers: [["content-type", "application/json"]],
      body: new TextEncoder().encode(JSON.stringify({ digest: intent.digest })),
      principal: "local-protocol-fixture", scope: "catalog:replace", replay: new NoReplay({})
    })
  }),
  observe: Effect.fn("Catalog.observe")(function*(operation) {
    const intent = decode(operation.intent)
    return yield* Effect.tryPromise({
      try: async () => {
        const response = await fetch(`${intent.endpoint}/catalog/${encodeURIComponent(intent.channel)}`)
        if (response.status === 404) return { status: "Absent" as const, evidence: { status: 404 } }
        const evidence = await response.json() as { digest: string }
        return { status: evidence.digest === intent.digest ? "Satisfied" as const : "Conflict" as const, evidence }
      }, catch: cause => new LabError({ code: "catalog.observe", message: String(cause) })
    })
  })
}
