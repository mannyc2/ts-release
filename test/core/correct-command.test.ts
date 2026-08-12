import { describe, expect, test } from "bun:test"
import { runCorrect } from "../../apps/release-ts/src/cli/commands.js"
import { cliApi, ioFor } from "./cli-fixture.js"

test("correct command forwards one prepared bundle and one canonical intent", async () => {
  let calls = 0
  const io = ioFor()
  await runCorrect(cliApi({ correct: async () => { calls += 1; return {} as never } }),
    { prepared: "/tmp/prepared", correction: "/tmp/correction.json" }, process.cwd(), io)
  expect(calls).toBe(1)
})
