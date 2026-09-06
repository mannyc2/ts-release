import { strict as assert } from "node:assert"
import { randomUUID } from "node:crypto"
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Crypto, Effect, FileSystem, Layer, Schema } from "effect"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Artifact from "effect-build/Artifact"
import * as Tool from "effect-build/Author/Tool"
import * as Tree from "effect-build/Author/Tree"
import * as Model from "effect-build-apple/Model"
import * as Notary from "effect-build-apple/Notary"
import * as Staple from "effect-build-apple/Staple"
import * as Assess from "effect-build-apple/Assess"
import { adoptTree } from "./adoption.js"
import { fileContentOwner } from "./content-owner.js"
import { ApplePreparation, ApplicationSignature, ReadyToPlan, preparationProvider, preparationScope, submitPreparedApp, finishPreparedApp, runPreparation, reportAppleContext, validateApplePublication } from "./apple-preparation.js"
import { SqliteJournal } from "../storage/sqlite.js"
import { Host, JournalEvent, LabError, NoReplay, ObservationRecorded, Plan, PlanSuperseded, canonical, createOperation, createPlan, hashCanonical, makeRequest, reportRelease, runRelease, type HostShape, type ProviderDefinition } from "../machine/src/index.js"

const publicObservation = <N extends string>(name:N): Tool.Observation<N> => ({name,participants:[{
  role:"protocol-double",name,version:"fixture-only",revision:"fixture-only",channel:"fixture-only",
  content:{bytes:Artifact.decimalBytes("0"),digest:Artifact.sha256Digest("0".repeat(64))}
}],capabilities:[]})
const codesign=publicObservation("codesign"), notarytool=publicObservation("notarytool"), ditto=publicObservation("ditto")
const submissionId="00000000-0000-4000-8000-000000000001"
const run = <A,E,R>(effect:Effect.Effect<A,E,R>) => Effect.runPromise(effect.pipe(Effect.provide(NodeServices.layer)) as Effect.Effect<A,E>)
const caught=(error:unknown)=>new LabError({code:"native-fixture",message:String(error)})
const calls=(root:string)=>existsSync(join(root,"native-calls.jsonl"))?readFileSync(join(root,"native-calls.jsonl"),"utf8").trim().split("\n").filter(Boolean).map(line=>JSON.parse(line) as {operation:string}):[]

/** Explicit protocol doubles. No xcrun/codesign/stapler/spctl command is executed. */
const protocolLayers = (root:string, mode:string) => {
  const record=(operation:string)=>appendFileSync(join(root,"native-calls.jsonl"),JSON.stringify({operation})+"\n")
  const client=Layer.succeed(Notary.Client,{
    submit:()=>Effect.die("file submit outside app fixture"),
    submitApp:(input)=>Effect.gen(function*(){
      assert.equal(Model.hasDeveloperIdApplicationSignature(input.bundle),true)
      assert.equal(input.bundle.root.endsWith("/Fixture.app"),true)
      record("submitApp")
      if(mode==="native-unknown") return yield* new Notary.SubmissionOutcomeUnknown({artifactDigest:input.bundle.manifestDigest.value,reason:"protocol double lost response before submission ID"})
      return new Notary.Submission({submissionId,kind:"zip",architecture:input.bundle.architecture,
        artifactBytes:Artifact.decimalBytes("17"),artifactDigest:Artifact.sha256Digest("a".repeat(64)),
        status:new Notary.Pending({providerStatus:"In Progress"}),submissionTool:notarytool,tool:notarytool,transportTool:ditto,
        stapleTarget:new Notary.StapleTarget({kind:"app",identityKind:"tree-manifest",artifactBytes:input.bundle.totalBytes,
          artifactDigest:input.bundle.manifestDigest,bundleName:"Fixture.app"})})
    }),
    info:(reference)=>Effect.sync(()=>{
      record("info")
      return new Notary.Observation({...reference,tool:notarytool,status:mode==="pending"?new Notary.Pending({providerStatus:"In Progress"}):mode==="rejected"?new Notary.Rejected({providerStatus:"Invalid"}):new Notary.Accepted({providerStatus:"Accepted"})})
    }),
    log:()=>Effect.die("log outside fixture")
  })
  const stapler=Layer.succeed(Staple.Stapler,{
    stapleFile:()=>Effect.die("file staple outside app fixture"),
    stapleApp:(input)=>Effect.gen(function*(){
      assert.equal(input.source.root.endsWith("/Fixture.app"),true);assert.equal(input.outdir.endsWith("/Fixture.app"),true)
      assert.equal(input.acceptance.stapleTarget.bundleName,"Fixture.app")
      record("stapleApp")
      if(mode==="race-final")yield* Effect.tryPromise({try:async()=>{
        writeFileSync(join(root,`barrier-${process.pid}`),"")
        for(let wait=0;wait<500;wait++){if(readdirSync(root).filter(name=>name.startsWith("barrier-")).length===2)return;await Bun.sleep(10)}
        throw new Error("second completing process did not reach barrier")
      },catch:caught})
      const output=yield* Tree.publish({outdir:input.outdir,observation:"hashed",provenance:codesign},candidate=>Effect.gen(function*(){
        const fs=yield* FileSystem.FileSystem
        yield* fs.writeFileString(`${candidate}/program`, "UNSIGNED PROTOCOL DOUBLE; NOT A MAC APPLICATION")
        yield* fs.chmod(`${candidate}/program`,0o755)
        yield* fs.writeFileString(`${candidate}/ticket`, `PROTOCOL DOUBLE; NOT AN APPLE TICKET${mode==="race-final"?input.outdir:""}`)
      }))
      return {...output,architecture:input.source.architecture,signature:input.source.signature,
        notarizationTicket:new Model.NotarizationTicket({submissionId:input.acceptance.submissionId,submittedKind:"zip",
          submittedBytes:input.acceptance.artifactBytes,submittedDigest:input.acceptance.artifactDigest,targetKind:"app",
          targetIdentityKind:"tree-manifest",targetBytes:input.source.totalBytes,targetDigest:input.source.manifestDigest,
          targetArchitecture:input.source.architecture,submissionTool:notarytool,acceptanceTool:notarytool})}
    }).pipe(Effect.provide(NodeServices.layer),Effect.mapError(error=>new Model.ProductStateInvalid({operation:"fixture-staple",path:input.outdir,expected:String(error)})))
  })
  const assessor=Layer.succeed(Assess.Assessor,{assess:(input)=>Effect.gen(function*(){
    record("assess")
    if(mode==="assessment-rejected") return yield* new Model.ProductStateInvalid({operation:"fixture-assess",path:"fixture",expected:"protocol double rejected assessment"})
    if(input.kind!=="app") return yield* new Model.ProductStateInvalid({operation:"fixture-assess",path:"fixture",expected:"wrong fixture kind"})
    return new Assess.GatekeeperAccepted({kind:"app",architecture:input.artifact.architecture,identityKind:"tree-manifest",
      artifactBytes:input.artifact.totalBytes,artifactDigest:input.artifact.manifestDigest,accepted:true,
      gatekeeper:publicObservation("spctl"),structuralVerifier:codesign})
  })})
  return Layer.mergeAll(client,stapler,assessor,NodeServices.layer)
}

class PublishIntent extends Schema.Class<PublishIntent>("lab/PublishIntent")({bundleId:Schema.String}) {}
class PublishReceipt extends Schema.Class<PublishReceipt>("lab/PublishReceipt")({published:Schema.Literal(true),bundleId:Schema.String}) {}
const publicationProvider:ProviderDefinition={definitionId:"fixture.publish-final-bundle",intentVersion:"1",intentCodec:PublishIntent,
  receiptVersion:"fixture-published/1",receiptCodec:PublishReceipt,
  classifyReceipt:()=>"Satisfied",
  receiptCorresponds:(operation,_request,receipt)=>Schema.decodeUnknownSync(PublishReceipt)(receipt).bundleId===Schema.decodeUnknownSync(PublishIntent)(operation.intent).bundleId,
  prepare:Effect.fn(function*(operation){return yield* makeRequest({transport:"opaque/1",endpoint:"fixture://publication",method:"invoke",headers:[],
    body:new TextEncoder().encode(canonical(operation.intent)),principal:"fixture-user",scope:"publish",replay:new NoReplay({})})})}

const setup=async(root:string)=>{
  mkdirSync(root,{recursive:true})
  const artifact=await run(Tree.publish({outdir:join(root,"signed-source"),observation:"hashed",provenance:codesign},candidate=>Effect.gen(function*(){
    const fs=yield* FileSystem.FileSystem; yield* fs.writeFileString(`${candidate}/program`,"UNSIGNED PROTOCOL DOUBLE; NOT A MAC APPLICATION");yield* fs.chmod(`${candidate}/program`,0o755)
  })))
  const source=await run(adoptTree(fileContentOwner(join(root,"objects")),"Fixture.app",artifact))
  const input=new ApplePreparation({format:"lab/apple-preparation/1",journalId:"fixture-release",bundleName:Artifact.portableRelativePath("Fixture.app"),source,architecture:"arm64",
    signature:new ApplicationSignature({certificateSha1:"0".repeat(40),tool:codesign,hardenedRuntime:true,secureTimestamp:true}),
    principal:"fixture-user",credentialRef:"fixture/no-credential",producerRevision:"dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc"})
  writeFileSync(join(root,"preparation.json"),canonical(Schema.encodeSync(ApplePreparation)(input)),{flag:"wx"})
  return input
}

const worker=async(root:string,mode:string)=>{
  const input=Schema.decodeUnknownSync(ApplePreparation)(JSON.parse(readFileSync(join(root,"preparation.json"),"utf8")))
  const scope=await run(preparationScope(input))
  const owner=fileContentOwner(join(root,"objects"))
  const store=new SqliteJournal(join(root,"journal.sqlite"))
  let injectForeignPrefix=false
  const observedStore={append:store.append,read:(journalId:string)=>Effect.gen(function*(){
    const snapshot=yield* store.read(journalId)
    if(injectForeignPrefix){injectForeignPrefix=false;yield* store.append(journalId,snapshot.revision,new JournalEvent({format:"architecture-lab/event/1",journalId,planId:"foreign-scope",eventId:randomUUID(),body:new PlanSuperseded({reason:"fixture concurrent unknown scope"})}))}
    return snapshot
  })}
  const plan=existsSync(join(root,"publication-plan.json"))?Schema.decodeUnknownSync(Plan)(JSON.parse(readFileSync(join(root,"publication-plan.json"),"utf8"))):undefined
  const host:HostShape={store:observedStore,journal:{journalId:"fixture-release",scopes:[scope,...(plan?[{_tag:"PublicationScope" as const,plan}]:[])]},
    now:()=>Date.now(),uniqueId:()=>randomUUID(),providers:[preparationProvider,publicationProvider],transport:{send:(request)=>Effect.gen(function*(){
      if(request.facts.endpoint==="fixture://publication") {appendFileSync(join(root,"publication-calls"),"publish\n");return {_tag:"Accepted" as const,receipt:new PublishReceipt({published:true,bundleId:JSON.parse(new TextDecoder().decode(request.body)).bundleId})}}
      const decoded=yield* Schema.decodeUnknownEffect(ApplePreparation)(JSON.parse(new TextDecoder().decode(request.body))).pipe(Effect.mapError(caught))
      return yield* submitPreparedApp(decoded,owner,join(root,`restored-${randomUUID()}`)).pipe(Effect.provide(protocolLayers(root,mode)),
        Effect.map(submission=>({_tag:"Accepted" as const,receipt:Schema.encodeSync(Notary.Submission)(submission)})),
        Effect.catch(error=>error instanceof Notary.SubmissionOutcomeUnknown?Effect.succeed({_tag:"Unknown" as const,reason:"Native submission has no durable ID",nativeError:Schema.encodeSync(Notary.SubmissionOutcomeUnknown)(error)}):Effect.fail(caught(error))))
    })}}
  const runWithHost=<A,E>(effect:Effect.Effect<A,E,Host|Crypto.Crypto>)=>run(effect.pipe(Effect.provideService(Host,host)))
  try {
    if(mode==="publish") {
      if(!plan) throw new Error("publication plan missing")
      await runWithHost(validateApplePublication(input,plan,owner))
      return await runWithHost(runRelease({candidate:"M2",plan,authorize:true}))
    }
    if(mode==="forged-plan"){
      const forged=await run(createPlan("different-final-bundle",[],input.journalId))
      return await runWithHost(validateApplePublication(input,forged,owner))
    }
    if(mode==="report") return await runWithHost(reportAppleContext(input,owner,plan))
    if(mode==="changed-input") {
      const changed=new ApplePreparation({...input,architecture:"x64"})
      return await runWithHost(runPreparation(changed,{candidate:"M2",authorize:true},()=>Effect.die("changed input must not complete")))
    }
    if(mode==="missing-context"){
      const {journal:_,...unscoped}=host
      return await run(runPreparation(input,{candidate:"M2",authorize:true},()=>Effect.die("missing context must not complete")).pipe(Effect.provideService(Host,unscoped)))
    }
    if(mode==="late-observation") {
      const snapshot=await run(store.read("fixture-release"))
      const submitted=snapshot.events.find(event=>event.body._tag==="ReceiptAccepted")!
      if(submitted.body._tag!=="ReceiptAccepted")throw new Error("receipt missing")
      const native=Schema.decodeUnknownSync(Notary.Submission)(submitted.body.receipt)
      const evidence=new Notary.Observation({...native,status:new Notary.Pending({providerStatus:"In Progress"})})
      await run(store.append("fixture-release",snapshot.revision,new JournalEvent({format:"architecture-lab/event/1",eventId:randomUUID(),journalId:"fixture-release",planId:scope.plan.planId,
        body:new ObservationRecorded({operationId:scope.plan.operations[0]!.operationId,status:"Pending",evidenceKind:"Observation",evidenceVersion:"lab/apple-evidence/1",evidence:Schema.encodeSync(Notary.Observation)(evidence),observedAt:Date.now()})})))
      return await runWithHost(reportAppleContext(input,owner,plan))
    }
    await runWithHost(runPreparation(input,{candidate:"M2",authorize:true,
      checkpoint:(stage)=>Effect.sync(()=>{if(mode===stage)process.exit(81)})},(submission,id)=>finishPreparedApp(id,input,submission,owner,
        join(root,`restore-final-${randomUUID()}`),join(root,`final-${randomUUID()}`)).pipe(Effect.provide(protocolLayers(root,mode)),Effect.mapError(caught),Effect.map(observation=>{if(mode==="concurrent-foreign-prefix")injectForeignPrefix=true;return observation}))))
    const snapshot=await run(store.read("fixture-release"))
    const ready=snapshot.events.find(event=>event.body._tag==="ObservationRecorded"&&typeof event.body.evidence==="object"&&event.body.evidence!==null&&"_tag" in event.body.evidence&&event.body.evidence._tag==="ReadyToPlan")
    if(ready&&ready.body._tag==="ObservationRecorded"&&!plan) {
      const value=Schema.decodeUnknownSync(ReadyToPlan)(ready.body.evidence)
      const bundleId=value.bundleContent.sha256
      const publication=await run(createPlan(bundleId,[await run(createOperation(publicationProvider,new PublishIntent({bundleId})))],input.journalId))
      const encoded=canonical(Schema.encodeSync(Plan)(publication))
      try{writeFileSync(join(root,"publication-plan.json"),encoded,{flag:"wx"})}
      catch(error){if((error as NodeJS.ErrnoException).code!=="EEXIST"||readFileSync(join(root,"publication-plan.json"),"utf8")!==encoded)throw error}
    }
    return {revision:snapshot.revision,ready:!!ready,calls:calls(root)}
  } finally {store.close()}
}

export const runAppleExperiment=async()=>{
  const root=mkdtempSync(join(tmpdir(),"apple-one-journal-restart-")),checks:string[]=[]
  const child=(directory:string,mode:string,exit=0)=>{
    const result=Bun.spawnSync([process.execPath,import.meta.filename,"--worker",directory,mode],{stdout:"pipe",stderr:"pipe"})
    assert.equal(result.exitCode,exit,`${mode}: ${result.stdout}\n${result.stderr}`)
    return exit===0?JSON.parse(result.stdout.toString()):undefined
  }
  try {
    for(const stage of ["after-append","after-send","after-receipt"]){
      const directory=join(root,stage);await setup(directory);child(directory,stage,81)
      child(directory,"resume")
      const submitted=calls(directory).filter(call=>call.operation==="submitApp").length
      assert.equal(submitted,stage==="after-append"?0:1)
      assert.equal(existsSync(join(directory,"publication-plan.json")),stage==="after-receipt")
      checks.push(`process-restart-${stage}-preserves-dispatch-uncertainty`)
    }
    const unknown=join(root,"pre-id-loss");await setup(unknown);child(unknown,"native-unknown");child(unknown,"resume")
    assert.equal(calls(unknown).filter(call=>call.operation==="submitApp").length,1)
    assert.equal(calls(unknown).filter(call=>call.operation==="info").length,0)
    assert.equal(existsSync(join(unknown,"publication-plan.json")),false)
    const unknownReport=child(unknown,"report")
    assert.equal(unknownReport.nativeFacts.some((event:any)=>event.body.evidenceKind==="DispatchError"&&event.body.evidenceVersion==="effect-build-apple/SubmissionOutcomeUnknown/pr24"&&event.body.evidence._tag==="SubmissionOutcomeUnknown"),true)
    checks.push("typed-public-pre-id-loss-never-guesses-or-resubmits")
    const unscoped=join(root,"missing-context");await setup(unscoped);child(unscoped,"missing-context",1)
    assert.equal(calls(unscoped).length,0)
    checks.push("missing-explicit-journal-context-rejected-before-native-call")
    const directory=join(root,"complete");await setup(directory);child(directory,"pending");child(directory,"resume")
    assert.deepEqual(calls(directory).map(call=>call.operation),["submitApp","info","info","stapleApp","assess"])
    checks.push("persisted-public-submission-polled-after-restart","staple-assess-before-final-adoption")
    const planBefore=readFileSync(join(directory,"publication-plan.json"),"utf8")
    child(directory,"forged-plan",1)
    assert.equal(existsSync(join(directory,"publication-calls")),false)
    checks.push("valid-plan-for-wrong-final-bundle-rejected-before-publication")
    child(directory,"resume")
    assert.equal(calls(directory).length,5)
    checks.push("ready-to-plan-does-not-repeat-local-transforms")
    const report=child(directory,"publish")
    assert.equal(report.operations[0].status,"Satisfied")
    const db=new SqliteJournal(join(directory,"journal.sqlite")),snapshot=await run(db.read("fixture-release"));db.close()
    assert.equal(snapshot.events.length,report.revision)
    assert.equal(new Set(snapshot.events.map(event=>event.planId)).size,2)
    assert.equal(snapshot.events.filter(event=>event.body._tag==="DispatchStarted").length,2)
    assert.equal(snapshot.events.some(event=>event.body._tag==="ObservationRecorded"&&typeof event.body.evidence==="object"&&event.body.evidence!==null&&"_tag"in event.body.evidence&&event.body.evidence._tag==="ReadyToPlan"),true)
    checks.push("one-physical-journal-global-cas-through-publication","one-persisted-publication-plan-with-transient-producer-view")
    const late=child(directory,"late-observation")
    assert.equal(late.revision,snapshot.revision+1)
    assert.equal(late.preparation.operations[0].status,"Pending")
    assert.equal(late.publication.operations[0].status,"Satisfied")
    assert.equal(late.nativeFacts.length,snapshot.events.filter(event=>event.planId!==JSON.parse(planBefore).planId).length+1)
    assert.equal(readFileSync(join(directory,"publication-plan.json"),"utf8"),planBefore)
    checks.push("late-producer-observation-preserved-without-changing-final-plan")
    child(directory,"changed-input",1)
    assert.equal(calls(directory).length,5)
    checks.push("changed-preparation-rejected-before-native-call")
    const foreign=join(root,"concurrent-foreign-prefix");await setup(foreign);child(foreign,"concurrent-foreign-prefix",1)
    const foreignDb=new SqliteJournal(join(foreign,"journal.sqlite")),foreignSnapshot=await run(foreignDb.read("fixture-release"));foreignDb.close()
    assert.equal(foreignSnapshot.events.some(event=>event.planId==="foreign-scope"),true)
    assert.equal(foreignSnapshot.events.some(event=>event.body._tag==="ObservationRecorded"&&typeof event.body.evidence==="object"&&event.body.evidence!==null&&"_tag"in event.body.evidence&&event.body.evidence._tag==="ReadyToPlan"),false)
    assert.equal(existsSync(join(foreign,"publication-plan.json")),false)
    checks.push("concurrent-unvalidated-prefix-cannot-select-ready-or-final-plan")
    const raced=join(root,"racing-finalization");await setup(raced);child(raced,"pending")
    const writers=[0,1].map(()=>Bun.spawn([process.execPath,import.meta.filename,"--worker",raced,"race-final"],{stdout:"pipe",stderr:"pipe"}))
    const outcomes=await Promise.all(writers.map(async writer=>({exit:await writer.exited,stderr:await new Response(writer.stderr).text()})))
    for(const outcome of outcomes)assert.equal(outcome.exit,0,outcome.stderr)
    const racingDb=new SqliteJournal(join(raced,"journal.sqlite")),racingSnapshot=await run(racingDb.read("fixture-release"));racingDb.close()
    assert.equal(racingSnapshot.events.filter(event=>event.body._tag==="ObservationRecorded"&&typeof event.body.evidence==="object"&&event.body.evidence!==null&&"_tag"in event.body.evidence&&event.body.evidence._tag==="ReadyToPlan").length,1)
    assert.equal(calls(raced).filter(call=>call.operation==="stapleApp").length,2)
    assert.equal(calls(raced).filter(call=>call.operation==="submitApp").length,1)
    child(raced,"publish")
    checks.push("two-process-distinct-final-bytes-select-one-ready-by-global-cas")
    const rejected=join(root,"assessment-rejected");await setup(rejected);child(rejected,"assessment-rejected",1)
    assert.equal(existsSync(join(rejected,"publication-plan.json")),false)
    checks.push("assessment-failure-prevents-ready-and-publication-plan")
    return {schema:"apple-lifecycle-experiment/1",passed:checks.length,checks,
      nativeOperations:"Explicit protocol doubles behind actual packed public Notary, Staple and Assess service operations; actual tree finalization and ownership transfer.",
      nativeAppleAcceptance:false,processRestart:true,samePhysicalJournal:true,journalEventKinds:6,persistedPublicationPlans:1}
  } finally {rmSync(root,{recursive:true,force:true})}
}
if(import.meta.main)console.log(JSON.stringify(process.argv[2]==="--worker"?await worker(process.argv[3]!,process.argv[4]!):await runAppleExperiment(),null,2))
