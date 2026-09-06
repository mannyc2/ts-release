import { readFile, writeFile, unlink } from "node:fs/promises"
import { randomUUID, createHash } from "node:crypto"
import { Effect, FileSystem, Layer, Schema } from "effect"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Artifact from "effect-build/Artifact"
import * as File from "effect-build/Author/File"
import { LabError, Plan, createOperation, createPlan, hashCanonical, loadPlan } from "@lab/kernel"
import { ownedNpm, OwnedNpmIntent } from "@lab/npm/owned"
import { adoptFile, finalize, OwnedBundle } from "@lab/host/adoption"
import { fileContentOwner } from "@lab/host/content-owner"
import { encodeBundle, loadBundle } from "@lab/host/bundle-codec"
import { GitJournal } from "@lab/host/git"
import { httpTransport } from "@lab/host/http"

interface Input { readonly directory:string; readonly remote:string; readonly endpoint:string; readonly name:string; readonly artifactPath:string }
/** Actual upstream finalized file → owned Bundle → bound Plan → native send. */
export const createApplication = Effect.fn("Owned.createApplication")(function*(input:Input) {
  const owner=fileContentOwner(`${input.directory}/objects`)
  const provider=ownedNpm(content=>owner.read(content).pipe(Effect.mapError(error=>new LabError({code:"owned-content",message:error.reason}))))
  const existing=yield* Effect.promise(async()=>{try {return await readFile(`${input.directory}/bundle.json`,"utf8")}
  catch(error) {if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error}})
  const plan=yield* Effect.gen(function*() {
    const bundle=existing===undefined ? yield* Effect.gen(function*() {
      const bytes=yield* Effect.promise(()=>readFile(input.artifactPath))
      const source=yield* File.publish({destination:`${input.directory}/producer.tgz`,observation:"hashed",provenance:Artifact.intrinsicProvenance("research/native-npm-tarball")},candidate=>Effect.gen(function*(){
        const fs=yield* FileSystem.FileSystem;yield* fs.writeFile(candidate,bytes)
      }))
      const owned=yield* adoptFile(owner,"fixture-1.0.0.tgz",source)
      const bundle=yield* finalize([owned])
      yield* Effect.promise(()=>writeFile(`${input.directory}/bundle.json`,encodeBundle(bundle)))
      yield* Effect.promise(()=>unlink(source.path))
      return bundle
    }) : yield* loadBundle(owner,new TextEncoder().encode(existing))
    const artifact=bundle.artifacts[0]
    if(!artifact||artifact._tag!=="OwnedFile")throw Error("Expected finalized owned file")
    const bytes=yield* owner.read(artifact.content)
    const bundleId=yield* hashCanonical("architecture-lab/owned-bundle/1",Schema.encodeSync(OwnedBundle)(bundle))
    if(existing!==undefined) {
      const saved=JSON.parse(yield* Effect.promise(()=>readFile(`${input.directory}/plan.json`,"utf8")))
      const restored=yield* loadPlan(saved,[provider])
      if(restored.bundleId!==bundleId)throw Error("Plan does not bind finalized Bundle")
      return restored
    }
    const operation=yield* createOperation(provider,new OwnedNpmIntent({
      registry:input.endpoint,packageName:input.name,version:"1.0.0",initialTag:"latest",filename:artifact.logicalName,
      content:artifact.content,integrity:`sha512-${createHash("sha512").update(bytes).digest("base64")}`
    }))
    const created=yield* createPlan(bundleId,[operation])
    yield* Effect.promise(()=>writeFile(`${input.directory}/plan.json`,JSON.stringify(Schema.encodeSync(Plan)(created))))
    return created
  }).pipe(Effect.provide(NodeServices.layer))
  return {host:{store:new GitJournal(`${input.directory}/journal`,input.remote),providers:[provider],transport:httpTransport,now:Date.now,uniqueId:randomUUID},options:{candidate:"M1" as const,plan,authorize:true,observe:true}}
},Effect.mapError(error=>new LabError({code:"owned.application",message:String(error)})))
