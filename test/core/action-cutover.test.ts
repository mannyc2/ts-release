import { expect, test } from "bun:test"
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { runAction, type ActionRuntime } from "../../apps/ts-release-action/src/commands.js"

const fixture = (command: string, root: string, extra: Record<string, string> = {}): [ActionRuntime, Record<string, string>] => {
  const outputs: Record<string, string> = {}
  const values: Record<string, string> = { command, ...extra }
  return [{
    workspace: root,
    input: (name) => values[name] ?? "",
    output: (name, value) => { outputs[name] = value },
    read: (path) => readFileSync(path, "utf8"),
    write: (path, value) => { mkdirSync(join(path, ".."), { recursive: true }); writeFileSync(path, value) }
  }, outputs]
}

test("each Action command invokes exactly its same-named public operation", async () => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-action-"))
  writeFileSync(join(root, "release.config.json"), "{}")
  mkdirSync(join(root, "prepared"))
  writeFileSync(join(root, "correction.json"), "{}")
  const calls: string[] = []
  const api = {
    prepare: async () => { calls.push("prepare"); return { directory: join(root, "prepared") } as never },
    publish: async () => { calls.push("publish"); return [] },
    inspect: async () => { calls.push("inspect"); return {} as never },
    correct: async () => { calls.push("correct"); return {} as never }
  }
  for (const [command, extra] of [["prepare", { config: "release.config.json" }], ["publish", { prepared: "prepared" }], ["inspect", { prepared: "prepared" }], ["correct", { prepared: "prepared", correction: "correction.json" }] ] as const) {
    const [io] = fixture(command, root, extra)
    await runAction(api, io)
  }
  expect(calls).toEqual(["prepare", "publish", "inspect", "correct"])
})

test("invalid combinations and escaping paths fail before the API call", async () => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-action-"))
  let calls = 0
  const api = { prepare: async () => { calls += 1; return {} as never }, publish: async () => { calls += 1; return [] }, inspect: async () => { calls += 1; return {} as never }, correct: async () => { calls += 1; return {} as never }
  }
  const [invalid, invalidOutputs] = fixture("publish", root, { config: "release.config.json" })
  await expect(runAction(api, invalid)).rejects.toThrow("not valid for command")
  expect(invalidOutputs.status).toBe("failed")
  const [escaping, escapingOutputs] = fixture("inspect", root, { config: "../outside.json" })
  await expect(runAction(api, escaping)).rejects.toThrow("outside GITHUB_WORKSPACE")
  expect(escapingOutputs.status).toBe("failed")
  expect(existsSync(escapingOutputs.report_path!)).toBe(true)
  expect(calls).toBe(0)
})
