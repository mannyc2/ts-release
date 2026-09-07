import * as Schema from "effect/Schema"
import { parse, type DefaultTreeAdapterTypes as Tree } from "parse5"
import { RequestFacts, type Operation, type ObservationStatus } from "@mannyc1/ts-release"
import { decodeJson, type HttpResponse } from "@mannyc1/ts-release/http"
import { requestMatches } from "./Wire.js"
import { invalid, object, own, readScope } from "./Native.js"
import * as Model from "./Model.js"

const sha256 = Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/u))
const bytes = Schema.String.check(Schema.isPattern(/^(?:0|[1-9][0-9]*)$/u))
class Absent extends Schema.TaggedClass<Absent>()("Absent", {}) {}
class Unavailable extends Schema.TaggedClass<Unavailable>()("Unavailable", {
  reason: Schema.Literals(["http-status", "malformed-simple"]),
}) {}
class FileFacts extends Schema.TaggedClass<FileFacts>()("FileFacts", {
  filename: Model.filename,
  sha256: Schema.NullOr(sha256),
  bytes: Schema.NullOr(bytes),
  yanked: Schema.Boolean,
}) {}
class DifferentProject extends Schema.TaggedClass<DifferentProject>()("DifferentProject", {
  project: Model.project,
}) {}
const status = Schema.Int.check(Schema.isBetween({ minimum: 100, maximum: 599 }))
export class SimpleObservation extends Schema.Class<SimpleObservation>("PyPiSimpleObservation")({
  request: RequestFacts,
  status,
  facet: Schema.Union([Absent, Unavailable, FileFacts, DifferentProject]),
}) {}
export class UploadReceipt extends Schema.Class<UploadReceipt>("PyPiUploadReceipt")({
  request: RequestFacts,
  status: Schema.Literal(200),
}) {}
export class NativeFailure extends Schema.Class<NativeFailure>("PyPiNativeFailure")({
  request: RequestFacts,
  status,
  kind: Schema.Literal("unclassified-response"),
}) {}
export const receiptCorresponds = (operation: Operation, request: RequestFacts, input: unknown) => {
  const receipt = own(UploadReceipt, input),
    intent = own(Model.UploadIntent, operation.intent)
  return (
    operation.definitionId === "pypi.upload" &&
    requestMatches(intent, request) &&
    JSON.stringify(receipt.request) === JSON.stringify(own(RequestFacts, request))
  )
}
export const failureCorresponds = (operation: Operation, request: RequestFacts, input: unknown) => {
  const failure = own(NativeFailure, input),
    intent = own(Model.UploadIntent, operation.intent)
  return (
    operation.definitionId === "pypi.upload" &&
    requestMatches(intent, request) &&
    JSON.stringify(failure.request) === JSON.stringify(own(RequestFacts, request))
  )
}
export const classifyObservation = (
  operation: Operation,
  input: unknown,
  receipts: readonly unknown[],
): ObservationStatus => {
  const observation = own(SimpleObservation, input),
    intent = own(Model.UploadIntent, operation.intent),
    facet = observation.facet
  if (
    operation.definitionId !== "pypi.upload" ||
    !requestMatches(intent, observation.request) ||
    (facet._tag !== "Unavailable" && observation.status !== 200 && observation.status !== 404) ||
    (observation.status === 404 && !["Absent", "Unavailable"].includes(facet._tag))
  )
    invalid("observation-binding")
  if (facet._tag === "Unavailable") return "Inconclusive"
  if (facet._tag === "Absent") return receipts.length ? "Pending" : "Absent"
  if (facet._tag === "DifferentProject") {
    if (facet.project === intent.project) invalid("observation-project")
    return "Conflict"
  }
  if (facet.filename !== intent.filename) invalid("observation-filename")
  if (
    facet.yanked ||
    (facet.bytes !== null && facet.bytes !== intent.distribution.content.bytes) ||
    (facet.sha256 !== null && facet.sha256 !== intent.distribution.content.sha256)
  )
    return "Conflict"
  return facet.sha256 === null ? "Inconclusive" : "Satisfied"
}
const fileUrl = (input: unknown, base: string, filename: string) => {
  if (typeof input !== "string") return invalid("simple-file-url")
  const url = new URL(input, base)
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    decodeURIComponent(url.pathname.split("/").at(-1)!) !== filename
  )
    invalid("simple-file-url")
  return url
}
const jsonFacet = (intent: Model.UploadIntent, body: Uint8Array) => {
  const page = object(decodeJson(body)),
    meta = object(page.meta)
  if (
    typeof meta["api-version"] !== "string" ||
    !/^1\.[0-9]+$/u.test(meta["api-version"]) ||
    !Array.isArray(page.files)
  )
    return invalid("simple-json")
  const project = own(Model.project, page.name)
  if (project !== intent.project) return new DifferentProject({ project })
  const seen = new Set<string>()
  let selected: FileFacts | undefined
  for (const raw of page.files) {
    const file = object(raw)
    if (typeof file.filename !== "string" || seen.has(file.filename))
      return invalid("simple-filename")
    seen.add(file.filename)
    const url = fileUrl(file.url, `${intent.endpoint.simpleUrl}${intent.project}/`, file.filename)
    if (file.filename !== intent.filename) continue
    const hashes = object(file.hashes),
      hash = hashes.sha256 === undefined ? null : own(sha256, hashes.sha256)
    if (url.hash.startsWith("#sha256=") && url.hash !== `#sha256=${hash}`) invalid("simple-digest")
    if (
      file.size !== undefined &&
      (typeof file.size !== "number" || !Number.isSafeInteger(file.size) || file.size < 0)
    )
      invalid("simple-size")
    if (
      file.yanked !== undefined &&
      typeof file.yanked !== "boolean" &&
      typeof file.yanked !== "string"
    )
      invalid("simple-yanked")
    selected = new FileFacts({
      filename: intent.filename,
      sha256: hash,
      bytes: file.size === undefined ? null : String(file.size),
      yanked: file.yanked === true || typeof file.yanked === "string",
    })
  }
  return selected ?? new Absent({})
}
const htmlFacet = (intent: Model.UploadIntent, body: Uint8Array) => {
  const document = parse(new TextDecoder("utf-8", { fatal: true }).decode(body), {
    onParseError: (error) => {
      if (error.code === "duplicate-attribute") invalid("simple-html-attribute")
    },
  })
  const elements: Tree.Element[] = []
  const visit = (node: Tree.Node, depth: number): void => {
    if (depth > 128) invalid("simple-html-depth")
    if ("tagName" in node) elements.push(node)
    if ("childNodes" in node) node.childNodes.forEach((child) => visit(child, depth + 1))
  }
  visit(document, 0)
  const attrs = (node: Tree.Element) => new Map(node.attrs.map((a) => [a.name, a.value]))
  const content = (node: Tree.Node): string =>
    "value" in node ? node.value : "childNodes" in node ? node.childNodes.map(content).join("") : ""
  const baseElements = elements.filter((node) => node.tagName === "base" && attrs(node).has("href"))
  if (baseElements.length > 1) invalid("simple-html-base")
  const base = new URL(
    baseElements.length ? attrs(baseElements[0]!).get("href")! : "",
    `${intent.endpoint.simpleUrl}${intent.project}/`,
  ).href
  const versions = elements.filter(
    (node) => node.tagName === "meta" && attrs(node).get("name") === "pypi:repository-version",
  )
  if (
    versions.length > 1 ||
    (versions.length === 1 && !/^1\.[0-9]+$/u.test(attrs(versions[0]!).get("content") ?? ""))
  )
    invalid("simple-version")
  const seen = new Set<string>()
  let selected: FileFacts | undefined
  for (const node of elements.filter((node) => node.tagName === "a")) {
    const name = content(node).trim(),
      attributes = attrs(node)
    const url = fileUrl(attributes.get("href"), base, name)
    const filename = decodeURIComponent(url.pathname.split("/").at(-1)!)
    if (seen.has(filename)) invalid("simple-filename")
    seen.add(filename)
    if (filename !== intent.filename) continue
    const hash = url.hash.startsWith("#sha256=") ? own(sha256, url.hash.slice(8)) : null
    selected = new FileFacts({
      filename: intent.filename,
      sha256: hash,
      bytes: null,
      yanked: attributes.has("data-yanked"),
    })
  }
  return selected ?? new Absent({})
}
export const observeResponse = (request: RequestFacts, response: HttpResponse) => {
  const intent = readScope(request.scope),
    code = own(status, response.status)
  let facet: (typeof SimpleObservation.Type)["facet"] = new Unavailable({ reason: "http-status" })
  if (code === 404) facet = new Absent({})
  else if (code === 200) {
    try {
      if (response.body.length > 1024 * 1024) invalid("simple-bound")
      const contentTypes = Object.entries(response.headers).filter(
        ([key]) => key.toLowerCase() === "content-type",
      )
      if (contentTypes.length !== 1) invalid("simple-content-type")
      const type = contentTypes[0]![1].split(";")[0]!.trim().toLowerCase()
      facet =
        type === "application/vnd.pypi.simple.v1+json"
          ? jsonFacet(intent, response.body)
          : ["text/html", "application/vnd.pypi.simple.v1+html"].includes(type)
            ? htmlFacet(intent, response.body)
            : invalid("simple-content-type")
    } catch {
      facet = new Unavailable({ reason: "malformed-simple" })
    }
  }
  return new SimpleObservation({ request, status: code, facet })
}
