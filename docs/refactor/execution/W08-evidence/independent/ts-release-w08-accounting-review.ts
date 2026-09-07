import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile, stat } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import ts from "/tmp/ts-release-implementation/node_modules/typescript/lib/typescript.js"
const root="/tmp/ts-release-implementation"
const read=path=>readFile(resolve(root,path),"utf8")
const design=JSON.parse(await read("docs/refactor/architecture-program/handoff/design.json"))
const graph=JSON.parse(await read("docs/refactor/architecture-program/handoff/layout.json"))
const selected=graph.alternatives.find(x=>x.id===design.selection.topology)
const modules=selected.modules
const moduleByPath=new Map(modules.map(x=>[resolve(root,x.path),x]))
const publicEntries=new Map(selected.packages.flatMap(pkg=>Object.entries(pkg.manifest.exports??{}).map(([name,conditions])=>[
  pkg.manifest.name+(name==="."?"":name.slice(1)),
  resolve(root,pkg.directory,(conditions as {import:string}).import.replace("./dist/","./src/").replace(/\.js$/,".ts")),
])))
const dependencyMismatches=[]
let checked=0
const actualGraph=new Map()
for(const module of modules){
  let sourceText:string
  try{sourceText=await read(module.path)}catch{continue}
  checked++
  const source=ts.createSourceFile(module.path,sourceText,ts.ScriptTarget.Latest,true)
  const edges=new Map<string,boolean>()
  for(const node of source.statements){
    if(!(ts.isImportDeclaration(node)||ts.isExportDeclaration(node))||!node.moduleSpecifier||!ts.isStringLiteral(node.moduleSpecifier))continue
    const name=node.moduleSpecifier.text
    if(!name.startsWith(".")&&!publicEntries.has(name))continue
    const path=name.startsWith(".")?resolve(dirname(resolve(root,module.path)),name.replace(/\.js$/,".ts")):publicEntries.get(name)!
    const target=moduleByPath.get(path)
    if(!target){dependencyMismatches.push({module:module.id,kind:"missing-target-module",name,path});continue}
    const typeOnly=ts.isImportDeclaration(node)?Boolean(node.importClause?.isTypeOnly):node.isTypeOnly
    edges.set(target.id,(edges.get(target.id)??true)&&typeOnly)
  }
  actualGraph.set(module.id,[...edges].filter(([,typeOnly])=>!typeOnly).map(([target])=>target))
  for(const [target,typeOnly] of edges){
    if(!module.dependencies.includes(target))dependencyMismatches.push({module:module.id,target,kind:"unlisted-direct-edge",actualTypeOnly:typeOnly})
    else if(Boolean(module.typeOnlyDependencies?.includes(target))!==typeOnly)dependencyMismatches.push({module:module.id,target,kind:"loading-mismatch",actualTypeOnly:typeOnly,declaredTypeOnly:Boolean(module.typeOnlyDependencies?.includes(target))})
  }
  for(const target of module.dependencies)if(!edges.has(target))dependencyMismatches.push({module:module.id,target,kind:"declared-but-not-actual-static-edge"})
}
const git=(...args:string[])=>{const result=spawnSync("git",args,{cwd:root,encoding:"utf8"});assert.equal(result.status,0,result.stderr);return result.stdout}
const prior=JSON.parse(git("show","HEAD:docs/refactor/architecture-program/handoff/public-surface.json"))
const surface=JSON.parse(await read("docs/refactor/architecture-program/handoff/public-surface.json"))
const apiChanges=[]
for(const old of prior.logicalSurfaces){
  const current=surface.logicalSurfaces.find(x=>x.id===old.id)
  const before=new Set(old.symbols.map(x=>x.name)),after=new Set(current?.symbols.map(x=>x.name)??[])
  const removed=[...before].filter(x=>!after.has(x)),added=[...after].filter(x=>!before.has(x))
  if(removed.length||added.length)apiChanges.push({surface:old.id,removed,added})
}
const migration=JSON.parse(await read("docs/refactor/execution/W08-migration.json"))
let lines=0,decls=0
const retired=[]
for(const row of migration.rows){
  const text=git("show",`${migration.sourceCommit}:${row.path}`)
  const hash=createHash("sha256").update(text).digest("hex")
  const actualLines=text.trimEnd().split("\n").length
  assert.equal(hash,row.sha256)
  assert.equal(actualLines,row.lines)
  assert.equal(await stat(resolve(root,row.path)).then(()=>true,()=>false),false)
  const baselineSource=ts.createSourceFile(row.path,text,ts.ScriptTarget.Latest,true)
  const nodeHashes=new Set<string>()
  const visit=(node:ts.Node)=>{nodeHashes.add(createHash("sha256").update(node.getText(baselineSource)).digest("hex"));ts.forEachChild(node,visit)}
  visit(baselineSource)
  for(const declaration of row.retiredDeclarations)assert.ok(nodeHashes.has(declaration.sha256),`${row.path}: missing exact declaration ${declaration.name}`)
  lines+=row.lines;decls+=row.retiredDeclarations.length
  retired.push({path:row.path,lines:row.lines,declarations:row.retiredDeclarations.length,responsibility:row.responsibility})
}
assert.equal(lines,migration.physicalDeletedLines)
const cycles:string[][]=[]
const walked=new Set<string>()
const walk=(id:string,active:string[])=>{
  const start=active.indexOf(id)
  if(start>=0){cycles.push([...active.slice(start),id]);return}
  if(walked.has(id))return
  walked.add(id)
  for(const target of actualGraph.get(id)??[])walk(target,[...active,id])
}
for(const id of actualGraph.keys())walk(id,[])
console.log(JSON.stringify({checkedModules:checked,actualStaticCycles:cycles,dependencyMismatches,apiChanges,retirement:{sourceCommit:migration.sourceCommit,files:retired.length,lines,declarations:decls,retired},carryForward:migration.nativeCarryForward},null,2))
