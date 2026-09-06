import { afterEach, expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as Effect from "effect/Effect"
import { JournalEvent, PlanSuperseded } from "../machine/src/contracts.js"
import { EVENT_BYTES, GitJournal, SqliteJournal, eventBytes, readEvent } from "./stores.js"

const roots: string[] = []
const root = () => { const path = mkdtempSync(join(tmpdir(), "ts-release-store-lab-")); roots.push(path); return path }
const event = (eventId = "event-1", reason = "research") => new JournalEvent({
  format: "architecture-lab/event/1", journalId: "plan-1", planId: "plan-1", eventId,
  body: new PlanSuperseded({ reason })
})
const run = Effect.runPromise
afterEach(() => { for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true }) })

function setup(backend: "sqlite" | "git", directory = root(), limit = EVENT_BYTES) {
  if (backend === "sqlite") return { store: new SqliteJournal(join(directory, "journal.sqlite"), limit), directory, remote: "" }
  const remote = join(directory, "remote.git")
  execFileSync("git", ["init", "--bare", "--quiet", remote])
  return { store: new GitJournal(join(directory, "runner"), remote, limit), directory, remote }
}

for (const backend of ["sqlite", "git"] as const) {
  test(`${backend}: preparation and publication scopes share the global revision`, async () => {
    const { store } = setup(backend)
    const preparation = new JournalEvent({ ...event("preparation"), journalId: "release", planId: "preparation-scope" })
    const publication = new JournalEvent({ ...event("publication"), journalId: "release", planId: "publication-plan" })
    expect((await run(store.append("release", 0, preparation)))._tag).toBe("Appended")
    expect(await run(store.append("release", 0, publication))).toEqual({ _tag: "RevisionMismatch", revision: 1 })
    expect(await run(store.append("release", 1, publication))).toEqual({ _tag: "Appended", revision: 2 })
    expect((await run(store.read("release"))).events.map(event => event.planId)).toEqual(["preparation-scope", "publication-plan"])
    if (store instanceof SqliteJournal) store.close()
  })

  test(`${backend}: persisted complete events, exact idempotency and conflicts`, async () => {
    const { store } = setup(backend)
    expect(await run(store.read("plan-1"))).toEqual({ revision: 0, events: [] })
    expect(await run(store.append("plan-1", 0, event()))).toEqual({ _tag: "Appended", revision: 1 })
    expect(await run(store.append("plan-1", 0, event()))).toEqual({ _tag: "AlreadyRecorded", revision: 1 })
    expect(await run(store.append("plan-1", 0, event("other")))).toEqual({ _tag: "RevisionMismatch", revision: 1 })
    await expect(run(store.append("plan-1", 1, event("event-1", "conflicting fact")))).rejects.toThrow("different facts")
    await expect(run(store.append("other-plan", 1, event()))).rejects.toThrow("namespace")
    const snapshot = await run(store.read("plan-1"))
    expect(snapshot.revision).toBe(1)
    expect(snapshot.events[0]).toEqual(event())
    if (store instanceof SqliteJournal) store.close()
  })

  test(`${backend}: two independent runners reading zero yield one append winner`, async () => {
    const { store, directory, remote } = setup(backend)
    if (store instanceof SqliteJournal) store.close()
    const barrier = join(directory, "go")
    const workers = ["writer-a", "writer-b"].map((id) => Bun.spawn([
      process.execPath, join(import.meta.dir, "worker.ts"), backend,
      backend === "sqlite" ? join(directory, "journal.sqlite") : join(directory, id),
      remote, "plan-1", id, barrier
    ], { stdout: "pipe", stderr: "pipe" }))
    const deadline = Date.now() + 10_000
    while (!(await Bun.file(`${barrier}.writer-a.ready`).exists()) || !(await Bun.file(`${barrier}.writer-b.ready`).exists())) {
      if (Date.now() > deadline) { workers.forEach((worker) => worker.kill()); throw new Error("Race workers failed to reach barrier") }
      await Bun.sleep(10)
    }
    expect(await Bun.file(`${barrier}.writer-a.ready`).text()).toBe("0")
    expect(await Bun.file(`${barrier}.writer-b.ready`).text()).toBe("0")
    await Bun.write(barrier, "go")
    const outputs = await Promise.all(workers.map(async (worker) => {
      const [code, output, error] = await Promise.all([worker.exited, new Response(worker.stdout).text(), new Response(worker.stderr).text()])
      if (code !== 0) throw new Error(error)
      return JSON.parse(output) as { _tag: string }
    }))
    expect(outputs.filter((result) => result._tag === "Appended")).toHaveLength(1)
    const reader = backend === "sqlite" ? new SqliteJournal(join(directory, "journal.sqlite")) : new GitJournal(join(directory, "fresh-reader"), remote)
    expect((await run(reader.read("plan-1"))).events).toHaveLength(1)
    if (reader instanceof SqliteJournal) reader.close()
  }, 20_000)

  test(`${backend}: exact UTF-8 event limit on both read and write`, async () => {
    const value = event("boundary", "é".repeat(100))
    const limit = eventBytes(value).byteLength
    const { store } = setup(backend, root(), limit)
    expect((await run(store.append("plan-1", 0, value)))._tag).toBe("Appended")
    expect((await run(store.read("plan-1"))).events[0]).toEqual(value)
    const tooLarge = event("boundary", "é".repeat(100) + "x")
    expect(eventBytes(tooLarge).byteLength).toBe(limit + 1)
    await expect(run(store.append("plan-1", 1, tooLarge))).rejects.toThrow("byte limit")
    expect(() => readEvent(eventBytes(tooLarge), limit)).toThrow("byte limit")
    expect((await run(store.read("plan-1"))).revision).toBe(1)
    if (store instanceof SqliteJournal) store.close()
  })

  test(`${backend}: proposed 1 MiB profile admits exact envelope and rejects one more byte`, async () => {
    const id = "product-profile"
    const overhead = eventBytes(event(id, "")).byteLength
    const value = event(id, "x".repeat(EVENT_BYTES - overhead))
    expect(eventBytes(value).byteLength).toBe(1_048_576)
    const { store, directory, remote } = setup(backend)
    expect((await run(store.append("plan-1", 0, value)))._tag).toBe("Appended")
    expect((await run(store.read("plan-1"))).events[0]).toEqual(value)
    const oversized = event(id, value.body._tag === "PlanSuperseded" ? value.body.reason + "x" : "")
    expect(eventBytes(oversized).byteLength).toBe(1_048_577)
    await expect(run(store.append("plan-1", 1, oversized))).rejects.toThrow("byte limit")
    expect(() => readEvent(eventBytes(oversized))).toThrow("byte limit")
    if (store instanceof SqliteJournal) store.close()
    const restarted = backend === "sqlite" ? new SqliteJournal(join(directory, "journal.sqlite")) : new GitJournal(join(directory, "restart"), remote)
    expect((await run(restarted.read("plan-1"))).events[0]).toEqual(value)
    if (restarted instanceof SqliteJournal) restarted.close()
  }, 20_000)
}

test("SQLite process exit inside transaction never leaves a partial append", async () => {
  const directory = root()
  const path = join(directory, "journal.sqlite")
  new SqliteJournal(path).close()
  const script = `import {Database} from 'bun:sqlite';const db=new Database(process.argv[1]);db.exec('BEGIN IMMEDIATE');db.query('INSERT INTO events VALUES(?,?,?,?)').run('plan-1',1,'partial',new Uint8Array([123]));process.exit(17);`
  const worker = Bun.spawn([process.execPath, "-e", script, path], { stdout: "pipe", stderr: "pipe" })
  expect(await worker.exited).toBe(17)
  const reader = new SqliteJournal(path)
  expect(await run(reader.read("plan-1"))).toEqual({ revision: 0, events: [] })
  reader.close()
})

test("SQLite rejects oversized hostile stored bytes before JSON decode", async () => {
  const { store } = setup("sqlite", root(), 32)
  if (!(store instanceof SqliteJournal)) throw new Error("SQLite fixture")
  store.db.query("INSERT INTO events VALUES(?,?,?,?)").run("plan-1", 1, "hostile", new Uint8Array(33))
  await expect(run(store.read("plan-1"))).rejects.toThrow("before loading")
  store.close()
})

test("Git identical target says up-to-date despite stale expectation; no new winner", async () => {
  const { store, remote } = setup("git")
  if (!(store instanceof GitJournal)) throw new Error("Git fixture")
  await run(store.append("plan-1", 0, event()))
  const head = store.head("plan-1")
  const output = store.git(["push", "--porcelain", `--force-with-lease=${store.ref("plan-1")}:`, remote, `${head}:${store.ref("plan-1")}`])
  expect(output.split("\n").some((line) => line.startsWith("=\t"))).toBe(true)
  expect((await run(store.append("plan-1", 0, event())))._tag).toBe("AlreadyRecorded")
})

test("Git rejecting repository policy never returns append permission", async () => {
  const { store, remote } = setup("git")
  const hook = join(remote, "hooks", "pre-receive")
  await Bun.write(hook, "#!/bin/sh\nexit 1\n")
  execFileSync("chmod", ["+x", hook])
  expect((await run(store.append("plan-1", 0, event())))._tag).toBe("AmbiguousStorageOutcome")
  expect((await run(store.read("plan-1"))).revision).toBe(0)
})

test("Lost acknowledgment cannot turn an identical fresh invocation into Appended", async () => {
  const { store } = setup("sqlite")
  const committed = await run(store.append("plan-1", 0, event()))
  expect(committed._tag).toBe("Appended")
  // Discard the first result. This second call knows only durable history.
  expect((await run(store.append("plan-1", 0, event())))._tag).toBe("AlreadyRecorded")
  if (store instanceof SqliteJournal) store.close()
})
