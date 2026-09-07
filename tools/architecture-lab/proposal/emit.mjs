/** Reproduce proposed declarations. No product implementation or publication. */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import ts from "typescript"
import { packRuntimeDependencies, install } from "../topology/pack.mjs"
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../../..")
const handoff=join(root,"docs/refactor/architecture-program/handoff")
const check=process.argv.includes("--check")
const consumerAt=process.argv.indexOf("--consumer")
let consumer=consumerAt>=0?resolve(process.argv[consumerAt+1]??""):undefined
if(!consumer){
  consumer=mkdtempSync(join(tmpdir(),"ts-release-proposal-"))
  const dependencies=await packRuntimeDependencies(join(consumer,"dependency-packs"),["effect","@effect/platform-node","bun-types"])
  await install(consumer,["effect-build","effect-build-apple"].map(name=>({name,tarball:{path:join(handoff,"upstream/packs",`${name}-0.6.3.tgz`)}})),dependencies,["effect","@effect/platform-node","bun-types","effect-build","effect-build-apple"])
}
for(const [name,version] of [["effect","4.0.0-rc.108"],["effect-build","0.6.3"],["effect-build-apple","0.6.3"]]){
  const actual=JSON.parse(readFileSync(join(consumer,"node_modules",name,"package.json"),"utf8"))
  if(actual.version!==version)throw Error(`Proposal emission requires ${name}@${version}`)
}
if(ts.version!=="6.0.3")throw Error("Proposal emission requires TypeScript6.0.3")
const work=mkdtempSync(join(consumer,"proposal-emission-"))
const source=join(work,"src")
mkdirSync(join(source,"apple"),{recursive:true})
const names=["adoption","bundle-codec","content-owner","apple-preparation","public-api"]
for(const name of names)cpSync(join(root,"tools/architecture-lab/apple",`${name}.ts`),join(source,"apple",`${name}.ts`))
cpSync(join(root,"tools/architecture-lab/machine/src"),join(source,"machine/src"),{recursive:true})
const options={strict:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,lib:["lib.es2022.d.ts","lib.dom.d.ts","lib.esnext.disposable.d.ts"],types:["bun-types"],declaration:true,emitDeclarationOnly:true,skipLibCheck:false,exactOptionalPropertyTypes:true,noUncheckedIndexedAccess:true}
const compile=(files,options)=>{
  const outputs=new Map(),host=ts.createCompilerHost(options)
  host.writeFile=(path,text)=>outputs.set(resolve(path),text)
  const program=ts.createProgram(files,options,host),diagnostics=ts.getPreEmitDiagnostics(program)
  if(diagnostics.length)throw Error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>process.cwd(),getCanonicalFileName:path=>path,getNewLine:()=>"\n"}))
  program.emit();return outputs
}
const native=compile(names.map(name=>join(source,"apple",`${name}.ts`)),{...options,rootDir:source,outDir:join(work,"emitted")})
const sha=text=>createHash("sha256").update(text).digest("hex")
const projection=join(work,"proposal")
mkdirSync(join(projection,"adoption-api"),{recursive:true})
const changes=["redirect machine imports to ../kernel-api.js","LabError becomes ReleaseError","lab/owned-bundle/1 becomes ts-release/bundle/1","lab/apple-preparation/1 becomes ts-release/apple-preparation/1","ApplePreparation producerRevision changes from historical PR24 to selected ef29 source; this is a proposed format/pin adaptation, not native acceptance"]
const header="/** Compiler-derived research shape adapted to the proposed production contract.\n * Target durable formats and selected producer pin differ from the frozen research\n * bytes. No production implementation or native acceptance is claimed. */\n"
const files=[]
for(const name of names){
  const declaration=native.get(join(work,"emitted/apple",`${name}.d.ts`))
  if(!declaration)throw Error(`Missing emitted ${name}`)
  const projected=header+declaration.replaceAll("../machine/src/index.js","../kernel-api.js").replaceAll("../machine/src/contracts.js","../kernel-api.js").replaceAll("LabError","ReleaseError").replaceAll("lab/owned-bundle/1","ts-release/bundle/1").replaceAll("lab/apple-preparation/1","ts-release/apple-preparation/1").replaceAll("dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc","ef29a087baac8bdbcd90a54bb62a2dceb739dd91")
  writeFileSync(join(projection,"adoption-api",`${name}.d.ts`),projected)
  files.push({name,source:`tools/architecture-lab/apple/${name}.ts`,sourceSha256:sha(readFileSync(join(source,"apple",`${name}.ts`))),emittedSha256:sha(declaration),proposalSha256:sha(projected)})
}
for(const name of ["kernel-api.d.ts","host-api.d.ts","provider-api.typecheck.ts","apple-api.typecheck.ts","checksum-api.d.ts"])cpSync(join(handoff,name),join(projection,name))
cpSync(join(root,"tools/architecture-lab/proposal/provider.ts"),join(projection,"provider-api.ts"))
cpSync(join(root,"tools/architecture-lab/proposal/apple.ts"),join(projection,"apple-api.ts"))
const provider=compile([join(projection,"provider-api.ts"),join(projection,"apple-api.ts")],{...options,rootDir:projection,outDir:join(work,"provider-emitted")})
writeFileSync(join(projection,"research-api/provider-api.d.ts"),provider.get(join(work,"provider-emitted/provider-api.d.ts")))
writeFileSync(join(projection,"apple-api.d.ts"),provider.get(join(work,"provider-emitted/apple-api.d.ts")))
rmSync(join(projection,"provider-api.ts"))
rmSync(join(projection,"apple-api.ts"))
compile([join(projection,"provider-api.typecheck.ts"),join(projection,"apple-api.typecheck.ts"),join(projection,"checksum-api.d.ts"),join(projection,"host-api.d.ts")],{...options,noEmit:true})
const receipt={format:"adoption-declaration-projection/2",emitter:"tools/architecture-lab/proposal/emit.mjs",compiler:"typescript6.0.3",effect:"4.0.0-rc.108",changes,nativeAcceptance:false,files,selectedProducer:{version:"0.6.3",revision:"ef29a087baac8bdbcd90a54bb62a2dceb739dd91",evidence:"../upstream/published-consumer.json"}}
writeFileSync(join(projection,"adoption-api/emission.json"),JSON.stringify(receipt,null,2)+"\n")
const selected=["research-api/provider-api.d.ts","apple-api.d.ts",...names.map(name=>`adoption-api/${name}.d.ts`),"adoption-api/emission.json"]
for(const name of selected){
 const next=readFileSync(join(projection,name)),target=join(handoff,name)
 if(check){if(!existsSync(target)||!next.equals(readFileSync(target)))throw Error(`Generated proposal differs: ${name}`)}
 else writeFileSync(target,next)
}
console.log(JSON.stringify({mode:check?"check":"write",consumer,files:selected,strictTypecheck:true,productionImplemented:false,nativeAcceptance:false}))
