import * as Schema from "effect/Schema"
import { ErrorCodes, parse, type DefaultTreeAdapterTypes as Tree } from "parse5"
import { RequestFacts, type Operation, type ObservationStatus } from "@mannyc1/ts-release"
import { sameData, type HttpResponse } from "@mannyc1/ts-release/http"
import { requestMatches } from "./Wire.js"
import { invalid, matches, object, own, readScope, parseJson, text } from "./Native.js"
import * as Model from "./Model.js"

const sha256 = Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/u))
const bytes = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
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
const correspondence =
  <A extends { readonly request: RequestFacts }, I>(codec: Schema.Codec<A, I>) =>
  (operation: Operation, request: RequestFacts, input: unknown) => {
    const evidence = own(codec, input),
      intent = own(Model.UploadIntent, operation.intent)
    return (
      operation.definitionId === "pypi.upload" &&
      requestMatches(intent, request) &&
      sameData(evidence.request, own(RequestFacts, request))
    )
  }
export const receiptCorresponds = correspondence(UploadReceipt)
export const failureCorresponds = correspondence(NativeFailure)
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
const filenameFrom = (url: URL): string => {
  const component = url.pathname.split("/").at(-1) ?? ""
  try {
    return decodeURIComponent(component)
  } catch {
    return invalid("data")
  }
}
const fileUrl = (input: unknown, base: string, filename: string) => {
  if (typeof input !== "string") return invalid("simple-file-url")
  let url: URL
  try {
    url = new URL(input, base)
  } catch {
    return invalid("data")
  }
  if (url.protocol !== "https:" || url.username || url.password || filenameFrom(url) !== filename)
    invalid("simple-file-url")
  return url
}
const jsonFacet = (intent: Model.UploadIntent, body: Uint8Array) => {
  const page = object(parseJson(body)),
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
      bytes: typeof file.size === "number" ? file.size : null,
      yanked: file.yanked === true || typeof file.yanked === "string",
    })
  }
  return selected ?? new Absent({})
}
const htmlFacet = (intent: Model.UploadIntent, body: Uint8Array) => {
  const document = parse(text(body), {
    onParseError: (error) => {
      if (error.code === ErrorCodes.duplicateAttribute) invalid("simple-html-attribute")
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
  const [baseElement] = baseElements
  const baseInput = baseElement === undefined ? "" : (attrs(baseElement).get("href") ?? ""),
    projectUrl = `${intent.endpoint.simpleUrl}${intent.project}/`
  let base: string
  try {
    base = new URL(baseInput, projectUrl).href
  } catch {
    return invalid("data")
  }
  const versions = elements.filter(
    (node) => node.tagName === "meta" && attrs(node).get("name") === "pypi:repository-version",
  )
  const [version] = versions
  if (
    versions.length > 1 ||
    (version !== undefined && !/^1\.[0-9]+$/u.test(attrs(version).get("content") ?? ""))
  )
    invalid("simple-version")
  const seen = new Set<string>()
  let selected: FileFacts | undefined
  for (const node of elements.filter((node) => node.tagName === "a")) {
    const name = content(node).trim(),
      attributes = attrs(node)
    const url = fileUrl(attributes.get("href"), base, name)
    const filename = filenameFrom(url)
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
  let facet: SimpleObservation["facet"] = new Unavailable({ reason: "http-status" })
  if (code === 404) facet = new Absent({})
  else if (code === 200) {
    const admitted = matches(() => {
      if (response.body.length > 1024 * 1024) invalid("simple-bound")
      const contentTypes = Object.entries(response.headers).filter(
        ([key]) => key.toLowerCase() === "content-type",
      )
      const [contentType] = contentTypes
      if (contentTypes.length !== 1 || contentType === undefined)
        return invalid("simple-content-type")
      const type = (contentType[1].split(";")[0] ?? "").trim().toLowerCase()
      facet =
        type === "application/vnd.pypi.simple.v1+json"
          ? jsonFacet(intent, response.body)
          : ["text/html", "application/vnd.pypi.simple.v1+html"].includes(type)
            ? htmlFacet(intent, response.body)
            : invalid("simple-content-type")
      return true
    })
    if (!admitted) facet = new Unavailable({ reason: "malformed-simple" })
  }
  return new SimpleObservation({ request, status: code, facet })
}
