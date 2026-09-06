import { createHash } from "node:crypto"
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { install, packRuntimeDependencies } from "../topology/pack.mjs"
import { amendApple } from "./amend.mjs"

const root=resolve(fileURLToPath(new URL("../../..",import.meta.url)))
const directory=mkdtempSync(join(tmpdir(),"ts-release-apple-composition-"))
const dependencies=await packRuntimeDependencies(join(directory,"dependencies"),["effect","@effect/platform-node","ioredis","bun-types"])
const recorded=JSON.parse(readFileSync(join(root,"docs/refactor/architecture-program/handoff/upstream/published-consumer.json"),"utf8"))
const packages=recorded.packages.map(pkg=>({...pkg,tarball:{...pkg.tarball,path:join(root,`docs/refactor/architecture-program/handoff/upstream/packs/${pkg.name}-${pkg.version}.tgz`)}}))
const consumer=join(directory,"consumer")
await install(consumer,packages,dependencies,["effect","@effect/platform-node","bun-types","effect-build","effect-build-apple"])
for(const path of ["apple","machine/src","storage","apple-composition"]){
  mkdirSync(join(consumer,"src",path),{recursive:true})
  const names=path==="apple"?["adoption.ts","content-owner.ts","bundle-codec.ts","apple-preparation.ts","apple-experiment.ts"]:path==="storage"?["protocol.ts","sqlite.ts"]:path==="apple-composition"?["composition.ts","fixture.ts"]:undefined
  if(names)for(const name of names)cpSync(join(root,"tools/architecture-lab",path,name),join(consumer,"src",path,name))
  else cpSync(join(root,"tools/architecture-lab",path),join(consumer,"src",path),{recursive:true})
}
const amendment=amendApple(consumer)
writeFileSync(join(consumer,"tsconfig.json"),JSON.stringify({compilerOptions:{target:"ES2022",module:"NodeNext",moduleResolution:"NodeNext",lib:["ES2022","DOM","ESNext.Disposable"],strict:true,skipLibCheck:false,noUncheckedIndexedAccess:true,exactOptionalPropertyTypes:true,types:["bun-types"],rootDir:"src",outDir:"dist"},include:["src/**/*.ts"]}))
const run=argv=>{const result=Bun.spawnSync(argv,{cwd:consumer,stdout:"pipe",stderr:"pipe"});if(result.exitCode!==0)throw Error(`${argv.join(" ")}\n${result.stdout}\n${result.stderr}`);return result.stdout.toString()}
run([process.execPath,join(root,"node_modules/typescript/bin/tsc"),"-p","tsconfig.json"])
const result=JSON.parse(run([process.execPath,"dist/apple-composition/fixture.js"]))
const sources=["composition.ts","fixture.ts","amend.mjs","run.mjs"].map(name=>{const source=readFileSync(join(root,"tools/architecture-lab/apple-composition",name));return {path:`tools/architecture-lab/apple-composition/${name}`,sha256:createHash("sha256").update(source).digest("hex"),physicalLines:source.toString().trimEnd().split("\n").length}})
const receipt={...result,directory,consumer,strictDeclarations:true,amendment,sources,machineTreeSha256:JSON.parse(readFileSync(join(root,"tools/architecture-lab/machine/source-metrics.json"),"utf8")).treeSha256,packages:packages.map(pkg=>({name:pkg.name,version:pkg.version,sha256:pkg.tarball.sha256})),limits:"Real process replacement, SQLite/content/native tar and upstream file/tree finalization. Apple services remain explicit protocol doubles; full app/DMG/pkg native acceptance is not claimed."}
writeFileSync(join(root,"tools/architecture-lab/apple-composition/results.json"),JSON.stringify(receipt,null,2)+"\n")
console.log(JSON.stringify(receipt))
