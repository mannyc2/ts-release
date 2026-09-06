import { strict as assert } from "node:assert"
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import ts from "../../../node_modules/typescript/lib/typescript.js"
import { files, hash, json, repository } from "./pack.mjs"
import { readEvidence, writeEvidence } from "./evidence.mjs"

const input = new URL("./results.json", import.meta.url)
const baseline = await readEvidence(input)
const result = { format: "packed-declaration-graphs/1", sourceSha256: baseline.sourceSha256,
  baselineSha256: hash(await readFile(input)),
  method: "TypeScript 6 NodeNext resolves every import/re-export/import-type from all installed packed declaration files, recursively through external declarations. Node runtime graphs and Bun bundle graphs remain in the baseline receipt. Builtins are ambient boundaries; compiler ambient libraries are inventoried separately.",
  declarationNormalization:"Map only known package coordinates and projection filenames to canonical roles. Verify and omit T1's pure root re-export barrel. Deduplicate only byte-identical repeated native receipt declarations; physical duplication remains separately counted. Preserve every other declaration byte.",graphs: [] }
for (const layout of baseline.layouts) {
  const roots = []
  for (const pkg of layout.built) for (const emitted of pkg.emitted.filter(file => file.path.endsWith(".d.ts"))) {
    const path = join(layout.consumer, "node_modules", pkg.name, "dist", emitted.path)
    assert.equal(hash(await readFile(path)), emitted.sha256)
    roots.push(path)
  }
  const options = { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022, strict: true, skipLibCheck: false,
    types: ["bun"], lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts", "lib.esnext.disposable.d.ts"],
    typeRoots: [join(repository,"node_modules/@types")] }
  const program = ts.createProgram(roots, options)
  const diagnostics = ts.getPreEmitDiagnostics(program)
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {getCanonicalFileName:p=>p,getCurrentDirectory:()=>layout.consumer,getNewLine:()=>"\n"}))
  const normalize = path => path.replace(layout.consumer, "<consumer>").replace(repository,"<repository>")
  const cache = ts.createModuleResolutionCache(layout.consumer, path=>path, options)
  const edges = [], fileInventory = [], ambient = []
  for (const file of program.getSourceFiles()) {
    const record = { path: normalize(file.fileName), sha256: hash(file.text), bytes: Buffer.byteLength(file.text) }
    if (!file.fileName.startsWith(join(layout.consumer,"node_modules"))) { ambient.push(record); continue }
    fileInventory.push(record)
    const add = (specifier, kind, node) => {
      const mode = ts.getModeForUsageLocation(file, node, options)
      const resolved = ts.resolveModuleName(specifier, file.fileName, options, ts.sys, cache, undefined, mode).resolvedModule
      assert(resolved || specifier.startsWith("node:") || specifier === "bun:sqlite", `Unresolved declaration edge: ${file.fileName}: ${specifier}`)
      edges.push({ from: normalize(file.fileName), specifier, kind,
        mode: mode === ts.ModuleKind.CommonJS ? "require" : "import",
        conditions: ["types", "node", mode === ts.ModuleKind.CommonJS ? "require" : "import"],
        to: resolved ? normalize(resolved.resolvedFileName) : `ambient:${specifier}` })
    }
    const visit = node => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) add(node.moduleSpecifier.text, ts.isExportDeclaration(node)?"re-export":"import", node.moduleSpecifier)
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) add(node.argument.literal.text,"import-type",node.argument.literal)
      ts.forEachChild(node, visit)
    }
    visit(file)
  }
  const unique = [...new Map(edges.map(edge=>[JSON.stringify(edge),edge])).values()]
  const ownDeclarationEdges=unique.filter(edge=>edge.from.includes("/node_modules/@lab/")&&edge.to.includes("/node_modules/@lab/"))
  const assertAcyclic=edges=>{
    const visiting=new Set(),finished=new Set()
    const visit=path=>{assert(!visiting.has(path),`Module cycle at ${path}`);if(finished.has(path))return;visiting.add(path);for(const edge of edges.filter(edge=>edge.from===path))visit(edge.to);visiting.delete(path);finished.add(path)}
    for(const edge of edges)visit(edge.from)
  }
  assertAcyclic(ownDeclarationEdges)
  const emittedEdges=[]
  for(const pkg of layout.built)for(const path of await files(join(layout.consumer,"node_modules",pkg.name,"dist")))if(path.endsWith(".js")) {
    const filename=join(layout.consumer,"node_modules",pkg.name,"dist",path)
    const file=ts.createSourceFile(filename,await readFile(filename,"utf8"),ts.ScriptTarget.Latest,true)
    const add=(specifier,kind)=>{
      const resolved=ts.resolveModuleName(specifier,filename,options,ts.sys,cache,undefined,ts.ModuleKind.ESNext).resolvedModule
      emittedEdges.push({from:normalize(filename),specifier,kind,to:resolved?normalize(resolved.resolvedFileName).replace(/\.d\.ts$/,".js"):`ambient:${specifier}`})
    }
    const visit=node=>{
      if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))add(node.moduleSpecifier.text,"static")
      if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword){const arg=node.arguments[0];if(arg&&ts.isStringLiteral(arg))add(arg.text,"literal-dynamic");else emittedEdges.push({from:normalize(filename),specifier:"<application-selected>",kind:"computed-dynamic",to:"host-application-boundary"})}
      ts.forEachChild(node,visit)
    }
    visit(file)
  }
  assertAcyclic(emittedEdges.filter(edge=>edge.to.includes("/node_modules/@lab/")))
  const normalizedDeclarations={}
  for(const pkg of layout.built)for(const entry of pkg.emitted.filter(entry=>entry.path.endsWith(".d.ts"))) {
    let path=entry.path,text=await readFile(join(layout.consumer,"node_modules",pkg.name,"dist",path),"utf8")
    if(pkg.name==="@lab/release"&&path==="index.d.ts"){assert.equal(text.trim(),'export * from "./kernel/index.js";');continue}
    if(pkg.name==="@lab/release")path=path
    else if(pkg.name==="@lab/kernel")path=`kernel/${path}`
    else if(pkg.name==="@lab/providers")path=`providers/${path}`
    else if(pkg.name==="@lab/npm"||pkg.name==="@lab/python") {
      const name=pkg.name.slice(5)
      path=`providers/${path==="index.d.ts"?`${name}.d.ts`:path}`
      if(name==="npm")text=text.replaceAll('"./index.js"','"./npm.js"')
    } else path=`${pkg.name.slice(5)}/${path}`
    text=text.replaceAll('"@lab/release"','"@lab/kernel"')
    if(path in normalizedDeclarations)assert.equal(normalizedDeclarations[path],text,`Nonidentical duplicated declaration ${path}`)
    normalizedDeclarations[path]=text
  }
  const normalizedDeclarationSha256=hash(json(Object.fromEntries(Object.entries(normalizedDeclarations).sort(([a],[b])=>a<b?-1:a>b?1:0))))
  result.graphs.push({ layout: layout.layoutId, roots: roots.map(normalize), files: fileInventory, ambient, edges: unique,emittedEdges,normalizedDeclarationSha256,normalizedDeclarations,ownDeclarationAcyclic:true,ownEmittedAcyclic:true })
  console.log(layout.layoutId, json({declarationFiles:fileInventory.length,edges:unique.length,ambientFiles:ambient.length}).trim())
}
const output = new URL("./graph-results.json", import.meta.url)
assert.equal(new Set(result.graphs.map(graph=>graph.normalizedDeclarationSha256)).size,1,"Package projections changed the normalized declaration contract")
await writeEvidence(output,result)
const summary = JSON.parse(await readFile(output,"utf8"))
summary.graphs=result.graphs.map(graph=>({layout:graph.layout,declarationFiles:graph.files.length,edges:graph.edges.length,ambientFiles:graph.ambient.length,normalizedDeclarationSha256:graph.normalizedDeclarationSha256,ownDeclarationAcyclic:graph.ownDeclarationAcyclic,ownEmittedAcyclic:graph.ownEmittedAcyclic}))
await writeFile(output,json(summary))
