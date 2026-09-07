import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile, lstat, mkdtemp } from "node:fs/promises"
import { join } from "node:path"
import ts from "/tmp/ts-release-implementation/node_modules/typescript/lib/typescript.js"
const root="/tmp/ts-release-implementation"
const evidence=join(root,"docs/refactor/execution/W08-evidence")
const read=(p:string)=>readFile(p)
const json=async(p:string)=>JSON.parse((await read(p)).toString())
const hash=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex")
const run=(argv:string[],cwd=root)=>{const r=Bun.spawnSync(argv,{cwd});assert.equal(r.exitCode,0,`${argv.join(" ")}\n${r.stderr}`);return r.stdout.toString()}
const files=async(cwd:string)=>{const names=[];for await(const name of new Bun.Glob("**/*").scan({cwd,onlyFiles:true,dot:true}))names.push(name);return names.sort()}
const retention=await json(join(evidence,"retention.json"))
const concreteSources=[]
assert.equal(new Set(retention.files.map((x:any)=>x.retained)).size,retention.files.length)
for(const row of retention.files){
 const bytes=await read(join(root,row.retained))
 assert.equal(bytes.length,row.bytes,row.retained);assert.equal(hash(bytes),row.sha256,row.retained)
 if(row.source.startsWith("/") && await lstat(row.source).then(s=>s.isFile(),()=>false)){
  assert.equal(hash(await read(row.source)),row.sha256,row.source);concreteSources.push(row.source)
 }
}
const unindexedAtReview=(await files(evidence)).filter(x=>x!=="retention.json").map(x=>`docs/refactor/execution/W08-evidence/${x}`).filter(x=>!retention.files.some((r:any)=>r.retained===x))
const producer=await json(join(evidence,"final-packed-producers/evidence.json"))
const apple=await json(join(evidence,"final-packed-apple/evidence.json"))
const kernel=hash(await read(join(evidence,"final-packed-producers/kernel.tgz")))
assert.equal(kernel,"eb038cb394139f069a0f937b72578f8f987705fae53e4210b0705ad2b7c723d9")
for(const value of [retention.final.kernelSha256,producer.kernelSha256,apple.kernelSha256,hash(await read(producer.archive))])assert.equal(value,kernel)
assert.equal(producer.work,retention.final.producerWork);assert.equal(apple.work,retention.final.appleWork);assert.equal(apple.packed,producer.work)
assert.deepEqual(producer.sourceBindings.map((x:any)=>x.path).sort(),await files(join(root,"packages/ts-release/src")))
for(const row of producer.sourceBindings)assert.equal(hash(await read(join(root,"packages/ts-release/src",row.path))),row.sha256,row.path)
const unpacked=await mkdtemp("/tmp/ts-release-w08-packed-audit-")
run(["tar","-xzf",join(evidence,"final-packed-producers/kernel.tgz"),"-C",unpacked])
const packedFiles=await files(join(unpacked,"package"))
for(const manager of ["bun","npm"]){
 const installed=join(producer.work,manager,"node_modules/@mannyc1/ts-release")
 assert.equal((await lstat(installed)).isSymbolicLink(),false)
 for(const name of packedFiles){
  const actual=await read(join(unpacked,"package",name))
  assert.equal(hash(await read(join(installed,name))),hash(actual),`${manager}:${name}`)
  if(name.startsWith("dist/")||name==="package.json")assert.equal(hash(await read(join(root,"packages/ts-release",name))),hash(actual),`current:${name}`)
 }
 for(const name of ["executables.mjs","archives.mjs","python.mjs","packages.mjs","sbom.mjs","public-contract.ts","apple-process.mjs","apple-installed.mjs"])
  assert.equal(hash(await read(join(producer.work,manager,name))),hash(await read(join(root,"test/reimplementation/artifacts",name))),`${manager}:${name}`)
 assert.equal(hash(await read(join(producer.work,manager,"apple-fixtures.js"))),apple.fixtureJavascriptSha256)
}
let fixture=(await read(join(root,"test/reimplementation/artifacts/apple-fixtures.ts"))).toString()
for(const [name,target]of Object.entries({EffectBuild:"effect-build",Node:"node",Bundle:"bundle",Apple:"apple"}))fixture=fixture.replaceAll(`../../../packages/ts-release/src/${name}.js`,`@mannyc1/ts-release/${target}`)
fixture=fixture.replaceAll("@effect/platform-bun/BunServices","@effect/platform-node/NodeServices").replaceAll("BunServices","NodeServices")
assert.equal(hash(new TextEncoder().encode(ts.transpileModule(fixture,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)),apple.fixtureJavascriptSha256)
for(const row of producer.upstream){
 const bytes=await read(join(root,"docs/refactor/execution/W08-upstream",row.retainedTarball))
 assert.equal(hash(bytes),row.sha256,row.name);assert.equal(bytes.length,row.bytes)
 assert.equal(`sha512-${createHash("sha512").update(bytes).digest("base64")}`,row.integrity,row.name)
}
assert.equal(producer.outcomes.length,4);assert.equal(producer.commands.length,36)
assert.ok(producer.commands.every((x:any)=>x.exitCode===0))
assert.deepEqual(producer.commands,await json(join(evidence,"final-packed-producers/commands.json")))
assert.deepEqual(producer.outcomes,await json(join(evidence,"final-packed-producers/outcomes.json")))
const producerCells=[]
for(const [i,cell]of producer.outcomes.entries()){
 let checks=0
 for(const kind of ["executables","archives","python","packages","sbom"]){
  const receipt=await json(join(evidence,`final-packed-producers/${cell.manager}-${i%2}/${kind}/evidence.json`))
  assert.equal(receipt.work,cell.evidence[kind].work)
  assert.equal(receipt.checks.length,cell.evidence[kind].checks)
  checks+=receipt.checks.length
  if(kind==="packages"){
   assert.equal(receipt.input.executableWork,cell.evidence.executables.work)
   assert.equal(receipt.input.bundleSha256,hash(await read(join(cell.evidence.executables.work,"bundle.json"))));assert.equal(receipt.consumers.length,4)
  }
 }
 assert.equal(checks,195);producerCells.push({manager:cell.manager,runtime:cell.runtime,checks})
}
assert.equal(apple.commands.length,48);assert.equal(apple.checks.length,120);assert.equal(apple.outcomes.length,4)
assert.deepEqual(apple.commands,await json(join(evidence,"final-packed-apple/commands.json")))
assert.deepEqual(apple.outcomes,await json(join(evidence,"final-packed-apple/outcomes.json")))
const killed=apple.commands.filter((x:any)=>x.argv.at(-1).startsWith("kill-"))
assert.equal(killed.length,8);assert.ok(killed.every((x:any)=>x.exitCode===137))
assert.ok(apple.commands.filter((x:any)=>!killed.includes(x)).every((x:any)=>x.exitCode===0))
const journalRoot=await mkdtemp("/tmp/ts-release-w08-journal-audit-")
const journals=[]
for(const [i,cell]of apple.outcomes.entries()){
 const stem=`${cell.manager}-${i%2}`
 for(const type of ["retained-receipt","lost-receipt"]){
  const cellRoot=join(evidence,"final-packed-apple",stem,type)
  const journal=join(journalRoot,stem+"-"+type+".git")
  run(["git","clone","--bare","--quiet",join(cellRoot,"journal.bundle"),journal])
  run(["git",`--git-dir=${journal}`,"fsck","--full"])
  const refs=run(["git",`--git-dir=${journal}`,"for-each-ref","--format=%(refname)"]).trim().split("\n")
  assert.equal(refs.length,1)
  const commits=run(["git",`--git-dir=${journal}`,"rev-list","--reverse",refs[0]]).trim().split("\n")
  const events=commits.map(commit=>JSON.parse(run(["git",`--git-dir=${journal}`,"show",`${commit}:event.json`])))
  const report=await json(join(cellRoot,type==="lost-receipt"?"restart-lost-report.json":"report-report.json"))
  const collection=await json(join(cellRoot,"collection.json"))
  const submits=(await read(join(cellRoot,"native-submits.jsonl"))).toString().trim().split("\n").map(x=>JSON.parse(x))
  assert.deepEqual(events,report.nativeFacts)
  assert.equal(report.revision,events.length);assert.equal(report.journalId,collection.journalId)
  assert.ok(events.every(x=>x.journalId===collection.journalId))
  for(const prep of report.preparations)assert.equal(prep.revision,report.revision)
  if(type==="lost-receipt"){
   assert.equal(commits.length,1);assert.equal(submits.length,1);assert.equal(events[0].body._tag,"DispatchStarted")
   assert.equal(report.preparations[0].operations[0].status,"Inconclusive")
   const resumptions=apple.commands.filter((x:any)=>x.argv[2]===cell.lost&&x.argv.at(-1)==="restart-lost")
   assert.equal(resumptions.length,2)
   for(const command of resumptions){const output=JSON.parse(command.output);assert.deepEqual(output.report,report);assert.deepEqual(output.calls,{submit:0,info:0,staple:0,assess:0})}
  }else{
   assert.equal(commits.length,8);assert.equal(submits.length,2)
   const pending=await json(join(cellRoot,"pending-report.json")),ready=await json(join(cellRoot,"ready-report.json"))
   assert.equal(pending.revision,6);assert.deepEqual(pending.nativeFacts,events.slice(0,6));assert.deepEqual(ready,{journalId:report.journalId,revision:report.revision,preparations:report.preparations,nativeFacts:report.nativeFacts})
   assert.deepEqual(events.filter(x=>x.body._tag==="ReceiptAccepted").map(x=>x.body.receipt.submissionId).sort(),submits.map(x=>x.submissionId).sort())
   assert.deepEqual(events.filter(x=>x.body._tag==="ReceiptAccepted").map(x=>x.body.receipt),submits)
   assert.deepEqual(report.preparations.map((x:any)=>x.operations[0].status),["Satisfied","Satisfied"])
   const publication=await json(join(cellRoot,"publication.json"));assert.equal(publication.plan.journalId,report.journalId);assert.equal(publication.plan.planId,report.publication.planId);assert.equal(publication.finalBundleContent.sha256,publication.plan.bundleId)
   const actualRoot=cell.success
   assert.equal(hash(await read(join(actualRoot,"objects",publication.finalBundleContent.sha256))),publication.finalBundleContent.sha256)
   const bundle=await json(join(actualRoot,"objects",publication.finalBundleContent.sha256));assert.equal(bundle.artifacts.filter((x:any)=>x._tag==="OwnedTree").length,2);assert.equal(bundle.artifacts.filter((x:any)=>x._tag==="OwnedFile").length,3)
   const installed=apple.commands.find((x:any)=>x.argv[1]==="apple-installed.mjs"&&x.argv[2]===cell.success)
   assert.equal(JSON.parse(installed.output).checks,8)
  }
  journals.push({cell:stem,type,events:events.length,submissions:submits.length,revision:report.revision,statuses:report.preparations.map((x:any)=>x.operations[0].status),exactReportMatch:true})
 }
}
const ledger=await json(join(root,"docs/refactor/execution/W08-outcome-evidence.json"))
const scoreBytes=await read(join(root,"docs/refactor/research/launch-scorecard.md"))
const selected=scoreBytes.toString().split("\n").filter(line=>/^[PQ][0-9]/.test(line)&&line.split("|")[9]==="V")
assert.equal(ledger.rows.length,28);assert.deepEqual(ledger.rows.map((x:any)=>x.id).sort(),selected.map(line=>line.split("|")[0]).sort())
for(const row of ledger.rows){
 assert.equal(row.source.sha256,hash(scoreBytes));const cells=scoreBytes.toString().split("\n")[row.source.line-1].split("|")
 assert.equal(cells[0],row.id);for(const [key,index]of Object.entries({outcome:2,exactScope:4,inputOutput:5,requiredPassWitness:6,fixtureOrDestination:7}))assert.equal(row[key],cells[index],`${row.id}:${key}`)
 assert.equal(row.status,"open-final-certification-required")
}
console.log(JSON.stringify({retainedFiles:retention.files.length,unindexedAtReview,concreteSourceCopiesVerified:concreteSources.length,kernelSha256:kernel,coreSourceBindings:producer.sourceBindings.length,packedFiles:packedFiles.length,installedManagersVerified:2,upstreamArchives:producer.upstream.length,producerCommands:producer.commands.length,producerCells,producerChecks:producerCells.reduce((n,x)=>n+x.checks,0),appleCommands:apple.commands.length,appleDriverChecks:apple.checks.length,sigkillExits:killed.length,journals,originalSelectedScopesPreserved:ledger.rows.length,qualification:"Local W08 implementation evidence; all launch outcomes and native macOS/Windows credentialed acceptance remain open"},null,2))
