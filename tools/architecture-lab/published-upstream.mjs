import { createHash } from "node:crypto"
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { install, node, packRuntimeDependencies } from "./topology/pack.mjs"

// Only public GETs. Downloaded native packages are integrity checked; lifecycle
// scripts are disabled. Protocol fixtures do not mutate GitHub/npm/Apple.
const root = resolve(fileURLToPath(new URL("../..", import.meta.url)))
const directory = mkdtempSync(join(tmpdir(), "ts-release-published-upstream-"))
const sha = (value, algorithm = "sha256", encoding = "hex") => createHash(algorithm).update(value).digest(encoding)
const version = "0.6.3"
const archive = join(root, "docs/refactor/architecture-program/handoff/upstream")
const offline = process.argv.includes("--offline")
const retained = offline ? JSON.parse(readFileSync(join(archive, "published-consumer.json"), "utf8")) : undefined
const packages = []
for (const name of ["effect-build", "effect-build-apple"]) {
  const metadataUrl = `https://registry.npmjs.org/${name}/${version}`
  const previous = retained?.packages.find(p => p.name === name && p.version === version)
  if (offline && !previous) throw new Error(`Missing retained ${name}`)
  const metadata = previous?.metadata ?? await (async () => {
    const response = await fetch(metadataUrl)
    if (!response.ok) throw new Error(`Public metadata ${response.status}`)
    return response.json()
  })()
  if (metadata.name !== name || metadata.version !== version || metadata.dist.tarball !== `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`) throw new Error("Unexpected native package coordinate")
  const retainedTarball = `docs/refactor/architecture-program/handoff/upstream/packs/${name}-${version}.tgz`
  const bytes = offline ? readFileSync(join(root, retainedTarball)) : await (async () => {
    const response = await fetch(metadata.dist.tarball)
    if (!response.ok) throw new Error(`Tarball GET ${response.status}`)
    return Buffer.from(await response.arrayBuffer())
  })()
  if (`sha512-${sha(bytes, "sha512", "base64")}` !== metadata.dist.integrity || sha(bytes, "sha1") !== metadata.dist.shasum) throw new Error("Native package integrity mismatch")
  const path = join(directory, `${name}-${version}.tgz`)
  writeFileSync(path, bytes)
  if (!offline) { mkdirSync(join(archive, "packs"), {recursive:true}); writeFileSync(join(root, retainedTarball), bytes) }
  packages.push({name,version,metadataUrl,metadata,tarball:{path,sha256:sha(bytes),bytes:bytes.length},retainedTarball})
}
const dependencies = await packRuntimeDependencies(join(directory, "dependencies"), ["effect", "@effect/platform-node", "ioredis", "bun-types"])
const consumer = join(directory, "consumer")
await install(consumer, packages, dependencies, ["effect", "@effect/platform-node", "bun-types", "effect-build", "effect-build-apple"])
mkdirSync(join(consumer, "src/apple"), {recursive:true})
const production = ["adoption.ts", "content-owner.ts", "bundle-codec.ts", "apple-preparation.ts", "public-api.ts"]
const fixtures = ["adoption-fixture.ts", "apple-experiment.ts"]
const sources = []
for (const name of [...production, ...fixtures]) {
  const source = readFileSync(join(root, "tools/architecture-lab/apple", name), "utf8")
  writeFileSync(join(consumer, "src/apple", name), source)
  sources.push({path:`apple/${name}`,sha256:sha(source)})
}
cpSync(join(root,"tools/architecture-lab/machine/src"),join(consumer,"src/machine/src"),{recursive:true})
mkdirSync(join(consumer, "src/storage"))
for (const name of ["sqlite.ts", "protocol.ts"]) cpSync(join(root, "tools/architecture-lab/storage", name), join(consumer, "src/storage", name))
writeFileSync(join(consumer, "tsconfig.json"), JSON.stringify({compilerOptions:{target:"ES2022",module:"NodeNext",moduleResolution:"NodeNext",lib:["ES2022","DOM","ESNext.Disposable"],strict:true,skipLibCheck:false,noUncheckedIndexedAccess:true,exactOptionalPropertyTypes:true,types:["bun-types"],declaration:true,rootDir:"src",outDir:"dist"},include:["src/**/*.ts"]}))
const run = argv => {
  const result = Bun.spawnSync(argv,{cwd:consumer,stdout:"pipe",stderr:"pipe"})
  if (result.exitCode !== 0) throw new Error(`${argv.join(" ")}\n${result.stdout}\n${result.stderr}`)
  return result.stdout.toString()
}
run([process.execPath,join(root,"node_modules/typescript/bin/tsc"),"-p","tsconfig.json"])
const adoption = JSON.parse(run([process.execPath,"dist/apple/adoption-fixture.js"]))
const adoptionNode = JSON.parse(run([node,"--input-type=module","-e","import('./dist/apple/adoption-fixture.js').then(m=>m.runAdoptionFixture()).then(r=>console.log(JSON.stringify(r)))"]))
const apple = JSON.parse(run([process.execPath,"dist/apple/apple-experiment.js"]))
const result = {format:"published-upstream-consumer/1",observedAt:new Date().toISOString(),mode:offline?"retained-registry-tarballs":"public-registry-get",directory,consumer,version,packages,sources,dependencies:dependencies.map(({name,version,tarball})=>({name,version,sha256:tarball.sha256})),strictDeclarations:true,adoption,adoptionNode,apple,note:"The unchanged PR24-shaped research input protocol ran against actual registry-published 0.6.3 JS/declarations. Native Apple protocol doubles remain explicit; no credentialed Apple acceptance or full upstream publication certification is claimed."}
writeFileSync(offline ? join(directory,"published-consumer.json") : join(archive,"published-consumer.json"),JSON.stringify(result,null,2)+"\n")
console.log(JSON.stringify({directory,version,strictDeclarations:true,bunAdoption:adoption.passed,nodeAdoption:adoptionNode.passed,apple,packages:packages.map(p=>({name:p.name,sha256:p.tarball.sha256,bytes:p.tarball.bytes}))}))
