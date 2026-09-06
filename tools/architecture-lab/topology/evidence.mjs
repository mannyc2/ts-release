import { readFile, writeFile } from "node:fs/promises"
import { dirname, join, basename } from "node:path"
import { fileURLToPath } from "node:url"
import { gzipSync, gunzipSync } from "node:zlib"
import { hash, json } from "./pack.mjs"

/** Lossless content-addressed sharing of repeated graph edges and inventories. */
export async function writeEvidence(path, value) {
  // Runtime qualification asks for graph edges; repeated resolutions and
  // identical scenario graphs do not need another copy of each long file URL.
  if(value.layouts?.some(layout=>layout.scenarios?.some(scenario=>scenario.runtimeTrace))) {
    const runtimeEdges={}
    const edgeIds=new Map()
    for(const layout of value.layouts)for(const scenario of layout.scenarios??[])if(scenario.runtimeTrace) {
      const ids=[]
      for(const edge of scenario.runtimeTrace) {
        const key=JSON.stringify(edge)
        if(!edgeIds.has(key)){const id=`e${edgeIds.size}`;edgeIds.set(key,id);runtimeEdges[id]=edge}
        ids.push(edgeIds.get(key))
      }
      scenario.runtimeGraph={edgeIds:[...new Set(ids)],resolutionCalls:ids.length}
      delete scenario.runtimeTrace
    }
    value.runtimeEdges=runtimeEdges
  }
  const counts=new Map()
  const keys=new WeakMap()
  function count(node) {
    if(typeof node!=="object"||node===null)return
    const text=JSON.stringify(node)
    if(text.length>=96){const key=hash(text);keys.set(node,key);counts.set(key,(counts.get(key)??0)+1)}
    for(const child of Object.values(node))count(child)
  }
  count(value)
  const evidenceObjects={}
  const children=node=>Array.isArray(node)?node.map(encode):Object.fromEntries(Object.entries(node).map(([key,child])=>[key,encode(child)]))
  function encode(node) {
    if(typeof node!=="object"||node===null)return node
    const key=keys.get(node)
    if(key&&(counts.get(key)??0)>1) {
      if(!(key in evidenceObjects))evidenceObjects[key]=children(node)
      return {$ref:key}
    }
    return children(node)
  }
  const encoded=encode(value)
  const expanded=json({...encoded,evidenceObjects})
  const compressed=gzipSync(expanded,{level:9})
  const filename=path instanceof URL?fileURLToPath(path):path
  await writeFile(`${filename}.gz`,compressed)
  const summary={
    format:value.format,work:value.work,method:value.method,scope:value.scope,sourceSnapshot:value.sourceSnapshot,sourceSha256:value.sourceSha256,runtimes:value.runtimes,
    evidenceArtifact:{file:`${basename(filename)}.gz`,sha256:hash(compressed),expandedSha256:hash(expanded),expandedBytes:Buffer.byteLength(expanded),compressedBytes:compressed.length,encoding:"gzip+json-with-content-addressed-sharing"},
    layouts:value.layouts?.map(layout=>layout.built?{
      layoutId:layout.layoutId,publishedBytes:layout.publishedBytes,
      packages:layout.built.map(pkg=>({name:pkg.name,private:pkg.manifest.private??false,sourceLines:pkg.sourceInventory.reduce((n,file)=>n+file.lines,0),packBytes:pkg.tarball.bytes,packSha256:pkg.tarball.sha256})),
      scenarios:layout.scenarios.length,restartSends:layout.scenarios.reduce((n,scenario)=>n+scenario.sendsAfterRestart,0),
      ownedScenarios:layout.ownedScenarios,
      selective:{installedOwnBytes:layout.selective.installedBytes,bundleBytes:layout.selective.bundleBytes,pythonProviderPresent:layout.selective.pythonProviderPresent},
      coreSelective:layout.coreSelective?{installedOwnBytes:layout.coreSelective.installedOwnBytes,bundleBytes:layout.coreSelective.bundleBytes}:undefined
    }:{layout:layout.layout,dependencyEdges:layout.dependencyEdges,ordering:layout.ordering,prefixes:layout.prefixes,
      coreOnly:layout.coreOnly?{installedOwnBytes:layout.coreOnly.installedOwnBytes,bundleBytes:layout.coreOnly.bundleBytes}:undefined,
      providerBeforeKernel:layout.providerBeforeKernel,skewInstalledPackages:layout.skewInstalledPackages,skewRuntime:layout.skewRuntime,pythonAbsentNpmOnly:layout.pythonAbsentNpmOnly}),
    probes:value.probes
  }
  await writeFile(filename,json(summary))
}

export async function readEvidence(path) {
  let document=JSON.parse(await readFile(path,"utf8"))
  if(document.evidenceArtifact) {
    const filename=path instanceof URL?fileURLToPath(path):path
    const compressed=await readFile(join(dirname(filename),document.evidenceArtifact.file))
    if(hash(compressed)!==document.evidenceArtifact.sha256)throw Error("Compressed evidence digest mismatch")
    const expanded=gunzipSync(compressed)
    if(hash(expanded)!==document.evidenceArtifact.expandedSha256)throw Error("Expanded evidence digest mismatch")
    document=JSON.parse(expanded.toString("utf8"))
  }
  const {evidenceObjects,...root}=document
  if(!evidenceObjects)return document
  const cache=new Map()
  function expand(node) {
    if(typeof node!=="object"||node===null)return node
    if(!Array.isArray(node)&&Object.keys(node).length===1&&typeof node.$ref==="string") {
      if(!cache.has(node.$ref)) {
        if(!(node.$ref in evidenceObjects))throw Error(`Missing evidence object ${node.$ref}`)
        const value=expand(evidenceObjects[node.$ref])
        if(hash(JSON.stringify(value))!==node.$ref)throw Error(`Evidence object hash mismatch ${node.$ref}`)
        cache.set(node.$ref,value)
      }
      return cache.get(node.$ref)
    }
    return Array.isArray(node)?node.map(expand):Object.fromEntries(Object.entries(node).map(([key,value])=>[key,expand(value)]))
  }
  return expand(root)
}
