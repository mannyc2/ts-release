import { describe, expect, test } from "bun:test"
import { commandNames } from "../apps/release-ts/src/cli/commands.js"

describe("installed CLI commands", () => {
  test("has exactly the four sealed commands", () => {
    expect(commandNames).toEqual(["init", "doctor", "plan", "apply"])
  })
})
