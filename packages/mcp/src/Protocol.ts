import { createHash } from "node:crypto"
import { Effect, Schema } from "effect"
import * as Core from "@mannyc1/ts-release"
import { decodeJson, sameBytes, sameData } from "@mannyc1/ts-release/http"
import type { HttpProviderDefinition, HttpRead } from "@mannyc1/ts-release/http"
import * as Model from "./Model.js"

const descriptor = Core.defineProvider("mcp.publish", Model.PublishIntentCodec)

export const publish: Core.Author<Model.PublishIntent> = (input, dependsOn = []) =>
  Core.createOperation(descriptor, input, dependsOn)

const Scope = Schema.Struct({
  definitionId: Schema.Literal("mcp.publish"),
  intentVersion: Schema.Literal("1"),
  intent: Model.PublishIntentCodec,
})
const scopeFor = (value: Model.PublishIntent): string =>
  Model.canonical({ definitionId: descriptor.definitionId, intentVersion: "1", intent: value })
export const readScope = (value: string): Model.PublishIntent => {
  const parsed = Model.own(Scope, decodeJson(value))
  return Model.intent(parsed.intent)
}
export const publishUrl = (value: Model.PublishIntent) => `${value.registry}/v0.1/publish`
export const observationUrl = (value: Model.PublishIntent) =>
  `${value.registry}/v0.1/servers/${encodeURIComponent(value.manifest.name)}` +
  `/versions/${encodeURIComponent(value.manifest.version)}`
const bodyFor = (value: Model.PublishIntent): Uint8Array =>
  new TextEncoder().encode(
    `${Model.canonical(Schema.encodeSync(Model.ManifestCodec)(Model.manifest(value.manifest)))}\n`,
  )
const sha256 = (value: Uint8Array): string => createHash("sha256").update(value).digest("hex")
const unknown = (reason: string) => ({ _tag: "Unknown" as const, reason })

const prepare = Effect.fn("mcp.prepare")(function* (operation: Core.Operation) {
  const selected = yield* Model.attempt("mcp-operation", () =>
    Model.ownOperation(Model.PublishIntentCodec, descriptor, operation),
  )
  return yield* Core.makeRequest({
    transport: "core.http/1",
    endpoint: publishUrl(selected),
    method: "POST",
    headers: [
      ["accept", "application/json"],
      ["content-type", "application/json"],
    ],
    body: yield* Model.render(selected.manifest),
    principal: selected.authorization.principal,
    scope: scopeFor(selected),
    replay: new Core.NoReplay({}),
  })
})

const ownsRequest = (request: Core.PreparedRequest): boolean =>
  Model.matches(() => {
    const { facts, body: requestBody } = Model.ownRequest(request),
      selected = readScope(facts.scope),
      body = bodyFor(selected)
    return (
      facts.transport === "core.http/1" &&
      facts.endpoint === publishUrl(selected) &&
      facts.method === "POST" &&
      sameData(facts.headers, [
        ["accept", "application/json"],
        ["content-type", "application/json"],
      ]) &&
      facts.principal === selected.authorization.principal &&
      facts.replay._tag === "None" &&
      facts.byteLength === String(body.length) &&
      facts.bodyDigest === sha256(body) &&
      sameBytes(requestBody, body)
    )
  })

const timestamp = Schema.String.check(
  Schema.makeFilter(
    (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) &&
      !Number.isNaN(Date.parse(value)),
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
  server: Model.ManifestCodec,
  _meta: Schema.Struct({ "io.modelcontextprotocol.registry/official": Official }),
})
type Response = typeof Response.Type
const response = (body: Uint8Array): Response => Model.own(Response, decodeJson(body))
const official = (value: Response) => value._meta["io.modelcontextprotocol.registry/official"]

class Receipt extends Schema.Class<Receipt>("Mcp.PublishReceipt")({
  request: Core.RequestFacts,
  status: Schema.Literal(200),
  server: Model.ManifestCodec,
  registryStatus: Schema.Literal("active"),
  isLatest: Schema.Boolean,
}) {}
class Exact extends Schema.TaggedClass<Exact>()("Exact", {
  request: Core.RequestFacts,
  server: Model.ManifestCodec,
  registryStatus: Schema.Literals(["active", "deprecated", "deleted"]),
}) {}
class Conflict extends Schema.TaggedClass<Conflict>()("Conflict", {
  request: Core.RequestFacts,
  observed: Model.ManifestCodec,
}) {}
class Pending extends Schema.TaggedClass<Pending>()("Pending", {
  request: Core.RequestFacts,
  status: Schema.Literal(404),
}) {}
class Inconclusive extends Schema.TaggedClass<Inconclusive>()("Inconclusive", {
  request: Core.RequestFacts,
  status: Schema.Int,
  reason: Schema.Literals(["http-status", "malformed-response", "coordinate-mismatch"]),
}) {}
const Observation = Schema.Union([Exact, Conflict, Pending, Inconclusive])
const inconclusive = (request: Core.RequestFacts, status: number, reason: Inconclusive["reason"]) =>
  new Inconclusive({ request, status, reason })

const operationMatches = (operation: Core.Operation, facts: Core.RequestFacts): boolean =>
  Model.matches(() => {
    const selected = Model.intent(operation.intent),
      scoped = readScope(facts.scope)
    return (
      operation.definitionId === descriptor.definitionId &&
      operation.intentVersion === descriptor.intentVersion &&
      sameData(selected, scoped) &&
      facts.endpoint === publishUrl(selected) &&
      facts.principal === selected.authorization.principal
    )
  })
const receiptCorresponds = (
  operation: Core.Operation,
  request: Core.RequestFacts,
  value: unknown,
) =>
  Model.matches(() => {
    const selected = Model.own(Receipt, value),
      expected = Model.intent(operation.intent)
    return (
      operationMatches(operation, request) &&
      sameData(selected.request, request) &&
      sameData(selected.server, expected.manifest) &&
      selected.registryStatus === "active"
    )
  })
const classifyObservation = (
  operation: Core.Operation,
  value: unknown,
  _receipts: ReadonlyArray<unknown>,
): Core.ObservationStatus => {
  const selected = Model.own(Observation, value)
  if (!operationMatches(operation, selected.request))
    throw Model.failure("mcp-observation", "Observation is not for this operation")
  if (selected._tag === "Pending") return "Pending"
  if (selected._tag === "Inconclusive") return "Inconclusive"
  if (selected._tag === "Conflict") return "Conflict"
  return selected.registryStatus === "active" ? "Satisfied" : "Conflict"
}

export const definitions = (dependencies: {
  readonly read: HttpRead
}): readonly HttpProviderDefinition[] => {
  const read = dependencies.read.bind(dependencies)
  return [
    {
      ...descriptor,
      contract: Core.PROVIDER_CONTRACT,
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
          return yield* Model.reject("mcp-response-binding", "MCP response request is invalid")
        if (result.status !== 200) return unknown("MCP Registry did not acknowledge publication")
        try {
          const value = response(result.body),
            selected = readScope(request.facts.scope),
            metadata = official(value)
          if (metadata.status !== "active" || !sameData(value.server, selected.manifest))
            return unknown("MCP Registry returned different publication facts")
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
          return unknown("MCP Registry returned an unreadable publication response")
        }
      }),
      observe: Effect.fn("mcp.observe")(function* (operation) {
        const request = yield* prepare(operation),
          selected = readScope(request.facts.scope)
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
          evidence = inconclusive(request.facts, result.status, "http-status")
        else {
          try {
            const value = response(result.body),
              metadata = official(value)
            if (
              value.server.name !== selected.manifest.name ||
              value.server.version !== selected.manifest.version
            )
              evidence = inconclusive(request.facts, 200, "coordinate-mismatch")
            else if (!sameData(value.server, selected.manifest))
              evidence = new Conflict({ request: request.facts, observed: value.server })
            else
              evidence = new Exact({
                request: request.facts,
                server: value.server,
                registryStatus: metadata.status,
              })
          } catch {
            evidence = inconclusive(request.facts, 200, "malformed-response")
          }
        }
        return { evidence, status: classifyObservation(operation, evidence, []) }
      }),
    },
  ]
}
