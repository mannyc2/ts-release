import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
const root="/tmp/ts-release-implementation"
const read=(path:string)=>readFile(join(root,path))
const json=async(path:string)=>JSON.parse((await read(path)).toString())
const hash=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex")
const lines=(bytes:Uint8Array)=>bytes.length===0?0:bytes.reduce((n,b)=>n+(b===10?1:0),0)+(bytes[bytes.length-1]===10?0:1)
const forecast=await json("docs/refactor/architecture-program/handoff/forecast.json")
const measurement=await json("docs/refactor/execution/source-measurement.json")
const layout=await json("docs/refactor/architecture-program/handoff/layout.json")
const waves=await json("docs/refactor/architecture-program/handoff/waves.json")
const legacy=new Map(waves.migrationExecutionMapping.currentSourceRows.map((row:any)=>[row.path,row.sha256]))
for(const row of forecast.legacyGeneratedInputs)legacy.set(row.path,row.sha256)
const listed=spawnSync("rg",["--files","src","apps","packages"],{cwd:root,encoding:"utf8"})
assert.equal(listed.status,0,listed.stderr)
const productPaths=listed.stdout.trim().split("\n").filter(path=>(/\.(?:ts|tsx|js|mjs|cjs)$/.test(path)&&(path.startsWith("src/")||/^(?:apps|packages)\/[^/]+\/src\//.test(path)))||/^apps\/[^/]+\/action\.yml$/.test(path))
const measuredProduct=measurement.files.filter((file:any)=>file.lane==="product")
assert.deepEqual([...productPaths].sort(),measuredProduct.map((row:any)=>row.path).sort())
let product=0,replacement=0,unchangedLegacy=0
const replacementPaths=[]
for(const path of productPaths){
  const bytes=await read(path),count=lines(bytes),sha=hash(bytes)
  const measured=measuredProduct.find((row:any)=>row.path===path)
  assert.equal(measured.lines,count,path)
  assert.equal(measured.sha256,sha,path)
  product+=count
  if(legacy.get(path)===sha)unchangedLegacy+=count
  else{replacement+=count;replacementPaths.push(path)}
}
assert.deepEqual({product,replacement,unchangedLegacy},{product:13570,replacement:11131,unchangedLegacy:2439})
const actualFiles=forecast.rows.flatMap((row:any)=>row.actualImplementation?.files??[])
assert.equal(new Set(actualFiles.map((file:any)=>file.path)).size,actualFiles.length)
assert.deepEqual(actualFiles.map((row:any)=>row.path).sort(),replacementPaths.sort())
for(const row of forecast.rows){
  if(row.actualImplementation){
    let count=0
    for(const file of row.actualImplementation.files){
      const bytes=await read(file.path)
      assert.equal(hash(bytes),file.sha256,file.path)
      assert.equal(lines(bytes),file.lines,file.path)
      count+=file.lines
    }
    assert.equal(row.actualImplementation.lines,count,row.owner)
    for(const kind of ["low","expected","high"]){
      assert.equal(row.components.find((part:any)=>part.name === "Actual W08 production owners")[kind],count,row.owner)
      assert.equal(row.components.reduce((n:number,part:any)=>n+part[kind],0),row.fullReplacementPhysicalLines[kind],row.owner)
    }
  }
}
for(const kind of ["low","expected","high"])assert.equal(forecast.rows.reduce((n:number,row:any)=>n+row.fullReplacementPhysicalLines[kind],0),forecast.totals[kind],kind)
assert.equal(forecast.perWaveBudget.W08,9200)
assert.equal(replacement-forecast.perWaveBudget.W08,1931)
assert.equal(forecast.denominator.ceiling,11485)
assert.equal(forecast.totals.expected,13483)
assert.equal(forecast.totals.expected-forecast.denominator.ceiling,1998)
assert.equal(forecast.expectedHeadroom,-1998)
const selected=layout.alternatives.find((x:any)=>x.id===layout.selection.topology)
assert.equal(selected.modules.length,92)
assert.equal(actualFiles.length,81)
console.log(JSON.stringify({product,replacement,unchangedLegacy,replacementTripwire:forecast.perWaveBudget.W08,tripwireExcess:1931,forecast:forecast.totals,completeProductCeiling:11485,expectedForecastDeficit:1998,boundReplacementSourceFiles:actualFiles.length,projectedModules:selected.modules.length,exactSourceHashesVerified:true,allReplacementFilesCountedOnce:true,scope:"Production and forecast accounting only; tests/tooling evidence may refresh during final gate"},null,2))
