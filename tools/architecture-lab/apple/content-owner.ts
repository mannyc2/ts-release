import { Effect } from "effect"
import { createHash, randomUUID } from "node:crypto"
import { constants } from "node:fs"
import { chmod, link, mkdir, open, unlink, type FileHandle } from "node:fs/promises"
import { join } from "node:path"
import { AdoptionError, Content, type ContentOwner } from "./adoption.js"

const READ_CAPACITY=512n*1024n*1024n
const caught=(error:unknown)=>new AdoptionError({reason:String(error)})
const syncDirectory=async(directory:string)=>{
  const handle=await open(directory,constants.O_RDONLY|constants.O_DIRECTORY)
  try{await handle.sync()}finally{await handle.close()}
}
const copyAndIdentify=async(source:FileHandle,expected:Content,destination?:FileHandle)=>{
  const hash=createHash("sha256"),buffer=Buffer.allocUnsafe(64*1024)
  let bytes=0n
  for(;;){
    const read=await source.read(buffer,0,buffer.length,null)
    if(read.bytesRead===0)break
    bytes+=BigInt(read.bytesRead)
    if(bytes>BigInt(expected.bytes))throw new Error("source exceeds expected decimal byte count")
    const chunk=buffer.subarray(0,read.bytesRead)
    hash.update(chunk)
    if(destination)await destination.writeFile(chunk)
  }
  if(String(bytes)!==expected.bytes||hash.digest("hex")!==expected.sha256)throw new Error("streamed content identity mismatch")
}

export const fileContentOwner = (directory:string):ContentOwner => ({
  putOwned:(input)=>{
    const bytes=new Uint8Array(input),sha256=createHash("sha256").update(bytes).digest("hex")
    return Effect.tryPromise({try:async()=>{
      await mkdir(directory,{recursive:true})
      const temporary=join(directory,`.buffer-${randomUUID()}`)
      const output=await open(temporary,"wx",0o600)
      try{await output.writeFile(bytes);await output.sync()}finally{await output.close()}
      try{
        await chmod(temporary,0o400)
        try{await link(temporary,join(directory,sha256))}catch(error){if((error as NodeJS.ErrnoException).code!=="EEXIST")throw error}
      }finally{await unlink(temporary)}
      await syncDirectory(directory)
      const existing=await open(join(directory,sha256),constants.O_RDONLY|constants.O_NOFOLLOW)
      try{await copyAndIdentify(existing,new Content({bytes:String(bytes.byteLength),sha256}))}finally{await existing.close()}
      return new Content({bytes:String(bytes.byteLength),sha256})
    },catch:caught})
  },
  putFileOwned:(source)=>Effect.tryPromise({try:async()=>{
    const expected=new Content({bytes:source.bytes,sha256:source.digest.value})
    await mkdir(directory,{recursive:true})
    const input=await open(source.path,constants.O_RDONLY|constants.O_NOFOLLOW)
    const temporary=join(directory,`.copy-${randomUUID()}`)
    let output:FileHandle|undefined
    try{
      const before=await input.stat({bigint:true})
      if(!before.isFile()||String(before.size)!==expected.bytes)throw new Error("source is not the expected regular file")
      output=await open(temporary,"wx",0o600)
      await copyAndIdentify(input,expected,output)
      await output.sync();await output.close();output=undefined
      await chmod(temporary,0o400)
      try{await link(temporary,join(directory,expected.sha256))}
      catch(error){
        if((error as NodeJS.ErrnoException).code!=="EEXIST")throw error
        const existing=await open(join(directory,expected.sha256),constants.O_RDONLY|constants.O_NOFOLLOW)
        try{await copyAndIdentify(existing,expected)}finally{await existing.close()}
      }
      await syncDirectory(directory)
      return expected
    }finally{
      await input.close();if(output)await output.close();await unlink(temporary).catch(error=>{if(error.code!=="ENOENT")throw error})
    }
  },catch:caught}),
  verify:(content)=>Effect.tryPromise({try:async()=>{
    const input=await open(join(directory,content.sha256),constants.O_RDONLY|constants.O_NOFOLLOW)
    try{const actual=await input.stat({bigint:true});if(!actual.isFile()||String(actual.size)!==content.bytes)throw new Error("owned content size differs");await copyAndIdentify(input,content)}finally{await input.close()}
  },catch:caught}),
  read:(content)=>Effect.tryPromise({try:async()=>{
    if(BigInt(content.bytes)>READ_CAPACITY)throw new Error("read exceeds 512 MiB buffered capacity; use a streaming consumer")
    const input=await open(join(directory,content.sha256),constants.O_RDONLY|constants.O_NOFOLLOW)
    try{
      const before=await input.stat({bigint:true})
      if(!before.isFile()||String(before.size)!==content.bytes)throw new Error("owned content size changed")
      const chunks:Buffer[]=[]
      const buffer=Buffer.allocUnsafe(64*1024),hash=createHash("sha256");let count=0n
      for(;;){const result=await input.read(buffer,0,buffer.length,null);if(result.bytesRead===0)break;count+=BigInt(result.bytesRead);if(count>BigInt(content.bytes))throw new Error("owned content grew");const chunk=Buffer.from(buffer.subarray(0,result.bytesRead));hash.update(chunk);chunks.push(chunk)}
      if(String(count)!==content.bytes||hash.digest("hex")!==content.sha256)throw new Error("owned content identity changed")
      return new Uint8Array(Buffer.concat(chunks))
    }finally{await input.close()}
  },catch:caught})
})
