import { strict as assert } from "node:assert"
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { bun, command, files, hash, install, inventory, json, node, pack } from "./pack.mjs"
import { compileConsumer, layouts } from "./build.mjs"
import { readEvidence, writeEvidence } from "./evidence.mjs"

const baselineFile=process.argv[2]??new URL("./results.json",import.meta.url)
const baseline=await readEvidence(baselineFile)
const work=await mkdtemp("/tmp/ts-release-topology-publication-")
const runtime=baseline.dependencies.map(entry=>({...entry,tarball:entry}))
const results={format:"local-publication-states/1",work,baselineSha256:hash(await readFile(baselineFile)),method:"No publishing: loopback registry exposes successive subsets of source-emitted tarballs. v2 changes only package coordinates and exact cohort dependencies; emitted JS/d.ts are byte-identical to v1. This tests package resolution and ordering, not ABI compatibility or registry availability.",layouts:[]}
async function attempt(directory,packages,direct) {
  try {await install(directory,packages,runtime,direct);return {installed:true}}
  catch(error) {const stderr=String(error.stderr??error);assert(/404|No version matching|failed to resolve|not found/.test(stderr),stderr);return {installed:false,exitCode:error.status??null,diagnostic:stderr.split("\n").filter(line=>/error:/.test(line)),stderrSha256:hash(stderr)}}
}
for(const layout of baseline.layouts) {
  const publicPackages=layout.built.filter(p=>!p.manifest.private&&p.name!=="@lab/external")
  const names=publicPackages.map(p=>p.name)
  const next=[]
  for(const original of publicPackages) {
    const root=join(work,layout.layoutId,"next",original.name.replaceAll("/","-"))
    await mkdir(root,{recursive:true});await cp(join(original.root,"dist"),join(root,"dist"),{recursive:true})
    const manifest={...original.manifest,version:"2.0.0-lab",dependencies:Object.fromEntries(Object.entries(original.manifest.dependencies).map(([name,version])=>[name,names.includes(name)?"2.0.0-lab":version]))}
    await writeFile(join(root,"package.json"),json(manifest))
    assert.deepEqual(await inventory(join(root,"dist")),original.emitted)
    next.push({name:original.name,root,manifest,tarball:await pack(root,join(work,layout.layoutId,"next-packs"))})
  }
  const ordering=[];const available=new Set()
  while(ordering.length<next.length) {
    const ready=next.filter(p=>!available.has(p.name)&&Object.keys(p.manifest.dependencies).every(name=>!names.includes(name)||available.has(name)))
    assert(ready.length,"Publication dependency cycle")
    for(const pkg of ready){ordering.push(pkg.name);available.add(pkg.name)}
  }
  const prefixes=[]
  for(let length=0;length<=ordering.length;length++) {
    const exposed=next.filter(p=>ordering.slice(0,length).includes(p.name))
    const consumer=join(work,layout.layoutId,`prefix-${length}`)
    const status=await attempt(consumer,[...publicPackages,...exposed],Object.fromEntries(names.map(name=>[name,"2.0.0-lab"])))
    assert.equal(status.installed,length===ordering.length)
    prefixes.push({exposed:exposed.map(p=>p.name),...status})
  }
  const coordinates=layouts[layout.layoutId]
  const coreRoot=join(work,layout.layoutId,"core-only")
  await install(coreRoot,publicPackages,runtime,[coordinates.kernel])
  await compileConsumer(coreRoot,`import{Effect}from"effect";import{createPlan}from${JSON.stringify(coordinates.kernel)};console.log((await Effect.runPromise(createPlan("bundle",[]))).format)\n`,"core.ts")
  const own=await inventory(join(coreRoot,"node_modules/@lab"))
  const bundled=await Bun.build({entrypoints:[join(coreRoot,"core.js")],target:"node",outdir:join(coreRoot,"bundle"),minify:true,metafile:true})
  assert(bundled.success);assert.equal(command([node,bundled.outputs[0].path],coreRoot).trim(),"architecture-lab/plan/1")
  const row={layout:layout.layoutId,dependencyEdges:next.flatMap(p=>Object.keys(p.manifest.dependencies).filter(name=>names.includes(name)).map(dependency=>({from:p.name,to:dependency}))),ordering,prefixes,coreOnly:{installedOwnBytes:own.reduce((n,p)=>n+p.bytes,0),files:own,bundleBytes:(await bundled.outputs[0].arrayBuffer()).byteLength,metafile:bundled.metafile}}
  if(layout.layoutId!=="T1") {
    const provider=next.find(p=>p.name===coordinates.providerPackages[0])
    row.providerBeforeKernel=await attempt(join(work,layout.layoutId,"provider-before-kernel"),[...publicPackages,provider],{[provider.name]:"2.0.0-lab"})
    assert.equal(row.providerBeforeKernel.installed,false)
    const skew=join(work,layout.layoutId,"skew")
    const nextKernel=next.find(p=>p.name===coordinates.kernel)
    await install(skew,[...publicPackages,nextKernel],runtime,{[coordinates.kernel]:"2.0.0-lab",[coordinates.providerPackages[0]]:"1.0.0-lab"})
    const manifests=(await files(join(skew,"node_modules/@lab"))).map(path=>`@lab/${path}`).filter(path=>path.endsWith("package.json"))
    row.skewInstalledPackages=[]
    for(const path of manifests){const data=JSON.parse(await readFile(join(skew,"node_modules",path),"utf8"));if(names.includes(data.name))row.skewInstalledPackages.push({path,name:data.name,version:data.version})}
    assert(row.skewInstalledPackages.filter(p=>p.name===coordinates.kernel).length===2)
    row.skewRuntime=command([node,"--input-type=module","-e",`import{createPlan}from${JSON.stringify(coordinates.kernel)};import{npm}from${JSON.stringify(coordinates.npm)};console.log(JSON.stringify({core:typeof createPlan,provider:npm.definitionId}))`],skew).trim()
  }
  if(layout.layoutId==="T3") {
    row.pythonAbsentNpmOnly=await attempt(join(work,layout.layoutId,"python-absent"),next.filter(p=>p.name!=="@lab/python"),{"@lab/npm":"2.0.0-lab"})
    assert(row.pythonAbsentNpmOnly.installed)
  }
  results.layouts.push(row);console.log(layout.layoutId,JSON.stringify({ordering,coreOnlyBytes:row.coreOnly.installedOwnBytes,prefixInstalls:prefixes.map(p=>p.installed),skew:row.skewInstalledPackages?.map(p=>p.name+"@"+p.version)}))
}
await writeEvidence(new URL("./publication-results.json",import.meta.url),results)
