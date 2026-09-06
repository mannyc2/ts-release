import { strict as assert } from "node:assert"
import { createHash } from "node:crypto"
import { chmodSync, copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect, FileSystem, Schema } from "effect"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Artifact from "effect-build/Artifact"
import * as File from "effect-build/Author/File"
import * as Tree from "effect-build/Author/Tree"
import { adoptFile, adoptTree, finalize, Content, OwnedBundle, type OwnedArtifact } from "./adoption.js"
import { fileContentOwner } from "./content-owner.js"
import { encodeBundle, loadBundle, restoreTree } from "./bundle-codec.js"

export const runAdoptionFixture = async () => {
  const root = mkdtempSync(join(tmpdir(), "owned-adoption-fixture-"))
  const checks: string[] = []
  const skippedChecks:string[]=[]
  let selectedProduct:unknown={available:false}
  const owner = fileContentOwner(join(root,"objects"))
  const run = <A,E,R>(effect:Effect.Effect<A,E,R>) => Effect.runPromise(effect.pipe(Effect.provide(NodeServices.layer)) as Effect.Effect<A,E>)
  const reject = async (name:string,operation:Promise<unknown>) => { await assert.rejects(operation); checks.push(name) }
  try {
    const provenance = Artifact.intrinsicProvenance("research-fixture/source-bytes")
    const file = await run(File.publish({destination:join(root,"producer.txt"),observation:"hashed",provenance}, (candidate) =>
      Effect.gen(function*(){ const fs=yield* FileSystem.FileSystem; yield* fs.writeFileString(candidate,"owned bytes") })))
    const owned = await run(adoptFile(owner,"file.txt",file))
    assert.equal(owned.content.bytes,"11"); checks.push("real-finalizer-file-adoption")
    assert.equal(owned.deliveryMode,0o644);assert.equal(owned.executable,null);assert.deepEqual(owned.provenance,provenance)
    checks.push("ordinary-file-delivery-mode-and-native-provenance-retained")
    const tree = await run(Tree.publish({outdir:join(root,"producer-tree"),observation:"hashed",provenance}, (candidate) =>
      Effect.gen(function*(){
        const fs=yield* FileSystem.FileSystem
        yield* fs.makeDirectory(join(candidate,"bin"))
        yield* fs.chmod(join(candidate,"bin"),0o750)
        yield* fs.writeFileString(join(candidate,"bin","run"),"owned bytes")
        yield* fs.chmod(join(candidate,"bin","run"),0o755)
        yield* fs.writeFileString(join(candidate,"copy"),"owned bytes")
        yield* fs.symlink("bin/run",join(candidate,"link"))
      })))
    const ownedTree = await run(adoptTree(owner,"tree",tree))
    assert.equal(ownedTree.rootMode,0o755)
    assert.equal(ownedTree.totalBytes,"22")
    assert.equal(ownedTree.entries.find(e=>e.relativePath==="bin")?._tag,"TreeDirectory")
    const binary=ownedTree.entries.find(e=>e.relativePath==="bin/run")
    assert.equal(binary?._tag,"TreeFile")
    if (binary?._tag==="TreeFile") assert.equal(binary.mode,0o755)
    const directory=ownedTree.entries.find(e=>e.relativePath==="bin")
    if (directory?._tag==="TreeDirectory") assert.equal(directory.mode,0o750)
    const link=ownedTree.entries.find(e=>e.relativePath==="link")
    assert.equal(link?._tag,"TreeLink")
    if (link?._tag==="TreeLink") assert.equal(link.target,"bin/run")
    assert.equal(readdirSync(join(root,"objects")).length,1)
    checks.push("real-tree-finalizer-and-verified-snapshot","root-directory-executable-modes","symlink-preserved-not-followed","shared-content-distinct-entries")
    const expectedManifest = JSON.stringify({rootMode:tree.rootMode,totalBytes:tree.totalBytes,entries:tree.entries})
    const hash = createHash("sha256").update(expectedManifest).digest("hex")
    assert.equal(hash,tree.manifestDigest.value)
    checks.push("exact-upstream-manifest-vector")
    const caller:OwnedArtifact[]=[owned,ownedTree]
    const bundle=await run(finalize(caller))
    caller.splice(0)
    assert.equal(bundle.artifacts.length,2)
    checks.push("finalization-severs-caller-array-alias")
    assert.equal(Reflect.set(bundle.artifacts[1]!,"logicalName","changed"),false)
    assert.equal(Reflect.set(bundle.artifacts,"length",0),false)
    checks.push("finalized-artifact-and-container-frozen")
    const persisted=JSON.stringify(Schema.encodeSync(OwnedBundle)(bundle))
    assert.equal(persisted.includes(root),false)
    writeFileSync(join(root,"bundle.json"),persisted)
    const restored=Schema.decodeUnknownSync(OwnedBundle)(JSON.parse(readFileSync(join(root,"bundle.json"),"utf8")))
    assert.equal(restored.artifacts.length,2)
    checks.push("path-free-durable-roundtrip")
    const loaded=await run(loadBundle(owner,encodeBundle(bundle)))
    assert.equal(loaded.artifacts.length,2)
    const restoredTree=await run(restoreTree(owner,ownedTree,join(root,"restored-tree"),provenance))
    assert.equal(restoredTree.manifestDigest.value,tree.manifestDigest.value)
    checks.push("strict-durable-bundle-load-and-real-tree-restore")
    const corrupted=(change:(value:any)=>void)=>{
      const value=JSON.parse(new TextDecoder().decode(encodeBundle(bundle)));change(value)
      return encodeBundle(Schema.decodeUnknownSync(OwnedBundle)(value))
    }
    await reject("durable-mode-tamper-rejected",run(loadBundle(owner,corrupted(value=>{value.artifacts[1].entries.find((entry:any)=>entry._tag==="TreeFile").mode=0o600}))))
    await reject("durable-manifest-tamper-rejected",run(loadBundle(owner,corrupted(value=>{value.artifacts[1].upstreamManifestSha256="0".repeat(64)}))))
    await reject("durable-escaping-symlink-rejected",run(loadBundle(owner,corrupted(value=>{value.artifacts[1].entries.find((entry:any)=>entry._tag==="TreeLink").target="../../outside"}))))
    await reject("durable-cyclic-symlink-rejected",run(loadBundle(owner,corrupted(value=>{value.artifacts[1].entries.find((entry:any)=>entry._tag==="TreeLink").target="link"}))))
    await reject("durable-duplicate-entry-rejected",run(loadBundle(owner,corrupted(value=>{value.artifacts[1].entries.push(value.artifacts[1].entries[0])}))))
    await reject("durable-duplicate-key-rejected",run(loadBundle(owner,new TextEncoder().encode(new TextDecoder().decode(encodeBundle(bundle)).replace('"format":','"format":"discarded","format":')))))
    const oversized={...tree,totalBytes:Artifact.decimalBytes("9007199254740993"),entries:[{kind:"file" as const,relativePath:Artifact.portableRelativePath("huge"),mode:Artifact.fileMode(0o600),bytes:Artifact.decimalBytes("9007199254740993"),digest:Artifact.sha256Digest("0".repeat(64))}]}
    const over=await Effect.runPromise(adoptTree(owner,"oversized",oversized).pipe(Effect.catch(error=>Effect.succeed(error))) as Effect.Effect<unknown>)
    assert.equal((over as {reason?:string}).reason?.includes("snapshot capacity"),true)
    checks.push("tree-capacity-overflow-rejected-before-filesystem-layer-or-allocation")
    const actualProduct="/mnt/models/dev/ts-release/.release/pypi-real-NrE6Nc/inputs/linux-x64"
    if(existsSync(actualProduct)){
      const native=await run(File.publish({destination:join(root,"real-95mb-product"),observation:"hashed",provenance},candidate=>Effect.sync(()=>copyFileSync(actualProduct,candidate))))
      const transferred=await run(adoptFile(owner,"real-linux-x64",native))
      assert.equal(transferred.content.bytes,"95971456")
      selectedProduct={available:true,path:actualProduct,bytes:native.bytes,sha256:native.digest.value,provenance:"Existing local .release artifact; this does not independently qualify its compiler or native signing lineage"}
      await run(loadBundle(owner,encodeBundle(await run(finalize([transferred])))))
      checks.push("actual-95971456-byte-selected-product-streaming-adoption-and-load")
    }else skippedChecks.push(`Selected-product-size qualification requires existing input ${actualProduct}`)
    chmodSync(file.path,0o600); writeFileSync(file.path,"evil bytes!")
    await reject("producer-file-tamper-rejected",run(adoptFile(owner,"other.txt",file)))
    assert.equal(new TextDecoder().decode(await run(owner.read(owned.content))),"owned bytes")
    checks.push("producer-mutation-cannot-change-owned-content")
    const alias=await run(owner.read(owned.content)); alias.fill(0)
    assert.equal(new TextDecoder().decode(await run(owner.read(owned.content))),"owned bytes")
    checks.push("reader-mutation-cannot-change-owned-content")
    await reject("duplicate-logical-identity-rejected",run(finalize([owned,owned])))
    await reject("case-colliding-logical-identity-rejected",run(finalize([owned,{...owned,logicalName:Artifact.portableRelativePath("FILE.txt")}])))
    await reject("unsafe-logical-name-rejected",run(adoptTree(owner,"../tree",tree)))
    await reject("false-unbounded-byte-count-rejected",run(adoptFile(owner,"huge",{...file,bytes:Artifact.decimalBytes("9007199254740993")})))
    const large=new Content({bytes:"9007199254740993",sha256:"0".repeat(64)})
    assert.equal(Schema.decodeUnknownSync(Content)(Schema.encodeSync(Content)(large)).bytes,"9007199254740993")
    checks.push("unbounded-decimal-codec-without-number-narrowing")
    await reject("tree-manifest-tamper-rejected",run(adoptTree(owner,"bad-tree",{...tree,manifestDigest:Artifact.sha256Digest("0".repeat(64))})))
    await reject("tree-entry-mode-forgery-rejected",run(adoptTree(owner,"bad-tree",{...tree,entries:tree.entries.map(entry=>entry.kind==="file"?{...entry,mode:Artifact.fileMode(0o600)}:entry)})))
    await reject("tree-duplicate-entry-rejected",run(adoptTree(owner,"bad-tree",{...tree,entries:[...tree.entries,tree.entries[0]!]})))
    await reject("escaping-tree-symlink-rejected",run(Tree.publish({outdir:join(root,"escaping"),observation:"hashed",provenance}, candidate=>
      Effect.gen(function*(){const fs=yield* FileSystem.FileSystem;yield* fs.symlink("../outside",join(candidate,"escape"))}))))
    chmodSync(join(root,"producer-tree","bin","run"),0o600)
    writeFileSync(join(root,"producer-tree","bin","run"),"different")
    await reject("producer-tree-tamper-rejected",run(adoptTree(owner,"changed-tree",tree)))
    writeFileSync(join(root,"producer-tree","bin","run"),new Uint8Array(128*1024))
    const grown=await run(adoptTree(owner,"grown-tree",tree).pipe(Effect.catch(error=>Effect.succeed(error))))
    assert.equal((grown as {reason?:string}).reason?.includes("byte budget"),true)
    checks.push("tampered-growing-tree-read-stops-at-declared-budget")
    chmodSync(join(root,"objects",owned.content.sha256),0o600)
    writeFileSync(join(root,"objects",owned.content.sha256),"corrupt")
    await reject("owned-store-tamper-rejected",run(owner.read(owned.content)))
    return {schema:"adoption-experiment/1",checks,passed:checks.length,skippedChecks,selectedProduct,nativeAppleAcceptance:false,source:"real emitted PR24 effect-build package"}
  } finally { rmSync(root,{recursive:true,force:true}) }
}
if (import.meta.main) console.log(JSON.stringify(await runAdoptionFixture(),null,2))
