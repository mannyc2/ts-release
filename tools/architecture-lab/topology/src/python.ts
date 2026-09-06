import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { LabError, NoReplay, makeRequest, type ProviderDefinition } from "@lab/kernel"
import { HttpReceipt, corresponds } from "./http-evidence.js"

export class PythonFileIntent extends Schema.Class<PythonFileIntent>("PythonFileIntent")({
  index: Schema.String,
  project: Schema.String,
  version: Schema.String,
  filename: Schema.String,
  filetype: Schema.Literals(["bdist_wheel", "sdist"]),
  pythonVersion: Schema.String,
  contentBase64: Schema.String,
  sha256: Schema.String
}) {}

const decode = Schema.decodeUnknownSync(PythonFileIntent, { onExcessProperty: "error" })
const PythonObservation = Schema.Union([
  Schema.Struct({ status: Schema.Number }),
  Schema.Struct({ urls: Schema.Array(Schema.Struct({ filename: Schema.String, digests: Schema.Struct({ sha256: Schema.String }), size: Schema.Number })) })
])
export const python: ProviderDefinition = {
  definitionId: "python.upload-file",
  intentVersion: "1",
  intentCodec: PythonFileIntent,
  receiptVersion: "1", receiptCodec: HttpReceipt,
  receiptCorresponds: (_operation, request, receipt) => corresponds(request, receipt),
  ...{ classifyReceipt: () => "Satisfied" as const },
  observationVersion: "1", observationCodec: PythonObservation,
  classifyObservation: (operation, evidence) => {
    const intent = decode(operation.intent)
    const value = Schema.decodeUnknownSync(PythonObservation)(evidence)
    if ("status" in value) return value.status === 404 ? "Absent" : "Inconclusive"
    const file = value.urls.find(file => file.filename === intent.filename)
    return file === undefined ? "Absent" : file.digests.sha256 === intent.sha256 ? "Satisfied" : "Conflict"
  },
  prepare: Effect.fn("Python.prepare")(function* (operation) {
    const intent = yield* Effect.try({
      try: () => decode(operation.intent),
      catch: (cause) => new LabError({ code: "python.intent", message: String(cause) })
    })
    const form = new FormData()
    for (const [key, value] of Object.entries({
      ":action": "file_upload",
      protocol_version: "1",
      name: intent.project,
      version: intent.version,
      filetype: intent.filetype,
      pyversion: intent.pythonVersion,
      sha256_digest: intent.sha256
    })) form.append(key, value)
    form.append("content", new Blob([Uint8Array.from(atob(intent.contentBase64), (value) => value.charCodeAt(0))]), intent.filename)
    // Materialize the generated multipart boundary and exact body BEFORE the
    // journal append, so send uses these bytes rather than re-encoding a form.
    const request = new Request(`${intent.index}/legacy/`, { method: "POST", body: form })
    // Bun lazily initializes FormData headers; read before consuming its body.
    const contentType = request.headers.get("content-type")
    if (contentType === null) return yield* Effect.fail(new LabError({ code: "python.multipart", message: "Multipart content type is unavailable" }))
    const body = yield* Effect.promise(() => request.arrayBuffer())
    return yield* makeRequest({
      transport: "core.http/1",
      endpoint: request.url,
      method: "POST",
      headers: [["content-type", contentType]],
      body: new Uint8Array(body),
      principal: "local-protocol-fixture",
      scope: "python:upload",
      replay: new NoReplay({})
    })
  }),
  observe: Effect.fn("Python.observe")(function* (operation) {
    const intent = decode(operation.intent)
    return yield* Effect.tryPromise({
      try: async () => {
        const response = await fetch(`${intent.index}/pypi/${encodeURIComponent(intent.project)}/${intent.version}/json`)
        if (response.status === 404) return { status: "Absent" as const, evidence: { status: 404 } }
        if (!response.ok) return { status: "Inconclusive" as const, evidence: { status: response.status } }
        const value = await response.json() as { urls?: Array<{ filename: string; digests: { sha256: string } }> }
        const file = value.urls?.find((candidate) => candidate.filename === intent.filename)
        return { status: file === undefined ? "Absent" as const : file.digests.sha256 === intent.sha256 ? "Satisfied" as const : "Conflict" as const, evidence: value }
      },
      catch: (cause) => new LabError({ code: "python.observe", message: String(cause) })
    })
  })
}
