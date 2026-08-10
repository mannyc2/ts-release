import { describe, expect, test } from "bun:test"
import { commandNames, makeCli } from "../../apps/release-ts/src/cli/command.js"
import { cliApi, ioFor } from "./cli-fixture.js"

describe("CLI cutover", () => {
  test("exposes exactly init inspect prepare publish release correct", () => {
    expect(commandNames).toEqual(["init", "inspect", "prepare", "publish", "release", "correct"])
    expect(makeCli(cliApi(), process.cwd(), ioFor())).toBeDefined()
  })
})
