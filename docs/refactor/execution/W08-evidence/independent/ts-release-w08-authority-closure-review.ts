import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { cp, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { spawnSync } from "node:child_process"
const root="/tmp/ts-release-implementation"
const handoff="docs/refactor/architecture-program/handoff"
const api=`${handoff}/production-api`
const hash=(text:string)=>createHash("sha256").update(text).digest("hex")
const manifestText=await readFile(join(root,api,"emission.json"),"utf8")
const manifest=JSON.parse(manifestText)
const surface=JSON.parse(await readFile(join(root,handoff,"public-surface.json"),"utf8"))
const layout=JSON.parse(await readFile(join(root,handoff,"layout.json"),"utf8"))
for(const artifact of [surface,layout]){
  assert.equal(artifact.productionDeclarations.path,`${api}/emission.json`)
  assert.equal(artifact.productionDeclarations.sha256,hash(manifestText))
  assert.equal(artifact.productionDeclarations.files,manifest.records.length)
}
for(const record of manifest.records){
  assert.equal(hash(await readFile(join(root,api,record.declaration),"utf8")),record.declarationSha256)
  assert.equal(hash(await readFile(join(root,record.source),"utf8")),record.sourceSha256)
}
const owner=manifest.records.find((x:any)=>x.declaration==="internal/ArtifactModel.d.ts")
assert.ok(owner)
const fixture=await mkdtemp("/tmp/ts-release-w08-authority-closure-")
await mkdir(join(fixture,"tools/architecture-lab"),{recursive:true})
await cp(join(root,"tools/architecture-lab/project.ts"),join(fixture,"tools/architecture-lab/project.ts"))
await cp(join(root,"tools/architecture-lab/records.ts"),join(fixture,"tools/architecture-lab/records.ts"))
await symlink(join(root,"node_modules"),join(fixture,"node_modules"),"dir")
await mkdir(join(fixture,handoff),{recursive:true})
await cp(join(root,handoff,"design.json"),join(fixture,handoff,"design.json"))
await cp(join(root,api),join(fixture,api),{recursive:true})
for(const record of manifest.records){
  await mkdir(dirname(join(fixture,record.source)),{recursive:true})
  await symlink(join(root,record.source),join(fixture,record.source))
}
const copiedModel=join(fixture,api,owner.declaration)
const original=await readFile(copiedModel,"utf8")
const mutated=original.replace("readonly bytes: Schema.String;","readonly bytes: Schema.Number;")
assert.notEqual(mutated,original)
await writeFile(copiedModel,mutated)
const result=spawnSync("/home/cjpher/.bun/bin/bun",[join(fixture,"tools/architecture-lab/project.ts"),"--check"],{cwd:fixture,encoding:"utf8"})
assert.notEqual(result.status,0)
assert.match(result.stderr,/Stale production declaration binding: internal\/ArtifactModel\.d\.ts/)
assert.equal(hash(await readFile(join(root,api,owner.declaration),"utf8")),owner.declarationSha256)
console.log(JSON.stringify({declarationOwnerFilesVerified:manifest.records.length,productionManifestSha256:hash(manifestText),boundArtifacts:["public-surface.json","layout.json"],negativeFixture:fixture,privateBaseMutation:"Content_base.bytes: Schema.String -> Schema.Number",actualProjectResult:{exitCode:result.status,diagnostic:"Stale production declaration binding: internal/ArtifactModel.d.ts"},productSourceUnchanged:true},null,2))
