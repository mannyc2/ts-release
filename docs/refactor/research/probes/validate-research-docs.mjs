import { readFileSync } from "node:fs"

const root = new URL("../", import.meta.url)
const documents = [
  "artifact-model.md",
  "effect-patterns.md",
  "provider-contracts.md",
  "resumability.md",
  "goreleaser-outcomes.md",
  "decision-packet.md"
]

const text = (path) => readFileSync(new URL(path, root), "utf8")

for (const document of documents) {
  const value = text(document)
  if (/[^\x00-\x7f]/u.test(value)) {
    throw new Error(`${document} contains non-ASCII text`)
  }
}

const ledger = text("goreleaser-outcomes.md")
const observed = [...ledger.matchAll(/^\| ((?:C|P)\d{3}) \|/gmu)].map((match) => match[1])
const expected = [
  ...Array.from({ length: 115 }, (_, index) => `C${String(index + 1).padStart(3, "0")}`),
  ...Array.from({ length: 36 }, (_, index) => `P${String(index + 1).padStart(3, "0")}`)
]
if (JSON.stringify(observed) !== JSON.stringify(expected)) {
  throw new Error(`GoReleaser ledger IDs differ: observed ${observed.length}, expected ${expected.length}`)
}

const artifact = text("artifact-model.md")
for (const phrase of [
  "returned Bundle type has no add method",
  "Bundle.fromValidated",
  "not structurally tied",
  "No root artifact API is selected"
]) {
  if (!artifact.includes(phrase)) throw new Error(`artifact-model.md is missing: ${phrase}`)
}

const effect = text("effect-patterns.md")
for (const phrase of [
  "4.0.0-beta.83",
  "4.0.0-rc.108",
  "ee06c9c1eed73ebcf282541ceb1615ff1ba1730d",
  "compile-only",
  "No aligned Effect version is selected"
]) {
  if (!effect.includes(phrase)) throw new Error(`effect-patterns.md is missing: ${phrase}`)
}

const resumability = text("resumability.md")
for (const phrase of [
  "Planned",
  "Dispatching",
  "ReconcileRequired",
  "cannot fence a stale request already in flight",
  "HistoricalReceipt",
  "FreshObservation"
]) {
  if (!resumability.includes(phrase)) throw new Error(`resumability.md is missing: ${phrase}`)
}

const standalone = readFileSync(new URL("custom-provider/scripts/test-standalone-loader.mjs", import.meta.url), "utf8")
if (!standalone.includes("loadedUnknownProvider")) throw new Error("standalone probe does not report its product outcome")
if (standalone.includes("README must state")) throw new Error("standalone probe still uses the README false green")

console.log(JSON.stringify({
  asciiDocuments: documents.length,
  ledgerCases: observed.length,
  ledgerFirst: observed[0],
  ledgerLast: observed.at(-1),
  standaloneOutcomeReported: true
}))
