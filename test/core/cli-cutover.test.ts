import { describe, expect, test } from "bun:test"
import { commandNames, makeCli } from "../../apps/release-ts/src/cli/command.js"
import { cliApiFactory, ioFor } from "./cli-fixture.js"

describe("CLI cutover", () => {
  test("exposes exactly init inspect prepare observe publish release correct", () => {
    expect(commandNames).toEqual([
      "init",
      "inspect",
      "prepare",
      "observe",
      "publish",
      "release",
      "correct"
    ])
    expect(makeCli(cliApiFactory(), process.cwd(), ioFor())).toBeDefined()
  })
})
