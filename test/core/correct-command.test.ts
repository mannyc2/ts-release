import { describe, expect, test } from "bun:test"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runCorrect } from "../../apps/release-ts/src/cli/commands.js"
import { cliApi, ioFor, localPrepared } from "./cli-fixture.js"

test("correct command reads and forwards authored correction contents", async () => {
  const root = mkdtempSync(join(tmpdir(), "ts-release-correct-cli-"))
  const correctionPath = join(root, "correction.json")
  const authored = "{\n  \"provider\": \"npm\",\n  \"kind\": \"deprecate\",\n  \"message\": \"Use 1.0.1.\"\n}\n"
  writeFileSync(correctionPath, authored)
  let calls = 0
  let received: unknown
  const io = ioFor({ [correctionPath]: authored })
  await runCorrect(cliApi({
    correct: async (input) => {
      calls += 1
      received = input.correction
      return { prepared: input.prepared, status: "unsupported", reason: "fixture" } as never
    }
  }), { prepared: localPrepared, correction: correctionPath }, root, io)
  expect(calls).toBe(1)
  expect(received).toEqual({ provider: "npm", kind: "deprecate", message: "Use 1.0.1." })
})
