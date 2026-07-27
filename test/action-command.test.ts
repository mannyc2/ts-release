import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import {
  actionCommands,
  actionOutputs
} from "../apps/ts-release-action/src/cutover.js"

describe("installed Action cutover", () => {
  test("has exact commands and outputs", () => {
    expect(actionCommands).toEqual(["plan", "apply", "doctor"])
    expect(actionOutputs).toHaveLength(9)
    const manifest = readFileSync("apps/ts-release-action/action.yml", "utf8")
    for (const output of actionOutputs) expect(manifest).toContain(`${output}:`)
  })
})
