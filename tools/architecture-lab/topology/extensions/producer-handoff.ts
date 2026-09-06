import { Effect, Schema } from "effect"
import * as Artifact from "effect-build/Artifact"
import { AdoptionError, adoptFile, adoptTree, type ContentOwner } from "./adoption.js"

const Digest=Schema.Struct({algorithm:Schema.Literal("sha256"),value:Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/))})
class FileHandoff extends Schema.Class<FileHandoff>("FileHandoff")({
  protocol:Schema.Literal(Artifact.adoptionProtocol),kind:Schema.Literal("file"),
  logicalName:Artifact.PortableRelativePath,bytes:Artifact.DecimalBytesSchema,digest:Digest
}) {}
class TreeHandoff extends Schema.Class<TreeHandoff>("TreeHandoff")({
  protocol:Schema.Literal(Artifact.adoptionProtocol),kind:Schema.Literal("tree"),
  logicalName:Artifact.PortableRelativePath,totalBytes:Artifact.DecimalBytesSchema,manifestDigest:Digest
}) {}
const Handoff=Schema.Union([FileHandoff,TreeHandoff])

/** Admit a serialized producer selection only against its exact finalized generation. */
export const adoptProducerHandoff=Effect.fn("lab.adoptProducerHandoff")(function*(
  owner:ContentOwner,serialized:Uint8Array,resolvedSource:unknown
) {
  const input=yield* Effect.try({try:()=>{
    const text=new TextDecoder("utf-8",{fatal:true}).decode(serialized)
    const parsed:unknown=JSON.parse(text)
    if(JSON.stringify(parsed)!==text)throw new Error("Handoff requires exact compact JSON without duplicate keys")
    return {parsed,source:JSON.parse(JSON.stringify(resolvedSource)) as unknown}
  },catch:error=>new AdoptionError({reason:String(error)})})
  const handoff=yield* Schema.decodeUnknownEffect(Handoff,{onExcessProperty:"error"})(input.parsed)
  const source=input.source
  if(handoff.kind==="file") {
    if((!Artifact.isHashedFile(source)&&!Artifact.isHashedExecutable(source))||
      handoff.bytes!==source.bytes||handoff.digest.value!==source.digest.value) {
      return yield* new AdoptionError({reason:"Producer file handoff does not match resolved generation"})
    }
    return yield* adoptFile(owner,handoff.logicalName,source)
  }
  if(!Artifact.isHashedTree(source)||handoff.totalBytes!==source.totalBytes||
    handoff.manifestDigest.value!==source.manifestDigest.value) {
    return yield* new AdoptionError({reason:"Producer tree handoff does not match resolved generation"})
  }
  return yield* adoptTree(owner,handoff.logicalName,source)
})
