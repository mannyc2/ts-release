#!/usr/bin/env bun
import {
  apply,
  plan,
  reviewExecution
} from "@mannyc1/ts-release"
import {
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs"
import { dirname } from "node:path"
import { runCutoverCli } from "./cutover.js"

await runCutoverCli(
  { plan, reviewExecution, apply },
  process.argv.slice(2),
  process.cwd(),
  {
    read: (path) => readFileSync(path, "utf8"),
    write: (path, value) => {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, value)
    },
    log: console.log
  }
).catch((cause) => {
  console.error(cause instanceof Error ? cause.message : String(cause))
  process.exitCode = 1
})
