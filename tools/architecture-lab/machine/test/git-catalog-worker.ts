import { readFileSync } from "node:fs"
import { join } from "node:path"
import * as Effect from "effect/Effect"
import { SqliteJournal } from "../../storage/sqlite.js"
import { loadPlan, makeCoreGitTransport, runRelease, type CoreGitOptions } from "../src/index.js"
import { runWithHost } from "./fixtures.js"
import { binding, catalog, decodeIntent } from "./git-catalog-fixture.js"
const [root, mode] = process.argv.slice(2)
if (!root) throw new Error("Missing research root")
const plan = await Effect.runPromise(loadPlan(JSON.parse(readFileSync(join(root, "plan.json"), "utf8")), [catalog]))
const bindings = plan.operations.map((operation, index) => binding(decodeIntent(operation.intent), root, mode === "lost" && index === 0)) as [CoreGitOptions, ...CoreGitOptions[]]
const store = new SqliteJournal(join(root, "journal.sqlite"))
try {
  const report = await runWithHost({ store, providers: [catalog], transport: makeCoreGitTransport(bindings), now: Date.now, uniqueId: () => crypto.randomUUID() },
    runRelease({ plan, authorize: true, ...(mode === "lost" ? { maxDispatches: 1 } : {}) }))
  console.log(JSON.stringify(report))
} finally { store.close() }
