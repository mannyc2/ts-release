#!/usr/bin/env bun

import { cwd, exit } from "node:process"
import { runClaimCases } from "./lib/claim-cases.js"
import { encodeCanonicalJson } from "./lib/canonical-json.js"

const args = process.argv.slice(2).filter((argument) => argument !== "--")
let family: string | undefined
const ids: Array<string> = []
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index]
  if (argument === "--family") family = args[++index]
  else if (argument === "--case") ids.push(args[++index] ?? "")
  else {
    console.error(`Unknown argument: ${argument}`)
    exit(1)
  }
}

try {
  const report = await runClaimCases(cwd(), {
    ...(family === undefined ? {} : { family }),
    ...(ids.length === 0 ? {} : { ids })
  })
  console.log(encodeCanonicalJson(report).trimEnd())
  if (report.failed > 0) exit(1)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  exit(1)
}
