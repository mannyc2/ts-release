import { describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { runAction } from "../../apps/ts-release-action/src/commands.js"

test("Action invokes one automatic release and emits only prepared/status", async () => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-action-"))
  writeFileSync(join(root, "release.config.json"), JSON.stringify({ project: {} }))
  let calls = 0
  const outputs: Record<string, string> = {}
  await runAction({ release: async (input) => {
    calls += 1
    expect(input.workspace).toBe(root)
    return { prepared: { directory: join(root, ".release/ts-release/prepared/digest") } as never, publications: [] }
  } }, {
    workspace: root,
    input: (name) => name === "config" ? "release.config.json" : name === "prepared" ? ".release/ts-release/prepared" : "",
    output: (name, value) => { outputs[name] = value },
    read: (path) => readFileSync(path, "utf8"),
    write: () => undefined
  })
  expect(calls).toBe(1)
  expect(outputs).toEqual({ prepared: join(root, ".release/ts-release/prepared/digest"), status: "complete" })
})
