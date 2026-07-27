#!/usr/bin/env bun

import * as Effect from "effect/Effect"
import { readFileSync } from "node:fs"
import { acceptPlan } from "../src/plan/accepted.js"
import { operationEntries } from "../src/model/validate.js"

const [path, operationId] = process.argv.slice(2)
if (path === undefined || operationId === undefined) {
  throw new Error("usage: plan-operation-contents <plan.json> <operationId>")
}
const accepted = await Effect.runPromise(
  acceptPlan(new TextEncoder().encode(readFileSync(path, "utf8")))
)
const operation = operationEntries(accepted.plan)
  .find((entry) => entry.operation.id === operationId)?.operation
if (operation === undefined) throw new Error(`Unknown operation ${operationId}.`)
process.stdout.write(JSON.stringify(
  operation._tag === "Write" ? operation.content : { _tag: operation._tag },
  null,
  2
))
