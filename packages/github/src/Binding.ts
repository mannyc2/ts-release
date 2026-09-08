import * as Schema from "effect/Schema"
import { Operation, type OperationEvidence, type ProviderContext } from "@mannyc1/ts-release"
import { decodeJson, sameData } from "@mannyc1/ts-release/http"
import * as Model from "./Model.js"
import { intentOf, type Kind } from "./Graph.js"
import { invalid, own, object } from "./Native.js"

export const NativeFacts = Schema.Union([
  Model.AnnotatedTagFacts,
  Model.RefFacts,
  Model.ReleaseFacts,
  Model.AssetFacts,
])
export type NativeFacts = typeof NativeFacts.Type
export class Parent extends Schema.Class<Parent>("GitHubParent")({
  operationId: Schema.String,
  targetCommit: Model.oid,
  facts: NativeFacts,
}) {}
export class BoundScope extends Schema.Class<BoundScope>("GitHubBoundScope")({
  operation: Operation,
  targetCommit: Model.oid,
  parents: Schema.Array(Parent),
}) {}
export const encodeScope = (scope: BoundScope) => JSON.stringify(scope)
export const readScope = (text: string): BoundScope => {
  if (text.length > 1024 * 1024) invalid("scope-bound")
  const scope = own(BoundScope, decodeJson(text))
  intentOf(scope.operation)
  if (encodeScope(scope) !== text) invalid("scope-encoding")
  return scope
}
/** These records are decoded only after the kernel has validated their native codecs. */
const selected = (evidence: OperationEvidence): Parent => {
  const candidates: Parent[] = []
  const parent = (scopeValue: unknown, facts: unknown) => {
    const scope = readScope(String(scopeValue))
    if (!sameData(scope.operation, evidence.operation)) invalid("parent-operation")
    return new Parent({
      operationId: evidence.operation.operationId,
      targetCommit: scope.targetCommit,
      facts: own(NativeFacts, facts),
    })
  }
  for (const receipt of evidence.receipts) {
    const record = object(receipt),
      request = object(record.request)
    candidates.push(parent(request.scope, record.facts))
  }
  for (const observation of evidence.observations) {
    if (observation.status !== "Satisfied") continue
    const record = object(observation.evidence)
    if (record._tag !== "Present") invalid("parent-observation")
    candidates.push(parent(record.scope, record.facts))
  }
  const stable = (value: Parent) => {
    const facts = { ...value.facts } as Record<string, unknown>
    if (value.facts instanceof Model.ReleaseFacts) delete facts.draft
    if (value.facts instanceof Model.AssetFacts) delete facts.sha256
    return JSON.stringify({ ...value, facts })
  }
  if (!candidates.length || new Set(candidates.map(stable)).size !== 1) invalid("parent-evidence")
  const digests = candidates.flatMap((c) =>
    c.facts instanceof Model.AssetFacts && c.facts.sha256 !== null ? [c.facts.sha256] : [],
  )
  if (new Set(digests).size > 1) invalid("parent-digest")
  // A later response cannot erase recorded public exposure or a known digest.
  const latest = [...candidates].reverse()
  return (
    latest.find((c) => c.facts instanceof Model.ReleaseFacts && !c.facts.draft) ??
    latest.find((c) => c.facts instanceof Model.AssetFacts && c.facts.sha256 !== null) ??
    latest[0]!
  )
}
export const bindScope = (operation: Operation, context: ProviderContext): BoundScope => {
  const intent = intentOf(operation),
    parents: Parent[] = []
  const parent = (id: string) => {
    const evidence = context.dependencies.find(
      (candidate) => candidate.operation.operationId === id,
    )
    if (!evidence) return invalid("undeclared-parent")
    const result = selected(evidence)
    parents.push(result)
    return result
  }
  let targetCommit: string
  if (intent instanceof Model.LightweightTag || intent instanceof Model.AnnotatedTag)
    targetCommit = intent.commit
  else if (intent instanceof Model.AnnotatedRef)
    targetCommit = parent(intent.annotatedTagOperation).targetCommit
  else if (intent instanceof Model.DraftIntent)
    targetCommit =
      intent.tagSource._tag === "ExistingTag"
        ? intent.tagSource.commit
        : parent(intent.tagSource.operationId).targetCommit
  else {
    targetCommit = parent(intent.draftOperation).targetCommit
    if (intent instanceof Model.PublishIntent)
      for (const id of [...intent.assetOperations].sort()) parent(id)
  }
  return new BoundScope({
    operation,
    targetCommit,
    parents: parents.sort((a, b) => (a.operationId < b.operationId ? -1 : 1)),
  })
}
export const parentFacts = <K extends Kind>(
  scope: BoundScope,
  id: string,
  kind: K,
): NativeFacts => {
  const facts = scope.parents.find((parent) => parent.operationId === id)?.facts
  if (
    !facts ||
    (kind === "draft" && !(facts instanceof Model.ReleaseFacts)) ||
    (kind === "object" && !(facts instanceof Model.AnnotatedTagFacts))
  )
    return invalid("parent-kind")
  return facts
}
