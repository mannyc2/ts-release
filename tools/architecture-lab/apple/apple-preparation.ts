import { Effect, FileSystem, Schema } from "effect"
import * as Artifact from "effect-build/Artifact"
import * as Tool from "effect-build/Author/Tool"
import * as Tree from "effect-build/Author/Tree"
import * as Model from "effect-build-apple/Model"
import * as Notary from "effect-build-apple/Notary"
import * as Staple from "effect-build-apple/Staple"
import * as Assess from "effect-build-apple/Assess"
import { Content, OwnedTree, adoptTree, finalize, type ContentOwner } from "./adoption.js"
import { encodeBundle, loadBundle, restoreTree } from "./bundle-codec.js"
import {
  Host, LabError, NoReplay, canonical, createPreparationScope, makeRequest,
  runRelease, observeRelease, reportRelease, PROVIDER_CONTRACT, type HostShape, type Plan, type ProviderDefinition, type RunOptions
} from "../machine/src/index.js"

const CodesignObservation = Schema.declare<Tool.Observation<"codesign">>(
  (value): value is Tool.Observation<"codesign"> => Artifact.isProvenance(value) && "name" in value && value.name === "codesign"
)
/** Consumer-owned durable projection: upstream Model signature is not a Schema. */
export class ApplicationSignature extends Schema.Class<ApplicationSignature>("lab/ApplicationSignature")({
  certificateSha1: Model.CertificateSha1, tool: CodesignObservation,
  hardenedRuntime: Schema.Literal(true), secureTimestamp: Schema.Literal(true)
}) {}
/** Fixed native request, without destinations, operation graph, or derived plan recipe. */
export class ApplePreparation extends Schema.Class<ApplePreparation>("lab/ApplePreparation")({
  format: Schema.Literal("lab/apple-preparation/1"),
  journalId: Schema.NonEmptyString,
  bundleName: Artifact.PortableRelativePath.check(Schema.isPattern(/^[^/\\]+\.app$/)),
  source: OwnedTree, architecture: Model.Architecture, signature: ApplicationSignature,
  principal: Schema.NonEmptyString, credentialRef: Schema.NonEmptyString,
  producerRevision: Schema.Literal("dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc")
}) {}
export class ReadyToPlan extends Schema.TaggedClass<ReadyToPlan>()("ReadyToPlan", {
  preparationId: Schema.String, acceptance: Notary.AcceptedReference,
  bundleContent: Content,
  finalTree: Schema.Struct({logicalName:Artifact.PortableRelativePath,totalBytes:Artifact.DecimalBytesSchema,manifestSha256:Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/))}),
  assessment: Assess.GatekeeperAccepted
}) {}
export const AppleEvidence = Schema.Union([Notary.Observation,ReadyToPlan])

const sourceCorresponds = (input: ApplePreparation, result: Notary.SubmissionReference|Notary.AcceptedReference) =>
  result.kind === "zip" && result.architecture === input.architecture &&
  result.stapleTarget?.kind === "app" && result.stapleTarget.identityKind === "tree-manifest" &&
  result.stapleTarget.bundleName === input.bundleName && result.stapleTarget.artifactBytes === input.source.totalBytes && result.stapleTarget.artifactDigest.value === input.source.upstreamManifestSha256

const asLabError = (error: unknown) => new LabError({code:"apple-host-boundary",message:String(error)})

/** Owned source bytes are restored into a new upstream-finalized private tree. */
export const restoreSource = Effect.fn("lab.restoreAppleSource")(function*(
  input: ApplePreparation, owner: ContentOwner, outdir: string
) {
  const artifact = yield* restoreTree(owner,input.source,`${outdir}/${input.bundleName}`,input.signature.tool)
  if (artifact.manifestDigest.value !== input.source.upstreamManifestSha256 || artifact.totalBytes !== input.source.totalBytes) {
    return yield* new LabError({code:"source-identity",message:"Restored source differs from immutable preparation"})
  }
  const source: Model.DeveloperIdApplicationBundle = {
    ...artifact, architecture:input.architecture,
    signature:new Model.DeveloperIdApplicationSignature({...input.signature,architecture:input.architecture})
  }
  if (!Model.hasDeveloperIdApplicationSignature(source)) return yield* new LabError({code:"signature-shape",message:"Restored signature projection is invalid"})
  return source
})

export const preparationProvider: ProviderDefinition = {
  contract: PROVIDER_CONTRACT, definitionId:"effect-build-apple.submit-app",intentVersion:"pr24/1",intentCodec:ApplePreparation,
  receiptVersion:"effect-build-apple/Submission/pr24",receiptCodec:Notary.Submission,
  classifyReceipt:()=>"Pending",
  dispatchError:{version:"effect-build-apple/SubmissionOutcomeUnknown/pr24",codec:Notary.SubmissionOutcomeUnknown,
    corresponds:(operation,request,evidence)=>{
      const input=Schema.decodeUnknownSync(ApplePreparation)(operation.intent)
      const native=Schema.decodeUnknownSync(Notary.SubmissionOutcomeUnknown)(evidence)
      // The opaque ZIP digest is native diagnostic evidence, not the source tree ID.
      return /^[0-9a-f]{64}$/.test(native.artifactDigest)&&request.transport==="opaque/1"&&request.endpoint==="effect-build-apple/Notary.submitApp"&&request.principal===input.principal&&request.scope===input.credentialRef
    }},
  receiptCorresponds:(operation,request,receipt)=>{
    const input=Schema.decodeUnknownSync(ApplePreparation)(operation.intent)
    const native=Schema.decodeUnknownSync(Notary.Submission)(receipt)
    return sourceCorresponds(input,native) && request.transport === "opaque/1" && request.endpoint === "effect-build-apple/Notary.submitApp" && request.principal === input.principal && request.scope === input.credentialRef
  },
  observationVersion:"lab/apple-evidence/1",observationCodec:AppleEvidence,
  classifyObservation:(operation,evidence,acceptedReceipts)=>{
    const input=Schema.decodeUnknownSync(ApplePreparation)(operation.intent)
    const native=Schema.decodeUnknownSync(AppleEvidence)(evidence)
    const correlated="_tag" in native && native._tag === "ReadyToPlan" ? native.acceptance : native as Notary.Observation
    if(!acceptedReceipts.some(receipt=>{
      const prior=Schema.decodeUnknownSync(Notary.Submission)(receipt)
      return prior.submissionId===correlated.submissionId && prior.artifactBytes===correlated.artifactBytes && prior.artifactDigest.value===correlated.artifactDigest.value && sourceCorresponds(input,prior)
    }))throw new Error("Native observation has no matching persisted submission")
    if ("_tag" in native && native._tag === "ReadyToPlan") {
      if(native.preparationId!==operation.operationId || !sourceCorresponds(input,native.acceptance) || native.finalTree.logicalName!==input.source.logicalName ||
        native.assessment.artifactDigest.value!==native.finalTree.manifestSha256 || native.assessment.artifactBytes!==native.finalTree.totalBytes ||
        native.assessment.kind!=="app" || native.assessment.identityKind!=="tree-manifest" || native.assessment.architecture!==input.architecture) throw new Error("ReadyToPlan source/final association differs")
      return "Satisfied"
    }
    const observation=native as Notary.Observation
    if(!sourceCorresponds(input,observation))throw new Error("Native observation belongs to another source")
    return observation.status._tag === "Rejected" ? "Conflict" : "Pending"
  },
  prepare: Effect.fn("lab.prepareOpaqueAppleCall")(function*(operation){
    const input = yield* Schema.decodeUnknownEffect(ApplePreparation)(operation.intent).pipe(Effect.mapError(asLabError))
    return yield* makeRequest({transport:"opaque/1",endpoint:"effect-build-apple/Notary.submitApp",method:"invoke",
      headers:[],body:new TextEncoder().encode(canonical(input)),principal:input.principal,
      scope:input.credentialRef,replay:new NoReplay({})})
  })
}

/** Public Notary.submitApp performs its ZIP creation internally; no wire claim. */
export const submitPreparedApp = Effect.fn("lab.submitPreparedApp")(function*(
  input: ApplePreparation, owner: ContentOwner, outdir: string
) {
  const source = yield* restoreSource(input,owner,outdir)
  return yield* Notary.submitApp({bundle:source})
})

/** Polling uses the persisted public submission. It never guesses a missing ID. */
export const finishPreparedApp = Effect.fn("lab.finishPreparedApp")(function*(
  preparationId: string, input: ApplePreparation, submission: Notary.Submission,
  owner: ContentOwner, sourceDir: string, outputDir: string
) {
  const result = submission.status._tag === "Accepted" ? submission : yield* Notary.info(submission)
  if (result.status._tag !== "Accepted") return {status:result.status._tag === "Pending" ? "Pending" as const : "Conflict" as const,evidence:Schema.encodeSync(Notary.Observation)(result)}
  const acceptance = yield* Notary.acceptedReference(result)
  if (acceptance.stapleTarget.kind !== "app" || acceptance.stapleTarget.artifactDigest.value !== input.source.upstreamManifestSha256 || acceptance.stapleTarget.artifactBytes !== input.source.totalBytes) {
    return yield* new LabError({code:"native-correlation",message:"Acceptance belongs to another source"})
  }
  const source = yield* restoreSource(input,owner,sourceDir)
  const finalArtifact = yield* Staple.stapleApp({source,acceptance,outdir:`${outputDir}/${input.bundleName}`})
  const assessment = yield* Assess.assess({kind:"app",artifact:finalArtifact})
  if (assessment.artifactDigest.value !== finalArtifact.manifestDigest.value || assessment.artifactBytes !== finalArtifact.totalBytes || assessment.architecture !== input.architecture || assessment.kind !== "app") {
    return yield* new LabError({code:"assessment-correlation",message:"Gatekeeper result belongs to another artifact"})
  }
  const adopted=yield* adoptTree(owner,input.source.logicalName,finalArtifact)
  const bundle = yield* finalize([adopted])
  const bundleContent=yield* owner.putOwned(encodeBundle(bundle))
  return {status:"Satisfied" as const,evidence:Schema.encodeSync(ReadyToPlan)(new ReadyToPlan({preparationId,acceptance,bundleContent,
    finalTree:{logicalName:adopted.logicalName,totalBytes:Artifact.decimalBytes(adopted.totalBytes),manifestSha256:Artifact.sha256Digest(adopted.upstreamManifestSha256).value},assessment}))}
})

export const preparationScope = (input: ApplePreparation) => createPreparationScope(preparationProvider,input,input.journalId)

/** Match the validated global revision to the exact prefix used for selection/CAS. */
const validatedSnapshot=Effect.fn("lab.validatedAppleSnapshot")(function*(plan:Plan){
  const host=yield* Host
  for(let retry=0;retry<8;retry++){
    const snapshot=yield* host.store.read(plan.journalId)
    const report=yield* reportRelease({plan})
    if(report.revision===snapshot.revision)return {snapshot,report}
  }
  return yield* new LabError({code:"context-contention",message:"Could not select an exact validated release prefix"})
})

/** The ordinary machine owns submit permission; native completion records a fact in its same journal. */
export const runPreparation = Effect.fn("lab.runPreparation")(function*(
  input: ApplePreparation, options: Omit<RunOptions,"plan">,
  complete: (submission: Notary.Submission, preparationId: string) => Effect.Effect<{status:"Satisfied"|"Pending"|"Conflict";evidence:unknown},LabError>
) {
  const host = yield* Host
  if(!host.journal||host.journal.journalId!==input.journalId)return yield* new LabError({code:"preparation-context",message:"Apple preparation requires its exact explicit release journal context"})
  const scope = yield* preparationScope(input)
  if (!host.journal.scopes.some(known=>known._tag === "PreparationScope" && known.plan.planId === scope.plan.planId)) {
    return yield* new LabError({code:"changed-preparation",message:"The exact immutable preparation must be admitted in this release context"})
  }
  yield* runRelease({...options,plan:scope.plan,observe:false})
  const {snapshot} = yield* validatedSnapshot(scope.plan)
  const events = snapshot.events.filter(event=>event.planId===scope.plan.planId)
  const alreadyReady = events.find(event=>event.body._tag === "ObservationRecorded" && typeof event.body.evidence === "object" && event.body.evidence !== null && "_tag" in event.body.evidence && event.body.evidence._tag === "ReadyToPlan")
  if (alreadyReady) return
  const receipt = events.find(event=>event.body._tag === "ReceiptAccepted")
  if (!receipt || receipt.body._tag !== "ReceiptAccepted") return
  const submission = yield* Schema.decodeUnknownEffect(Notary.Submission)(receipt.body.receipt).pipe(Effect.mapError(asLabError))
  const observation = yield* complete(submission,scope.plan.operations[0]!.operationId)
  // Ready and non-Ready native facts take the same ordinary observation path. A competing process may
  // have selected different final bytes first: the kernel's preparation-selection law refuses this one
  // at the CAS, which is not a failure of this process.
  const observing: HostShape = {...host,providers:host.providers.map(provider=>provider.definitionId===preparationProvider.definitionId?{...provider,observe:()=>Effect.succeed(observation)}:provider)}
  yield* observeRelease({plan:scope.plan}).pipe(
    Effect.provideService(Host,observing),
    Effect.catchIf((error)=>error.code==="preparation-selected",()=>Effect.gen(function*(){
      // A competing selected output is success only after fresh complete admission.
      // Invalid already-committed history must still fail on this read.
      const winner = yield* validatedSnapshot(scope.plan)
      if (!winner.snapshot.events.some(event=>event.planId===scope.plan.planId&&event.body._tag==="ObservationRecorded"&&event.body.status==="Satisfied")) {
        return yield* new LabError({code:"preparation-selected",message:"No validated selected preparation output exists"})
      }
    }))
  )
})

/** The sole final plan binds the first CAS-selected ReadyToPlan bytes in this root. */
export const validateApplePublication = Effect.fn("lab.validateApplePublication")(function*(input:ApplePreparation,publication:Plan,owner:ContentOwner){
  const host=yield* Host
  const scope=yield* preparationScope(input)
  const {snapshot}=yield* validatedSnapshot(scope.plan)
  const event=snapshot.events.find(item=>item.planId===scope.plan.planId&&item.body._tag==="ObservationRecorded"&&typeof item.body.evidence==="object"&&item.body.evidence!==null&&"_tag" in item.body.evidence&&item.body.evidence._tag==="ReadyToPlan")
  if(!event||event.body._tag!=="ObservationRecorded")return yield* new LabError({code:"not-ready",message:"No finalized native product is ready to plan"})
  const ready=yield* Schema.decodeUnknownEffect(ReadyToPlan)(event.body.evidence).pipe(Effect.mapError(asLabError))
  const bundle=yield* loadBundle(owner,yield* owner.read(ready.bundleContent))
  const artifact=bundle.artifacts[0]
  if(bundle.artifacts.length!==1||artifact?._tag!=="OwnedTree"||artifact.logicalName!==ready.finalTree.logicalName||artifact.totalBytes!==ready.finalTree.totalBytes||artifact.upstreamManifestSha256!==ready.finalTree.manifestSha256)return yield* new LabError({code:"ready-content-binding",message:"Ready record differs from immutable final bundle"})
  if(publication.journalId!==input.journalId||publication.bundleId!==ready.bundleContent.sha256)return yield* new LabError({code:"final-bundle-binding",message:"Publication plan does not bind this preparation's selected final bytes"})
  return ready
})

/** A selected publication report alone cannot represent the producer prefix. */
export const reportAppleContext = Effect.fn("lab.reportAppleContext")(function*(input:ApplePreparation,owner:ContentOwner, publication?:Plan){
  const host=yield* Host
  const preparation=yield* preparationScope(input)
  if(publication)yield* validateApplePublication(input,publication,owner)
  for(let retry=0;retry<8;retry++){
    const {snapshot,report:prepared}=yield* validatedSnapshot(preparation.plan)
    const published=publication?yield* reportRelease({plan:publication}):undefined
    if(published&&published.revision!==snapshot.revision)continue
    return {journalId:input.journalId,revision:snapshot.revision,preparation:prepared,...(published?{publication:published}:{}),
      nativeFacts:snapshot.events.filter(event=>event.planId===preparation.plan.planId)}
  }
  return yield* new LabError({code:"report-contention",message:"Could not report one exact global prefix"})
})
