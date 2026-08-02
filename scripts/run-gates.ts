import { readFileSync } from "node:fs"
import { cwd, exit } from "node:process"

// Runs every gate in check:portable sequentially, keeps going on failure,
// and prints one table — so a contributor sees ALL failures in one run
// instead of fail-one-fix-rerun. The gate list is read from package.json so
// there is exactly one place chains are defined.
const scripts = (JSON.parse(readFileSync(`${cwd()}/package.json`, "utf8")) as {
  readonly scripts: Readonly<Record<string, string>>
}).scripts

const expand = (name: string): ReadonlyArray<string> => {
  const value = scripts[name]
  if (value === undefined) return [name]
  return value.split("&&").map((step) => step.trim()).flatMap((step) => {
    const chained = step.match(/^bun run (check:[a-z-]+)$/u)
    return chained !== null && (scripts[chained[1]!]?.includes("&&") ?? false)
      ? expand(chained[1]!)
      : [step]
  })
}

const steps = expand("check:portable")
const rows: Array<{ readonly step: string; readonly ok: boolean; readonly seconds: string }> = []
for (const step of steps) {
  const startedAt = performance.now()
  const result = Bun.spawnSync(["sh", "-c", step], { stdout: "inherit", stderr: "inherit" })
  rows.push({
    step,
    ok: result.exitCode === 0,
    seconds: ((performance.now() - startedAt) / 1000).toFixed(1)
  })
}

const width = Math.max(...rows.map((row) => row.step.length))
console.log(`\n${"gate".padEnd(width)} | status | seconds`)
for (const row of rows) {
  console.log(`${row.step.padEnd(width)} | ${row.ok ? "pass  " : "FAIL  "} | ${row.seconds}`)
}
exit(rows.every((row) => row.ok) ? 0 : 1)
