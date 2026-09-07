import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import ts from "/tmp/ts-release-implementation/node_modules/typescript/lib/typescript.js"
const root="/tmp/ts-release-implementation"
const design=JSON.parse(await readFile(resolve(root,"docs/refactor/architecture-program/handoff/design.json"),"utf8"))
const entry=resolve(root,design.authorities.bundle)
const model=resolve(root,"docs/refactor/architecture-program/handoff/production-api/internal/ArtifactModel.d.ts")
const original=await readFile(model,"utf8")
const revised=original.replace("readonly bytes: Schema.String;","readonly bytes: Schema.Number;")
assert.notEqual(revised,original)
assert.equal(Object.values(design.authorities).includes(model.slice(root.length+1)),false)
const hash=(value:string)=>createHash("sha256").update(value).digest("hex")
const project=(replace:boolean)=>{
  const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,types:[]}
  const host=ts.createCompilerHost(options)
  const getSourceFile=host.getSourceFile.bind(host)
  host.getSourceFile=(fileName,languageVersion,onError,shouldCreateNewSourceFile)=>resolve(fileName)===model&&replace
    ? ts.createSourceFile(fileName,revised,languageVersion,true)
    : getSourceFile(fileName,languageVersion,onError,shouldCreateNewSourceFile)
  const program=ts.createProgram([entry],options,host),checker=program.getTypeChecker()
  const source=program.getSourceFile(entry)!,module=checker.getSymbolAtLocation(source)!
  return checker.getExportsOfModule(module).map(exported=>{
    const symbol=exported.flags & ts.SymbolFlags.Alias?checker.getAliasedSymbol(exported):exported
    return {name:exported.name,declarations:(symbol.declarations??[]).map(node=>({line:node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line+1,sha256:hash(node.getText())}))}
  })
}
const before=project(false),after=project(true)
assert.deepEqual(after,before)
console.log(JSON.stringify({virtualChange:"Content_base.bytes: Schema.String -> Schema.Number",entryAuthorityHashUnchanged:true,allBundleProjectedDeclarationHashesUnchanged:true,changedFileOutsideAuthorityBindings:model,contentProjection:before.find(x=>x.name==="Content")},null,2))
