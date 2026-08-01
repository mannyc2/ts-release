import { describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  actionCommands,
  actionOutputs,
  runAction
} from "../apps/ts-release-action/src/commands.js"
import type { ApplyInput, ApplyOutput } from "../src/api/types.js"

describe("installed Action commands", () => {
  test("has exact commands and outputs", () => {
    expect(actionCommands).toEqual(["plan", "apply", "doctor"])
    expect(actionOutputs).toHaveLength(9)
    const manifest = readFileSync("apps/ts-release-action/action.yml", "utf8")
    for (const output of actionOutputs) expect(manifest).toContain(`${output}:`)
  })

  test("the retry input reaches the api as a retry id list", async () => {
    const directory = mkdtempSync(join(tmpdir(), "ts-release-action-retry-"))
    try {
      writeFileSync(join(directory, "plan.json"), "plan-bytes")
      const inputs: Record<string, string> = {
        command: "apply",
        "plan-path": "plan.json",
        "plan-id": "plan",
        reviewer: "reviewer",
        resume: "runs/run.json",
        retry: "upload"
      }
      let captured: ApplyInput | undefined
      const api = {
        plan: () => Promise.reject(new Error("unused")),
        reviewExecution: () => Promise.reject(new Error("unused")),
        apply: (input: ApplyInput) => {
          captured = input
          return Promise.resolve({
            status: "stopped",
            runId: "run",
            runPath: join(directory, "runs/run.json"),
            executionReceiptId: "receipt",
            evidence: {}
          } as unknown as ApplyOutput)
        }
      }
      await runAction(api, {
        workspace: directory,
        input: (name) => inputs[name] ?? "",
        output: () => {},
        read: (path) => readFileSync(path, "utf8"),
        write: () => {}
      })
      expect(captured?.retry).toEqual(["upload"])
      expect(captured?.resumeRunPath).toBe("runs/run.json")
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
