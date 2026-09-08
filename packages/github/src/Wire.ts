import { createHash } from "node:crypto"
import { NoReplay, RequestFacts, type Operation } from "@mannyc1/ts-release"
import type { PreparedRequest, ProviderContext } from "@mannyc1/ts-release"
import * as Model from "./Model.js"
import { intentOf } from "./Graph.js"
import { BoundScope, bindScope, readScope, encodeScope, parentFacts } from "./Binding.js"
import { api, headers, invalid, matches, own, sameUrl, uploadTemplate } from "./Native.js"

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value))
export const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
export const nativeRequest = (scope: BoundScope, bytes?: Uint8Array) => {
  const intent = intentOf(scope.operation),
    base = api(intent.repository)
  let endpoint = "",
    method = "POST",
    body: Uint8Array,
    mediaType = "application/json"
  if (intent instanceof Model.LightweightTag) {
    endpoint = `${base}/git/refs`
    body = encode({ ref: `refs/tags/${intent.tag}`, sha: scope.targetCommit })
  } else if (intent instanceof Model.AnnotatedTag) {
    endpoint = `${base}/git/tags`
    body = encode({
      tag: intent.tag,
      message: intent.message,
      object: scope.targetCommit,
      type: "commit",
      tagger: intent.tagger,
    })
  } else if (intent instanceof Model.AnnotatedRef) {
    const parent = parentFacts(
      scope,
      intent.annotatedTagOperation,
      "object",
    ) as Model.AnnotatedTagFacts
    if (parent.tag !== intent.tag || parent.targetOid !== scope.targetCommit)
      invalid("annotated-parent")
    endpoint = `${base}/git/refs`
    body = encode({ ref: `refs/tags/${intent.tag}`, sha: parent.objectOid })
  } else if (intent instanceof Model.DraftIntent) {
    endpoint = `${base}/releases`
    body = encode({
      tag_name: intent.tag,
      target_commitish: scope.targetCommit,
      name: intent.title,
      body: intent.body,
      draft: true,
      prerelease: intent.prerelease,
      generate_release_notes: false,
    })
  } else {
    const parent = parentFacts(scope, intent.draftOperation, "draft") as Model.ReleaseFacts
    if (
      !sameUrl(
        parent.uploadUrlTemplate,
        uploadTemplate(intent.repository, parent.releaseId),
        intent.repository,
      )
    )
      invalid("upload-parent")
    if (intent instanceof Model.AssetIntent) {
      if (!parent.draft) invalid("asset-parent-published")
      endpoint = parent.uploadUrlTemplate.replace(
        "{?name,label}",
        `?${new URLSearchParams({ name: intent.publicName })}`,
      )
      mediaType = intent.mediaType
      body = bytes ?? new Uint8Array()
    } else {
      endpoint = `${base}/releases/${parent.releaseId}`
      method = "PATCH"
      body = encode({ draft: false })
    }
  }
  return {
    transport: "core.http/1" as const,
    endpoint,
    method,
    principal: intent.principal,
    scope: encodeScope(scope),
    replay: new NoReplay({}),
    headers: [...headers, ["content-type", mediaType] as const],
    body,
  }
}
export const requestMatches = (scope: BoundScope, request: RequestFacts): boolean => {
  const expected = nativeRequest(scope),
    intent = intentOf(scope.operation)
  const { body, ...fields } = expected
  return (
    JSON.stringify(own(RequestFacts, request)) ===
    JSON.stringify(
      new RequestFacts({
        ...fields,
        bodyDigest: intent instanceof Model.AssetIntent ? intent.file.content.sha256 : sha256(body),
        byteLength:
          intent instanceof Model.AssetIntent ? intent.file.content.bytes : String(body.length),
      }),
    )
  )
}
export const ownsRequest = (request: PreparedRequest) => {
  return matches(() => {
    return (
      requestMatches(readScope(request.facts.scope), request.facts) &&
      request.facts.byteLength === String(request.body.length) &&
      request.facts.bodyDigest === sha256(request.body)
    )
  })
}
export const requestCorresponds = (
  operation: Operation,
  request: RequestFacts,
  context: ProviderContext,
) => {
  const scope = bindScope(operation, context)
  return requestMatches(scope, request)
}
