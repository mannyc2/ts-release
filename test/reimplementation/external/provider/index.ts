import { Effect, Schema } from "effect"
import {
  PROVIDER_CONTRACT,
  NoReplay,
  ReleaseError,
  type Json,
  type Operation,
  type PreparedRequest,
  type Transport,
  makeRequest,
} from "@mannyc1/ts-release"
import { File, type ReadContent } from "@mannyc1/ts-release/bundle"
import { type HttpProviderDefinition, type HttpRead, decodeJson } from "@mannyc1/ts-release/http"
import * as Git from "@mannyc1/ts-release/git"

const fields = {
  endpoint: Schema.String,
  account: Schema.String,
  key: Schema.String,
  payload: Schema.Struct({ artifact: File, labels: Schema.Array(Schema.String) }),
}
export class Upload extends Schema.TaggedClass<Upload>()("Upload", fields) {}
export class Opaque extends Schema.TaggedClass<Opaque>()("Opaque", {
  ...fields,
  sequence: Schema.Number,
}) {}
export const Intent = Schema.Union([Upload, Opaque])
export type Intent = typeof Intent.Type
export const intentCodec: Schema.Codec<Intent, Json, never, never> = Schema.toCodecJson(Intent)
export const intentCanonicalVersion = "fixture.intent-canonical/1"
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  return `{${Object.entries(value)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
    .join(",")}}`
}
export const encodeIntent = (value: Intent): Uint8Array =>
  new TextEncoder().encode(
    `${intentCanonicalVersion}\0${canonical(Schema.encodeSync(intentCodec)(value))}\n`,
  )

export class Receipt extends Schema.TaggedClass<Receipt>()("PutReceipt", {
  endpoint: Schema.String,
  account: Schema.String,
  key: Schema.String,
  digest: Schema.String,
  id: Schema.String,
  state: Schema.Literals(["created", "pending"]),
}) {}
export class Observation extends Schema.Class<Observation>("ExternalObservation")({
  endpoint: Schema.String,
  account: Schema.String,
  key: Schema.String,
  digest: Schema.NullOr(Schema.String),
  state: Schema.Literals(["Absent", "Satisfied", "Conflict", "Pending", "Inconclusive"]),
}) {}
export class NativeError extends Schema.TaggedError<NativeError>()("NativeError", {
  endpoint: Schema.String,
  account: Schema.String,
  key: Schema.String,
  digest: Schema.String,
  code: Schema.Literals(["Denied", "AcknowledgementLost"]),
}) {}
const invalid = () =>
  new ReleaseError({ code: "external-fixture", message: "Invalid native evidence" })
const decode = <A>(codec: Schema.Codec<A, unknown>, value: unknown): A =>
  Schema.is(codec)(value)
    ? value
    : Schema.decodeUnknownSync(codec, { onExcessProperty: "error" })(value)
const intent = (operation: Operation) => decode(Intent, operation.intent)
const binding = (
  operation: Operation,
  value: { endpoint: string; account: string; key: string },
) => {
  const input = intent(operation)
  return (
    value.endpoint === input.endpoint && value.account === input.account && value.key === input.key
  )
}
const requestMatches = (input: Intent, request: PreparedRequest["facts"]): boolean =>
  request.endpoint === input.endpoint &&
  request.principal === input.account &&
  request.scope === input.key &&
  request.bodyDigest === input.payload.artifact.content.sha256 &&
  request.byteLength === input.payload.artifact.content.bytes &&
  request.method === "POST" &&
  request.transport === (input._tag === "Upload" ? "core.http/1" : "opaque/1") &&
  request.replay._tag === "None" &&
  canonical(request.headers) ===
    canonical([
      ["content-type", "application/octet-stream"],
      ["x-external-key", input.key],
    ])

export const definition = (options: {
  readonly readContent: ReadContent
  readonly read: HttpRead
}) => {
  const requests = new Map<string, Intent>()
  const classify = (operation: Operation, input: unknown) => {
    const value = decode(Observation, input)
    if (!binding(operation, value)) throw invalid()
    return value.state === "Satisfied" &&
      value.digest !== intent(operation).payload.artifact.content.sha256
      ? ("Conflict" as const)
      : value.state
  }
  const provider: HttpProviderDefinition = {
    contract: PROVIDER_CONTRACT,
    definitionId: "fixture.external.put",
    intentVersion: "1",
    intentCodec,
    receiptVersion: "fixture.put-receipt/1",
    receiptCodec: Receipt,
    requestCorresponds: (operation, request) => requestMatches(intent(operation), request),
    receiptCorresponds: (operation, request, input) => {
      const value = decode(Receipt, input)
      return (
        requestMatches(intent(operation), request) &&
        binding(operation, value) &&
        value.digest === request.bodyDigest &&
        value.id === `native:${value.key}`
      )
    },
    classifyReceipt: (_, __, input) =>
      decode(Receipt, input).state === "created" ? "Satisfied" : "Pending",
    dispatchError: {
      version: "fixture.native-error/1",
      codec: NativeError,
      corresponds: (operation, request, input) => {
        const value = decode(NativeError, input)
        return (
          binding(operation, value) &&
          value.digest === request.bodyDigest &&
          value.code === "AcknowledgementLost"
        )
      },
    },
    rejection: {
      version: "fixture.native-error/1",
      codec: NativeError,
      corresponds: (operation, request, input) => {
        const value = decode(NativeError, input)
        return (
          binding(operation, value) &&
          value.digest === request.bodyDigest &&
          value.code === "Denied"
        )
      },
    },
    observationVersion: "fixture.observation/1",
    observationCodec: Observation,
    classifyObservation: classify,
    observe: Effect.fn("external.observe")(function* (operation) {
      const input = intent(operation)
      let evidence: Observation
      if (input._tag === "Opaque") {
        evidence = new Observation({
          endpoint: input.endpoint,
          account: input.account,
          key: input.key,
          digest: null,
          state: "Inconclusive",
        })
      } else {
        const response = yield* options.read({
          method: "GET",
          url: input.endpoint,
          headers: [],
          principal: input.account,
          scope: input.key,
        })
        if (response.status !== 200) return yield* invalid()
        evidence = yield* Effect.try({
          try: () => decode(Observation, decodeJson(response.body)),
          catch: invalid,
        })
      }
      return { status: classify(operation, evidence), evidence }
    }),
    prepare: Effect.fn("external.prepare")(function* (operation) {
      const input = intent(operation)
      const body = yield* options
        .readContent(input.payload.artifact.content)
        .pipe(Effect.mapError(() => invalid()))
      const request = yield* makeRequest({
        endpoint: input.endpoint,
        principal: input.account,
        scope: input.key,
        transport: input._tag === "Upload" ? "core.http/1" : "opaque/1",
        method: "POST",
        headers: [
          ["content-type", "application/octet-stream"],
          ["x-external-key", input.key],
        ],
        replay: new NoReplay({}),
        body,
      })
      if (!requestMatches(input, request.facts)) return yield* invalid()
      requests.set(canonical(request.facts), input)
      return request
    }),
    ownsRequest: (request) =>
      request.facts.transport === "core.http/1" && requests.has(canonical(request.facts)),
    decodeResponse: (request, response) =>
      Effect.try({
        try: () => {
          const value = decodeJson(response.body)
          if (response.status === 403)
            return {
              _tag: "RejectedBeforeCommit" as const,
              proof: Schema.encodeSync(NativeError)(decode(NativeError, value)),
            }
          if (response.status !== 201 && response.status !== 202) throw invalid()
          const receipt = decode(Receipt, value)
          if (receipt.state !== (response.status === 201 ? "created" : "pending")) throw invalid()
          return { _tag: "Accepted" as const, receipt }
        },
        catch: invalid,
      }),
  }
  const opaqueTransport = (
    prepareWrite: (
      input: Opaque,
    ) => Effect.Effect<(bytes: Uint8Array) => ReturnType<Transport["send"]>, ReleaseError>,
  ): Transport => {
    const prepare = Effect.fn("external.prepareOpaqueDispatch")(function* (
      request: PreparedRequest,
    ) {
      const key = canonical(request.facts),
        input = requests.get(key)
      if (!input || input._tag !== "Opaque") return yield* invalid()
      const write = yield* prepareWrite(input)
      return Effect.fn("external.opaqueDispatch")(function* (actual: PreparedRequest) {
        if (canonical(actual.facts) !== key) return yield* invalid()
        return yield* write(actual.body)
      })
    })
    return {
      prepare,
      send: Effect.fn(function* (request) {
        return yield* (yield* prepare(request))(request)
      }),
    }
  }
  return { provider, opaqueTransport }
}

/** An external definition composes the public Git contracts, without importing
 * any first-party provider or private kernel path. */
export const gitDefinition = (options: Parameters<typeof Git.definition>[0]) => ({
  ...Git.definition(options),
  definitionId: "fixture.external.git",
})
export { CachingJournalStore } from "./cache.js"
export { transitionMachine } from "./machine.js"
