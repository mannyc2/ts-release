import { strict as assert } from "node:assert"
import { randomUUID } from "node:crypto"
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { Effect, FileSystem, Schema } from "effect"
import * as File from "effect-build/Author/File"
import { adoptFile, Content, finalize, type OwnedFile } from "../apple/adoption.js"
import { encodeBundle, loadBundle } from "../apple/bundle-codec.js"
import { fileContentOwner } from "../apple/content-owner.js"
import { ApplePreparation, ReadyToPlan, finishPreparedApp, preparationProvider, preparationScope, runPreparation, submitPreparedApp } from "../apple/apple-preparation.js"
import { protocolLayers, run, setup } from "../apple/apple-experiment.js"
import { SqliteJournal } from "../storage/sqlite.js"
import { Host, LabError, NoReplay, Plan, canonical, createOperation, createPlan, makeRequest, runRelease, type HostShape, PROVIDER_CONTRACT, type ProviderDefinition } from "../machine/src/index.js"
import { ApplePreparations, createApplePreparations, loadApplePreparations, validateApplePublication } from "./composition.js"

const caught = (error:unknown) => new LabError({code:"mixed-apple-fixture",message:String(error)})
const publication:ProviderDefinition={
  contract: PROVIDER_CONTRACT,definitionId:"fixture.complete-release",intentVersion:"1",intentCodec:Schema.Struct({bundleId:Schema.String}),receiptVersion:"1",receiptCodec:Schema.Struct({bundleId:Schema.String}),receiptCorresponds:(operation,_request,receipt)=>canonical(operation.intent)===canonical(receipt),classifyReceipt:()=>"Satisfied",prepare:operation=>makeRequest({transport:"opaque/1",endpoint:"fixture://complete-release",method:"invoke",headers:[],body:new TextEncoder().encode(canonical(operation.intent)),principal:"fixture",scope:"complete",replay:new NoReplay({})})}
const worker=async(root:string,phase:string)=>{
  const collection=await run(loadApplePreparations(JSON.parse(readFileSync(join(root,"preparations.json"),"utf8")))),inputs=collection.preparations,journalId=collection.journalId
  const scopes=await run(Effect.forEach(inputs,preparationScope)),owner=fileContentOwner(join(root,"objects")),store=new SqliteJournal(join(root,"journal.sqlite"))
  const plan=existsSync(join(root,"plan.json"))?Schema.decodeUnknownSync(Plan)(JSON.parse(readFileSync(join(root,"plan.json"),"utf8"))):undefined
  const host:HostShape={store,journal:{journalId,scopes:[...scopes,...(plan?[{_tag:"PublicationScope" as const,plan}]:[])]},providers:[preparationProvider,publication],now:Date.now,uniqueId:randomUUID,transport:{send:request=>Effect.gen(function*(){
    if(request.facts.endpoint==="fixture://complete-release"){appendFileSync(join(root,"publication-calls"),"publish\n");return {_tag:"Accepted" as const,receipt:JSON.parse(new TextDecoder().decode(request.body))}}
    const input=yield* Schema.decodeUnknownEffect(ApplePreparation)(JSON.parse(new TextDecoder().decode(request.body)))
    const result=yield* submitPreparedApp(input,owner,join(root,"native",randomUUID())).pipe(Effect.provide(protocolLayers(root,"complete",input.bundleName)))
    return {_tag:"Accepted" as const,receipt:result}
  }).pipe(Effect.mapError(caught))}}
  const withHost=<A,E,R>(effect:Effect.Effect<A,E,R>)=>run(effect.pipe(Effect.provideService(Host,host)))
  try {
    if(phase.startsWith("start-")){const i=Number(phase.slice(6));return await withHost(runRelease({plan:scopes[i]!.plan,authorize:true,maxDispatches:1}))}
    if(phase.startsWith("finish-")){
      const input=inputs[Number(phase.slice(7))]!
      return await withHost(runPreparation(input,{authorize:true},(submission,id)=>finishPreparedApp(id,input,submission,owner,join(root,"native",randomUUID()),join(root,"native",randomUUID()),artifact=>Effect.gen(function*(){
        const delivery=yield* File.publish({destination:join(root,"native",`${input.bundleName}.tar`),observation:"hashed",provenance:artifact.provenance},candidate=>Effect.try({try:()=>{
          const result=Bun.spawnSync(["tar","-cf",candidate,"-C",artifact.root,"."],{stdout:"pipe",stderr:"pipe"})
          if(result.exitCode!==0)throw new Error(result.stderr.toString())
          const ticket=Bun.spawnSync(["tar","-xOf",candidate,"./ticket"],{stdout:"pipe",stderr:"pipe"})
          assert.equal(ticket.exitCode,0);assert.match(ticket.stdout.toString(),/NOT AN APPLE TICKET/)
        },catch:caught}))
        return [yield* adoptFile(owner,`${input.bundleName}.tar`,delivery)]
      }).pipe(Effect.provide(protocolLayers(root,"complete",input.bundleName)),Effect.mapError(caught))).pipe(Effect.provide(protocolLayers(root,"complete",input.bundleName)),Effect.mapError(caught))))
    }
    if(phase==="compose"){
      const snapshot=await run(store.read(journalId))
      const ready=snapshot.events.flatMap(event=>event.body._tag==="ObservationRecorded"&&typeof event.body.evidence==="object"&&event.body.evidence!==null&&"_tag" in event.body.evidence&&event.body.evidence._tag==="ReadyToPlan"?[Schema.decodeUnknownSync(ReadyToPlan)(event.body.evidence)]:[])
      assert.equal(ready.length,2)
      const bundles=await run(Effect.forEach(ready,result=>Effect.gen(function*(){return yield* loadBundle(owner,yield* owner.read(result.bundleContent))})))
      const extra=await run(File.publish({destination:join(root,"linux.txt"),observation:"hashed",provenance:inputs[0]!.source.provenance},candidate=>Effect.gen(function*(){const fs=yield* FileSystem.FileSystem;yield* fs.writeFileString(candidate,"independent Linux release file\n")})))
      const linux=await run(adoptFile(owner,"linux.txt",extra)),bundle=await run(finalize([...bundles.flatMap(value=>value.artifacts),linux]))
      const content=await run(owner.putOwned(encodeBundle(bundle))),created=await run(createPlan(content.sha256,[await run(createOperation(publication,{bundleId:content.sha256}))],journalId))
      writeFileSync(join(root,"bundle-content.json"),canonical(Schema.encodeSync(Content)(content)))
      writeFileSync(join(root,"plan.json"),canonical(Schema.encodeSync(Plan)(created)))
      return {artifacts:bundle.artifacts.length,nativeOutputSets:ready.length}
    }
    if(!plan)throw new Error("Missing final publication")
    const content=Schema.decodeUnknownSync(Content)(JSON.parse(readFileSync(join(root,"bundle-content.json"),"utf8")))
    if(phase==="negative"){
      const bundle=await run(loadBundle(owner,await run(owner.read(content))))
      const changed=await run(finalize(bundle.artifacts.filter(artifact=>artifact.logicalName!=="First.app.tar")))
      const other=await run(owner.putOwned(encodeBundle(changed))),wrong=await run(createPlan(other.sha256,[],journalId))
      const sourceInstead=await run(finalize(bundle.artifacts.map(artifact=>artifact.logicalName==="First.app"?inputs[0]!.source:artifact)))
      const sourceContent=await run(owner.putOwned(encodeBundle(sourceInstead))),sourcePlan=await run(createPlan(sourceContent.sha256,[],journalId))
      const checks=[
        ()=>withHost(validateApplePublication(new ApplePreparations({...collection,preparations:inputs.slice(0,1)}),plan,content,owner)),
        ()=>withHost(validateApplePublication(new ApplePreparations({...collection,preparations:[...inputs,inputs[0]!]}),plan,content,owner)),
        ()=>withHost(validateApplePublication(collection,plan,other,owner)),
        ()=>run(validateApplePublication(collection,wrong,other,owner).pipe(Effect.provideService(Host,{...host,journal:{journalId,scopes:[...scopes,{_tag:"PublicationScope",plan:wrong}]}}))),
        ()=>run(validateApplePublication(collection,sourcePlan,sourceContent,owner).pipe(Effect.provideService(Host,{...host,journal:{journalId,scopes:[...scopes,{_tag:"PublicationScope",plan:sourcePlan}]}})))
      ]
      for(const check of checks)await assert.rejects(check)
      assert.equal(existsSync(join(root,"publication-calls")),false)
      return {rejected:checks.length,sends:0}
    }
    const ready=await withHost(validateApplePublication(collection,plan,content,owner));assert.equal(ready.length,2)
    return await withHost(runRelease({plan,authorize:true}))
  }finally{store.close()}
}

if(process.argv[2]==="worker") console.log(JSON.stringify(await worker(process.argv[3]!,process.argv[4]!)??null))
else {
  const root=mkdtempSync(join(tmpdir(),"ts-release-mixed-apple-")),objects=join(root,"objects")
  const inputs=[await setup(join(root,"first"),"First.app",objects,"arm64"),await setup(join(root,"second"),"Second.app",objects,"x64")]
  const collection=await run(createApplePreparations(inputs))
  await assert.rejects(()=>run(loadApplePreparations(new ApplePreparations({...collection,preparations:[collection.preparations[0]!,new ApplePreparation({...collection.preparations[1]!,principal:"changed-before-first-dispatch"})]}))))
  assert.equal(existsSync(join(root,"native-calls.jsonl")),false)
  assert.equal(existsSync(join(root,"journal.sqlite")),false)
  writeFileSync(join(root,"preparations.json"),canonical(Schema.encodeSync(ApplePreparations)(collection)))
  rmSync(join(root,"first"),{recursive:true});rmSync(join(root,"second"),{recursive:true})
  const phases=[]
  for(const phase of ["start-0","finish-0","start-1","finish-1","compose","negative","publish","resume"]){
    if(phase==="compose")rmSync(join(root,"native"),{recursive:true})
    const result=Bun.spawnSync([process.execPath,import.meta.path,"worker",root,phase],{stdout:"pipe",stderr:"pipe"})
    assert.equal(result.exitCode,0,`${phase}: ${result.stderr}`)
    phases.push({phase,result:result.stdout.toString().trim()?JSON.parse(result.stdout.toString()):null})
  }
  const native=readFileSync(join(root,"native-calls.jsonl"),"utf8").trim().split("\n").map(line=>JSON.parse(line).operation)
  for(const operation of ["submitApp","info","stapleApp","assess"])assert.equal(native.filter(value=>value===operation).length,2)
  assert.equal(readFileSync(join(root,"publication-calls"),"utf8"),"publish\n")
  console.log(JSON.stringify({format:"mixed-apple-composition/1",root,processes:8,preparations:2,finalPlans:1,fullBundleArtifacts:5,derivedNativeTarFiles:2,negativeChecks:6,changedUntouchedInputRejectedBeforeAnyJournalOrNativeCall:true,publicationSends:1,resumeSends:0,native,phases,nativeApple:false}))
}
