import * as Effect from "effect/Effect"
import { createOperation, type Operation, type ProviderDescriptor } from "@mannyc1/ts-release"
import * as Model from "./Model.js"
import { attempt, invalid, own, api } from "./Native.js"

export const descriptors = {
  lightweight: {
    definitionId: "github.lightweight-tag",
    intentVersion: "1",
    intentCodec: Model.LightweightTag,
  },
  object: {
    definitionId: "github.annotated-tag",
    intentVersion: "1",
    intentCodec: Model.AnnotatedTag,
  },
  ref: {
    definitionId: "github.annotated-ref",
    intentVersion: "1",
    intentCodec: Model.AnnotatedRef,
  },
  draft: { definitionId: "github.draft", intentVersion: "1", intentCodec: Model.DraftIntent },
  asset: { definitionId: "github.asset", intentVersion: "1", intentCodec: Model.AssetIntent },
  publish: { definitionId: "github.publish", intentVersion: "1", intentCodec: Model.PublishIntent },
} as const satisfies Record<string, ProviderDescriptor>
export type Kind = keyof typeof descriptors
export type Intent =
  | Model.LightweightTag
  | Model.AnnotatedTag
  | Model.AnnotatedRef
  | Model.DraftIntent
  | Model.AssetIntent
  | Model.PublishIntent
export const kindOf = (operation: Operation): Kind => {
  const kind = (Object.keys(descriptors) as Kind[]).find(
    (key) =>
      descriptors[key].definitionId === operation.definitionId && operation.intentVersion === "1",
  )
  return kind ?? invalid("definition")
}
export const intentOf = (operation: Operation): Intent =>
  own(
    descriptors[kindOf(operation)].intentCodec as import("effect/Schema").Codec<Intent, unknown>,
    operation.intent,
  )
const required = (intent: Intent): readonly string[] => {
  if (intent instanceof Model.AnnotatedRef) return [intent.annotatedTagOperation]
  if (intent instanceof Model.DraftIntent)
    return intent.tagSource._tag === "ManagedTag" ? [intent.tagSource.operationId] : []
  if (intent instanceof Model.PublishIntent)
    return [intent.draftOperation, ...intent.assetOperations]
  if (intent instanceof Model.AssetIntent) return [intent.draftOperation]
  return []
}
const author = <A extends Intent>(
  descriptor: ProviderDescriptor & {
    readonly intentCodec: import("effect/Schema").Codec<A, unknown>
  },
) =>
  Effect.fn(descriptor.definitionId)(function* (input: A, dependsOn: readonly string[] = []) {
    const intent = yield* attempt(() => own(descriptor.intentCodec, input))
    return yield* createOperation(descriptor, intent, [
      ...new Set([...required(intent), ...dependsOn]),
    ])
  })
export const lightweightTag = author(descriptors.lightweight)
export const annotatedTag = author(descriptors.object)
export const annotatedRef = author(descriptors.ref)
export const draft = author(descriptors.draft)
export const uploadAsset = author(descriptors.asset)
export const publish = author(descriptors.publish)
const sameRepository = (a: Intent, b: Intent) =>
  api(a.repository).toLowerCase() === api(b.repository).toLowerCase()
/** All selected native relationships are admitted before the first provider effect. */
export const validatePlan = (operations: readonly Operation[]): void => {
  const selected = operations.filter((operation) =>
    Object.values(descriptors).some((d) => d.definitionId === operation.definitionId),
  )
  const intents = new Map(selected.map((operation) => [operation.operationId, intentOf(operation)]))
  const coordinates = new Set<string>()
  for (const operation of selected) {
    const intent = intents.get(operation.operationId)!,
      kind = kindOf(operation)
    for (const id of required(intent)) {
      const dependency = intents.get(id)
      if (!dependency || !operation.dependsOn.includes(id) || !sameRepository(intent, dependency))
        invalid("graph-dependency")
    }
    if (intent instanceof Model.AnnotatedRef) {
      const parent = intents.get(intent.annotatedTagOperation)
      if (!(parent instanceof Model.AnnotatedTag) || parent.tag !== intent.tag)
        invalid("annotated-parent")
    }
    if (intent instanceof Model.DraftIntent && intent.tagSource._tag === "ManagedTag") {
      const parent = intents.get(intent.tagSource.operationId)
      if (
        !(parent instanceof Model.LightweightTag || parent instanceof Model.AnnotatedRef) ||
        parent.tag !== intent.tag
      )
        invalid("draft-tag")
    }
    if (intent instanceof Model.AssetIntent || intent instanceof Model.PublishIntent) {
      if (!(intents.get(intent.draftOperation) instanceof Model.DraftIntent))
        invalid("draft-parent")
    }
    if (intent instanceof Model.PublishIntent) {
      if (new Set(intent.assetOperations).size !== intent.assetOperations.length)
        invalid("duplicate-asset")
      const assets = selected
        .filter((op) => {
          const asset = intents.get(op.operationId)
          return (
            asset instanceof Model.AssetIntent && asset.draftOperation === intent.draftOperation
          )
        })
        .map((op) => op.operationId)
        .sort()
      if (JSON.stringify(assets) !== JSON.stringify([...intent.assetOperations].sort()))
        invalid("complete-assets")
    }
    const coordinate =
      intent instanceof Model.AssetIntent
        ? `${api(intent.repository)}:asset:${intent.draftOperation}:${intent.publicName}`
        : intent instanceof Model.PublishIntent
          ? `${api(intent.repository)}:publish:${intent.draftOperation}`
          : `${api(intent.repository)}:${kind === "lightweight" || kind === "ref" ? "ref" : kind}:${intent.tag}`
    const prefix = api(intent.repository)
    const nativeCoordinate = prefix.toLowerCase() + coordinate.slice(prefix.length)
    if (coordinates.has(nativeCoordinate)) invalid("duplicate-coordinate")
    coordinates.add(nativeCoordinate)
  }
}
