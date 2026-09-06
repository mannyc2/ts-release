#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import { runApplication } from "./host.js"

const [application, inputFile] = process.argv.slice(2)
if (application === undefined || inputFile === undefined) {
  throw new Error("Usage: release-lab <application.mjs> <input.json>")
}
const report = await runApplication(application, JSON.parse(await readFile(inputFile, "utf8")))
process.stdout.write(`${JSON.stringify(report)}\n`)
