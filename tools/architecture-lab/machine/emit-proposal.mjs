import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

const here=dirname(fileURLToPath(import.meta.url))
const sourceRoot=join(here,"src")
const files=readdirSync(sourceRoot).filter(name=>name.endsWith(".ts")).map(name=>join(sourceRoot,name))
const options={strict:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,lib:["lib.es2022.d.ts","lib.dom.d.ts"],types:["bun-types"],declaration:true,emitDeclarationOnly:true,rootDir:sourceRoot,exactOptionalPropertyTypes:true,noUncheckedIndexedAccess:true}
const outputs=new Map()
const host=ts.createCompilerHost(options)
host.writeFile=(path,text)=>outputs.set(path.split("/").at(-1),text)
const program=ts.createProgram(files,options,host)
const diagnostics=ts.getPreEmitDiagnostics(program)
if(diagnostics.length)throw Error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>process.cwd(),getCanonicalFileName:path=>path,getNewLine:()=>"\n"}))
program.emit()
const publicIdentity=new Set(["createOperation","createPlan","createPreparationScope","loadPlan","makeRequest"])
const file=ts.createSourceFile("identity.d.ts",outputs.get("identity.d.ts"),ts.ScriptTarget.Latest,true)
const identity=file.statements.filter(statement=>ts.isVariableStatement(statement)&&publicIdentity.has(statement.declarationList.declarations[0].name.getText(file))).map(statement=>statement.getText(file)).join("\n")
const clean=text=>text.replace(/^import .*\n/gm,"").replace(/^export \{\};\n/gm,"")
let contracts=outputs.get("contracts.d.ts").replace(/^export type Candidate = .*\n/m,"").replace(/^    readonly candidate: Candidate;\n/gm,"").replace(/    \/\*\* Research fault hook:[\s\S]*?readonly checkpoint\?:[^\n]+\n/m,"").replace('/** Research-only durable boundary. No published compatibility claim. */','/** Implementation must retain Schema.TaggedError and Schema.Class validation. */')
contracts=contracts.replace(/^import type .*from "\.\/model.js";\n/m, "")
const model=clean(outputs.get("model.d.ts"))
const history=clean(outputs.get("m1-history.d.ts"))
const git=clean(outputs.get("core-git.d.ts")).replace(/^export declare const assertTransportBinding:[^\n]+\n/m,"")
const run=clean(outputs.get("run.d.ts")).replace(/^    readonly candidate: Candidate;\n/gm,"").replaceAll('import("./contracts.js").OperationReport','OperationReport')
const header=`/**
 * Proposed production contract, derived from type-checked research declarations.
 * This file declares no implementation and is not evidence of production completion.
 * Changes from the prototype: error renamed ReleaseError; production domains
 * use ts-release/*; private candidate selection and checkpoint hooks omitted.
 * Operation/Plan IDs remain strings whose validation is proved by constructors;
 * additional compile-time brands are not claimed by this tested contract.
 * Implementation classes must remain Schema.Class / Schema.TaggedClass / tagged
 * errors, not interface casts. No legacy reader or migration export is proposed.
 */\n`
const result=(header+contracts+"\n"+model+"\n"+history+"\n"+identity+"\n"+git+"\n"+run).replaceAll("LabError","ReleaseError").replaceAll("architecture-lab/","ts-release/").replaceAll("lab/provider/", "ts-release/provider/").replaceAll('(planId: string,','(journalId: string,').replaceAll('(planId: string)', '(journalId: string)')
const http=header+outputs.get("http-evidence.d.ts").replaceAll("./contracts.js", "./kernel-api.js")
for (const [name,text] of [["kernel-api.d.ts",result],["http-api.d.ts",http]]) {
  const path=resolve(here,"../../../docs/refactor/architecture-program/handoff",name === "kernel-api.d.ts" ? `research-api/${name}` : name)
  if(process.argv.includes("--check")) {
    if(readFileSync(path,"utf8")!==text) throw Error(`Compiler-derived ${name} differs`)
  } else writeFileSync(path,text)
}
console.log("Research-derived kernel snapshot and proposed HTTP declarations "+(process.argv.includes("--check")?"verified":"written"))
