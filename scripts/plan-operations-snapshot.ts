#!/usr/bin/env bun

import * as Effect from "effect/Effect"
import { readFileSync } from "node:fs"
import { acceptPlan } from "../src/plan/accepted.js"
import { operationEntries } from "../src/model/validate.js"

const path = process.argv[2]
if (path === undefined) throw new Error("usage: plan-operations-snapshot <plan.json>")
const accepted = await Effect.runPromise(
  acceptPlan(new TextEncoder().encode(readFileSync(path, "utf8")))
)
process.stdout.write(JSON.stringify(operationEntries(accepted.plan).map(({ stage, operation }) => ({
  id: operation.id,
  stage,
  mechanism: operation._tag,
  inputs: operation.inputs,
  outputs: operation.outputs.map((output) => output.id)
})), null, 2))
