import { describe, expect, test } from "bun:test"
import { commandNames } from "../apps/release-ts/src/cli/cutover.js"

describe("installed CLI cutover", () => {
  test("has exactly the four sealed commands", () => {
    expect(commandNames).toEqual(["init", "doctor", "plan", "apply"])
  })
})
