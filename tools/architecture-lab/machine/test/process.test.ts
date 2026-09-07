import { expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import * as Effect from "effect/Effect"
import { SqliteJournal } from "../../storage/sqlite.js"
import { canonical, createOperation, createPlan, type ReleaseReport } from "../src/index.js"
import { providerFor } from "./fixtures.js"

const worker = resolve(import.meta.dir, "process-runner.ts")
import { evaluatorNames } from "./fixtures.js"
for (const candidate of evaluatorNames) for (const cache of [false, true]) for (const fault of ["after-append", "after-send"] as const) {
  test(`${candidate}${cache ? "+cache" : ""}: fresh OS process resumes ${fault} from SQLite after deleting original workspace`, async () => {
    const directory = mkdtempSync(join(tmpdir(), "machine-process-"))
    const oldWorkspace = join(directory, "old-workspace")
    const freshWorkspace = join(directory, "fresh-workspace")
    mkdirSync(oldWorkspace)
    mkdirSync(freshWorkspace)
    let sends = 0
    let remote: Uint8Array | undefined
    const server = Bun.serve({ port: 0, hostname: "127.0.0.1", async fetch(request) {
      if (request.method === "PUT") {
        sends++
        remote = new Uint8Array(await request.arrayBuffer())
        return new Response("accepted", { status: 201 })
      }
      return remote ? new Response(new Uint8Array(remote)) : new Response("absent", { status: 404 })
    } })
    const planPath = join(directory, "owned-plan.json")
    const databasePath = join(directory, "history.sqlite")
    try {
      const operation = await Effect.runPromise(createOperation(providerFor(), { coordinate: "package-1", endpoint: `http://127.0.0.1:${server.port}`, content: "owned exact artifact bytes" }))
      const plan = await Effect.runPromise(createPlan("process-owned-bundle", [operation]))
      writeFileSync(planPath, canonical(plan))
      const launch = (cwd: string, stage: string, observe: string) => Bun.spawn([process.execPath, worker, planPath, databasePath, candidate, stage, observe], { cwd, stdout: "pipe", stderr: "pipe", env: { ...process.env, LAB_CACHE: cache ? "1" : "" } })
      const first = launch(oldWorkspace, fault, "false")
      expect(await first.exited).toBe(70)
      expect(await new Response(first.stderr).text()).toBe("")
      const checkpointStore = new SqliteJournal(databasePath)
      const snapshot = await Effect.runPromise(checkpointStore.read(plan.journalId))
      checkpointStore.close()
      expect(snapshot.events.map((event) => event.body._tag)).toEqual(["DispatchStarted"])
      rmSync(oldWorkspace, { recursive: true })
      const second = launch(freshWorkspace, "none", "true")
      expect(await second.exited).toBe(0)
      expect(await new Response(second.stderr).text()).toBe("")
      const report = JSON.parse(await new Response(second.stdout).text()) as ReleaseReport
      expect(report.operations[0]).toMatchObject({ status: fault === "after-send" ? "Satisfied" : "Inconclusive", dispatches: 1, receipts: 0 })
      expect(sends).toBe(fault === "after-send" ? 1 : 0)
      if (remote) expect(new TextDecoder().decode(remote)).toBe("owned exact artifact bytes")
      const third = launch(freshWorkspace, "none", "true")
      expect(await third.exited).toBe(0)
      expect(sends).toBe(fault === "after-send" ? 1 : 0)
    } finally {
      server.stop(true)
      rmSync(directory, { recursive: true, force: true })
    }
  })
}
