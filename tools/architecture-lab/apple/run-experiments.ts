import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { tmpdir } from "node:os"
import { createHash } from "node:crypto"
import { packRuntimeDependencies, install, node } from "../topology/pack.mjs"
import ts from "typescript"

const root=resolve(import.meta.dir,"../../..")
const build=JSON.parse(readFileSync(join(import.meta.dir,"upstream-build.json"),"utf8"))
const consumer=mkdtempSync(join(tmpdir(),"ts-release-packed-adopter-"))
const dependencies=await packRuntimeDependencies(join(consumer,"dependency-packs"),["effect","@effect/platform-node","ioredis","bun-types"])
await install(consumer,build.packages.map((pkg:any)=>({name:pkg.name,tarball:{path:pkg.path}})),dependencies,["effect","@effect/platform-node","bun-types","effect-build","effect-build-apple"])
mkdirSync(join(consumer,"src/apple"),{recursive:true})
for(const name of readdirSync(import.meta.dir).filter(n=>n.endsWith(".ts")&&!n.startsWith("build-")&&!n.startsWith("run-"))){
  cpSync(join(import.meta.dir,name),join(consumer,"src/apple",name))
}
cpSync(join(import.meta.dir,"../machine/src"),join(consumer,"src/machine/src"),{recursive:true})
mkdirSync(join(consumer,"src/storage"),{recursive:true})
for(const name of ["sqlite.ts","protocol.ts"])cpSync(join(import.meta.dir,"../storage",name),join(consumer,"src/storage",name))
writeFileSync(join(consumer,"tsconfig.json"),JSON.stringify({compilerOptions:{target:"ES2022",module:"NodeNext",moduleResolution:"NodeNext",lib:["ES2022","DOM","ESNext.Disposable"],strict:true,skipLibCheck:false,noUncheckedIndexedAccess:true,exactOptionalPropertyTypes:true,types:["bun-types"],declaration:true,rootDir:"src",outDir:"dist"},include:["src/**/*.ts"]}))
const run=(cmd:string[])=>{const result=Bun.spawnSync(cmd,{cwd:consumer,stdout:"pipe",stderr:"pipe"});if(result.exitCode!==0)throw new Error(`${cmd.join(" ")}\n${result.stdout}\n${result.stderr}`);return result.stdout.toString()}
run([process.execPath,join(root,"node_modules/typescript/bin/tsc"),"-p","tsconfig.json"])
const adoption=JSON.parse(run([process.execPath,"dist/apple/adoption-fixture.js"]))
const adoptionNode=JSON.parse(run([node,"--input-type=module","-e","import('./dist/apple/adoption-fixture.js').then(m=>m.runAdoptionFixture()).then(r=>console.log(JSON.stringify(r)))"]))
const apple=existsSync(join(consumer,"dist/apple/apple-experiment.js"))?JSON.parse(run([process.execPath,"dist/apple/apple-experiment.js"])):null
const result={schema:"apple-adoption-lab-run/1",consumer,upstream:build.packages,dependencyAssembly:"Actual upstream and dependency tarballs installed by Bun into a fresh graph, with loopback-only registry and no symlink backend. No registry availability or publication claimed.",dependencies:dependencies.map(({name,version,tarball}:any)=>({name,version,sha256:tarball.sha256})),strictEmittedConsumer:true,adoption,adoptionNode,apple}
const production=new Set(["adoption.ts","content-owner.ts","bundle-codec.ts","apple-preparation.ts","public-api.ts"])
const sourceInventory=readdirSync(import.meta.dir).filter(name=>name.endsWith(".ts")&&!name.endsWith(".d.ts")).map(name=>{
  const bytes=readFileSync(join(import.meta.dir,name)),text=bytes.toString()
  const printed=ts.createPrinter({newLine:ts.NewLineKind.LineFeed}).printFile(ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS))
  return {name,kind:production.has(name)?"production-prototype":"research-fixture-or-driver",physicalLines:text.split("\n").length-(text.endsWith("\n")?1:0),printerNormalizedLines:printed.split("\n").length-1,sha256:createHash("sha256").update(bytes).digest("hex")}
})
writeFileSync(join(import.meta.dir,"source-inventory.json"),JSON.stringify({schema:"apple-source-inventory/1",files:sourceInventory,productionPrototypeLines:sourceInventory.filter(file=>file.kind==="production-prototype").reduce((total,file)=>total+file.physicalLines,0),productionPrinterNormalizedLines:sourceInventory.filter(file=>file.kind==="production-prototype").reduce((total,file)=>total+file.printerNormalizedLines,0),researchLines:sourceInventory.filter(file=>file.kind!=="production-prototype").reduce((total,file)=>total+file.physicalLines,0)},null,2)+"\n")
cpSync(join(consumer,"dist/apple/public-api.d.ts"),join(import.meta.dir,"apple-api.d.ts"))
writeFileSync(join(import.meta.dir,"results.json"),JSON.stringify(result,null,2)+"\n")
console.log(JSON.stringify(result,null,2))
