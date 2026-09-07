import * as Schema from "effect/Schema"
import {
  RequestFacts,
  type Operation,
  type ProviderContext,
  type ObservationStatus,
} from "@mannyc1/ts-release"
import * as Model from "./Model.js"
import { intentOf, kindOf } from "./Graph.js"
import {
  BoundScope,
  NativeFacts,
  bindScope,
  encodeScope,
  readScope,
  parentFacts,
} from "./Binding.js"
import { requestMatches } from "./Wire.js"
import {
  invalid,
  own,
  refFacts,
  tagFacts,
  releaseFacts,
  assetFacts,
  sameUrl,
  uploadTemplate,
  api,
  assetUrls,
} from "./Native.js"

export class Receipt extends Schema.Class<Receipt>("GitHubReceipt")({
  request: RequestFacts,
  status: Schema.Literals([200, 201]),
  facts: NativeFacts,
}) {}
export class NativeFailure extends Schema.Class<NativeFailure>("GitHubNativeFailure")({
  request: RequestFacts,
  status: Schema.Int.check(Schema.isBetween({ minimum: 100, maximum: 599 })),
  kind: Schema.Literals(["http-status", "malformed-native", "different-native"]),
}) {}
const Digest = Schema.NullOr(Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/u)))
export class AssetEvidence extends Schema.Class<AssetEvidence>("GitHubAssetEvidence")({
  facts: Model.AssetFacts,
  downloadedSha256: Digest,
}) {}
export class Present extends Schema.TaggedClass<Present>()("Present", {
  scope: Schema.String,
  facts: NativeFacts,
  observedCommit: Schema.NullOr(Model.oid),
  downloadedSha256: Digest,
  assets: Schema.Array(AssetEvidence),
}) {}
export class Missing extends Schema.TaggedClass<Missing>()("Missing", { scope: Schema.String }) {}
export class Unavailable extends Schema.TaggedClass<Unavailable>()("Unavailable", {
  operationId: Schema.String,
  reason: Schema.Literals([
    "parent-unresolved",
    "http-status",
    "malformed-native",
    "pagination-bound",
    "download-unavailable",
  ]),
}) {}
export const Observation = Schema.Union([Present, Missing, Unavailable])
export type Observation = typeof Observation.Type
export const decodeFacts = (scope: BoundScope, value: unknown): NativeFacts => {
  const intent = intentOf(scope.operation),
    kind = kindOf(scope.operation)
  if (kind === "object") return tagFacts(value, intent.repository)
  if (kind === "ref" || kind === "lightweight") return refFacts(value, intent.repository)
  if (intent instanceof Model.AssetIntent)
    return assetFacts(
      value,
      intent.repository,
      (parentFacts(scope, intent.draftOperation, "draft") as Model.ReleaseFacts).tag,
    )
  return releaseFacts(value, intent.repository)
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
export const matches = (scope: BoundScope, facts: NativeFacts): boolean => {
  const intent = intentOf(scope.operation)
  if (
    facts instanceof Model.ReleaseFacts &&
    !sameUrl(
      facts.uploadUrlTemplate,
      uploadTemplate(intent.repository, facts.releaseId),
      intent.repository,
    )
  )
    return false
  if (
    facts instanceof Model.AssetFacts &&
    (!(intent instanceof Model.AssetIntent) ||
      !assetUrls(
        facts,
        intent.repository,
        (parentFacts(scope, intent.draftOperation, "draft") as Model.ReleaseFacts).tag,
      ))
  )
    return false
  if (intent instanceof Model.AnnotatedTag)
    return (
      facts instanceof Model.AnnotatedTagFacts &&
      facts.tag === intent.tag &&
      facts.message === intent.message &&
      facts.tagger.name === intent.tagger.name &&
      facts.tagger.email === intent.tagger.email &&
      Date.parse(facts.tagger.date) === Date.parse(intent.tagger.date) &&
      facts.targetOid === intent.commit
    )
  if (intent instanceof Model.LightweightTag)
    return (
      facts instanceof Model.RefFacts &&
      facts.ref === `refs/tags/${intent.tag}` &&
      facts.objectType === "commit" &&
      facts.objectOid === intent.commit
    )
  if (intent instanceof Model.AnnotatedRef)
    return (
      facts instanceof Model.RefFacts &&
      facts.ref === `refs/tags/${intent.tag}` &&
      facts.objectType === "tag" &&
      facts.objectOid ===
        (parentFacts(scope, intent.annotatedTagOperation, "object") as Model.AnnotatedTagFacts)
          .objectOid
    )
  if (intent instanceof Model.DraftIntent)
    return (
      facts instanceof Model.ReleaseFacts &&
      facts.tag === intent.tag &&
      facts.title === intent.title &&
      facts.body === intent.body &&
      facts.prerelease === intent.prerelease
    )
  if (intent instanceof Model.AssetIntent)
    return (
      facts instanceof Model.AssetFacts &&
      facts.storedName === intent.publicName &&
      facts.state === "uploaded" &&
      facts.contentType === intent.mediaType &&
      facts.bytes === intent.file.content.bytes &&
      (facts.sha256 === null || facts.sha256 === intent.file.content.sha256)
    )
  const parent = parentFacts(scope, intent.draftOperation, "draft") as Model.ReleaseFacts
  return (
    facts instanceof Model.ReleaseFacts &&
    same({ ...facts, draft: true }, { ...parent, draft: true })
  )
}
const bound = (operation: Operation, request: RequestFacts): BoundScope => {
  const scope = readScope(request.scope)
  if (!same(operation, scope.operation) || !requestMatches(scope, request))
    invalid("receipt-request")
  return scope
}
export const receiptCorresponds = (operation: Operation, request: RequestFacts, value: unknown) => {
  const receipt = own(Receipt, value),
    scope = bound(operation, request)
  return (
    same(receipt.request, request) &&
    receipt.status === (kindOf(operation) === "publish" ? 200 : 201) &&
    (kindOf(operation) !== "draft" ||
      (receipt.facts instanceof Model.ReleaseFacts && receipt.facts.draft)) &&
    (kindOf(operation) !== "publish" ||
      (receipt.facts instanceof Model.ReleaseFacts && !receipt.facts.draft)) &&
    matches(scope, receipt.facts)
  )
}
export const failureCorresponds = (operation: Operation, request: RequestFacts, value: unknown) => {
  const failure = own(NativeFailure, value)
  bound(operation, request)
  return same(failure.request, request)
}
export const classifyObservation = (
  operation: Operation,
  input: unknown,
  receipts: readonly unknown[],
  context: ProviderContext,
): ObservationStatus => {
  const evidence = own(Observation, input)
  if (evidence._tag === "Unavailable") {
    if (evidence.operationId !== operation.operationId) invalid("observation-operation")
    return "Inconclusive"
  }
  const scope = bindScope(operation, context)
  if (evidence.scope !== encodeScope(scope)) invalid("observation-parent")
  if (evidence._tag === "Missing") return receipts.length ? "Pending" : "Absent"
  if (!matches(scope, evidence.facts)) return "Conflict"
  const intent = intentOf(operation)
  if (!(intent instanceof Model.PublishIntent) && evidence.assets.length)
    invalid("observation-assets")
  if (evidence.observedCommit !== null && evidence.observedCommit !== scope.targetCommit)
    return "Conflict"
  if (intent instanceof Model.AssetIntent) {
    const facts = evidence.facts as Model.AssetFacts
    if (
      evidence.downloadedSha256 !== null &&
      evidence.downloadedSha256 !== intent.file.content.sha256
    )
      return "Conflict"
    return facts.sha256 !== null || evidence.downloadedSha256 !== null
      ? "Satisfied"
      : "Inconclusive"
  }
  if (intent instanceof Model.DraftIntent || intent instanceof Model.PublishIntent)
    if (evidence.observedCommit !== scope.targetCommit) return "Inconclusive"
    else if (intent instanceof Model.PublishIntent) {
      const status = classifyAssets(scope, evidence.assets, context)
      return status !== "Satisfied"
        ? status
        : (evidence.facts as Model.ReleaseFacts).draft
          ? receipts.length
            ? "Conflict"
            : "Absent"
          : "Satisfied"
    } else return "Satisfied"
  return "Satisfied"
}
/** Publish compares the complete native enumeration against every selected asset. */
export const classifyAssets = (
  scope: BoundScope,
  assets: readonly AssetEvidence[],
  context: ProviderContext,
): ObservationStatus => {
  const intent = intentOf(scope.operation)
  if (!(intent instanceof Model.PublishIntent)) invalid("publish-assets")
  const publish = intent as Model.PublishIntent
  if (
    assets.length !== publish.assetOperations.length ||
    new Set(assets.map((a) => a.facts.assetId)).size !== assets.length ||
    new Set(assets.map((a) => a.facts.storedName)).size !== assets.length
  )
    return "Conflict"
  let status: ObservationStatus = "Satisfied"
  for (const id of publish.assetOperations) {
    const dependency = context.dependencies.find((d) => d.operation.operationId === id)
    if (!dependency) invalid("publish-dependency")
    const operation = dependency!.operation,
      assetScope = bindScope(operation, {
        own: dependency!,
        dependencies: context.dependencies,
      })
    const expected = intentOf(operation) as Model.AssetIntent,
      actual = assets.find((a) => a.facts.storedName === expected.publicName),
      recorded = scope.parents.find((p) => p.operationId === id)?.facts
    if (
      !actual ||
      !(recorded instanceof Model.AssetFacts) ||
      actual.facts.assetId !== recorded.assetId ||
      !matches(assetScope, actual.facts) ||
      (actual.downloadedSha256 !== null && actual.downloadedSha256 !== expected.file.content.sha256)
    )
      return "Conflict"
    if (actual.facts.sha256 === null && actual.downloadedSha256 === null) status = "Inconclusive"
  }
  return status
}
