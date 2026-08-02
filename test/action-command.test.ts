import { describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  actionCommands,
  actionOutputs,
  runAction
} from "../apps/ts-release-action/src/commands.js"
import type { ApplyInput, ApplyOutput } from "../src/api/types.js"

// Two-space-indented keys under a top-level block; the repo has no yaml dep.
const blockKeys = (manifest: string, block: "inputs" | "outputs"): ReadonlyArray<string> => {
  const lines = manifest.split("\n")
  const start = lines.indexOf(`${block}:`)
  if (start < 0) return []
  const keys: Array<string> = []
  for (const line of lines.slice(start + 1)) {
    if (line.trim().length > 0 && !line.startsWith(" ")) break
    const match = line.match(/^ {2}([a-z0-9_-]+):/u)
    if (match !== null) keys.push(match[1]!)
  }
  return keys
}

describe("installed Action commands", () => {
  test("has exact commands and outputs", () => {
    expect(actionCommands).toEqual(["plan", "apply", "doctor"])
    expect(actionOutputs).toHaveLength(9)
  })

  test("action.yml and the command source agree on outputs and inputs", () => {
    const manifest = readFileSync("apps/ts-release-action/action.yml", "utf8")
    expect(new Set(blockKeys(manifest, "outputs"))).toEqual(new Set(actionOutputs))
    const source = readFileSync("apps/ts-release-action/src/commands.ts", "utf8")
    const consumed = new Set(
      [...source.matchAll(/optional\(runtime, "([a-z0-9-]+)"\)/gu)].map((match) => match[1]!)
    )
    const declared = new Set(blockKeys(manifest, "inputs"))
    for (const name of consumed) {
      expect(declared.has(name)).toBe(true)
    }
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

  const planFixture = (inputs: Record<string, string>, commit?: string) => {
    const directory = realpathSync(mkdtempSync(join(tmpdir(), "ts-release-action-resolve-")))
    writeFileSync(join(directory, "release.config.json"), JSON.stringify({
      project: { name: "@scope/fixture" },
      versionFrom: "manifest",
      publish: {}
    }))
    writeFileSync(join(directory, "package.json"), JSON.stringify({
      name: "@scope/fixture", version: "2.3.4"
    }))
    const writes: Record<string, string> = {}
    let planned: unknown
    const api = {
      plan: (input: { config: unknown }) => {
        planned = input.config
        return Promise.resolve({ bytes: "{}", planId: "p".repeat(64) } as never)
      },
      reviewExecution: () => Promise.reject(new Error("unused")),
      apply: () => Promise.reject(new Error("unused"))
    }
    const run = () =>
      runAction(api, {
        workspace: directory,
        ...(commit === undefined ? {} : { commit }),
        input: (name) => inputs[name] ?? "",
        output: () => {},
        read: (path) => readFileSync(path, "utf8"),
        write: (path, value) => {
          writes[path] = value
        }
      })
    return { directory, run, writes, planned: () => planned }
  }

  test("resolve: github fills omitted facts from the runner and emits the resolved config", async () => {
    const fixture = planFixture({ command: "plan", resolve: "github" }, "c".repeat(40))
    try {
      await fixture.run()
      const planned = fixture.planned() as { project: Record<string, string> }
      // Observed, not invented: the runner's commit and the manifest's version.
      expect(planned.project.commit).toBe("c".repeat(40))
      expect(planned.project.version).toBe("2.3.4")
      expect(planned.project.tag).toBe("v2.3.4")
      const resolved = fixture.writes[join(fixture.directory, "release-plan.json.resolved.json")]
      expect(JSON.parse(resolved!).project.version).toBe("2.3.4")
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true })
    }
  })

  // A clean checkout has no `.release/`, and the containment check resolves the
  // parent's realpath before anything writes it. This passed locally for months
  // because the directory already existed; the first real dispatch hit ENOENT.
  test("a plan-path whose directory does not exist yet is planned, not refused", async () => {
    const fixture = planFixture({
      command: "plan",
      "plan-path": ".release/nested/release-plan.json"
    })
    try {
      await fixture.run()
      expect(fixture.writes[join(fixture.directory, ".release/nested/release-plan.json")]).toBe("{}")
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true })
    }
  })

  test("an unknown resolve value is refused by name", async () => {
    const fixture = planFixture({ command: "plan", resolve: "gitlab" })
    try {
      await expect(fixture.run()).rejects.toThrow(/resolve must be empty or "github"/u)
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true })
    }
  })

  test("without resolve the authored config reaches the api untouched", async () => {
    const fixture = planFixture({ command: "plan" }, "c".repeat(40))
    try {
      await fixture.run()
      expect(fixture.planned()).toEqual({
        project: { name: "@scope/fixture" }, versionFrom: "manifest", publish: {}
      })
    } finally {
      rmSync(fixture.directory, { recursive: true, force: true })
    }
  })
})
