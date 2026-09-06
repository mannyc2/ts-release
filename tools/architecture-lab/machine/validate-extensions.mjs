import { strict as assert } from "node:assert"
import { createHash } from "node:crypto"
import { mkdtemp, readdir, readFile, writeFile, mkdir, symlink } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"
import { machineVariant } from "./extensions/variants.mjs"

const here=dirname(fileURLToPath(import.meta.url))
const repository=resolve(here,"../../..")
const work=await mkdtemp("/tmp/machine-extensions-")
const original=Object.fromEntries(await Promise.all((await readdir(join(here,"src"))).filter(name=>name.endsWith(".ts")).map(async name=>[name,await readFile(join(here,"src",name),"utf8")])))
const template=(await readFile(join(here,"extensions/consumer.ts"),"utf8")).replace('"@lab/kernel"','"./src/index.js"')
const outcomes=[]
const sha256=text=>createHash("sha256").update(text).digest("hex")
const treeSha256=sources=>sha256(JSON.stringify(Object.entries(sources).sort(([a],[b])=>a.localeCompare(b)).map(([path,text])=>({path,sha256:sha256(text)}))))
const bindings={canonicalSourceTreeSha256:treeSha256(original),variantGeneratorSha256:sha256(await readFile(join(here,"extensions/variants.mjs"))),consumerSha256:sha256(template),runnerSha256:sha256(await readFile(fileURLToPath(import.meta.url))),bun:Bun.version,effect:JSON.parse(await readFile(join(repository,"node_modules/effect/package.json"),"utf8")).version}
for(const id of ["P04","P09"]) for(const phase of ["before","after"]) {
  const root=join(work,`${id}-${phase}`)
  await mkdir(join(root,"src"),{recursive:true})
  await symlink(join(repository,"node_modules"),join(root,"node_modules"))
  await writeFile(join(root,"package.json"),'{"type":"module"}')
  const sources=await machineVariant(id,phase,original)
  for(const[name,text]of Object.entries(sources))await writeFile(join(root,"src",name),text)
  await writeFile(join(root,"consumer.ts"),template)
  await writeFile(join(root,"tsconfig.json"),JSON.stringify({compilerOptions:{strict:true,target:"ES2022",module:"NodeNext",moduleResolution:"NodeNext",lib:["ES2022","DOM"],types:["bun-types"],outDir:"dist",noUncheckedIndexedAccess:true,exactOptionalPropertyTypes:true,skipLibCheck:false},include:["src/**/*.ts","consumer.ts"]}))
  const check=Bun.spawnSync([process.execPath,join(repository,"node_modules/typescript/bin/tsc"),"-p",join(root,"tsconfig.json")],{stdout:"pipe",stderr:"pipe"})
  assert.equal(check.exitCode,0,check.stdout.toString()+check.stderr.toString())
  for(const candidate of ["M1","M2"])for(const mode of id==="P04"?["P04"]:["P09-live","P09-migrate"]) {
    const child=Bun.spawn([process.execPath,join(root,"dist/consumer.js"),mode,candidate],{stdout:"pipe",stderr:"pipe"})
    const code=await child.exited
    const stdout=await new Response(child.stdout).text()
    const stderr=await new Response(child.stderr).text()
    assert.equal(code===0,phase==="after",`${id}/${phase}/${mode}/${candidate}: ${stdout}\n${stderr}`)
    const expected=mode==="P04"?/must remain Pending/:mode==="P09-live"?/Legacy supersession/:/one-shot importer/
    if(phase==="before")assert.match(stderr,expected)
    outcomes.push({id,phase,mode,candidate,sourceTreeSha256:treeSha256(sources),exitCode:code,...(code===0?{result:JSON.parse(stdout)}:{expectedFailure:expected.source})})
  }
}
await writeFile(join(here,"extension-results.json"),JSON.stringify({format:"machine-extension-verification/1",work,bindings,outcomes},null,2)+"\n")
console.log(JSON.stringify({work,outcomes},null,2))
