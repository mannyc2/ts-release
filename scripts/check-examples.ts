#!/usr/bin/env bun

import * as Schema from "effect/Schema"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { AuthoredConfig } from "../src/resolve/authored.js"
import { commandNames } from "../apps/release-ts/src/cli/commands.js"

const root = process.cwd()
const configs: string[] = []
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
  try {
    Schema.decodeUnknownSync(AuthoredConfig, { onExcessProperty: "error" })(
      JSON.parse(readFileSync(path, "utf8")) as unknown
    )
  } catch (cause) {
    throw new Error(`${path}: authored configuration is invalid: ${String(cause)}`)
  }
}

const workflowRoot = resolve(root, "templates", "github-actions")
const workflows = existsSync(workflowRoot)
  ? readdirSync(workflowRoot).filter((name) => /\.ya?ml$/u.test(name))
  : []
for (const name of workflows) {
  const text = readFileSync(join(workflowRoot, name), "utf8")
  if (/\bcommand:\s*(?:plan|apply|doctor|build|verify)\b/u.test(text)) {
    throw new Error(`${name}: workflow uses a removed lifecycle command.`)
  }
}

console.log(JSON.stringify({
  schemaVersion: "release-examples-report/v1",
  examples: configs.filter((path) => path.includes("/examples/")).length,
  templates: configs.filter((path) => path.includes("/templates/")).length,
  workflows: workflows.length,
  commands: commandNames,
  status: "current"
}))
