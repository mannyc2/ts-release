import { describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

interface ChildResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

interface PersistedState {
  readonly objects: Readonly<Record<string, ReadonlyArray<unknown>>>
}

const fixture = resolve("test/fixtures/operation-journal-child.ts")
const decoder = new TextDecoder()
const runChild = (mode: string, statePath: string): ChildResult => {
  const result = Bun.spawnSync([process.execPath, fixture, mode, statePath], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe"
  })
  return {
    exitCode: result.exitCode,
    stdout: decoder.decode(result.stdout),
    stderr: decoder.decode(result.stderr)
  }
}

const storedCounts = (statePath: string): { readonly events: number, readonly heads: number } => {
  const state = JSON.parse(readFileSync(statePath, "utf8")) as PersistedState
  const keys = Object.keys(state.objects)
  return {
    events: keys.filter((key) => key.includes("/events/")).length,
    heads: keys.filter((key) => key.endsWith("/head.bin")).length
  }
}

describe("operation journal process crash law", () => {
  test("a fresh process adopts the exact event left before head CAS", () => {
    const directory = mkdtempSync(join(tmpdir(), "ts-release-journal-child-"))
    const statePath = join(directory, "state.json")
    try {
      const crashed = runChild("crash-before-head", statePath)
      expect(crashed.exitCode).toBe(86)
      expect(crashed.stdout).toBe("")
      expect(storedCounts(statePath)).toEqual({ events: 1, heads: 0 })

      const resumed = runChild("reconcile", statePath)
      expect(resumed.exitCode, resumed.stderr).toBe(0)
      expect(JSON.parse(resumed.stdout)).toMatchObject({
        state: "IntentRecorded",
        records: [{ tag: "IntentRecorded", sequence: 1 }]
      })
      expect(storedCounts(statePath)).toEqual({ events: 1, heads: 1 })
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test("a fresh process reconstructs a head committed before acknowledgement", () => {
    const directory = mkdtempSync(join(tmpdir(), "ts-release-journal-child-"))
    const statePath = join(directory, "state.json")
    try {
      const crashed = runChild("crash-after-head", statePath)
      expect(crashed.exitCode).toBe(87)
      expect(crashed.stdout).toBe("")
      expect(storedCounts(statePath)).toEqual({ events: 1, heads: 1 })

      const resumed = runChild("read", statePath)
      expect(resumed.exitCode, resumed.stderr).toBe(0)
      expect(JSON.parse(resumed.stdout)).toMatchObject({
        state: "IntentRecorded",
        records: [{ tag: "IntentRecorded", sequence: 1 }],
        acknowledgement: { sequence: 1 }
      })
      expect(storedCounts(statePath)).toEqual({ events: 1, heads: 1 })
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
