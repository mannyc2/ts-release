import { RequestFacts, type PreparedRequest } from "@mannyc1/ts-release"
import { sameData } from "@mannyc1/ts-release/http"
import type { UploadIntent } from "./Model.js"
import { inspect } from "./Metadata.js"
import { digest, invalid, matches, own, readScope, scopeFor, MAX_BYTES } from "./Native.js"

export const multipart = (intent: UploadIntent, bytes: Uint8Array) => {
  if (
    bytes.length !== intent.distribution.content.bytes ||
    digest(bytes) !== intent.distribution.content.sha256
  )
    invalid("distribution-content")
  const { metadata, fields } = inspect(intent.filename, bytes)
  if (
    metadata.project !== intent.project ||
    metadata.version !== intent.version ||
    metadata.metadataVersion !== intent.metadataVersion ||
    metadata.pythonTag !== intent.pythonTag ||
    (metadata.kind === "wheel") !== (intent._tag === "WheelUpload")
  )
    invalid("distribution-metadata")
  const base = `tsr-${intent.distribution.content.sha256}`
  let boundary = base
  const values = Buffer.concat([
    Buffer.from(bytes),
    ...fields.map(([, value]) => Buffer.from(value)),
  ])
  for (let suffix = 1; values.includes(boundary); suffix++)
    boundary = `tsr-${digest(new TextEncoder().encode(`${base}:${suffix}`))}`
  const entries: Array<readonly [string, string]> = [
    [":action", "file_upload"],
    ["protocol_version", "1"],
    ["sha256_digest", intent.distribution.content.sha256],
    ["filetype", metadata.kind === "wheel" ? "bdist_wheel" : "sdist"],
    ["pyversion", metadata.pythonTag],
    ...fields,
  ]
  const parts = entries.map(([name, value]) =>
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    ),
  )
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="content"; filename="${intent.filename}"\r\nContent-Type: ${intent.filename.endsWith(".tar.gz") ? "application/gzip" : "application/zip"}\r\n\r\n`,
    ),
    Buffer.from(bytes),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  )
  const body = new Uint8Array(Buffer.concat(parts))
  return {
    body,
    headers: [
      ["accept", "text/plain, application/json;q=0.1"],
      ["content-type", `multipart/form-data; boundary=${boundary}`],
    ] as const,
  }
}
export const ownsFacts = (facts: RequestFacts) => {
  const intent = readScope(facts.scope),
    headers = facts.headers
  return (
    facts.transport === "core.http/1" &&
    facts.endpoint === intent.endpoint.uploadUrl &&
    facts.method === "POST" &&
    facts.principal === intent.authorization.principal &&
    facts.replay._tag === "None" &&
    /^[1-9][0-9]*$/u.test(facts.byteLength) &&
    /^[0-9a-f]{64}$/u.test(facts.bodyDigest) &&
    headers.length === 2 &&
    headers[0]?.[0] === "accept" &&
    headers[0]?.[1] === "text/plain, application/json;q=0.1" &&
    headers[1]?.[0] === "content-type" &&
    /^multipart\/form-data; boundary=tsr-[0-9a-f]{64}$/u.test(headers[1][1])
  )
}
export const ownsRequest = (request: PreparedRequest) => {
  return matches(() => {
    const facts = own(RequestFacts, request.facts),
      bytes = new Uint8Array(request.body)
    if (
      bytes.length > MAX_BYTES + 2 * 1024 * 1024 ||
      !ownsFacts(facts) ||
      facts.byteLength !== String(bytes.length) ||
      facts.bodyDigest !== digest(bytes)
    )
      return false
    const intent = readScope(facts.scope),
      boundary = facts.headers[1]![1].split("boundary=")[1]!
    const end = Buffer.from(`\r\n--${boundary}--\r\n`),
      start = bytes.length - end.length - intent.distribution.content.bytes
    if (start < 0 || !Buffer.from(bytes.subarray(bytes.length - end.length)).equals(end))
      return false
    const expected = multipart(intent, bytes.subarray(start, bytes.length - end.length))
    return Buffer.from(expected.body).equals(bytes) && sameData(expected.headers, facts.headers)
  })
}
export const requestMatches = (intent: UploadIntent, facts: RequestFacts) =>
  ownsFacts(facts) && facts.scope === scopeFor(intent)
