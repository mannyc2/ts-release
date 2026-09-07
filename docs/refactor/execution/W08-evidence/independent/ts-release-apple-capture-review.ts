import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { Effect } from "/tmp/ts-release-implementation/node_modules/effect/dist/index.js"
import { Host, ReleaseError, runRelease } from "/tmp/ts-release-implementation/packages/ts-release/src/index.ts"
import { createApplePreparations, preparationProvider, preparationScopes, runPreparation } from "/tmp/ts-release-implementation/packages/ts-release/src/Apple.ts"
import { makeSources, run } from "/tmp/ts-release-implementation/test/reimplementation/artifacts/apple-fixtures.ts"
import { MemoryJournal } from "/tmp/ts-release-implementation/test/reimplementation/kernel/fixtures.ts"
const root = await mkdtemp("/tmp/ts-release-apple-capture-review-")
try {
  const { inputs } = await makeSources(root)
  const collection = await run(createApplePreparations([inputs[1]!]))
  const scopes = await run(preparationScopes(collection))
  const plan = scopes[0]!.plan
  const id = plan.operations[0]!.operationId
  const observed = []
  for (const api of ["core", "apple"]) {
    const counts = { original: 0, replacement: 0 }
    const host = {
      store: new MemoryJournal(),
      transport: { send: () => Effect.sync(() => {
        counts.original++
        return { _tag: "Unknown" as const, reason: "original protocol transport" }
      }) },
      providers: [preparationProvider], now: Date.now,
      uniqueId: () => crypto.randomUUID(),
      journal: { journalId: collection.journalId, scopes },
    }
    const task = api === "core"
      ? runRelease({ plan, authorize: true, observe: false })
      : runPreparation(collection, id, { authorize: true }, () => Effect.fail(new ReleaseError({code:"unused",message:"unused"})))
    const running = Effect.runPromise(task.pipe(Effect.provideService(Host, host)))
    host.transport.send = () => Effect.sync(() => {
      counts.replacement++
      return { _tag: "Unknown" as const, reason: "replacement protocol transport" }
    })
    await running
    observed.push({ api, ...counts })
  }
  assert.deepEqual(observed, [
    { api: "core", original: 1, replacement: 0 },
    { api: "apple", original: 1, replacement: 0 },
  ])
  console.log(JSON.stringify(observed, null, 2))
} finally {
  await rm(root, {recursive:true,force:true})
}
