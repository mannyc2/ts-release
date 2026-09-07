import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { chmod, lstat, mkdir, mkdtemp, readFile, readlink, readdir, rm } from "node:fs/promises"
import { join } from "node:path"
import { Effect, Exit, Fiber, FileSystem, PlatformError } from "/tmp/ts-release-implementation/node_modules/effect/dist/index.js"
import * as BunServices from "/tmp/ts-release-implementation/node_modules/@effect/platform-bun/dist/BunServices.js"
import * as Artifact from "/tmp/ts-release-implementation/node_modules/effect-build/dist/Artifact.js"
import * as Tree from "/tmp/ts-release-implementation/node_modules/effect-build/dist/Author/Tree.js"
import { adoptTree, restoreTree } from "/tmp/ts-release-implementation/packages/ts-release/src/EffectBuild.ts"
import { finalize } from "/tmp/ts-release-implementation/packages/ts-release/src/Bundle.ts"
import { treeManifest } from "/tmp/ts-release-implementation/packages/ts-release/src/internal/TreeManifest.ts"
import { fileContentOwner, nodeDirectoryReader } from "/tmp/ts-release-implementation/packages/ts-release/src/Node.ts"

const root = await mkdtemp("/tmp/ts-release-restore-closure-review-")
const work = join(root,"work")
const run = effect => Effect.runPromise(effect.pipe(Effect.provide(BunServices.layer)))
const logs: string[] = []
const removable = async (entry:string):Promise<void> => {
  const info = await lstat(entry)
  if (!info.isDirectory() || info.isSymbolicLink()) return
  await chmod(entry,0o700)
  for (const name of await readdir(entry)) await removable(join(entry,name))
}
try {
  await mkdir(work)
  const owner = fileContentOwner(join(root,"objects"),nodeDirectoryReader(process.env.TS_RELEASE_HTTP_PEER_NODE!))
  const provenance = Artifact.intrinsicProvenance("restore-review-original")
  const native = await run(Tree.publish({outdir:join(root,"original"),observation:"hashed",provenance},candidate=>Effect.gen(function*(){
    const fs = yield* FileSystem.FileSystem
    yield* fs.makeDirectory(join(candidate,"data"))
    yield* fs.writeFileString(join(candidate,"data/payload"),"exact restoration bytes")
    yield* fs.chmod(join(candidate,"data/payload"),0o444)
    yield* fs.symlink("data/payload",join(candidate,"link"))
    yield* fs.symlink("data",join(candidate,"dir-link"))
    yield* fs.symlink("link",join(candidate,"chain"))
    yield* fs.chmod(join(candidate,"data"),0o555)
  })))
  const owned = await run(adoptTree(owner,"owned",native))
  await removable(native.root)
  await rm(native.root,{recursive:true})
  const restored = await run(restoreTree(owner,owned,join(work,"success"),provenance))
  assert.equal(restored.manifestDigest.value,owned.upstreamManifestSha256)
  assert.equal(Artifact.isHashedTree(restored),true)
  await run(Tree.withVerifiedSnapshot(restored,()=>Effect.void))
  assert.equal((await lstat(join(restored.root,"data"))).mode & 0o777,0o555)
  assert.equal((await lstat(join(restored.root,"data/payload"))).mode & 0o777,0o444)
  for (const [name,target] of [["link","data/payload"],["dir-link","data"],["chain","link"]]) assert.equal(await readlink(join(restored.root,name)),target)
  assert.equal(await readFile(join(restored.root,"chain"),"utf8"),"exact restoration bytes")
  logs.push("Public restoration preserves file bytes/modes, readonly nested mode0555, and file/directory/chained symlinks after original source deletion")
  await removable(restored.root); await rm(restored.root,{recursive:true})

  const treeAlias = JSON.parse(JSON.stringify(owned)), provenanceAlias = {...provenance}
  let originalReads = 0, replacementReads = 0
  const mutableOwner = {
    ...owner,
    read: content=>{originalReads++;return owner.read(content)},
    verify: content=>{
      treeAlias.entries = []
      provenanceAlias.producer = "changed-after-start"
      mutableOwner.read = () => {replacementReads++;return Effect.fail(new Error("replacement should not run"))}
      return owner.verify(content)
    },
  }
  const captured = await run(restoreTree(mutableOwner,treeAlias,join(work,"captured"),provenanceAlias))
  assert.equal(captured.manifestDigest.value,owned.upstreamManifestSha256)
  assert.equal(captured.provenance.producer,"restore-review-original")
  assert.equal(originalReads,1); assert.equal(replacementReads,0)
  logs.push("OwnedTree, provenance, and owner methods remain captured across mutable caller replacements")
  await removable(captured.root); await rm(captured.root,{recursive:true})

  const corrupt = {...owner,read:content=>owner.read(content).pipe(Effect.map(bytes=>new Uint8Array(bytes.length).fill(120)))}
  const corrupted = await run(Effect.exit(restoreTree(corrupt,owned,join(work,"corrupt"),provenance)))
  assert.equal(Exit.isFailure(corrupted),true)
  assert.deepEqual(await readdir(work),[])
  logs.push("Same-size corrupt reader fails before commit and removes candidate")

  const divergent = await run(Effect.exit(Effect.gen(function*(){
    const fs = yield* FileSystem.FileSystem
    return yield* restoreTree(owner,owned,join(work,"divergent"),provenance).pipe(Effect.provideService(FileSystem.FileSystem,{
      ...fs,
      chmod:(name,mode)=>fs.chmod(name,mode).pipe(Effect.andThen(
        name.split("/").at(-1)!.startsWith(".effect-build-tree-candidate-") && mode===0o755
          ? fs.writeFileString(join(name,"unexpected-file"),"candidate divergence")
          : Effect.void,
      )),
    }))
  })))
  assert.equal(Exit.isFailure(divergent),true)
  assert.deepEqual(await readdir(work),[])
  logs.push("A fully captured but divergent candidate is rejected by inspection before destination commit")

  const lateFailure = await run(Effect.exit(Effect.gen(function*(){
    const fs = yield* FileSystem.FileSystem
    return yield* restoreTree(owner,owned,join(work,"late-failure"),provenance).pipe(Effect.provideService(FileSystem.FileSystem,{
      ...fs,
      chmod:(name,mode)=>fs.chmod(name,mode).pipe(Effect.andThen(
        name.endsWith("/data") && mode===0o555
          ? Effect.fail(PlatformError.badArgument({module:"review",method:"chmod",description:"injected after readonly chmod"}))
          : Effect.void,
      )),
    }))
  })))
  assert.equal(Exit.isFailure(lateFailure),true)
  assert.deepEqual(await readdir(work),[])
  logs.push("Failure after readonly chmod leaves no destination or private candidate")

  let reached!:()=>void
  const entered = new Promise<void>(resolve=>{reached=resolve})
  const fiber = Effect.runFork(Effect.gen(function*(){
    const fs = yield* FileSystem.FileSystem
    return yield* restoreTree(owner,owned,join(work,"interrupted"),provenance).pipe(Effect.provideService(FileSystem.FileSystem,{
      ...fs,
      chmod:(name,mode)=>fs.chmod(name,mode).pipe(Effect.andThen(
        name.endsWith("/data") && mode===0o555
          ? Effect.sync(reached).pipe(Effect.andThen(Effect.never))
          : Effect.void,
      )),
    }))
  }).pipe(Effect.provide(BunServices.layer)))
  await entered
  await Effect.runPromise(Fiber.interrupt(fiber))
  assert.equal(Exit.isFailure(await Effect.runPromise(Fiber.await(fiber))),true)
  assert.deepEqual(await readdir(work),[])
  logs.push("Interruption after readonly chmod awaits cleanup and leaves no destination or private candidate")

  const differentRoot = {...owned,rootMode:0o555}
  const unsupported = {...differentRoot,upstreamManifestSha256:createHash("sha256").update(treeManifest(differentRoot)).digest("hex")}
  await run(finalize([unsupported]))
  const unsupportedResult = await run(Effect.exit(restoreTree(owner,unsupported,join(work,"unsupported"),provenance)))
  assert.equal(Exit.isFailure(unsupportedResult),true)
  assert.deepEqual(await readdir(work),[])
  logs.push("Self-consistent unsupported root0555 rejects without committing divergent tree")
  console.log(JSON.stringify({uid:process.getuid!(),logs},null,2))
} finally {
  await removable(root)
  await rm(root,{recursive:true,force:true})
}
