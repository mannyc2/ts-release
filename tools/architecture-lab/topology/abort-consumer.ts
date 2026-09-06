import { strict as assert } from "node:assert"
import { readFile } from "node:fs/promises"
import { Effect, Layer } from "effect"
import { Host, runRelease } from "@lab/kernel"
import { createApplication, type Input } from "./application.js"

const input:Input=JSON.parse(await readFile(process.argv[2]!,"utf8"))
const state=async()=>await(await fetch(`${input.endpoint}/__state`)).json() as {calls:unknown[];held:Array<{path:string;closed:boolean}>}
const before=await state()
await fetch(`${input.endpoint}/__hold-next`)
const controller=new AbortController()
const running=Effect.runPromise(Effect.scoped(Effect.gen(function*(){const app=yield*createApplication(input);return yield*runRelease(app.options).pipe(Effect.provide(Layer.succeed(Host,app.host)))})),{signal:controller.signal})
void running.catch(()=>{})
const until=async(predicate:(value:Awaited<ReturnType<typeof state>>)=>boolean)=>{const deadline=Date.now()+5000;while(Date.now()<deadline){const value=await state();if(predicate(value))return value;await new Promise(resolve=>setTimeout(resolve,10))}throw Error("Native interruption fixture timed out")}
await until(value=>value.held.length===before.held.length+1)
controller.abort()
await assert.rejects(running,/interrupt/i)
const after=await until(value=>value.held.at(-1)!.closed)
assert.equal(after.calls.length-before.calls.length,1)
const snapshot=await Effect.runPromise(Effect.scoped(Effect.gen(function*(){const app=yield*createApplication(input);return yield*app.host.store.read(app.options.plan.journalId)})))
assert.equal(snapshot.events.filter(event=>event.body._tag==="DispatchStarted").length,1)
assert.equal(snapshot.events.filter(event=>event.body._tag==="ReceiptAccepted").length,0)
console.log(JSON.stringify({nativeRequests:1,connectionClosed:true,started:1,receipts:0,durableUncertainty:true}))
