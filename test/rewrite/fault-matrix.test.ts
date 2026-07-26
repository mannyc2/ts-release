import { describe, expect, test } from "@effect/bun-test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  FileBackedFakeRemote,
  failureKinds,
  faultCells,
  injectionPoints,
  runBunFaultSubprocess,
  structuralControls
} from "./fault-matrix.js"

describe("rewrite fault matrix bootstrap", () => {
  test("discovers and executes exactly 5 × 9 cells and 11 controls", () => {
    expect(injectionPoints).toHaveLength(5)
    expect(failureKinds).toHaveLength(9)
    expect(faultCells).toHaveLength(45)
    expect(structuralControls).toHaveLength(11)
    expect(new Set([...faultCells, ...structuralControls].map((item) => item.id)).size).toBe(56)
    const root = mkdtempSync(join(tmpdir(), "ts-release-fault-test-"))
    try {
      const statuses = faultCells.map((cell, index) =>
        cell.run(new FileBackedFakeRemote(join(root, String(index)))).status)
      expect(statuses.every((status) =>
        status === "candidate-pending" || status === "legacy-known-defect")).toBe(true)
      expect(statuses.filter((status) => status === "legacy-known-defect")).toHaveLength(1)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("file-backed remote is idempotent and subprocess harness is observable", () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-fake-remote-"))
    try {
      const remote = new FileBackedFakeRemote(root)
      remote.dispatch("publish-1", true)
      remote.dispatch("publish-1", true)
      expect(remote.snapshot()).toEqual({ dispatches: 2, committed: ["publish-1"] })
      expect(runBunFaultSubprocess(root, 17)).toEqual({
        exitCode: 17,
        stdout: "fault-harness"
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
