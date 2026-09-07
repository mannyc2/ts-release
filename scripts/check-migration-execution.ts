import assert from "node:assert/strict"
import { join, resolve } from "node:path"

const root = resolve(import.meta.dir, "..")
const waves = await Bun.file(
  join(root, "docs/refactor/architecture-program/handoff/waves.json"),
).json()
const record = await Bun.file(join(root, "docs/refactor/execution/W01-migration.json")).json()
const expected = waves.migrationExecutionMapping.currentSourceRows.filter(
  (row: { wave: string }) => row.wave === "W01",
)
assert.deepEqual(
  record.rows.map((row: { path: string }) => row.path).sort(),
  expected.map((row: { path: string }) => row.path).sort(),
)
let deletedLines = 0
for (const row of record.rows) {
  assert.equal(row.sha256, expected.find((item: { path: string }) => item.path === row.path).sha256)
  assert.equal(
    await Bun.file(join(root, row.path)).exists(),
    false,
    `Retired authority restored: ${row.path}`,
  )
  for (const path of row.successorPaths) assert.ok(await Bun.file(join(root, path)).exists(), path)
  for (const wave of row.nativeCarryForwardWaves)
    assert.ok(
      record.nativeCarryForward.find(
        (entry: { wave: string; files: string[] }) =>
          entry.wave === wave && entry.files.includes(row.path),
      ),
    )
  deletedLines += row.lines
}
assert.equal(deletedLines, record.physicalDeletedLines)
assert.equal(record.rows.length, 51)
const progress = await Bun.file(join(root, "docs/refactor/execution/progress.json")).json()
if (progress.completedWave === "W10")
  assert.ok(
    record.nativeCarryForward.every((entry: { status: string }) => entry.status === "verified"),
    "Mixed native migration responsibilities remain open",
  )
console.log(
  JSON.stringify({
    wave: record.wave,
    retiredFiles: record.rows.length,
    deletedLines,
    nativeCarryForwardOpen: record.nativeCarryForward
      .filter((entry: { status: string }) => entry.status !== "verified")
      .map((entry: { wave: string }) => entry.wave),
  }),
)
