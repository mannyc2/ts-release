import { createHash } from "node:crypto"
import { readdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { machineVariant } from "./extensions/variants.mjs"

const here=dirname(fileURLToPath(import.meta.url))
const sources=Object.fromEntries(await Promise.all((await readdir(join(here,"src"))).filter(name=>name.endsWith(".ts")).sort().map(async name=>[name,await readFile(join(here,"src",name),"utf8")])))
const sha256=value=>createHash("sha256").update(value).digest("hex")
const treeHash=values=>sha256(JSON.stringify(Object.entries(values).sort(([a],[b])=>a.localeCompare(b)).map(([path,value])=>({path,sha256:sha256(value)}))))
const lines=value=>value.trimEnd().split("\n")
const printer=ts.createPrinter({newLine:ts.NewLineKind.LineFeed})
function metrics(path,text) {
  const file=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
  let nodes=0,branches=0
  const visit=node=>{nodes++;if(ts.isIfStatement(node)||ts.isCaseClause(node)||ts.isConditionalExpression(node))branches++;ts.forEachChild(node,visit)}
  visit(file)
  return {path,sha256:sha256(text),utf8Bytes:Buffer.byteLength(text),physicalLines:(text.match(/\n/g)??[]).length,printerNormalizedLines:lines(printer.printFile(file)).length,astNodes:nodes,branches}
}
function changes(before,after) {
  const result=[]
  for(const path of new Set([...Object.keys(before),...Object.keys(after)]))if(before[path]!==after[path]) {
    const a=before[path]?lines(before[path]):[],b=after[path]?lines(after[path]):[]
    let prior=new Uint32Array(b.length+1)
    for(const line of a){const next=new Uint32Array(b.length+1);for(let j=0;j<b.length;j++)next[j+1]=line===b[j]?prior[j]+1:Math.max(prior[j+1],next[j]);prior=next}
    result.push({path,added:b.length-prior[b.length],removed:a.length-prior[b.length]})
  }
  return result
}
const files=Object.entries(sources).map(([path,text])=>metrics(path,text))
const extensions=[]
for(const id of process.argv.includes("--source-only") ? [] : ["P04","P09"]) {
  const before=await machineVariant(id,"before",sources),after=await machineVariant(id,"after",sources)
  const patch=changes(before,after)
  extensions.push({id,beforeTreeSha256:treeHash(before),afterTreeSha256:treeHash(after),changedFiles:patch,physicalAdded:patch.reduce((n,file)=>n+file.added,0),physicalRemoved:patch.reduce((n,file)=>n+file.removed,0),patchSha256:sha256(JSON.stringify(patch.map(file=>({...file,before:before[file.path]??null,after:after[file.path]??null}))))})
}
const output={format:"machine-source-measurement/1",method:"Actual source newline counts and TypeScript printer-normalized lines are separate diagnostics; neither is semantic-source/v3. Hash tree is SHA-256 of JSON sorted path/file-hash records. Extension LCS costs include both candidate edits and whole migration module; topologies separately count physical package/export/consumer edits.",typescript:ts.version,treeSha256:treeHash(sources),files,totals:{physicalLines:files.reduce((n,file)=>n+file.physicalLines,0),printerNormalizedLines:files.reduce((n,file)=>n+file.printerNormalizedLines,0),utf8Bytes:files.reduce((n,file)=>n+file.utf8Bytes,0)},extensions}
if (process.argv.includes("--source-only")) output.extensionQualification = "Source-only recount after reviewed kernel law amendments. Extension results are measured separately against the preserved original slice plus HTTP helper relocation; no current production extension pass is claimed."
await writeFile(join(here,"source-metrics.json"),JSON.stringify(output,null,2)+"\n")
console.log(JSON.stringify(output,null,2))
