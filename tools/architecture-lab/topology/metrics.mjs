import { strict as assert } from "node:assert"
import { mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { command, files, hash, json, repository } from "./pack.mjs"
import { layouts } from "./build.mjs"
import { readEvidence, writeEvidence } from "./evidence.mjs"

const baseline=await readEvidence(new URL("./results.json",import.meta.url))
const extensions=await readEvidence(new URL("./extension-results.json",import.meta.url))
assert.equal(extensions.baselineSourceSha256,baseline.sourceSha256)
const work=await mkdtemp("/tmp/ts-release-topology-metrics-")
const git=await realpath(command(["which","git"],repository).trim())
const gitEnvironment={PATH:process.env.PATH,LC_ALL:"C",LANG:"C",TZ:"UTC",NO_COLOR:"1",GIT_CONFIG_NOSYSTEM:"1",GIT_CONFIG_GLOBAL:"/dev/null",GIT_CONFIG_SYSTEM:"/dev/null",GIT_ATTR_NOSYSTEM:"1"}
const result={format:"packed-extension-metrics/1",sourceSha256:baseline.sourceSha256,work,
  git:{path:git,version:command([git,"--version"],repository).trim(),sha256:hash(await readFile(git)),environment:gitEnvironment},
  method:"Actual git diff --no-index --numstat --no-renames --diff-algorithm=myers --no-ext-diff --no-textconv. Physical TypeScript source, generated package/export metadata, compiler configuration and emitted JS/declarations are separate lanes. Both source-only and conservative source-plus-package-metadata additions are reported. This supplements, and does not impersonate, the frozen candidate-manifest receipt protocol.",probes:[]}
const packageRoot=(root,name)=>join(root,"packages",name.replaceAll("@","").replaceAll("/","-"))
async function authoring(root) {
  if(!root)return {}
  const paths=[...(await files(join(root,"src"))).map(path=>`src/${path}`),...(await files(join(root,"dist"))).map(path=>`dist/${path}`),"package.json","tsconfig.json"]
  return Object.fromEntries(await Promise.all(paths.map(async path=>[path,await readFile(join(root,path),"utf8")])))
}
const lane=path=>path.startsWith("src/")?"source":path==="package.json"?"packageMetadata":path==="tsconfig.json"?"compilerConfiguration":"emittedOutput"
async function measure(id,before,after) {
  const directory=join(work,id)
  for(const [phase,values]of Object.entries({before,after})) {
    await mkdir(join(directory,phase),{recursive:true})
    for(const[path,text]of Object.entries(values)){const target=join(directory,phase,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,text)}
  }
  let output
  const argv=[git,"diff","--no-index","--numstat","--no-renames","--diff-algorithm=myers","--no-ext-diff","--no-textconv","--","before","after"]
  try{output=command(argv,directory,{env:gitEnvironment})}catch(error){assert.equal(error.status,1);output=String(error.stdout)}
  const deltas=[]
  for(const line of output.trim().split("\n").filter(Boolean)) {
    const[added,removed,rawPath]=line.split("\t")
    const path=rawPath.replace(/^\/dev\/null => /,"").replace(/ => \/dev\/null$/,"").replace(/^\{before => after\}\//,"").replace(/^(before|after)\//,"")
    assert(path in before||path in after,`Unexpected diff path ${rawPath}`)
    deltas.push({path,lane:lane(path),added:Number(added),removed:Number(removed),beforeSha256:before[path]===undefined?null:hash(before[path]),afterSha256:after[path]===undefined?null:hash(after[path])})
  }
  const summarize=kind=>({added:deltas.filter(d=>d.lane===kind).reduce((n,d)=>n+d.added,0),removed:deltas.filter(d=>d.lane===kind).reduce((n,d)=>n+d.removed,0),files:deltas.filter(d=>d.lane===kind).length})
  const manifest=values=>Object.entries(values).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([path,text])=>({path,mode:"0644",bytes:Buffer.byteLength(text),sha256:hash(text)}))
  const beforeInventory=manifest(before),afterInventory=manifest(after)
  return {beforeTreeSha256:hash(json(beforeInventory)),afterTreeSha256:hash(json(afterInventory)),patchSha256:hash(json(deltas)),beforeInventory,afterInventory,deltas,source:summarize("source"),packageMetadata:summarize("packageMetadata"),compilerConfiguration:summarize("compilerConfiguration"),emittedOutput:summarize("emittedOutput")}
}
for(const layout of baseline.layouts)for(const probe of extensions.probes.filter(probe=>probe.layout===layout.layoutId)) {
  const coordinates=layouts[layout.layoutId],name=probe.id==="P02"?"@lab/external":["P03","P05"].includes(probe.id)?probe.id==="P03"&&layout.layoutId==="T3"?"@lab/catalog":coordinates.providerPackages[0]:["P06","P07"].includes(probe.id)?"@lab/host":coordinates.kernel
  const original=layout.built.find(pkg=>pkg.name===name)?.root
  let before=original,after=packageRoot(join(extensions.work,layout.layoutId,probe.id),name)
  if(probe.id==="P01"){before=undefined;after=undefined}
  if(probe.id==="P02"){before=undefined;after=original}
  if(probe.id==="P04"||probe.id==="P09"){before=packageRoot(join(extensions.work,layout.layoutId,`${probe.id}-before`),name);after=packageRoot(join(extensions.work,layout.layoutId,`${probe.id}-after`),name)}
  if(probe.id==="P06"){before=packageRoot(join(extensions.work,layout.layoutId,"P06-before"),name);after=original}
  const measured=await measure(`${layout.layoutId}/${probe.id}`,await authoring(before),await authoring(after))
  result.probes.push({layout:layout.layoutId,id:probe.id,package:name,...measured,
    conservativeProductAdditions:measured.source.added+measured.packageMetadata.added,
    conservativeProductDeletions:measured.source.removed+measured.packageMetadata.removed,
    printerDiagnostic:probe.productPatch.normalized??{added:0,removed:0},
    configuration:probe.id==="P01"?{lane:"fixture",field:"instances",before:1,after:2,sourceChange:0}:undefined})
}
const quantiles=values=>{const sorted=[...values].sort((a,b)=>a-b);return{total:sorted.reduce((a,b)=>a+b,0),median:sorted[Math.ceil(sorted.length*.5)-1],p90:sorted[Math.ceil(sorted.length*.9)-1],maximum:sorted.at(-1)}}
result.quantiles=baseline.layouts.map(layout=>{const probes=result.probes.filter(probe=>probe.layout===layout.layoutId);return{layout:layout.layoutId,sourceAdditions:quantiles(probes.map(probe=>probe.source.added)),sourceChurn:quantiles(probes.map(probe=>probe.source.added+probe.source.removed)),sourcePlusPackageMetadata:quantiles(probes.map(probe=>probe.conservativeProductAdditions)),printerAdditions:quantiles(probes.map(probe=>probe.printerDiagnostic.added)),nonzeroPopulation:false}})
const output=new URL("./metric-results.json",import.meta.url)
await writeEvidence(output,result)
const summary=JSON.parse(await readFile(output,"utf8"))
summary.probes=result.probes.map(({layout,id,source,packageMetadata,conservativeProductAdditions,conservativeProductDeletions,printerDiagnostic,patchSha256})=>({layout,id,source,packageMetadata,conservativeProductAdditions,conservativeProductDeletions,printerDiagnostic,patchSha256}))
summary.quantiles=result.quantiles
await writeFile(output,json(summary))
console.log(json(result.quantiles))
