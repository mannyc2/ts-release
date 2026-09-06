import * as Effect from "effect/Effect"
import { request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"
import { LabError, type Transport, type SendResult } from "@lab/kernel"

/** One native request per permit. Fetch can retry a PUT after a lost response. */
export const httpTransport: Transport = {
  send: Effect.fn("Http.send")(function*(prepared) {
    return yield* Effect.tryPromise({
      try: (signal) => new Promise<SendResult>((resolve) => {
        const endpoint=new URL(prepared.facts.endpoint)
        const send=endpoint.protocol==="https:"?httpsRequest:httpRequest
        const request=send(endpoint,{method:prepared.facts.method,headers:Object.fromEntries(prepared.facts.headers),agent:false},response=>{
          const chunks:Buffer[]=[]
          let length=0
          response.on("data",(chunk:Buffer)=>{
            length+=chunk.length
            if(length>1_048_576){request.destroy(new Error("Native response exceeds research byte capacity"));return}
            chunks.push(chunk)
          })
          response.on("error",error=>resolve({_tag:"Unknown",reason:String(error)}))
          response.on("aborted",()=>resolve({_tag:"Unknown",reason:"Native response aborted"}))
          response.on("end",()=>{
            const status=response.statusCode??0
            const body=Buffer.concat(chunks).toString("utf8")
            if(status>=200&&status<300)resolve({_tag:"Accepted",receipt:{status,body,
              endpoint:prepared.facts.endpoint,method:prepared.facts.method,bodyDigest:prepared.facts.bodyDigest}})
            else if(status===422&&response.headers["x-fixture-no-commit"]==="true")resolve({_tag:"RejectedBeforeCommit",proof:{status,body}})
            else resolve({_tag:"Unknown",reason:`HTTP ${status}: ${body}`})
          })
        })
        request.on("error",error=>resolve({_tag:"Unknown",reason:String(error)}))
        const abort=()=>request.destroy(new Error("Native request interrupted"))
        signal.addEventListener("abort",abort,{once:true})
        request.once("close",()=>signal.removeEventListener("abort",abort))
        if(signal.aborted){abort();return}
        request.setTimeout(10_000,()=>request.destroy(new Error("Native request timed out")))
        request.end(Buffer.from(prepared.body))
      }),
      catch: cause => new LabError({code:"http.transport",message:String(cause)})
    })
  })
}
