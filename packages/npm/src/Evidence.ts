import * as Schema from "effect/Schema"
import {
  RequestFacts,
  type Operation,
  type ObservationStatus,
  type PreparedRequest,
} from "@mannyc1/ts-release"
import { type HttpResponse } from "@mannyc1/ts-release/http"
import * as Model from "./Model.js"
import {
  digest,
  encode,
  endpointFor,
  invalid,
  object,
  own,
  parseJson,
  readScope,
  scopeFor,
} from "./Native.js"
import { admitBody } from "./Wire.js"

const hex = (size: number) =>
  Schema.String.check(Schema.isPattern(new RegExp(`^[0-9a-f]{${size}}$`, "u")))
const integrity = Model.integrity
class Absent extends Schema.TaggedClass<Absent>()("Absent", {}) {}
class Unavailable extends Schema.TaggedClass<Unavailable>()("Unavailable", {
  reason: Schema.Literals([
    "http-status",
    "malformed-package",
    "malformed-version",
    "incomplete-digests",
    "malformed-tag",
  ]),
}) {}
class DifferentPackage extends Schema.TaggedClass<DifferentPackage>()("DifferentPackage", {
  name: Model.name,
}) {}
class VersionFacts extends Schema.TaggedClass<VersionFacts>()("VersionFacts", {
  name: Model.name,
  version: Model.version,
  integrity,
  shasum: hex(40),
}) {}
class TagValue extends Schema.TaggedClass<TagValue>()("TagValue", { version: Model.version }) {}
class NotApplicable extends Schema.TaggedClass<NotApplicable>()("NotApplicable", {}) {}
export class RegistryObservation extends Schema.Class<RegistryObservation>(
  "NpmRegistryObservation",
)({
  request: RequestFacts,
  status: Schema.Int.check(Schema.isBetween({ minimum: 100, maximum: 599 })),
  version: Schema.Union([Absent, Unavailable, DifferentPackage, VersionFacts, NotApplicable]),
  tag: Schema.Union([Absent, Unavailable, TagValue]),
}) {}
export class RegistryReceipt extends Schema.Class<RegistryReceipt>("NpmRegistryReceipt")({
  request: RequestFacts,
  status: Schema.Int.check(Schema.isBetween({ minimum: 200, maximum: 299 })),
  responseBody: Schema.Literal("not-used-as-publication-facts"),
}) {}
const ownsFacts = (definitionId: string, input: RequestFacts): boolean => {
  try {
    const request = own(RequestFacts, input),
      scope = readScope(request.scope)
    if (
      scope.definitionId !== definitionId ||
      request.transport !== "core.http/1" ||
      request.method !== "PUT" ||
      request.endpoint !== endpointFor(scope) ||
      request.principal !== scope.authorization.principal ||
      request.replay._tag !== "None" ||
      JSON.stringify(request.headers) !== '[["content-type","application/json"]]' ||
      !/^[0-9a-f]{64}$/u.test(request.bodyDigest) ||
      !/^[1-9][0-9]*$/u.test(request.byteLength)
    )
      return false
    if (definitionId === "npm.dist-tag") {
      const body = encode(scope.version)
      return (
        request.bodyDigest === digest("sha256", body) && request.byteLength === String(body.length)
      )
    }
    return true
  } catch {
    return false
  }
}
export const ownsRequest = (definitionId: string, input: PreparedRequest): boolean => {
  try {
    const facts = own(RequestFacts, input.facts),
      body = new Uint8Array(input.body)
    if (
      !ownsFacts(definitionId, facts) ||
      facts.bodyDigest !== digest("sha256", body) ||
      facts.byteLength !== String(body.length)
    )
      return false
    admitBody(readScope(facts.scope), body)
    return true
  } catch {
    return false
  }
}
export const requestMatches = (operation: Operation, request: RequestFacts) => {
  if (!ownsFacts(operation.definitionId, request)) return false
  return request.scope === scopeFor(operation.intent as Model.PublishIntent | Model.DistTagIntent)
}
export const receiptCorresponds = (operation: Operation, request: RequestFacts, input: unknown) => {
  const receipt = own(RegistryReceipt, input)
  return (
    requestMatches(operation, request) &&
    JSON.stringify(receipt.request) === JSON.stringify(own(RequestFacts, request)) &&
    (operation.definitionId !== "npm.publish" || receipt.status === 201)
  )
}
export const classifyObservation = (
  operation: Operation,
  input: unknown,
  acceptedReceipts: ReadonlyArray<unknown> = [],
): ObservationStatus => {
  const evidence = own(RegistryObservation, input)
  if (!requestMatches(operation, evidence.request)) invalid("observation-binding")
  const intent = operation.intent as Model.PublishIntent | Model.DistTagIntent
  if (evidence.status === 404) {
    if (
      evidence.tag._tag !== "Absent" ||
      evidence.version._tag !==
        (operation.definitionId === "npm.publish" ? "Absent" : "NotApplicable")
    )
      invalid("observation-status")
  } else if (evidence.status < 200 || evidence.status >= 300) {
    if (
      evidence.tag._tag !== "Unavailable" ||
      evidence.version._tag !==
        (operation.definitionId === "npm.publish" ? "Unavailable" : "NotApplicable")
    )
      invalid("observation-status")
  }
  if (operation.definitionId === "npm.publish") {
    if (!("tarball" in intent) || evidence.version._tag === "NotApplicable")
      invalid("observation-version")
    const facet = evidence.version
    if (facet._tag === "DifferentPackage") {
      if (facet.name === intent.name) invalid("observation-package")
      return "Conflict"
    }
    if (facet._tag === "Absent") return "Absent"
    if (facet._tag === "Unavailable") return "Inconclusive"
    if (facet._tag !== "VersionFacts" || !("tarball" in intent))
      return invalid("observation-version")
    if (
      facet.name !== intent.name ||
      facet.version !== intent.version ||
      facet.integrity !== intent.integrity ||
      facet.shasum !== intent.shasum
    )
      return "Conflict"
  } else if (evidence.version._tag !== "NotApplicable") invalid("observation-version")
  if (evidence.tag._tag === "TagValue") {
    if (evidence.tag.version === intent.version) return "Satisfied"
    return operation.definitionId === "npm.publish" || acceptedReceipts.length > 0
      ? "Conflict"
      : "Absent"
  }
  // An existing immutable version needs observation or a separate tag operation;
  // missing tag metadata can never make the composite package PUT replayable.
  return operation.definitionId === "npm.publish"
    ? "Pending"
    : evidence.tag._tag === "Absent"
      ? acceptedReceipts.length > 0
        ? "Pending"
        : "Absent"
      : "Inconclusive"
}
const unavailable = (reason: Unavailable["reason"]) => new Unavailable({ reason })
export const observeResponse = (
  request: RequestFacts,
  response: HttpResponse,
): RegistryObservation => {
  const scope = readScope(request.scope)
  let version: RegistryObservation["version"] = unavailable("http-status"),
    tag: RegistryObservation["tag"] = unavailable("http-status")
  if (response.status === 404) {
    version = new Absent({})
    tag = new Absent({})
  } else if (response.status >= 200 && response.status < 300) {
    try {
      if (response.body.length > 1024 * 1024) invalid("metadata-bound")
      const metadata = object(parseJson(response.body))
      const packageName = own(Model.name, metadata.name)
      try {
        const tags = object(metadata["dist-tags"]),
          raw = Object.hasOwn(tags, scope.tag) ? tags[scope.tag] : undefined
        tag =
          raw === undefined ? new Absent({}) : new TagValue({ version: own(Model.version, raw) })
      } catch {
        tag = unavailable("malformed-tag")
      }
      if (packageName !== scope.name) version = new DifferentPackage({ name: packageName })
      else {
        const versions = object(metadata.versions)
        if (!Object.hasOwn(versions, scope.version)) version = new Absent({})
        else {
          try {
            const selected = object(versions[scope.version]),
              dist = object(selected.dist)
            const name = own(Model.name, selected.name),
              nativeVersion = own(Model.version, selected.version)
            try {
              version = new VersionFacts({
                name,
                version: nativeVersion,
                integrity: own(integrity, dist.integrity),
                shasum: own(hex(40), dist.shasum),
              })
            } catch {
              version = unavailable("incomplete-digests")
            }
          } catch {
            version = unavailable("malformed-version")
          }
        }
      }
      if (scope.definitionId === "npm.dist-tag" && packageName !== scope.name)
        tag = unavailable("malformed-package")
    } catch {
      version = unavailable("malformed-package")
      tag = unavailable("malformed-package")
    }
  }
  return new RegistryObservation({
    request,
    status: response.status,
    version: scope.definitionId === "npm.dist-tag" ? new NotApplicable({}) : version,
    tag,
  })
}
