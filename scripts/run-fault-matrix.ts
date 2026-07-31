import { mkdtempSync, rmSync } from "node:fs"
import { randomBytes } from "node:crypto"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { encodeCanonicalJson } from "./lib/canonical-json.js"
import {
  FileBackedFakeRemote,
  faultCells,
  structuralControls
} from "../test/rewrite/fault-matrix.js"

const directory = mkdtempSync(join(tmpdir(), "ts-release-fault-matrix-"))
try {
  const fakeCredential = randomBytes(32).toString("hex")
  const tests = Bun.spawnSync(["bun", "test",
    "test/rewrite/fault-matrix.test.ts",
    "test/rewrite/run-ledger.test.ts",
    "test/rewrite/run-store.test.ts",
    "test/rewrite/apply.test.ts"
  ], {
    cwd: process.cwd(), stdin: "ignore", stdout: "pipe", stderr: "pipe",
    env: { ...process.env, REWRITE_FAKE_CREDENTIAL: fakeCredential }
  })
  if (tests.exitCode !== 0) {
    process.stderr.write(tests.stderr)
    throw new Error("Candidate fault tests failed.")
  }
  const results = faultCells.map((cell, index) =>
    cell.run(new FileBackedFakeRemote(join(directory, String(index)))))
  const controls = structuralControls.map((control) => control.run())
  if (faultCells.length !== 45 || structuralControls.length !== 11) {
    throw new Error("Fault matrix roster is incomplete.")
  }
  const all = [...results, ...controls]
  const report = encodeCanonicalJson({
    schemaVersion: 1,
    status: "candidate-proven",
    faultCells: { passed: results.filter(({ status }) => status === "passed").length, total: 45 },
    structuralControls: { confirmed: controls.filter(({ status }) => status === "passed").length, total: 11 },
    duplicateMutations: all.reduce((total, result) => total + result.duplicateMutations, 0),
    credentialLeaks: all.reduce((total, result) => total + result.credentialLeaks, 0),
    unclassified: all.reduce((total, result) => total + result.unclassified, 0),
    results: all
  })
  if ([tests.stdout.toString(), tests.stderr.toString(), report]
    .some((value) => value.includes(fakeCredential))) throw new Error("Fake credential leaked.")
  process.stdout.write(report)
} finally {
  rmSync(directory, { recursive: true, force: true })
}
