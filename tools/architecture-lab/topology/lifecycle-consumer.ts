import { strict as assert } from "node:assert"
import { closeSync, mkdtempSync, openSync, readSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { Effect } from "effect"
import { createPlan, LabError, type JournalStore } from "@lab/kernel"
import { runApplication } from "@lab/host"

const resources:Array<{fd:number;closed:boolean;sqliteClosed:boolean}>=[]
export const createApplication=Effect.fn("Lifecycle.createApplication")(function*(input:{directory:string;outcome:"success"|"failure"|"interruption"}) {
  const resource=yield* Effect.acquireRelease(Effect.sync(()=>{const record={fd:openSync(join(input.directory,input.outcome),"w+"),closed:false,sqliteClosed:false};resources.push(record);return record}),record=>Effect.sync(()=>{closeSync(record.fd);record.closed=true}))
  let store:JournalStore={read:()=>Effect.succeed({revision:0,events:[]}),append:()=>Effect.die("Unexpected append")}
  if(typeof Bun!=="undefined") {
    const sqlite=yield* Effect.acquireRelease(Effect.promise(async()=>new (await import("@lab/host/sqlite")).SqliteJournal(join(input.directory,`${input.outcome}.sqlite`))),db=>Effect.sync(()=>{db.close();assert.throws(()=>db.db.query("SELECT 1").get());resource.sqliteClosed=true}))
    store=sqlite
  }
  if(input.outcome==="failure")return yield* Effect.fail(new LabError({code:"lifecycle.failure",message:"Expected application failure after acquisition"}))
  if(input.outcome==="interruption")return yield* Effect.interrupt
  const plan=yield* createPlan("lifecycle",[])
  return {host:{store,providers:[],transport:{send:()=>Effect.die("Unexpected send")},now:Date.now,uniqueId:()=>"unused"},options:{plan,candidate:"M1" as const,authorize:false,observe:false}}
})

export async function runLifecycleFixture() {
  const directory=mkdtempSync(join(tmpdir(),"packed-host-scope-"))
  try {
    const application=fileURLToPath(import.meta.url)
    await runApplication(application,{directory,outcome:"success"})
    await assert.rejects(runApplication(application,{directory,outcome:"failure"}))
    await assert.rejects(runApplication(application,{directory,outcome:"interruption"}))
    assert.equal(resources.length,3)
    for(const record of resources){assert(record.closed);assert.throws(()=>readSync(record.fd,new Uint8Array(1),0,1,0));if(typeof Bun!=="undefined")assert(record.sqliteClosed)}
    return {acquired:3,closed:3,outcomes:["success","failure","interruption"],sqliteClosed:typeof Bun!=="undefined"?3:0}
  } finally {rmSync(directory,{recursive:true,force:true})}
}
