import { expect, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import {
  actionOutputs,
  makePreparedReferenceChannel,
  runAction,
  type ActionRuntime
} from "../../apps/ts-release-action/src/commands.js"

const digest = "c".repeat(64)
const preparedRef = `prepared:gha:owner/repository/runs/99/attempts/2/artifacts/ts-release-prepared-${digest}#sha256-${digest}`

const fixture = (command: string, root: string, extra: Record<string, string> = {}) => {
  const outputs: Record<string, string> = {}
  const summaries: string[] = []
  const values: Record<string, string> = { command, ...extra }
  const output = (name: typeof actionOutputs[number], value: string): void => { outputs[name] = value }
  const summarize = async (message: string): Promise<void> => { summaries.push(message) }
  const preparedReference = makePreparedReferenceChannel({ output, summarize })
  const runtime: ActionRuntime = {
    workspace: root,
    input: (name) => values[name] ?? "",
    output,
    read: (path) => readFileSync(path, "utf8"),
    write: (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value) },
    resolvePrepared: async (reference) => {
      await preparedReference.emit(reference)
      return join(root, "downloaded", digest)
    },
    preparedReference,
    summarize
  }
  return { outputs, preparedReference, runtime, summaries }
}

test("each Action command invokes exactly its same-named public operation", async () => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-action-"))
  writeFileSync(join(root, "release.config.json"), "{}")
  const calls: string[] = []
  let channel = fixture("release", root).preparedReference
  const api = {
    release: async () => { calls.push("release"); await channel.emit(preparedRef); return { publications: [] } as never },
    prepare: async () => { calls.push("prepare"); await channel.emit(preparedRef); return {} as never },
    publish: async () => { calls.push("publish"); return [] }
  }

  for (const [command, extra] of [
    ["release", { config: "release.config.json" }],
    ["prepare", { config: "release.config.json" }],
    ["publish", { prepared: preparedRef }]
  ] as const) {
    const current = fixture(command, root, extra)
    channel = current.preparedReference
    await runAction(api, current.runtime)
    expect(Object.keys(current.outputs).sort()).toEqual(["prepared-ref", "report-ref"])
  }
  expect(calls).toEqual(["release", "prepare", "publish"])
})

test("invalid combinations and escaping paths fail before the API call", async () => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-action-"))
  let calls = 0
  const api = {
    release: async () => { calls += 1; return {} as never },
    prepare: async () => { calls += 1; return {} as never },
    publish: async () => { calls += 1; return [] }
  }
  const invalid = fixture("publish", root, { config: "release.config.json" })
  await expect(runAction(api, invalid.runtime)).rejects.toThrow("not valid for command")
  expect(invalid.outputs["report-ref"]).toBe(".release/ts-release/action-report.json")

  const escaping = fixture("release", root, { config: "../outside.json" })
  await expect(runAction(api, escaping.runtime)).rejects.toThrow("outside GITHUB_WORKSPACE")
  expect(existsSync(join(root, escaping.outputs["report-ref"]!))).toBe(true)
  expect(calls).toBe(0)
})

test("a non-complete report fails closed after preserving recovery outputs", async () => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-action-"))
  writeFileSync(join(root, "release.config.json"), "{}")
  const current = fixture("release", root, { config: "release.config.json" })
  await expect(runAction({
    release: async () => {
      await current.preparedReference.emit(preparedRef)
      return { publications: [{ _tag: "PublicationBlocked" }] } as never
    },
    prepare: async () => ({}) as never,
    publish: async () => []
  }, current.runtime)).rejects.toThrow("report is blocked")

  expect(current.outputs["prepared-ref"]).toBe(preparedRef)
  const report = readFileSync(join(root, current.outputs["report-ref"]!), "utf8")
  expect(report).toContain('"status": "blocked"')
  expect(current.summaries.join("\n")).toContain("Re-run the failed publish job")
  expect(current.summaries.join("\n")).not.toContain("ts-release publish")
})

test("a caught post-commit failure emits hosted rerun guidance without a local command", async () => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-action-"))
  writeFileSync(join(root, "release.config.json"), "{}")
  const current = fixture("release", root, { config: "release.config.json" })
  await expect(runAction({
    release: async () => {
      await current.preparedReference.emit(preparedRef)
      throw new Error("forced post-commit failure")
    },
    prepare: async () => ({}) as never,
    publish: async () => []
  }, current.runtime)).rejects.toThrow("forced post-commit failure")

  expect(current.outputs["prepared-ref"]).toBe(preparedRef)
  expect(current.outputs["report-ref"]).toBe(".release/ts-release/action-report.json")
  const guidance = current.summaries.join("\n")
  expect(guidance).toContain("Re-run the failed publish job")
  expect(guidance).not.toContain("ts-release publish")
  expect(guidance).not.toContain("dispatch")
})
