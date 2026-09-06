import { strict as assert } from "node:assert"
import { createHash } from "node:crypto"
import { mkdtemp, mkdir, readFile, writeFile, cp, unlink } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "../../../node_modules/typescript/lib/typescript.js"
import { buildLayout, compileConsumer, layouts, sourceSet } from "./build.mjs"
import { bun, command, files, hash, install, inventory, json, node, pack, packRuntimeDependencies, repository } from "./pack.mjs"
import { writeEvidence } from "./evidence.mjs"

const here = dirname(fileURLToPath(import.meta.url))
export const work = await mkdtemp("/tmp/ts-release-topology-")
console.log(`Topology artifacts: ${work}`)
const executedFiles=["run.mjs","build.mjs","pack.mjs","registry.mjs","fixture-server.mjs","trace-loader.mjs","evidence.mjs","consumer.ts","owned-consumer.ts","lifecycle-consumer.ts","abort-consumer.ts"]
const executedInputs=await Promise.all(executedFiles.map(async path=>({path,sha256:hash(await readFile(join(here,path)))})))
const adoptionFixtureSource=await readFile(join(repository,"tools/architecture-lab/apple/adoption-fixture.ts"),"utf8")
const receipt = JSON.parse(await readFile(join(repository, "tools/architecture-lab/apple/upstream-build.json"), "utf8"))
const upstream = process.env.LAB_UPSTREAM ?? receipt.stage
const upstreamRoot = join(upstream, "packages/effect-build")
const upstreamPack = { name: "effect-build", tarball: { path: join(upstream, "artifacts/effect-build-0.6.0.tgz") } }
const runtime = await packRuntimeDependencies(join(work, "dependencies"), ["effect", "@effect/platform-node"])
const source = process.env.LAB_SOURCE_SNAPSHOT
  ? JSON.parse(await readFile(process.env.LAB_SOURCE_SNAPSHOT,"utf8")) : await sourceSet()
if(!process.env.LAB_SOURCE_SNAPSHOT)assert.equal(JSON.stringify(source),JSON.stringify(await sourceSet()),"Source changed during snapshot; retry after freeze")
await writeFile(join(work,"sources.json"),json(source))
const fixture = Bun.spawn([node, join(here, "fixture-server.mjs")], { stdout: "pipe", stderr: "pipe" })
const first = await fixture.stdout.getReader().read()
if (first.done) throw Error(`Fixture failed: ${await new Response(fixture.stderr).text()}`)
const endpoint = `http://127.0.0.1:${JSON.parse(new TextDecoder().decode(first.value)).port}`
const result = {
  format: "real-source-topology/1", work, sourceSnapshot:process.env.LAB_SOURCE_SNAPSHOT??"current-canonical-lab-source", sourceSha256:hash(json(source)), runtimes: { bun: command([bun, "--version"], work).trim(), node: command([node, "--version"], work).trim() },
  method: "Strict tsc emits JS and d.ts from canonical source, Bun packs, loopback registry serves exact tarballs, Bun fresh installs with copied files, consumers execute admitted Node and Bun.",
  scope: "Research protocols; no real registry credentials, remote publish, production CLI option parity, platform binaries, or security audit claim.",
  upstream: receipt, dependencies: runtime.map(({ name, version, tarball }) => ({ name, version, ...tarball })), layouts: []
}

function project(text, layout) {
  return text.replaceAll('"@lab/kernel"', JSON.stringify(layout.kernel)).replaceAll('"@lab/npm/owned"', JSON.stringify(`${layout.npm}/owned`)).replaceAll('"@lab/npm"', JSON.stringify(layout.npm)).replaceAll('"@lab/python"', JSON.stringify(layout.python))
}
const state = () => fetch(`${endpoint}/__state`).then(r => r.json())
const fixtureRoot = join(work, "artifact-input")
await mkdir(fixtureRoot)
await writeFile(join(fixtureRoot, "package.json"), json({ name: "fixture", version: "1.0.0", type: "module", files: ["index.js"] }))
await writeFile(join(fixtureRoot, "index.js"), "export const fixture = true\n")
const npmArtifact = await pack(fixtureRoot, join(work, "artifact-packs"))
await mkdir(join(fixtureRoot, "fixture-1.0.0"))
await writeFile(join(fixtureRoot, "fixture-1.0.0/PKG-INFO"), "Metadata-Version: 2.1\nName: fixture\nVersion: 1.0.0\n\nResearch fixture.\n")
const pythonPath = join(work, "fixture-1.0.0.tar.gz")
command(["tar", "-czf", pythonPath, "fixture-1.0.0"], fixtureRoot)
const npmBytes = await readFile(npmArtifact.path)
const pythonBytes = await readFile(pythonPath)

async function scenario(root, layoutId, runtimeName, candidate, mode, kinds = ["npm", "python"], instances = 2, fault) {
  const id = `${layoutId}-${runtimeName}-${candidate}-${mode}-${kinds.join("-")}-${instances}${fault?`-${fault}`:""}`.toLowerCase()
  const directory = join(root, id)
  await mkdir(directory)
  const remote = join(directory, "remote.git")
  command(["git", "init", "--bare", "--quiet", remote], directory)
  const input = {
    endpoint, prefix: id, kinds, instances, tarballBase64: npmBytes.toString("base64"), integrity: `sha512-${createHash("sha512").update(npmBytes).digest("base64")}`,
    pythonBase64: pythonBytes.toString("base64"), pythonSha256: hash(pythonBytes),
    planFile: join(directory, "plan.json"), storeDirectory: join(directory, "store"), remote,
    store: runtimeName === "bun" ? "sqlite" : "git", candidate, authorize: true, observe: true
  }
  await writeFile(join(directory, "input.json"), json(input))
  const inputFile = join(directory, "input.json")
  const runner = runtimeName === "bun" ? bun : node
  const app = join(root, "application.js")
  const driver = mode === "cli" ? [join(root, "node_modules/.bin/release-lab"), app, inputFile]
    : ["--input-type=module", "-e", mode === "action"
      ? `import{readFile}from"node:fs/promises";import{runAction}from"@lab/host";console.log(JSON.stringify((await runAction({application:${JSON.stringify(app)},input:JSON.parse(await readFile(${JSON.stringify(inputFile)},"utf8"))})).report))`
      : `import{readFile}from"node:fs/promises";import{library}from"./application.js";console.log(JSON.stringify(await library(JSON.parse(await readFile(${JSON.stringify(inputFile)},"utf8")))))`]
  const before = (await state()).calls.length
  if(fault==="lose")await fetch(`${endpoint}/__lose-next`)
  const trace = join(directory, "trace.jsonl")
  const env = { ...process.env, LAB_TRACE: trace }
  const traceFlags = runtimeName === "node" ? ["--no-warnings", "--experimental-loader", join(here, "trace-loader.mjs")] : []
  const first = JSON.parse(command([runner, ...traceFlags, ...driver], root, { env }))
  const afterFirst = (await state()).calls.length
  assert.equal(first.operations.length, kinds.length * instances)
  assert(first.operations.every(operation => (fault!==undefined||operation.status === "Satisfied") && operation.dispatches === 1))
  const second = JSON.parse(command([runner, ...driver], root))
  const afterSecond = (await state()).calls.length
  assert.equal(afterFirst - before, kinds.length * instances)
  assert.equal(afterSecond, afterFirst, "Fresh process must not send completed operations again")
  assert(second.operations.every(operation=>operation.status==="Satisfied"))
  if(fault===undefined)assert.deepEqual(second.operations.map(({operationId,status,dispatches})=>({operationId,status,dispatches})), first.operations.map(({operationId,status,dispatches})=>({operationId,status,dispatches})))
  const runtimeTrace = runtimeName === "node" ? (await readFile(trace, "utf8")).trim().split("\n").map(JSON.parse).map(edge => Object.fromEntries(Object.entries(edge).map(([key,value])=>[key,typeof value === "string" ? value.replaceAll(root,"<consumer>") : value]))) : []
  let dispatchErrors=[]
  if(fault!==undefined){
    const events=JSON.parse(command([runner,"--input-type=module","-e",`import{readFile}from"node:fs/promises";import{Effect}from"effect";import{createApplication}from"./application.js";const input=JSON.parse(await readFile(${JSON.stringify(inputFile)},"utf8"));console.log(JSON.stringify(await Effect.runPromise(Effect.scoped(Effect.gen(function*(){const app=yield*createApplication(input);return(yield*app.host.store.read(app.options.plan.journalId)).events})))))`],root))
    dispatchErrors=events.filter(event=>event.body._tag==="ObservationRecorded"&&event.body.evidenceKind==="DispatchError").map(event=>event.body)
    assert.equal(dispatchErrors.length,1,"Actual lost HTTP acknowledgement must retain a durable dispatch error")
  }
  return { id, mode, runtime: runtimeName, candidate, store: input.store, operations: first.operations, sends: afterFirst - before, sendsAfterRestart: afterSecond - afterFirst, runtimeTrace,fault,dispatchErrors }
}

async function inspectSurface(root, built) {
  const surfaces = []
  for (const item of built) for (const [subpath, declared] of Object.entries(item.surfaces)) {
    const specifier = item.name + (subpath === "." ? "" : subpath.slice(1))
    const runner = specifier.endsWith("/sqlite") ? bun : node
    const values = JSON.parse(command([runner, "--input-type=module", "-e", `console.log(JSON.stringify(Object.keys(await import(${JSON.stringify(specifier)})).sort()))`], root))
    const target = join(root,"node_modules",item.name,item.manifest.exports[subpath].types)
    const program = ts.createProgram([target], {module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext})
    const checker = program.getTypeChecker()
    const symbol = checker.getSymbolAtLocation(program.getSourceFile(target))
    const expected = checker.getExportsOfModule(symbol).filter(value => {
      const actual = value.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(value) : value
      return !!(actual.flags & ts.SymbolFlags.Value)
    }).map(value=>value.name).sort()
    assert.deepEqual(values, expected, `Runtime/type value exports differ for ${specifier}`)
    surfaces.push({specifier, runtimeValues: values, declarationSymbols: declared.symbols, declarationFiles:program.getSourceFiles().filter(file=>file.fileName.includes("node_modules/@lab/")).map(file=>file.fileName.replace(root,"<consumer>")).sort()})
  }
  return surfaces
}

async function ownedScenario(root,layoutId,runtimeName) {
  await compileConsumer(root,project(await readFile(join(here,"owned-consumer.ts"),"utf8"),layouts[layoutId]),"owned-application.ts")
  const directory=join(root,`owned-${runtimeName}`);await mkdir(directory)
  const remote=join(directory,"remote.git");command(["git","init","--bare","--quiet",remote],directory)
  const artifactPath=join(directory,"input.tgz");await cp(npmArtifact.path,artifactPath)
  const input={directory,remote,endpoint,name:`owned-${layoutId}-${runtimeName}`.toLowerCase(),artifactPath}
  const inputFile=join(directory,"input.json");await writeFile(inputFile,json(input))
  const args=[runtimeName==="node"?node:bun,join(root,"node_modules/.bin/release-lab"),join(root,"owned-application.js"),inputFile]
  const before=(await state()).calls.length
  const first=JSON.parse(command(args,root))
  assert.equal(first.operations[0].status,"Satisfied");assert.equal(first.operations[0].dispatches,1)
  await unlink(artifactPath)
  const second=JSON.parse(command(args,root))
  assert.equal(second.operations[0].status,"Satisfied");assert.equal(second.operations[0].dispatches,1)
  assert.equal((await state()).calls.length-before,1)
  const planText=await readFile(join(directory,"plan.json"),"utf8")
  const plan=JSON.parse(planText)
  assert(!planText.includes(directory));assert(!planText.includes("tarballBase64"))
  assert.deepEqual(plan.operations[0].intent.content,{bytes:String(npmBytes.length),sha256:hash(npmBytes)})
  return {runtime:runtimeName,bundleId:plan.bundleId,planId:plan.planId,content:plan.operations[0].intent.content,sends:1,restartSends:0,producerPathsDeleted:true,pathFreePlan:true,embeddedArtifactBytes:false}
}

async function abortScenario(root,layoutId,runtimeName) {
  const template=JSON.parse(await readFile(join(root,`${layoutId}-${runtimeName}-M1-cli-npm-1-lose`.toLowerCase(),"input.json"),"utf8"))
  const directory=join(root,`abort-${runtimeName}`);await mkdir(directory)
  const remote=join(directory,"remote.git");command(["git","init","--bare","--quiet",remote],directory)
  const input={...template,prefix:`abort-${layoutId}-${runtimeName}`.toLowerCase(),remote,storeDirectory:join(directory,"store"),planFile:join(directory,"plan.json"),observe:false}
  const inputFile=join(directory,"input.json");await writeFile(inputFile,json(input))
  const runner=runtimeName==="node"?node:bun
  const before=(await state()).calls.length
  const interrupted=JSON.parse(command([runner,join(root,"abort.js"),inputFile],root))
  assert.equal((await state()).calls.length-before,1)
  await writeFile(inputFile,json({...input,observe:true}))
  const resumed=JSON.parse(command([runner,join(root,"node_modules/.bin/release-lab"),join(root,"application.js"),inputFile],root))
  assert.equal((await state()).calls.length-before,1)
  assert.equal(resumed.operations[0].status,"Satisfied");assert.equal(resumed.operations[0].dispatches,1)
  return {runtime:runtimeName,...interrupted,restartSends:0,restartStatus:resumed.operations[0].status}
}

try {
  for (const layoutId of Object.keys(layouts)) {
    console.log(`${layoutId}: source compile and pack`)
    const build = await buildLayout(layoutId, join(work, layoutId), source, upstreamRoot)
    const consumer = join(work, layoutId, "consumer")
    await install(consumer, [...build.built, upstreamPack], runtime,["effect","@effect/platform-node",...build.built.map(p=>p.name),"effect-build"])
    const installed = await inventory(join(consumer, "node_modules/@lab"))
    assert(installed.every(entry => !entry.path.endsWith(".ts") || entry.path.endsWith(".d.ts")))
    await compileConsumer(consumer, project(await readFile(join(here, "consumer.ts"), "utf8"), layouts[layoutId]))
    const scenarios = []
    for (const runtimeName of ["node", "bun"]) for (const candidate of ["M1", "M2"]) {
      for (const mode of ["library", "cli", "action"]) scenarios.push(await scenario(consumer, layoutId, runtimeName, candidate, mode))
      scenarios.push(await scenario(consumer, layoutId, runtimeName, candidate, "cli", ["external"], 2))
      scenarios.push(await scenario(consumer,layoutId,runtimeName,candidate,"cli",["npm"],1,"lose"))
    }
    console.log(`${layoutId}: ${scenarios.length} consumer scenarios passed; checking exports`)
    const surfaces = await inspectSurface(consumer, build.built)
    const ownedScenarios=[]
    if(source.own["npm-owned.ts"])for(const runtime of ["node","bun"])ownedScenarios.push(await ownedScenario(consumer,layoutId,runtime))
    const adoptionText=adoptionFixtureSource.replaceAll('"./adoption.js"','"@lab/host/adoption"').replaceAll('"./content-owner.js"','"@lab/host/content-owner"').replaceAll('"./bundle-codec.js"','"@lab/host/bundle-codec"')
    await compileConsumer(consumer,adoptionText,"baseline-adoption.ts")
    const baselineAdoption=[node,bun].map(runner=>({runtime:runner===node?"node":"bun",result:JSON.parse(command([runner,"--input-type=module","-e",'import{runAdoptionFixture}from"./baseline-adoption.js";console.log(JSON.stringify(await runAdoptionFixture()))'],consumer))}))
    await compileConsumer(consumer,project(await readFile(join(here,"lifecycle-consumer.ts"),"utf8"),layouts[layoutId]),"lifecycle.ts")
    const lifecycle=[node,bun].map(runner=>({runtime:runner===node?"node":"bun",result:JSON.parse(command([runner,"--input-type=module","-e",'import{runLifecycleFixture}from"./lifecycle.js";console.log(JSON.stringify(await runLifecycleFixture()))'],consumer))}))
    await compileConsumer(consumer,project(await readFile(join(here,"abort-consumer.ts"),"utf8"),layouts[layoutId]),"abort.ts")
    const interruptions=[]
    for(const runtime of ["node","bun"])interruptions.push(await abortScenario(consumer,layoutId,runtime))
    const selective = join(work, layoutId, "selective")
    const npmPackage = layouts[layoutId].providerPackages[0]
    await install(selective, build.built, runtime, [npmPackage])
    await compileConsumer(selective, project('import{npm}from"@lab/npm";console.log(npm.definitionId)\n', layouts[layoutId]), "selective.ts")
    const bundle = await Bun.build({ entrypoints:[join(selective,"selective.js")], target:"node", minify:true, outdir:join(selective,"bundle"), metafile:true })
    assert(bundle.success)
    const bundleBytes = await bundle.outputs[0].text()
    assert(!bundleBytes.includes("python.upload-file"))
    assert.equal(command([node,bundle.outputs[0].path],selective).trim(),"npm.publish")
    const selectiveFiles = await inventory(join(selective,"node_modules/@lab"))
    const measured = {
      ...build, consumer, scenarios, surfaces,ownedScenarios,baselineAdoption,lifecycle,interruptions,
      selective:{ files:selectiveFiles,installedBytes:selectiveFiles.reduce((n,file)=>n+file.bytes,0),bundleBytes:Buffer.byteLength(bundleBytes),pythonProviderPresent:selectiveFiles.some(file=>/python/.test(file.path)),pythonProviderInBundle: false,metafile:bundle.metafile },
      packageGraph: build.built.map(item=>({name:item.name,private:item.manifest.private??false,dependencies:item.manifest.dependencies})),
      publishedBytes:build.built.filter(item=>!item.manifest.private && item.name!=="@lab/external").reduce((n,item)=>n+item.tarball.bytes,0)
    }
    result.layouts.push(measured)
    await writeFile(join(work, "results.json"), json(result))
    console.log(`${layoutId}: public pack bytes ${measured.publishedBytes}; selective installed own bytes ${measured.selective.installedBytes}; bundled ${measured.selective.bundleBytes}`)
  }
  result.protocolState = await state()
  result.harness=executedInputs
  result.adoptionFixtureSha256=hash(adoptionFixtureSource)
  assert.deepEqual(executedInputs,await Promise.all(executedFiles.map(async path=>({path,sha256:hash(await readFile(join(here,path)))}))),"Executed tooling changed during trial")
  if(!process.env.LAB_SOURCE_SNAPSHOT)assert.equal(JSON.stringify(source),JSON.stringify(await sourceSet()),"Canonical source changed during trial")
  await writeEvidence(join(here, "results.json"), result)
  console.log(`PASS: ${result.layouts.reduce((n,layout)=>n+layout.scenarios.length,0)} source-packed consumers; results ${join(here,"results.json")}`)
} finally { fixture.kill(); await fixture.exited }
