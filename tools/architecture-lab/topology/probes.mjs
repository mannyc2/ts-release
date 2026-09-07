import { strict as assert } from "node:assert"
import { mkdir, mkdtemp, readFile, writeFile, cp } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { buildPackage, compileConsumer, layouts, specification } from "./build.mjs"
import { bun, command, files, hash, install, json, node, repository, packRuntimeDependencies } from "./pack.mjs"
import { readEvidence, writeEvidence } from "./evidence.mjs"
import { machineVariant } from "../machine/extensions/variants.mjs"
import ts from "../../../node_modules/typescript/lib/typescript.js"

const here = dirname(fileURLToPath(import.meta.url))
const executedFiles=["probes.mjs","build.mjs","pack.mjs","registry.mjs","fixture-server.mjs","evidence.mjs","consumer.ts",...(await files(join(here,"extensions"))).map(path=>`extensions/${path}`),"../machine/extensions/variants.mjs","../machine/extensions/consumer.ts"]
const inputs=()=>Promise.all(executedFiles.map(async path=>({path,sha256:hash(await readFile(join(here,path)))})))
const executedInputs=await inputs()
const baseline = await readEvidence(process.argv[2] ?? join(here,"results.json"))
const source = JSON.parse(await readFile(join(baseline.work,"sources.json"),"utf8"))
const work = await mkdtemp("/tmp/ts-release-topology-extensions-")
const upstreamRoot = join(process.env.LAB_UPSTREAM??baseline.upstream.stage,"packages/effect-build")
const upstream = { name:"effect-build",tarball:{path:join(dirname(dirname(upstreamRoot)),"artifacts/effect-build-0.6.0.tgz")} }
const runtime = await packRuntimeDependencies(join(work,"dependencies"),["effect","@effect/platform-node"])
const server = Bun.spawn([node,join(here,"fixture-server.mjs")],{stdout:"pipe",stderr:"pipe"})
const first = await server.stdout.getReader().read()
if(first.done)throw Error(await new Response(server.stderr).text())
const endpoint=`http://127.0.0.1:${JSON.parse(new TextDecoder().decode(first.value)).port}`
const result={format:"integrated-extensions/1",work,baselineSourceSha256:baseline.sourceSha256,baseline:hash(await readFile(process.argv[2]??join(here,"results.json"))),method:"Each source extension is emitted, packed, freshly installed, and called by a consumer. Baseline absence errors are checked. Configuration-only and preexisting extension seams are reported separately from code additions. Physical and TS6-printer normalized churn are distinct diagnostics.",probes:[]}
console.log(`Extension artifacts: ${work}`)

function failImport(root,specifier,named) {
  const code=named?`import{${named}}from${JSON.stringify(specifier)};console.log(${named})`:`await import(${JSON.stringify(specifier)})`
  try { command([node,"--input-type=module","-e",code],root,{stdio:["ignore","pipe","pipe"]}) }
  catch(error) {
    const stderr=String(error.stderr)
    assert(/ERR_MODULE_NOT_FOUND|ERR_PACKAGE_PATH_NOT_EXPORTED|does not provide an export named/.test(stderr),stderr)
    return {exitCode:error.status,error:stderr.split("\n").find(line=>/Error|SyntaxError/.test(line))??stderr.slice(0,160),stderrSha256:hash(stderr)}
  }
  throw Error(`Baseline unexpectedly provided ${specifier} ${named??""}`)
}
function patchSize(before,after,normalized=false) {
  if(!normalized) {
    const printer=ts.createPrinter({newLine:ts.NewLineKind.LineFeed})
    const normalize=values=>Object.fromEntries(Object.entries(values).map(([path,text])=>[path,printer.printFile(ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true))]))
    return {...patchSize(before,after,true),normalized:patchSize(normalize(before),normalize(after),true)}
  }
  const paths=new Set([...Object.keys(before),...Object.keys(after)])
  const changed=[]
  for(const path of paths)if(before[path]!==after[path]) {
    const a=(before[path]??"").trimEnd().split("\n").filter((_,i,lines)=>lines.length!==1||lines[0]!=="")
    const b=(after[path]??"").trimEnd().split("\n").filter((_,i,lines)=>lines.length!==1||lines[0]!=="")
    let prior=new Uint32Array(b.length+1)
    for(const line of a){const next=new Uint32Array(b.length+1);for(let j=0;j<b.length;j++)next[j+1]=line===b[j]?prior[j]+1:Math.max(prior[j+1],next[j]);prior=next}
    const common=prior[b.length]
    changed.push({path,added:b.length-common,removed:a.length-common,beforeLines:a.length,afterLines:b.length})
  }
  return {changed,added:changed.reduce((n,f)=>n+f.added,0),removed:changed.reduce((n,f)=>n+f.removed,0)}
}
async function variant(layout, id, original, changed, extra=[]) {
  const directory=join(work,layout.layoutId,id)
  const built=await buildPackage(changed,layouts[layout.layoutId],directory,layout.built.filter(p=>p.name!==changed.name),upstreamRoot)
  const packages=[...layout.built.filter(p=>p.name!==built.name),built,...extra,upstream]
  const consumer=join(directory,"consumer")
  await install(consumer,packages,runtime,["effect","@effect/platform-node",...packages.map(p=>p.name)])
  return {consumer,package:built,patch:patchSize(original?.sources??{},changed.sources),manifestChanged:JSON.stringify(original?.exports)!==JSON.stringify(changed.exports),packages}
}
async function runProvider(consumer,layout,providerSpecifier,providerName,intent,label,pairs=[["node","M1"],["node","M2"],["bun","M1"],["bun","M2"]]) {
  const template=await readFile(join(here,"extensions/consumer.ts"),"utf8")
  const sourceText=template.replace('import { provider } from "@lab/provider"',`import { ${providerName} as provider } from ${JSON.stringify(providerSpecifier)}`).replaceAll('"@lab/kernel"',JSON.stringify(layout.kernel))
  await compileConsumer(consumer,sourceText)
  const outcomes=[]
  for(const [runtimeName,candidate] of pairs) {
    const prefix=`${label}-${runtimeName}-${candidate}-${work.split("-").at(-1)}`.toLowerCase()
    const directory=join(consumer,prefix);await mkdir(directory)
    const remote=join(directory,"remote.git");command(["git","init","--bare","--quiet",remote],directory)
    const input={intent:intent(prefix),work:join(directory,"store"),remote,candidate}
    const inputFile=join(directory,"input.json");await writeFile(inputFile,json(input))
    const runner=runtimeName==="node"?node:bun
    const args=[runner,join(consumer,"node_modules/.bin/release-lab"),join(consumer,"application.js"),inputFile]
    const before=(await(await fetch(endpoint+"/__state")).json()).calls.length
    const first=JSON.parse(command(args,consumer));const second=JSON.parse(command(args,consumer))
    const after=(await(await fetch(endpoint+"/__state")).json()).calls.length
    assert.equal(first.operations.length,1);assert.equal(first.operations[0].status,"Satisfied");assert.equal(first.operations[0].dispatches,1)
    assert.equal(second.operations[0].dispatches,1);assert.equal(after-before,1)
    outcomes.push({runtime:runtimeName,candidate,status:first.operations[0].status,sends:after-before,restartDispatches:second.operations[0].dispatches})
  }
  return outcomes
}

async function instanceExtension(layout,scenario) {
  const coordinates=layouts[layout.layoutId]
  const template=(await readFile(join(here,"consumer.ts"),"utf8")).replaceAll('"@lab/kernel"',JSON.stringify(coordinates.kernel)).replaceAll('"@lab/npm"',JSON.stringify(coordinates.npm)).replaceAll('"@lab/python"',JSON.stringify(coordinates.python)).replace("registry: input.endpoint,",'registry: `${input.endpoint}/registry-${index}`,')
  await compileConsumer(layout.consumer,template,"instances.ts")
  const original=JSON.parse(await readFile(join(layout.consumer,scenario.id,"input.json"),"utf8"))
  const outcomes=[]
  for(const count of [1,2]) {
    const directory=join(work,layout.layoutId,`P01-${count}`);await mkdir(directory,{recursive:true})
    const remote=join(directory,"remote.git");command(["git","init","--bare","--quiet",remote],directory)
    const input={...original,endpoint,prefix:`${layout.layoutId}-instance-${work.split("-").at(-1)}`.toLowerCase(),kinds:["npm"],instances:count,remote,store:"git",storeDirectory:join(directory,"store"),planFile:join(directory,"plan.json")}
    await writeFile(join(directory,"input.json"),json(input))
    const before=(await(await fetch(endpoint+"/__state")).json()).calls.length
    const report=JSON.parse(command([node,join(layout.consumer,"node_modules/.bin/release-lab"),join(layout.consumer,"instances.js"),join(directory,"input.json")],layout.consumer))
    const sends=(await(await fetch(endpoint+"/__state")).json()).calls.length-before
    assert.equal(report.operations.length,count);assert(report.operations.every(op=>op.status==="Satisfied"));assert.equal(sends,1)
    const plan=JSON.parse(await readFile(input.planFile,"utf8"))
    const registries=[...new Set(plan.operations.map(operation=>operation.intent.registry))]
    assert.equal(registries.length,count)
    outcomes.push({configuredInstances:count,registryEndpoints:registries,measuredOperations:report.operations.length,newSends:sends,requiredInstances:2,postcondition:report.operations.length===2})
  }
  assert.equal(outcomes[0].postcondition,false);assert.equal(outcomes[1].postcondition,true)
  return {before:outcomes[0],after:outcomes[1]}
}

try {
  for(const layout of baseline.layouts) {
    const coordinates=layouts[layout.layoutId]
    const specs=specification(layout.layoutId,source)
    console.log(`${layout.layoutId}: isolated extension changes`)
    // P01 is deliberately honest: adding another configured instance needs no
    // engine/provider edit. The actual postcondition is exercised by all modes.
    const instanceScenario=layout.scenarios.find(s=>s.runtime==="node"&&s.mode==="cli"&&s.candidate==="M1"&&s.operations.length===4)
    assert(instanceScenario)
    result.probes.push({layout:layout.layoutId,id:"P01",kind:"configuration-only",...await instanceExtension(layout,instanceScenario),productPatch:{added:0,removed:0},configurationFieldsChanged:["instances"]})

    const withoutExternal=join(work,layout.layoutId,"P02-before")
    await install(withoutExternal,[...layout.built.filter(p=>p.name!=="@lab/external"),upstream],runtime)
    const missingExternal=failImport(withoutExternal,"@lab/external")
    const externalOutcomes=await runProvider(layout.consumer,coordinates,"@lab/external","external",prefix=>({endpoint,instanceId:prefix,value:"external"}),`${layout.layoutId}-p02`)
    assert.equal(layout.cliHashBeforeExternal,layout.built.find(p=>p.name==="@lab/host").tarball.sha256)
    result.probes.push({layout:layout.layoutId,id:"P02",before:missingExternal,after:externalOutcomes,productPatch:patchSize({}, {"external.ts":source.own["external.ts"],...(source.own["http-evidence.ts"]?{"http-evidence.ts":source.own["http-evidence.ts"]}:{})}),coreAndCliUnchanged:true})

    const catalogSource=await readFile(join(here,"extensions/catalog.ts"),"utf8")
    const providerSpec=specs.find(p=>p.name===coordinates.providerPackages[0])
    const catalogPath=layout.layoutId==="T1"?"providers/catalog.ts":"catalog.ts"
    const catalogSpecifier=layout.layoutId==="T1"?"@lab/release/catalog":layout.layoutId==="T2"?"@lab/providers/catalog":"@lab/catalog"
    const catalogSpec=layout.layoutId==="T3"?{name:"@lab/catalog",sources:{"index.ts":catalogSource,...(source.own["http-evidence.ts"]?{"http-evidence.ts":source.own["http-evidence.ts"]}:{})},exports:{".":"index"},dependencies:{effect:"4.0.0-rc.108",[coordinates.kernel]:"1.0.0-lab"}}:{...providerSpec,sources:{...providerSpec.sources,[catalogPath]:catalogSource},exports:{...providerSpec.exports,"./catalog":catalogPath.replace(/\.ts$/,"")}}
    const missingCatalog=failImport(layout.consumer,catalogSpecifier)
    const addedCatalog=await variant(layout,"P03",layout.layoutId==="T3"?undefined:providerSpec,catalogSpec)
    result.probes.push({layout:layout.layoutId,id:"P03",before:missingCatalog,after:await runProvider(addedCatalog.consumer,coordinates,catalogSpecifier,"catalog",prefix=>({endpoint,channel:prefix,digest:"a".repeat(64)}),`${layout.layoutId}-p03`),productPatch:addedCatalog.patch,manifestChanged:addedCatalog.manifestChanged})

    const tagPath=layout.layoutId==="T1"?"providers/npm-tag.ts":"npm-tag.ts"
    const npmEntry=layout.layoutId==="T1"?"providers/npm.ts":layout.layoutId==="T2"?"npm.ts":"index.ts"
    const tagSpec={...providerSpec,sources:{...providerSpec.sources,[tagPath]:await readFile(join(here,"extensions/npm-tag.ts"),"utf8"),[npmEntry]:providerSpec.sources[npmEntry]+'\nexport { npmTag, NpmTagIntent } from "./npm-tag.js"\n'}}
    const missingTag=failImport(layout.consumer,coordinates.npm,"npmTag")
    const tagVariant=await variant(layout,"P05",providerSpec,tagSpec)
    // Seed a real native npm version before moving its tag, through its provider.
    const packedNpm=await readFile(join(baseline.work,"artifact-packs/fixture-1.0.0.tgz"))
    const {createHash}=await import("node:crypto")
    await runProvider(tagVariant.consumer,coordinates,coordinates.npm,"npm",()=>({registry:endpoint,packageName:`${layout.layoutId.toLowerCase()}-tag-target`,version:"1.0.0",initialTag:"latest",filename:"fixture-1.0.0.tgz",tarballBase64:packedNpm.toString("base64"),integrity:`sha512-${createHash("sha512").update(packedNpm).digest("base64")}`}),`${layout.layoutId}-p05-seed`,[["node","M1"]])
    result.probes.push({layout:layout.layoutId,id:"P05",before:missingTag,after:await runProvider(tagVariant.consumer,coordinates,coordinates.npm,"npmTag",prefix=>({registry:endpoint,packageName:`${layout.layoutId.toLowerCase()}-tag-target`,tag:prefix,version:"1.0.0"}),`${layout.layoutId}-p05`),productPatch:tagVariant.patch})

    const hostSpec=specs.find(p=>p.name==="@lab/host")
    for(const [id,excluded,subpaths] of [["P06",["storage/git.ts"],["./git"]]]) {
      const missingSpec={...hostSpec,sources:Object.fromEntries(Object.entries(hostSpec.sources).filter(([p])=>!excluded.includes(p))),exports:Object.fromEntries(Object.entries(hostSpec.exports).filter(([p])=>!subpaths.includes(p)))}
      const removed=await variant(layout,`${id}-before`,hostSpec,missingSpec)
      const before=failImport(removed.consumer,"@lab/host"+subpaths[0].slice(1))
      const after=layout.scenarios.filter(s=>s.store==="git").map(s=>({id:s.id,sends:s.sends,sendsAfterRestart:s.sendsAfterRestart}))
      result.probes.push({layout:layout.layoutId,id,before,after,productPatch:patchSize(missingSpec.sources,hostSpec.sources),manifestChanged:true})
    }
    const handoffSource=await readFile(join(here,"extensions/producer-handoff.ts"),"utf8")
    const handoffSpec={...hostSpec,sources:{...hostSpec.sources,"adoption/producer-handoff.ts":handoffSource},exports:{...hostSpec.exports,"./producer-handoff":"adoption/producer-handoff"}}
    const handoff=await variant(layout,"P07",hostSpec,handoffSpec)
    const handoffConsumer=await readFile(join(here,"extensions/producer-consumer.ts"),"utf8")
    await compileConsumer(handoff.consumer,handoffConsumer,"producer-extension.ts")
    // Identical source-emitted test program executes the existing adoption path
    // in before mode; that branch does not import the new module.
    await cp(join(handoff.consumer,"producer-extension.js"),join(layout.consumer,"producer-extension.js"))
    const producerBefore=[],producerAfter=[]
    for(const runner of [node,bun]) {
      let failed=false
      try{command([runner,join(layout.consumer,"producer-extension.js"),"before"],layout.consumer,{stdio:["ignore","pipe","pipe"]})}
      catch(error){const stderr=String(error.stderr);assert(/Producer-selected generation must survive resolution/.test(stderr),stderr);producerBefore.push({runtime:runner===node?"node":"bun",exitCode:error.status,stderrSha256:hash(stderr)});failed=true}
      assert(failed,"Existing raw artifact adopter unexpectedly checked producer-selected header")
      producerAfter.push({runtime:runner===node?"node":"bun",...JSON.parse(command([runner,join(handoff.consumer,"producer-extension.js"),"after"],handoff.consumer))})
    }
    result.probes.push({layout:layout.layoutId,id:"P07",before:producerBefore,after:producerAfter,productPatch:handoff.patch,initialAdoptionCapabilityLines:Object.values(source.adoption).reduce((n,text)=>n+text.trimEnd().split("\n").length,0),scope:"Additional actual PR24 path-free adoption-header adapter; existing file/tree ownership and strict loader remain in both trees. Test program is strictly emitted against added public API, then identical emitted bytes execute before/after modes."})
    const kernelSpec=specs.find(p=>p.name===coordinates.kernel)
    const kernelPrefix=layout.layoutId==="T1"?"kernel/":""
    for(const id of ["P04","P09"]) {
      const variants={}
      const outcomes={before:[],after:[]}
      for(const phase of ["before","after"]) {
        const machine=await machineVariant(id,phase,source.machine)
        const beforePaths=new Set(Object.keys(source.machine).map(path=>kernelPrefix+path))
        const changedSpec={...kernelSpec,sources:{...Object.fromEntries(Object.entries(kernelSpec.sources).filter(([path])=>!beforePaths.has(path))),...Object.fromEntries(Object.entries(machine).map(([path,text])=>[kernelPrefix+path,text]))}}
        const built=await variant(layout,`${id}-${phase}`,kernelSpec,changedSpec)
        variants[phase]={...built,sources:changedSpec.sources}
        const consumerText=(await readFile(join(repository,"tools/architecture-lab/machine/extensions/consumer.ts"),"utf8")).replaceAll('"@lab/kernel"',JSON.stringify(coordinates.kernel))
        await compileConsumer(built.consumer,consumerText,"machine-extension.ts")
        for(const runner of [node,bun])for(const candidate of ["M1","M2"])for(const mode of id==="P04"?["P04"]:["P09-live","P09-migrate"]) {
          const args=[runner,join(built.consumer,"machine-extension.js"),mode,candidate]
          if(phase==="after")outcomes.after.push({runtime:runner===node?"node":"bun",...JSON.parse(command(args,built.consumer))})
          else {
            let failed=false
            try{command(args,built.consumer,{stdio:["ignore","pipe","pipe"]})}
            catch(error){const stderr=String(error.stderr);const expected=mode==="P04"?/must remain Pending/:mode==="P09-live"?/Legacy supersession/:/one-shot importer/;assert(expected.test(stderr),stderr);outcomes.before.push({runtime:runner===node?"node":"bun",candidate,mode,exitCode:error.status,diagnostic:stderr.split("\n").find(line=>expected.test(line)),stderrSha256:hash(stderr)});failed=true}
            assert(failed,`${id} baseline unexpectedly passed`)
          }
        }
      }
      result.probes.push({layout:layout.layoutId,id,baselineKind:"compiled counterfactual pre-extension source",...outcomes,productPatch:patchSize(variants.before.sources,variants.after.sources),variantGeneratorSha256:hash(await readFile(join(repository,"tools/architecture-lab/machine/extensions/variants.mjs"))),consumerSha256:hash(await readFile(join(repository,"tools/architecture-lab/machine/extensions/consumer.ts")))})
    }
    const publicSpec={...kernelSpec,sources:{...kernelSpec.sources,[`${kernelPrefix}serialize-plan.ts`]:await readFile(join(here,"extensions/serialize-plan.ts"),"utf8"),[`${kernelPrefix}index.ts`]:kernelSpec.sources[`${kernelPrefix}index.ts`]+'export { serializePlan } from "./serialize-plan.js"\n'}}
    const missingPublic=failImport(layout.consumer,coordinates.kernel,"serializePlan")
    const addedPublic=await variant(layout,"P08",kernelSpec,publicSpec)
    const after=[node,bun].map(runner=>JSON.parse(command([runner,"--input-type=module","-e",`import{strict as assert}from"node:assert";import{Effect}from"effect";import{serializePlan,createPlan,loadPlan}from${JSON.stringify(coordinates.kernel)};const p=await Effect.runPromise(createPlan("owned-bundle",[]));const encoded=serializePlan(p);const restored=await Effect.runPromise(loadPlan(JSON.parse(encoded),[]));assert.equal(restored.planId,p.planId);console.log(JSON.stringify({encodedBytes:encoded.length,planId:p.planId}))`],addedPublic.consumer)))
    result.probes.push({layout:layout.layoutId,id:"P08",before:missingPublic,after,productPatch:addedPublic.patch})
    await writeFile(join(work,"results.json"),json(result))
    console.log(`${layout.layoutId}: ${result.probes.filter(p=>p.layout===layout.layoutId).length} extension records`)
  }
  assert.deepEqual(await inputs(),executedInputs,"Extension tooling changed during execution")
  result.harness=executedInputs
  await writeEvidence(join(here,"extension-results.json"),result)
  console.log(`Extension records written: ${result.probes.length}`)
} finally {await writeFile(join(work,"results.json"),json(result));server.kill();await server.exited}
