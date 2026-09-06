import { strict as assert } from "node:assert"
import { createServer } from "node:http"
import { writeFile } from "node:fs/promises"
import { bun, node, hash, json } from "./pack.mjs"

const results=[]
for(const executable of [node,bun]) {
  const calls=[]
  const server=createServer(async(request,response)=>{
    if(request.method==="GET"){response.writeHead(404,{"content-type":"application/json"});response.end('{}');return}
    const chunks=[];for await(const chunk of request)chunks.push(Buffer.from(chunk))
    calls.push({method:request.method,bodySha256:hash(Buffer.concat(chunks))})
    if(calls.length===1){request.socket.destroy();return}
    response.writeHead(409,{"content-type":"application/json"});response.end('{"alreadyCommitted":true}')
  })
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve)})
  const endpoint=`http://127.0.0.1:${server.address().port}`
  try {
    const source=`await(await fetch(${JSON.stringify(endpoint)})).json();try{const r=await fetch(${JSON.stringify(endpoint)},{method:"PUT",body:new Uint8Array([1,2,3]),redirect:"manual"});console.log(JSON.stringify({status:r.status}))}catch(error){console.log(JSON.stringify({error:String(error)}))}`
    const child=Bun.spawn([executable,"--input-type=module","-e",source],{stdout:"pipe",stderr:"pipe"})
    assert.equal(await child.exited,0)
    results.push({runtime:executable===node?"Node22.22.2":"Bun1.3.14",fetchCalls:1,nativeRequests:calls,consumer:JSON.parse(await new Response(child.stdout).text())})
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
}
assert.equal(results[0].nativeRequests.length,1)
assert.equal(results[1].nativeRequests.length,2)
await writeFile(new URL("./fetch-retry-results.json",import.meta.url),json({format:"native-fetch-retry/1",sourceSha256:hash(await Bun.file(import.meta.path).text()),results}))
console.log(JSON.stringify(results.map(result=>({runtime:result.runtime,nativeRequests:result.nativeRequests.length}))))
