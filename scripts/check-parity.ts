#!/usr/bin/env bun

import { readFileSync } from "node:fs"
import { cwd, exit } from "node:process"
import { runClaimCases } from "./lib/claim-cases.js"
import { encodeCanonicalJson } from "./lib/canonical-json.js"
import {
  FINAL_PARITY_CLAIM,
  readParityManifest,
  requiredCaseIds,
  validateParityClaim
} from "./lib/parity.js"

const args = process.argv.slice(2).filter((argument) => argument !== "--")
let family: string | undefined
let checkClaims = false
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index]
  if (argument === "--family") family = args[++index]
  else if (argument === "--check-claims") checkClaims = true
  else {
    console.error(`Unknown argument: ${argument}`)
    exit(1)
  }
}

try {
  const root = cwd()
  const manifest = readParityManifest(root)
  const run = await runClaimCases(root, family === undefined ? {} : { family })
  const results = new Map(run.results.map((result) => [result.id, result]))
  const selected = manifest.rows.filter((row) =>
    row.scope === "included" && (family === undefined || row.family === family)
  )
  const passingRows = selected.filter((row) =>
    requiredCaseIds(manifest, row).every((id) => results.get(id)?.status === "pass")
  )
  const passingCustomization = passingRows.filter((row) => row.population === "customization").length
  const passingPro = passingRows.filter((row) => row.population === "pro").length
  const eligibleCustomization = selected.filter((row) => row.population === "customization").length
  const eligiblePro = selected.filter((row) => row.population === "pro").length
  if (checkClaims) {
    if (family !== undefined) throw new Error("--check-claims requires the complete parity run.")
    validateParityClaim(manifest.claim, passingCustomization, passingPro)
    const docs = ["README.md", "SPEC.md", "ARCHITECTURE.md", "CHANGELOG.md"]
      .map((path) => readFileSync(path, "utf8")).join("\n").replace(/\s+/gu, " ")
    if (!docs.includes(FINAL_PARITY_CLAIM)) throw new Error("Public docs omit the frozen parity claim.")
    if (/\bfull parity\b|\bparity is full\b/iu.test(docs)) {
      throw new Error("Public docs contain an unqualified full-parity claim.")
    }
  }
  const report = {
    schemaVersion: "rewrite-parity-report/v1",
    pin: manifest.pin,
    family: family ?? "all",
    sourceSnapshotHash: run.sourceSnapshotHash,
    raw: manifest.populations.raw,
    eligible: { customization: eligibleCustomization, pro: eligiblePro },
    excluded: manifest.populations.excluded,
    passing: { customization: passingCustomization, pro: passingPro },
    caseSummary: {
      selected: run.selected,
      passed: run.passed,
      pending: run.pending,
      failed: run.failed
    }
  }
  if (family === undefined) {
    console.log("raw customization=115 pro=36 deprecations=40")
    console.log("eligible customization=107 pro=33")
    console.log("excluded customization=8 pro=3")
    console.log(`passing customization=${passingCustomization}/107`)
    console.log(`passing pro=${passingPro}/33`)
  } else {
    console.log(`${family} customization=${passingCustomization}/${eligibleCustomization}`)
    console.log(`${family} pro=${passingPro}/${eligiblePro}`)
    console.log(`${family} unresolved=${eligibleCustomization + eligiblePro - passingRows.length}`)
  }
  console.log(encodeCanonicalJson(report).trimEnd())
  if (
    run.failed > 0 ||
    passingCustomization !== eligibleCustomization ||
    passingPro !== eligiblePro
  ) {
    exit(1)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  exit(1)
}
