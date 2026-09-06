import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { LabError, NoReplay, makeRequest, type ProviderDefinition } from "@lab/kernel"
import { HttpReceipt, corresponds } from "./http-evidence.js"

export class NpmIntent extends Schema.Class<NpmIntent>("NpmIntent")({
  registry: Schema.String,
  packageName: Schema.String,
  version: Schema.String,
  initialTag: Schema.String,
  filename: Schema.String,
  tarballBase64: Schema.String,
  integrity: Schema.String
}) {}

const decode = Schema.decodeUnknownSync(NpmIntent, { onExcessProperty: "error" })
const NpmObservation = Schema.Union([
  Schema.Struct({ status: Schema.Number }),
  Schema.Struct({ name: Schema.String, version: Schema.String, dist: Schema.Struct({ tarball: Schema.String, integrity: Schema.String }) })
])

export const npm: ProviderDefinition = {
  definitionId: "npm.publish",
  intentVersion: "1",
  intentCodec: NpmIntent,
  receiptVersion: "1", receiptCodec: HttpReceipt,
  receiptCorresponds: (_operation, request, receipt) => corresponds(request, receipt),
  ...{ classifyReceipt: () => "Satisfied" as const },
  observationVersion: "1", observationCodec: NpmObservation,
  classifyObservation: (operation, evidence) => {
    const intent = decode(operation.intent)
    const value = Schema.decodeUnknownSync(NpmObservation)(evidence)
    return "status" in value ? value.status === 404 ? "Absent" : "Inconclusive"
      : value.name === intent.packageName && value.version === intent.version && value.dist.integrity === intent.integrity ? "Satisfied" : "Conflict"
  },
  prepare: Effect.fn("Npm.prepare")(function* (operation) {
    const intent = yield* Effect.try({
      try: () => decode(operation.intent),
      catch: (cause) => new LabError({ code: "npm.intent", message: String(cause) })
    })
    const bytes = Uint8Array.from(atob(intent.tarballBase64), (value) => value.charCodeAt(0))
    const tarball = `${intent.registry}/${intent.packageName}/-/${intent.filename}`
    const body = new TextEncoder().encode(JSON.stringify({
      _id: intent.packageName,
      name: intent.packageName,
      "dist-tags": { [intent.initialTag]: intent.version },
      versions: {
        [intent.version]: {
          name: intent.packageName,
          version: intent.version,
          dist: { tarball, integrity: intent.integrity }
        }
      },
      _attachments: {
        [intent.filename]: {
          content_type: "application/octet-stream",
          data: intent.tarballBase64,
          length: bytes.byteLength
        }
      }
    }))
    return yield* makeRequest({
      transport: "core.http/1",
      endpoint: `${intent.registry}/${encodeURIComponent(intent.packageName)}`,
      method: "PUT",
      headers: [["content-type", "application/json"]],
      body,
      principal: "local-protocol-fixture",
      scope: "npm:publish",
      replay: new NoReplay({})
    })
  }),
  observe: Effect.fn("Npm.observe")(function* (operation) {
    const intent = decode(operation.intent)
    return yield* Effect.tryPromise({
      try: async () => {
        const response = await fetch(`${intent.registry}/${encodeURIComponent(intent.packageName)}/${intent.version}`)
        if (response.status === 404) return { status: "Absent" as const, evidence: { status: 404 } }
        if (!response.ok) return { status: "Inconclusive" as const, evidence: { status: response.status } }
        const value = await response.json() as { dist?: { integrity?: string }; name?: string; version?: string }
        return {
          status: value.name === intent.packageName && value.version === intent.version && value.dist?.integrity === intent.integrity
            ? "Satisfied" as const : "Conflict" as const,
          evidence: value
        }
      },
      catch: (cause) => new LabError({ code: "npm.observe", message: String(cause) })
    })
  })
}
