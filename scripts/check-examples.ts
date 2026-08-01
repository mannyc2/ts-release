#!/usr/bin/env bun

import * as Effect from "effect/Effect"
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { BunReleaseLayer } from "../src/platform/bun.js"
import { CatalogStructuredRequest, DriverCatalog } from "../src/drivers/services.js"
import { WorkspaceRoot } from "../src/model/primitives.js"
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
  const filesOnlyPacks = result.plan.stages.process.filter((operation) =>
    operation._tag === "Pack" && operation.files !== undefined && operation.inputs.length === 0)
  for (const operation of filesOnlyPacks) {
    const temp = mkdtempSync(join(tmpdir(), "ts-release-example-archive-"))
    try {
      cpSync(workspace, temp, { recursive: true })
      await Effect.runPromise(Effect.gen(function*() {
        const catalog = yield* DriverCatalog
        return yield* catalog.structured(CatalogStructuredRequest.make({
          operation, root: WorkspaceRoot.make(realpathSync(temp)), availableOutputs: []
        }))
      }).pipe(Effect.provide(BunReleaseLayer)))
    } catch (cause) {
      throw new Error(`${path}: files-only archive ${operation.id} failed to materialize: ${String(cause)}`)
    } finally {
      rmSync(temp, { recursive: true, force: true })
    }
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
