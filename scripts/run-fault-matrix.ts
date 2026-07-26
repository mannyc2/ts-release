import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { encodeCanonicalJson } from "./lib/canonical-json.js"
import {
  FileBackedFakeRemote,
  faultCells,
  structuralControls
} from "../test/rewrite/fault-matrix.js"

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: { bootstrap: { type: "boolean", default: false } },
  strict: true
})
if (!values.bootstrap) throw new Error("Plan 173 supports --bootstrap only.")

const directory = mkdtempSync(join(tmpdir(), "ts-release-fault-matrix-"))
try {
  const results = faultCells.map((cell, index) =>
    cell.run(new FileBackedFakeRemote(join(directory, String(index)))))
  const controls = structuralControls.map((control) => control.run())
  if (faultCells.length !== 45 || structuralControls.length !== 11) {
    throw new Error("Fault matrix roster is incomplete.")
  }
  process.stdout.write(encodeCanonicalJson({
    schemaVersion: 1,
    cells: faultCells.length,
    controls: structuralControls.length,
    statuses: {
      candidatePending: [...results, ...controls]
        .filter((result) => result.status === "candidate-pending").length,
      legacyKnownDefect: results
        .filter((result) => result.status === "legacy-known-defect").length
    },
    results: [...results, ...controls]
  }))
} finally {
  rmSync(directory, { recursive: true, force: true })
}
