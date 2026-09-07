import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { NoReplay, makeRequest, type ProviderDefinition , HttpReceipt, corresponds } from "@lab/kernel"

export class ExternalIntent extends Schema.Class<ExternalIntent>("ExternalIntent")({
  endpoint: Schema.String,
  instanceId: Schema.String,
  value: Schema.String
}) {}
const decode = Schema.decodeUnknownSync(ExternalIntent, { onExcessProperty: "error" })

export const external: ProviderDefinition = {
  definitionId: "external.publish",
  intentVersion: "1",
  intentCodec: ExternalIntent,
  receiptVersion: "1", receiptCodec: HttpReceipt,
  receiptCorresponds: (_operation, request, receipt) => corresponds(request, receipt),
  ...{ classifyReceipt: () => "Satisfied" as const },
  prepare: Effect.fn("External.prepare")(function* (operation) {
    const intent = decode(operation.intent)
    return yield* makeRequest({
      transport: "core.http/1",
      endpoint: `${intent.endpoint}/external/${encodeURIComponent(intent.instanceId)}`,
      method: "PUT",
      headers: [["content-type", "application/json"]],
      body: new TextEncoder().encode(JSON.stringify({ instanceId: intent.instanceId, value: intent.value })),
      principal: "local-protocol-fixture",
      scope: "external:publish",
      replay: new NoReplay({})
    })
  })
}
