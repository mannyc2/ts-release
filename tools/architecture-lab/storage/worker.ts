import * as Effect from "effect/Effect"
import { JournalEvent, PlanSuperseded } from "../machine/src/contracts.js"
import { GitJournal, SqliteJournal } from "./stores.js"

const [backend, path, remote, plan, eventId, barrier] = process.argv.slice(2) as [string, string, string, string, string, string]
const store = backend === "sqlite" ? new SqliteJournal(path) : new GitJournal(path, remote)
const initial = await Effect.runPromise(store.read(plan))
await Bun.write(`${barrier}.${eventId}.ready`, String(initial.revision))
while (!(await Bun.file(barrier).exists())) await Bun.sleep(5)
const event = new JournalEvent({ format: "architecture-lab/event/1", eventId, journalId: plan, planId: plan,
  body: new PlanSuperseded({ reason: eventId }) })
console.log(JSON.stringify(await Effect.runPromise(store.append(plan, initial.revision, event))))
if (store instanceof SqliteJournal) store.close()
