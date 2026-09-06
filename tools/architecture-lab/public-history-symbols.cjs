// Parse shipped declarations and JavaScript; never import the historical package.
const ts = require('../../node_modules/typescript/lib/typescript.js');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = process.argv[2];
const outputPath = process.argv[3];
if (!root || !outputPath) throw Error('Expected inspected package directory and output JSON path');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
const entries = Object.entries(manifest.exports);
const program = ts.createProgram(entries.map(([,value]) => path.join(root,value.types)), {target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,skipLibCheck:true,noEmit:true});
const checker = program.getTypeChecker();
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const archivePath = p => 'package/'+path.relative(root,p).split(path.sep).join('/');
const roots = entries.map(([subpath,value]) => {
  const sf = program.getSourceFile(path.join(root,value.types));
  const runtime = ts.createSourceFile(value.default, fs.readFileSync(path.join(root,value.default),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const runtimeNames=[];
  for(const stmt of runtime.statements){
    if(ts.isExportDeclaration(stmt)){
      if(!stmt.exportClause || !ts.isNamedExports(stmt.exportClause)) throw Error('Unexpected runtime star/namespace export: '+subpath);
      runtimeNames.push(...stmt.exportClause.elements.map(e=>e.name.text));
    } else if(stmt.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)){
      if(ts.isVariableStatement(stmt)) runtimeNames.push(...stmt.declarationList.declarations.map(d=>d.name.getText(runtime)));
      else if(stmt.name) runtimeNames.push(stmt.name.text);
      else throw Error('Unexpected runtime exported statement');
    }
  }
  const symbols=checker.getExportsOfModule(checker.getSymbolAtLocation(sf)).map(symbol => {
    const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    const ds=target.getDeclarations()??[];
    if(!ds.length) throw Error('Unresolved '+subpath+':'+symbol.getName());
    const origins=ds.map(d=>{
      const f=d.getSourceFile();
      if(!f.fileName.startsWith(root+'/')) throw Error('External public symbol '+symbol.getName()+':'+f.fileName);
      return {path:archivePath(f.fileName),line:f.getLineAndCharacterOfPosition(d.getStart(f)).line+1,kind:ts.SyntaxKind[d.kind],declarationSha256:hash(d.getText(f)),declaredMembers:Array.from(d.members??(d.type && ts.isTypeLiteralNode(d.type)?d.type.members:[])).map(m=>({name:m.name?.getText(f)??ts.SyntaxKind[m.kind],kind:ts.SyntaxKind[m.kind],line:f.getLineAndCharacterOfPosition(m.getStart(f)).line+1,sha256:hash(m.getText(f))}))};
    });
    const bindings=(symbol.getDeclarations()??[]).map(d=>({path:archivePath(d.getSourceFile().fileName),line:d.getSourceFile().getLineAndCharacterOfPosition(d.getStart()).line+1,kind:ts.SyntaxKind[d.kind]}));
    return {name:symbol.getName(),runtime:runtimeNames.includes(symbol.getName()),typeOnly:!runtimeNames.includes(symbol.getName()),bindings,origins};
  }).sort((a,b)=>a.name.localeCompare(b.name));
  for(const name of runtimeNames) if(!symbols.some(s=>s.name===name)) throw Error('Missing declaration for runtime name '+name);
  return {subpath,types:archivePath(path.join(root,value.types)),runtime:archivePath(path.join(root,value.default)),symbolCount:symbols.length,runtimeSymbolCount:runtimeNames.length,symbols};
});
const output={compiler:ts.version,method:'TypeScript compiler export and alias traversal over shipped declarations; independent AST of shipped JS named exports. No package code execution, rebuild, beta.83 dependency installation, or typecheck against installed rc.108 is claimed.',surfaces:roots};
fs.writeFileSync(outputPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(roots.map(({subpath,symbolCount,runtimeSymbolCount})=>({subpath,symbolCount,runtimeSymbolCount})),null,2));
