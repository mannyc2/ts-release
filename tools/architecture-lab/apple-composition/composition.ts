import { Effect, Schema } from "effect"
import { Content, OwnedArtifact, type ContentOwner } from "../apple/adoption.js"
import { loadBundle } from "../apple/bundle-codec.js"
import { ApplePreparation, ReadyToPlan, preparationScope } from "../apple/apple-preparation.js"
import { Host, LabError, canonical, hashCanonical, reportRelease, type Plan } from "../machine/src/index.js"

export class ApplePreparations extends Schema.Class<ApplePreparations>("lab/ApplePreparations")({
  format:Schema.Literal("lab/apple-preparations/1"),journalId:Schema.String,preparations:Schema.Array(ApplePreparation)
}) {}
/** These are fixed native inputs, not a recipe or future publication graph. */
export const createApplePreparations=Effect.fn("lab.createApplePreparations")(function*(inputs:readonly ApplePreparation[]){
  if(!inputs.length||new Set(inputs.map(input=>input.source.logicalName.toLowerCase())).size!==inputs.length)return yield* new LabError({code:"preparation-set",message:"Nonempty uniquely named preparation inputs required"})
  const encoded=Schema.encodeSync(Schema.Array(ApplePreparation))(inputs)
  const preimage=encoded.map(({journalId:_,...input})=>input)
  const journalId=yield* hashCanonical("lab/apple-preparations/1",preimage)
  const preparations=yield* Schema.decodeUnknownEffect(Schema.Array(ApplePreparation))(JSON.parse(canonical(encoded.map(input=>({...input,journalId})))))
  const result=new ApplePreparations({format:"lab/apple-preparations/1",journalId,preparations})
  const freeze=(value:unknown):void=>{if(value&&typeof value==="object"){Object.values(value).forEach(freeze);Object.freeze(value)}}
  freeze(result)
  return result
})
export const loadApplePreparations=Effect.fn("lab.loadApplePreparations")(function*(value:unknown){
  const decoded=yield* Schema.decodeUnknownEffect(ApplePreparations,{onExcessProperty:"error"})(value)
  const expected=yield* createApplePreparations(decoded.preparations)
  if(canonical(Schema.encodeSync(ApplePreparations)(decoded))!==canonical(Schema.encodeSync(ApplePreparations)(expected)))return yield* new LabError({code:"preparation-root",message:"Preparation set changed its derived release root"})
  return expected
})

/** A preparation selects its immutable native output set. The one publication
 * binds the complete Bundle containing every selected set and other files. */
export const validateApplePublication = Effect.fn("lab.validateMixedApplePublication")(function*(
  input: ApplePreparations, publication: Plan, bundleContent: Content, owner: ContentOwner
) {
  const admitted=yield* loadApplePreparations(input),inputs=admitted.preparations
  const host = yield* Host
  if (!host.journal || admitted.journalId!==publication.journalId || host.journal.journalId !== publication.journalId || publication.bundleId !== bundleContent.sha256) {
    return yield* new LabError({code:"final-bundle-binding",message:"Publication must bind the complete owned Bundle in this journal"})
  }
  const scopes = yield* Effect.forEach(inputs, preparationScope)
  const ids = scopes.map(scope => scope.plan.planId)
  const known = host.journal.scopes.filter(scope => scope._tag === "PreparationScope" && scope.plan.operations[0]?.definitionId === "effect-build-apple.submit-app")
  if (!inputs.length || new Set(ids).size !== ids.length || known.length !== ids.length || known.some(scope => !ids.includes(scope.plan.planId)) || inputs.some(input => input.journalId !== publication.journalId)) {
    return yield* new LabError({code:"preparation-set",message:"Every exact Apple preparation in this journal must be supplied once"})
  }
  const bundle = yield* loadBundle(owner, yield* owner.read(bundleContent))
  const encoded = (artifact: typeof OwnedArtifact.Type) => canonical(Schema.encodeSync(OwnedArtifact)(artifact))
  for (let retry = 0; retry < 8; retry++) {
    const before = yield* host.store.read(publication.journalId)
    // Validates every declared scope/native codec before interpreting any Ready.
    const report = yield* reportRelease({candidate:"M1",plan:publication})
    if (report.revision !== before.revision) continue
    const results: ReadyToPlan[] = []
    for (const scope of scopes) {
      const record = before.events.find(event => event.planId === scope.plan.planId && event.body._tag === "ObservationRecorded" && typeof event.body.evidence === "object" && event.body.evidence !== null && "_tag" in event.body.evidence && event.body.evidence._tag === "ReadyToPlan")
      if (!record || record.body._tag !== "ObservationRecorded") return yield* new LabError({code:"not-ready",message:"Every Apple preparation must have selected final bytes"})
      const ready = yield* Schema.decodeUnknownEffect(ReadyToPlan)(record.body.evidence)
      const outputs = yield* loadBundle(owner, yield* owner.read(ready.bundleContent))
      const tree = outputs.artifacts.find(artifact => artifact.logicalName === ready.finalTree.logicalName)
      if (tree?._tag !== "OwnedTree" || tree.totalBytes !== ready.finalTree.totalBytes || tree.upstreamManifestSha256 !== ready.finalTree.manifestSha256 || outputs.artifacts.some(artifact => artifact._tag === "OwnedTree" && artifact !== tree)) {
        return yield* new LabError({code:"ready-content-binding",message:"Selected output set must contain the exact assessed native tree"})
      }
      for (const output of outputs.artifacts) if (!bundle.artifacts.some(artifact => encoded(artifact) === encoded(output))) {
        return yield* new LabError({code:"prepared-output-binding",message:"Complete Bundle omits or changes a selected native output"})
      }
      results.push(ready)
    }
    if ((yield* host.store.read(publication.journalId)).revision === before.revision) return results
  }
  return yield* new LabError({code:"context-contention",message:"Could not validate one complete global preparation/publication prefix"})
})
