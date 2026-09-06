import { Crypto, Effect, FileSystem, Schema } from "effect"
import * as Artifact from "effect-build/Artifact"
import * as Tree from "effect-build/Author/Tree"
import { AdoptionError, OwnedBundle, OwnedTree, finalize, MAX_BUFFERED_TREE_BYTES, MAX_TREE_ENTRIES, type ContentOwner } from "./adoption.js"

export const encodeBundle=(bundle:OwnedBundle)=>new TextEncoder().encode(JSON.stringify(Schema.encodeSync(OwnedBundle)(bundle)))
function invalid(reason:string):never{throw new AdoptionError({reason})}
const asError=(error:unknown)=>error instanceof AdoptionError?error:new AdoptionError({reason:String(error)})
const normalized=(parts:readonly string[])=>{
  const result:string[]=[]
  for(const part of parts){if(part===""||part===".")continue;if(part===".."){if(result.length===0)invalid("symbolic link escapes tree");result.pop()}else result.push(part)}
  return result.join("/")
}

/** Reconstructs the exact upstream ordered preimage and rejects unsafe graph shapes. */
const treeManifest=(tree:OwnedTree)=>{
  if(BigInt(tree.totalBytes)>MAX_BUFFERED_TREE_BYTES||tree.entries.length>MAX_TREE_ENTRIES)invalid("tree exceeds admitted snapshot capacity")
  const names=new Map<string,typeof tree.entries[number]>(),folded=new Set<string>()
  let previous="",total=0n
  for(const entry of tree.entries){
    if(entry.relativePath<=previous||folded.has(entry.relativePath.toLowerCase()))invalid("tree paths are repeated, case-colliding or unsorted")
    previous=entry.relativePath;folded.add(entry.relativePath.toLowerCase());names.set(entry.relativePath,entry)
    if(entry._tag==="TreeFile")total+=BigInt(entry.content.bytes)
  }
  if(String(total)!==tree.totalBytes)invalid("tree decimal total differs from file identities")
  const resolve=(path:string,seen:Set<string>):string=>{
    const parts=path.split("/").filter(Boolean)
    for(let index=0;index<parts.length;index++){
      const name=parts.slice(0,index+1).join("/"),entry=names.get(name)
      if(!entry)invalid("symbolic link points to an absent entry")
      if(entry._tag==="TreeLink"){
        if(seen.has(name))invalid("symbolic link cycle")
        if(entry.target.length===0||entry.target.startsWith("/")||entry.target.includes("\\")||entry.target.includes("\0")||/^[A-Za-z]:/.test(entry.target))invalid("nonportable symbolic link")
        return resolve(normalized([...parts.slice(0,index),...entry.target.split("/"),...parts.slice(index+1)]),new Set(seen).add(name))
      }
      if(index<parts.length-1&&entry._tag!=="TreeDirectory")invalid("symbolic link traverses a regular file")
    }
    return path
  }
  for(const entry of tree.entries){
    const parent=entry.relativePath.split("/").slice(0,-1).join("/")
    if(parent!==""&&names.get(parent)?._tag!=="TreeDirectory")invalid("tree entry has no directory parent")
    if(entry._tag==="TreeLink")resolve(entry.relativePath,new Set())
  }
  const entries=tree.entries.map(entry=>entry._tag==="TreeFile"?{kind:"file",relativePath:entry.relativePath,mode:entry.mode,bytes:entry.content.bytes,digest:{algorithm:"sha256",value:entry.content.sha256}}:
    entry._tag==="TreeDirectory"?{kind:"directory",relativePath:entry.relativePath,mode:entry.mode}:{kind:"symbolic-link",relativePath:entry.relativePath,target:entry.target})
  return JSON.stringify({rootMode:tree.rootMode,totalBytes:tree.totalBytes,entries})
}

export const loadBundle=Effect.fn("lab.loadOwnedBundle")(function*(owner:ContentOwner,bytes:Uint8Array){
  const decoded=yield* Effect.try({try:()=>{
    const text=new TextDecoder("utf-8",{fatal:true}).decode(bytes)
    const value=Schema.decodeUnknownSync(OwnedBundle,{onExcessProperty:"error"})(JSON.parse(text))
    if(new TextDecoder().decode(encodeBundle(value))!==text)invalid("bundle encoding is not the exact canonical codec output")
    return value
  },catch:asError})
  const crypto=yield* Crypto.Crypto
  for(const artifact of decoded.artifacts){
    if(artifact._tag==="OwnedFile")yield* owner.verify(artifact.content)
    else{
      const manifest=yield* Effect.try({try:()=>treeManifest(artifact),catch:asError})
      const digest=yield* crypto.digest("SHA-256",new TextEncoder().encode(manifest))
      const hex=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("")
      if(hex!==artifact.upstreamManifestSha256)return yield* new AdoptionError({reason:"durable tree manifest differs from upstream identity"})
      for(const entry of artifact.entries)if(entry._tag==="TreeFile")yield* owner.verify(entry.content)
    }
  }
  return yield* finalize(decoded.artifacts)
})

/** Durable tree restoration passes through the actual public finalizer again. */
export const restoreTree=Effect.fn("lab.restoreOwnedTree")(function*(owner:ContentOwner,tree:OwnedTree,outdir:string,provenance:Artifact.Provenance){
  const validated=yield* loadBundle(owner,encodeBundle(new OwnedBundle({format:"lab/owned-bundle/1",artifacts:[tree]})))
  const source=validated.artifacts[0] as OwnedTree
  const artifact=yield* Tree.publish({outdir,observation:"hashed",provenance},candidate=>Effect.gen(function*(){
    const fs=yield* FileSystem.FileSystem
    yield* fs.chmod(candidate,source.rootMode)
    for(const entry of source.entries){
      const destination=`${candidate}/${entry.relativePath}`
      if(entry._tag==="TreeDirectory"){yield* fs.makeDirectory(destination);yield* fs.chmod(destination,entry.mode)}
      else if(entry._tag==="TreeFile"){yield* fs.writeFile(destination,yield* owner.read(entry.content));yield* fs.chmod(destination,entry.mode)}
      else yield* fs.symlink(entry.target,destination)
    }
  }))
  if(artifact.manifestDigest.value!==source.upstreamManifestSha256)return yield* new AdoptionError({reason:"restored tree differs from durable manifest"})
  return artifact
})
