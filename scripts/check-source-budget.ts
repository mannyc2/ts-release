#!/usr/bin/env bun

import { cwd, exit } from "node:process"
import { encodeCanonicalJson } from "./lib/canonical-json.js"
import { countSourceTree, recordImplementationKey } from "./lib/source-budget.js"

interface Options {
  readonly milestone: string
  readonly families: ReadonlyArray<string>
  readonly recordKey?: string | undefined
}

const parseOptions = (args: ReadonlyArray<string>): Options => {
  let milestone = "M0"
  let milestoneExplicit = false
  const families: Array<string> = []
  let recordKey: string | undefined
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!
    if (argument === "--") continue
    if (argument === "--milestone") {
      milestone = args[++index] ?? ""
      milestoneExplicit = true
      continue
    }
    if (argument === "--family") {
      families.push(args[++index] ?? "")
      continue
    }
    if (argument === "--record-key") {
      if (recordKey !== undefined) throw new Error("Duplicate --record-key.")
      recordKey = args[++index]
      continue
    }
    throw new Error(`Unknown argument: ${argument}`)
  }
  if (milestone.length === 0) throw new Error("--milestone requires a value.")
  if (recordKey === "") throw new Error("--record-key requires a value.")
  if (!milestoneExplicit && families.length > 0) milestone = "PARITY"
  return { milestone, families, ...(recordKey === undefined ? {} : { recordKey }) }
}

try {
  const options = parseOptions(process.argv.slice(2))
  if (options.recordKey !== undefined) {
    const target = await recordImplementationKey(cwd(), options.recordKey)
    console.log(encodeCanonicalJson({ recorded: target }).trimEnd())
  } else {
    const report = await countSourceTree(cwd(), options.milestone, options.families)
    console.log(encodeCanonicalJson(report).trimEnd())
    if (report.warnings.length > 0) exit(1)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  exit(1)
}
