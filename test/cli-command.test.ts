import { describe, expect, test } from "bun:test"
import { commandNames } from "../apps/release-ts/src/cli/commands.js"

describe("CLI command vocabulary", () => {
  test("contains no protocol commands", () => {
    expect(commandNames).toEqual([
      "init",
      "inspect",
      "prepare",
      "observe",
      "publish",
      "release",
      "correct"
    ])
  })
})
