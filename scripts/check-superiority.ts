#!/usr/bin/env bun

import { readFileSync } from "node:fs"
import { cwd, exit } from "node:process"
import { encodeCanonicalJson } from "./lib/canonical-json.js"
import { checkSuperiority, validateSuperiorityClaims } from "./lib/superiority.js"

const args = process.argv.slice(2).filter((argument) => argument !== "--")
let milestone = "PARITY"
let checkClaims = false
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--check-claims") {
    checkClaims = true
    continue
  }
  if (args[index] !== "--milestone") {
    console.error(`Unknown argument: ${args[index]}`)
    exit(1)
  }
  milestone = args[++index] ?? ""
}

try {
  const root = cwd()
  const report = checkSuperiority(root, milestone)
  if (checkClaims) {
    validateSuperiorityClaims(root, ["README.md", "SPEC.md", "ARCHITECTURE.md", "CHANGELOG.md"]
      .map((path) => readFileSync(path, "utf8")).join("\n"))
  }
  console.log(encodeCanonicalJson(report).trimEnd())
  if (report.failures.length > 0) exit(1)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  exit(1)
}
