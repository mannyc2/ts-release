import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import ts from "typescript"
import { node } from "../topology/pack.mjs"
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../../.."),consumer=resolve(process.argv[2]??"")
for(const [name,version] of [["effect","4.0.0-rc.108"],["effect-build","0.6.3"]])if(JSON.parse(readFileSync(join(consumer,"node_modules",name,"package.json"))).version!==version)throw Error(`Requires ${name}@${version} installed consumer`)
const work=mkdtempSync(join(consumer,"checksums-research-"))
mkdirSync(join(work,"src"))
for(const folder of ["checksums","apple","machine/src"])cpSync(join(root,"tools/architecture-lab",folder),join(work,"src",folder),{recursive:true})
writeFileSync(join(work,"tsconfig.json"),JSON.stringify({compilerOptions:{target:"ES2022",module:"NodeNext",moduleResolution:"NodeNext",lib:["ES2022","DOM","ESNext.Disposable"],types:["bun-types"],strict:true,noUncheckedIndexedAccess:true,exactOptionalPropertyTypes:true,skipLibCheck:false,declaration:true,rootDir:"src",outDir:"dist"},files:["src/checksums/checksums.ts","src/checksums/fixture.ts"]}))
const run=cmd=>{const r=Bun.spawnSync(cmd,{cwd:work,stdout:"pipe",stderr:"pipe"});if(r.exitCode!==0)throw Error(`${r.stdout}\n${r.stderr}`);return r.stdout.toString()}
run([process.execPath,join(root,"node_modules/typescript/bin/tsc"),"-p","tsconfig.json"])
const bun=JSON.parse(run([process.execPath,"dist/checksums/fixture.js"]))
const nodeResult=JSON.parse(run([node,"--input-type=module","-e","import('./dist/checksums/fixture.js').then(m=>m.runChecksumFixture()).then(x=>console.log(JSON.stringify(x)))"]))
const files=["checksums.ts","fixture.ts","run.mjs"].map(name=>{const bytes=readFileSync(join(root,"tools/architecture-lab/checksums",name)),printed=ts.createPrinter().printFile(ts.createSourceFile(name,bytes.toString(),ts.ScriptTarget.Latest,true));return{name,physicalLines:bytes.toString().trimEnd().split("\n").length,printerNormalizedLines:printed.trimEnd().split("\n").length,sha256:createHash("sha256").update(bytes).digest("hex")}})
const declaration=readFileSync(join(work,"dist/checksums/checksums.d.ts"),"utf8").replaceAll("../apple/adoption.js","./adoption-api/adoption.js").replaceAll("../machine/src/index.js","./kernel-api.js").replaceAll("LabError","ReleaseError")
writeFileSync(join(root,"docs/refactor/architecture-program/handoff/checksum-api.d.ts"),"/** Proposed root /bundle API emitted from bounded checksum research. */\n"+declaration)
const result={format:"checksum-native-research/1",consumer,work,strictTypecheck:true,bun,node:nodeResult,files,productionImplemented:false,newUpstreamImplementationLines:0,fullReplacementPhysicalLines:{low:files[0].physicalLines+5,expected:files[0].physicalLines+12,high:files[0].physicalLines+30},components:[{name:"Measured checksum projection and content verification",low:files[0].physicalLines,expected:files[0].physicalLines,high:files[0].physicalLines},{name:"Target domain/export, explicit input bounds and final shared public-name admission",low:5,expected:12,high:30}],sourceDonor:{revision:"2ef7a9a61fe40608d053569cbcd71e40fca5c181",path:"src/release/checksums.ts",physicalLines:122},declarationSha256:createHash("sha256").update("/** Proposed root /bundle API emitted from bounded checksum research. */\n"+declaration).digest("hex")}
writeFileSync(join(root,"tools/architecture-lab/checksums/results.json"),JSON.stringify(result,null,2)+"\n")
console.log(JSON.stringify(result,null,2))
