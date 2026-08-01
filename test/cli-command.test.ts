import { describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { commandNames, runApply } from "../apps/release-ts/src/cli/commands.js"
import type { ApplyInput, ApplyOutput } from "../src/api/types.js"

describe("installed CLI commands", () => {
  test("has exactly the four sealed commands", () => {
    expect(commandNames).toEqual(["init", "doctor", "plan", "apply"])
  })

  test("--retry reaches the api as a retry id list", async () => {
    const directory = mkdtempSync(join(tmpdir(), "ts-release-cli-retry-"))
    try {
      writeFileSync(join(directory, "plan.json"), "plan-bytes")
      let captured: ApplyInput | undefined
      const api = {
        plan: () => Promise.reject(new Error("unused")),
        reviewExecution: () => Promise.reject(new Error("unused")),
        apply: (input: ApplyInput) => {
          captured = input
          return Promise.resolve({
            status: "stopped",
            runId: "run",
            runPath: "runs/run.json",
            executionReceiptId: "receipt"
          } as unknown as ApplyOutput)
        }
      }
      await runApply(api, {
        plan: "plan.json",
        planId: "plan",
        root: ".",
        reviewer: "reviewer",
        resume: "runs/run.json",
        retry: "upload,forge"
      }, directory, {
        read: (path) => readFileSync(path, "utf8"),
        write: () => {},
        log: () => {}
      })
      expect(captured?.retry).toEqual(["upload", "forge"])
      expect(captured?.resumeRunPath).toBe("runs/run.json")
      expect(captured?.reconcile).toBeUndefined()
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
