#!/usr/bin/env bun

import { encodeCanonicalJson } from "./lib/canonical-json.js"
import { runAudit } from "./lib/audit.js"

try {
  console.log(encodeCanonicalJson(runAudit(process.cwd())).trimEnd())
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
