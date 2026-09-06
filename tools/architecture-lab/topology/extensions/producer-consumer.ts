import { strict as assert } from "node:assert"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect, FileSystem } from "effect"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Artifact from "effect-build/Artifact"
import * as File from "effect-build/Author/File"
import * as Tree from "effect-build/Author/Tree"
import { adoptFile, adoptTree, finalize } from "@lab/host/adoption"
import { encodeBundle, loadBundle, restoreTree } from "@lab/host/bundle-codec"
import { fileContentOwner } from "@lab/host/content-owner"

const phase=process.argv[2]??"after"
const root=await mkdtemp(join(tmpdir(),"producer-handoff-"))
const owner=fileContentOwner(join(root,"objects"))
const run=<A,E,R>(effect:Effect.Effect<A,E,R>)=>Effect.runPromise(effect.pipe(Effect.provide(NodeServices.layer)) as Effect.Effect<A,E>)
const encode=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value))
try {
  const provenance=Artifact.intrinsicProvenance("real-producer-handoff-fixture")
  const file=await run(File.publish({destination:join(root,"file"),observation:"hashed",provenance},candidate=>Effect.gen(function*(){const fs=yield* FileSystem.FileSystem;yield* fs.writeFileString(candidate,"file bytes")})))
  const tree=await run(Tree.publish({outdir:join(root,"tree"),observation:"hashed",provenance},candidate=>Effect.gen(function*(){const fs=yield* FileSystem.FileSystem;yield* fs.writeFileString(join(candidate,"binary"),"selected generation")})))
  const other=await run(Tree.publish({outdir:join(root,"other"),observation:"hashed",provenance},candidate=>Effect.gen(function*(){const fs=yield* FileSystem.FileSystem;yield* fs.writeFileString(join(candidate,"binary"),"different generation")})))
  const selectedTree=Artifact.adoptTree("selected-tree",tree)
  const selectedFile=Artifact.adoptFile("selected-file",file)
  if(phase==="before") {
    // Existing raw-artifact adoption has no serialized producer selection input.
    const adopted=await run(adoptTree(owner,selectedTree.logicalName,other))
    assert.equal(adopted.upstreamManifestSha256,selectedTree.manifestDigest.value,"Producer-selected generation must survive resolution")
  } else {
    const {adoptProducerHandoff}=await import("@lab/host/producer-handoff")
    await assert.rejects(run(adoptProducerHandoff(owner,encode(selectedTree),other)),{reason:/does not match resolved generation/})
    await assert.rejects(run(adoptProducerHandoff(owner,encode({...selectedFile,bytes:"999"}),file)),{reason:/does not match resolved generation/})
    await assert.rejects(run(adoptProducerHandoff(owner,encode({...selectedTree,protocol:"unknown"}),tree)))
    await assert.rejects(run(adoptProducerHandoff(owner,new TextEncoder().encode('{"kind":"bad","kind":"tree"}'),tree)),{reason:/duplicate keys/})
    const adoptedFile=await run(adoptProducerHandoff(owner,encode(selectedFile),file))
    const adoptedTree=await run(adoptProducerHandoff(owner,encode(selectedTree),tree))
    assert.equal(adoptedTree._tag,"OwnedTree")
    const bundle=await run(finalize([adoptedFile,adoptedTree]))
    const durable=encodeBundle(bundle)
    assert.equal(new TextDecoder().decode(durable).includes(root),false)
    await rm(tree.root,{recursive:true,force:true});await rm(file.path)
    const restored=await run(loadBundle(owner,durable))
    const ownedTree=restored.artifacts.find(artifact=>artifact._tag==="OwnedTree")!
    assert.equal(ownedTree._tag,"OwnedTree")
    if(ownedTree._tag!=="OwnedTree")throw Error("Missing owned tree")
    const native=await run(restoreTree(owner,ownedTree,join(root,"restored"),provenance))
    assert.equal(await readFile(join(native.root,"binary"),"utf8"),"selected generation")
    console.log(JSON.stringify({phase,checks:8,nativeProtocol:Artifact.adoptionProtocol,rejectsResolvedGenerationMismatch:true,producerPathsDeleted:true,restored:true}))
  }
} finally {await rm(root,{recursive:true,force:true})}
