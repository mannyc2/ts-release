#!/usr/bin/env bun

import { existsSync, readFileSync, readdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { plan } from "../src/index.js"
import { encodeCanonicalJson } from "./lib/canonical-json.js"

const root = process.cwd()
const configs: Array<string> = []
const walk = (directory: string): void => {
  if (!existsSync(directory)) return
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) walk(path)
    else if (entry.isFile() && entry.name === "release.config.json") configs.push(path)
  }
}
walk(resolve(root, "examples"))
walk(resolve(root, "templates"))

for (const path of configs) {
  const workspace = dirname(path)
  const config = JSON.parse(readFileSync(path, "utf8")) as unknown
  const result = await plan({ config, workspace })
  const returnedPlan = JSON.parse(JSON.stringify(result.plan)) as unknown
  if (encodeCanonicalJson(returnedPlan) !== result.bytes) {
    throw new Error(`${path}: public plan bytes differ from the returned plan.`)
  }
}

const workflowRoot = resolve(root, "templates", "github-actions")
const workflows = existsSync(workflowRoot)
  ? readdirSync(workflowRoot).filter((name) => /\.ya?ml$/u.test(name))
  : []
for (const name of workflows) {
  const text = readFileSync(join(workflowRoot, name), "utf8")
  if (/\bcommand:\s*(?:build|release|verify)\b/u.test(text)) {
    throw new Error(`${name}: workflow uses a removed lifecycle command.`)
  }
}

process.stdout.write(encodeCanonicalJson({
  schemaVersion: "rewrite-examples-report/v1",
  examples: configs.filter((path) => path.includes("/examples/")).length,
  templates: configs.filter((path) => path.includes("/templates/")).length,
  workflows: workflows.length,
  status: "current"
}))
