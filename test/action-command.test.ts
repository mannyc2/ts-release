import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { actionCommands, actionOutputs } from "../apps/ts-release-action/src/commands.js"

test("Action manifest matches the one-command surface", () => {
  const manifest = readFileSync("apps/ts-release-action/action.yml", "utf8")
  expect(actionCommands).toEqual(["release"])
  expect(actionOutputs).toEqual(["prepared", "status"])
  expect(manifest).toContain("prepared:")
  expect(manifest).toContain("status:")
  expect(manifest).not.toMatch(/\b(?:plan|apply|doctor|review|ledger)\b/iu)
})
