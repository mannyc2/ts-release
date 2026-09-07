import { createHash } from "node:crypto"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  NoReplay,
  PROVIDER_CONTRACT,
  ReleaseError,
  RequestFacts,
  createOperation,
  makeRequest,
  type Author,
  type ObservationStatus,
  type Operation,
  type PreparedRequest,
} from "@mannyc1/ts-release"
import { decodeJson, type HttpProviderDefinition, type HttpRead } from "@mannyc1/ts-release/http"
import {
  ManifestCodec,
  PublishIntent,
  PublishIntentCodec,
  attempt,
  canonical,
  intent,
  manifest,
  render,
} from "./Model.js"

const descriptor = {
  definitionId: "mcp.publish",
  intentVersion: "1",
  intentCodec: PublishIntentCodec,
} as const

export const publish: Author<PublishIntent> = (input, dependsOn = []) =>
  createOperation(descriptor, input, dependsOn)

const Scope = Schema.Struct({
  definitionId: Schema.Literal("mcp.publish"),
  intentVersion: Schema.Literal("1"),
  intent: PublishIntentCodec,
})
const scopeFor = (value: PublishIntent): string =>
  canonical({ definitionId: descriptor.definitionId, intentVersion: "1", intent: value })
export const readScope = (value: string): PublishIntent => {
  const parsed = Schema.decodeUnknownSync(Scope, { onExcessProperty: "error" })(
    decodeJson(new TextEncoder().encode(value)),
  )
  return intent(parsed.intent)
}
export const publishUrl = (value: PublishIntent) => `${value.registry}/v0.1/publish`
export const observationUrl = (value: PublishIntent) =>
  `${value.registry}/v0.1/servers/${encodeURIComponent(value.manifest.name)}` +
  `/versions/${encodeURIComponent(value.manifest.version)}`
const bodyFor = (value: PublishIntent): Uint8Array =>
  new TextEncoder().encode(
    `${canonical(Schema.encodeSync(ManifestCodec)(manifest(value.manifest)))}\n`,
  )
const equalBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((byte, index) => byte === right[index])
const sha256 = (value: Uint8Array): string => createHash("sha256").update(value).digest("hex")
const equal = (left: unknown, right: unknown): boolean => canonical(left) === canonical(right)

const prepare = Effect.fn("mcp.prepare")(function* (operation: Operation) {
  const selected = yield* attempt("mcp-operation", () => {
    if (
      operation.definitionId !== descriptor.definitionId ||
      operation.intentVersion !== descriptor.intentVersion
    )
      throw new Error("MCP operation uses another definition")
    return intent(operation.intent)
  })
  return yield* makeRequest({
    transport: "core.http/1",
    endpoint: publishUrl(selected),
    method: "POST",
    headers: [
      ["accept", "application/json"],
      ["content-type", "application/json"],
    ],
    body: yield* render(selected.manifest),
    principal: selected.authorization.principal,
    scope: scopeFor(selected),
    replay: new NoReplay({}),
  })
})

const ownsRequest = (request: PreparedRequest): boolean => {
  try {
    const facts = Schema.decodeUnknownSync(RequestFacts, { onExcessProperty: "error" })(
        request.facts,
      ),
      selected = readScope(facts.scope),
      body = bodyFor(selected)
    return (
      facts.transport === "core.http/1" &&
      facts.endpoint === publishUrl(selected) &&
      facts.method === "POST" &&
      equal(facts.headers, [
        ["accept", "application/json"],
        ["content-type", "application/json"],
      ]) &&
      facts.principal === selected.authorization.principal &&
      facts.replay._tag === "None" &&
      facts.byteLength === String(body.length) &&
      facts.bodyDigest === sha256(body) &&
      equalBytes(new Uint8Array(request.body), body)
    )
  } catch {
    return false
  }
}

const timestamp = Schema.String.check(
  Schema.makeFilter(
    (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(
        value,
      ) && !Number.isNaN(Date.parse(value)),
  ),
)
const Official = Schema.Struct({
  status: Schema.Literals(["active", "deprecated", "deleted"]),
  statusChangedAt: timestamp,
  statusMessage: Schema.optionalKey(Schema.String),
  publishedAt: timestamp,
  updatedAt: Schema.optionalKey(timestamp),
  isLatest: Schema.Boolean,
})
const Response = Schema.Struct({
  server: ManifestCodec,
  _meta: Schema.Struct({ "io.modelcontextprotocol.registry/official": Official }),
})
type Response = typeof Response.Type
const response = (body: Uint8Array): Response =>
  Schema.decodeUnknownSync(Response, { onExcessProperty: "error" })(decodeJson(body))
const official = (value: Response) => value._meta["io.modelcontextprotocol.registry/official"]

class Receipt extends Schema.Class<Receipt>("Mcp.PublishReceipt")({
  request: RequestFacts,
  status: Schema.Literal(200),
  server: ManifestCodec,
  registryStatus: Schema.Literal("active"),
  isLatest: Schema.Boolean,
}) {}
class Exact extends Schema.TaggedClass<Exact>()("Exact", {
  request: RequestFacts,
  server: ManifestCodec,
  registryStatus: Schema.Literals(["active", "deprecated", "deleted"]),
}) {}
class Conflict extends Schema.TaggedClass<Conflict>()("Conflict", {
  request: RequestFacts,
  observed: ManifestCodec,
}) {}
class Pending extends Schema.TaggedClass<Pending>()("Pending", {
  request: RequestFacts,
  status: Schema.Literal(404),
}) {}
class Inconclusive extends Schema.TaggedClass<Inconclusive>()("Inconclusive", {
  request: RequestFacts,
  status: Schema.Int,
  reason: Schema.Literals(["http-status", "malformed-response", "coordinate-mismatch"]),
}) {}
const Observation = Schema.Union([Exact, Conflict, Pending, Inconclusive])

const operationMatches = (operation: Operation, facts: RequestFacts): boolean => {
  try {
    const selected = intent(operation.intent), scoped = readScope(facts.scope)
    return (
      operation.definitionId === descriptor.definitionId &&
      operation.intentVersion === descriptor.intentVersion &&
      equal(selected, scoped) &&
      facts.endpoint === publishUrl(selected) &&
      facts.principal === selected.authorization.principal
    )
  } catch {
    return false
  }
}
const receiptCorresponds = (operation: Operation, request: RequestFacts, value: unknown) => {
  try {
    const selected = Schema.decodeUnknownSync(Receipt, { onExcessProperty: "error" })(value),
      expected = intent(operation.intent)
    return (
      operationMatches(operation, request) &&
      equal(selected.request, request) &&
      equal(selected.server, expected.manifest) &&
      selected.registryStatus === "active"
    )
  } catch {
    return false
  }
}
const classifyObservation = (
  operation: Operation,
  value: unknown,
  _receipts: ReadonlyArray<unknown>,
): ObservationStatus => {
  const selected = Schema.decodeUnknownSync(Observation, { onExcessProperty: "error" })(value)
  if (!operationMatches(operation, selected.request))
    throw new ReleaseError({ code: "mcp-observation", message: "Observation is not for this operation" })
  if (selected._tag === "Pending") return "Pending"
  if (selected._tag === "Inconclusive") return "Inconclusive"
  if (selected._tag === "Conflict") return "Conflict"
  return selected.registryStatus === "active" ? "Satisfied" : "Conflict"
}

export const definitions = (dependencies: { readonly read: HttpRead }): readonly HttpProviderDefinition[] => {
  const read = dependencies.read.bind(dependencies)
  return [
    {
      ...descriptor,
      contract: PROVIDER_CONTRACT,
      prepare,
      ownsRequest,
      receiptVersion: "mcp-publish-receipt/1",
      receiptCodec: Receipt,
      receiptCorresponds,
      classifyReceipt: () => "Satisfied",
      observationVersion: "mcp-publish-observation/1",
      observationCodec: Observation,
      classifyObservation,
      decodeResponse: Effect.fn("mcp.decodeResponse")(function* (request, result) {
        if (!ownsRequest(request))
          return yield* new ReleaseError({
            code: "mcp-response-binding",
            message: "MCP response request could not be admitted",
          })
        if (result.status !== 200)
          return { _tag: "Unknown", reason: "MCP Registry did not acknowledge publication" }
        try {
          const value = response(result.body), selected = readScope(request.facts.scope), metadata = official(value)
          if (metadata.status !== "active" || !equal(value.server, selected.manifest))
            return { _tag: "Unknown" as const, reason: "MCP Registry returned different publication facts" }
          return {
            _tag: "Accepted" as const,
            receipt: new Receipt({
              request: request.facts,
              status: 200,
              server: value.server,
              registryStatus: "active",
              isLatest: metadata.isLatest,
            }),
          }
        } catch {
          return { _tag: "Unknown", reason: "MCP Registry returned an unreadable publication response" }
        }
      }),
      observe: Effect.fn("mcp.observe")(function* (operation) {
        const request = yield* prepare(operation), selected = readScope(request.facts.scope)
        const result = yield* read({
          method: "GET",
          url: observationUrl(selected),
          headers: [["accept", "application/json"]],
          principal: selected.authorization.principal,
          scope: request.facts.scope,
        })
        let evidence: typeof Observation.Type
        if (result.status === 404) evidence = new Pending({ request: request.facts, status: 404 })
        else if (result.status !== 200)
          evidence = new Inconclusive({
            request: request.facts,
            status: result.status,
            reason: "http-status",
          })
        else {
          try {
            const value = response(result.body), metadata = official(value)
            if (
              value.server.name !== selected.manifest.name ||
              value.server.version !== selected.manifest.version
            )
              evidence = new Inconclusive({
                request: request.facts,
                status: 200,
                reason: "coordinate-mismatch",
              })
            else if (!equal(value.server, selected.manifest))
              evidence = new Conflict({ request: request.facts, observed: value.server })
            else
              evidence = new Exact({
                request: request.facts,
                server: value.server,
                registryStatus: metadata.status,
              })
          } catch {
            evidence = new Inconclusive({
              request: request.facts,
              status: 200,
              reason: "malformed-response",
            })
          }
        }
        return { evidence, status: classifyObservation(operation, evidence, []) }
      }),
    },
  ]
}
