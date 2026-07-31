#!/usr/bin/env bun

import { cwd, exit } from "node:process"
import { checkArchitecture } from "./lib/architecture.js"
import { encodeCanonicalJson } from "./lib/canonical-json.js"

const args = process.argv.slice(2).filter((argument) => argument !== "--")
let milestone = "contract"
for (let index = 0; index < args.length; index += 1) {
  if (args[index] !== "--milestone") {
    console.error(`Unknown argument: ${args[index]}`)
    exit(1)
  }
  milestone = args[++index] ?? ""
}

try {
  const report = checkArchitecture(cwd(), milestone)
  console.log(encodeCanonicalJson(report).trimEnd())
  if (report.failures.length > 0) exit(1)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  exit(1)
}
