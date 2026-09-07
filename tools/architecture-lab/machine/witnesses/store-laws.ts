// Reusable JournalStore conformance kit: the laws every store, cache or decorator must satisfy.
import * as Effect from "effect/Effect"
import { JournalEvent, PlanSuperseded, canonical, type JournalStore } from "../src/index.js"

const event = (journalId: string, eventId: string, reason: string) => new JournalEvent({ format: "architecture-lab/event/1", eventId, journalId, planId: journalId, body: new PlanSuperseded({ reason }) })
export interface StoreLawReport { readonly passed: ReadonlyArray<string>; readonly failed: ReadonlyArray<{ readonly law: string; readonly detail: string }> }

/** Runs the store laws against a fresh store; `journalId` must be empty in that store. */
export const checkStoreLaws = async (store: JournalStore, journalId = `laws-${Date.now()}-${Math.random().toString(16).slice(2)}`): Promise<StoreLawReport> => {
  const passed: string[] = []; const failed: Array<{ law: string; detail: string }> = []
  const law = async (name: string, body: () => Promise<boolean | string>) => {
    try { const result = await body(); if (result === true) passed.push(name); else failed.push({ law: name, detail: result === false ? "predicate false" : result }) }
    catch (error) { failed.push({ law: name, detail: String(error) }) }
  }
  const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect as Effect.Effect<A, E, never>)
  const e1 = event(journalId, "law-1", "first"), e1x = event(journalId, "law-1", "different facts"), e2 = event(journalId, "law-2", "second")
  await law("empty journal reads revision 0 and no events", async () => { const s = await run(store.read(journalId)); return s.revision === 0 && s.events.length === 0 })
  await law("append at the expected revision is Appended with revision+1", async () => { const r = await run(store.append(journalId, 0, e1)); return r._tag === "Appended" && r.revision === 1 ? true : JSON.stringify(r) })
  await law("identical event again is AlreadyRecorded, never Appended", async () => { const r = await run(store.append(journalId, 0, e1)); return r._tag === "AlreadyRecorded" ? true : JSON.stringify(r) })
  await law("a different event at a stale revision is RevisionMismatch, never Appended", async () => { const r = await run(store.append(journalId, 0, e2)); return r._tag === "RevisionMismatch" && r.revision === 1 ? true : JSON.stringify(r) })
  await law("same event ID with different facts is an error", async () => { try { await run(store.append(journalId, 1, e1x)); return "append succeeded" } catch { return true } })
  await law("read returns the complete prefix with revision = events.length", async () => { const s = await run(store.read(journalId)); return s.revision === 1 && s.events.length === 1 && canonical(s.events[0]) === canonical(e1) })
  await law("append at the current revision advances the history", async () => { const r = await run(store.append(journalId, 1, e2)); const s = await run(store.read(journalId)); return r._tag === "Appended" && s.revision === 2 && s.events.map((e) => e.eventId).join() === "law-1,law-2" })
  return { passed, failed }
}
