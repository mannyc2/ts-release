import { expect, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { actionCommands, actionOutputs, runAction, type ActionRuntime } from "../apps/ts-release-action/src/commands.js"

const runtime = (root: string, values: Record<string, string>, outputs: Record<string, string>): ActionRuntime => ({
  workspace: root,
  input: (name) => values[name] ?? "",
  output: (name, value) => { outputs[name] = value },
  read: (path) => readFileSync(path, "utf8"),
  write: (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value) }
})

test("Action metadata exposes four thin commands and three useful outputs", () => {
  const manifest = readFileSync("apps/ts-release-action/action.yml", "utf8")
  expect(actionCommands).toEqual(["prepare", "publish", "inspect", "correct"])
  expect(actionOutputs).toEqual(["status", "prepared_path", "report_path"])
  expect(manifest).toContain("command:")
  expect(manifest).toContain("prepared_path:")
  expect(manifest).toContain("report_path:")
  expect(manifest).not.toMatch(/\b(?:plan|apply|doctor|review|ledger|receipt|reviewer)\b/iu)
})

test("prepare makes one public call and writes a contained report", async () => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-action-"))
  writeFileSync(join(root, "release.config.json"), JSON.stringify({ project: {} }))
  const outputs: Record<string, string> = {}
  let calls = 0
  await runAction({
    prepare: async (input) => {
      calls += 1
      expect(input.workspace).toBe(root)
      return { directory: join(root, ".release/ts-release/prepared/digest") } as never
    }, publish: async () => [], inspect: async () => ({}) as never, correct: async () => ({}) as never
  }, runtime(root, { command: "prepare", config: "release.config.json" }, outputs))
  expect(calls).toBe(1)
  expect(outputs.status).toBe("complete")
  expect(outputs.prepared_path).toBe(join(root, ".release/ts-release/prepared/digest"))
  expect(existsSync(outputs.report_path!)).toBe(true)
  expect(readFileSync(outputs.report_path!, "utf8")).toContain('"command": "prepare"')
})
