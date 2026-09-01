import { expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import {
  actionOutputs,
  makePreparedReferenceChannel,
  runAction,
  type ActionRuntime
} from "../../apps/ts-release-action/src/commands.js"
import { decodeCompletePreparedReleaseRef } from "../../src/release/prepared-ref.js"

const digest = "c".repeat(64)
const preparedRef = `prepared:gha:owner/repository/runs/99/attempts/2/artifacts/ts-release-prepared-2-${digest}#sha256-${digest}`
const preparedReference = () => Effect.runPromise(decodeCompletePreparedReleaseRef(preparedRef))
const report = (status: "complete" | "blocked" | "uncertain") => ({ status, subjects: [] }) as never

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
    preparedReference,
    summarize
  }
  return { outputs, preparedReference, runtime, summaries }
}

test("each Action command invokes exactly its same-named public operation", async () => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-action-"))
  writeFileSync(join(root, "release.config.json"), "{}")
  const calls: string[] = []
  const prepared = await preparedReference()
  let channel = fixture("release", root).preparedReference
  const api = {
    release: async () => {
      calls.push("release")
      await channel.emit(preparedRef)
      return { prepared, report: report("complete") }
    },
    prepare: async () => {
      calls.push("prepare")
      await channel.emit(preparedRef)
      return prepared
    },
    inspect: async (input: { readonly prepared?: typeof prepared }) => {
      calls.push("inspect")
      expect(input.prepared).toEqual(prepared)
      return {} as never
    },
    publish: async (input: { readonly prepared: typeof prepared }) => {
      calls.push("publish")
      expect(input.prepared).toEqual(prepared)
      return report("complete")
    }
  }

  for (const [command, extra] of [
    ["release", { config: "release.config.json" }],
    ["prepare", { config: "release.config.json" }],
    ["inspect", { prepared: preparedRef }],
    ["publish", { prepared: preparedRef }]
  ] as const) {
    const current = fixture(command, root, extra)
    channel = current.preparedReference
    await runAction(api, current.runtime)
    expect(Object.keys(current.outputs).sort()).toEqual(["prepared-ref", "report-ref"])
  }
  expect(calls).toEqual(["release", "prepare", "inspect", "publish"])
})

test("publish decodes a canonical reference object and emits it before the public operation", async () => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-action-"))
  const current = fixture("publish", root, { prepared: preparedRef })
  const expected = await preparedReference()
  let received: unknown

  await runAction({
    release: async () => ({ prepared: expected, report: report("complete") }),
    prepare: async () => expected,
    inspect: async () => ({} as never),
    publish: async (input) => {
      expect(current.outputs["prepared-ref"]).toBe(preparedRef)
      received = input.prepared
      return report("complete")
    }
  }, current.runtime)

  expect(received).toEqual(expected)
  expect(received).toMatchObject({ scheme: "gha", runId: "99", attempt: "2" })
  const written = JSON.parse(readFileSync(join(root, current.outputs["report-ref"]!), "utf8")) as Record<string, unknown>
  expect(written).toMatchObject({ command: "publish", status: "complete", prepared: preparedRef })
  expect(written).toHaveProperty("report.status", "complete")
  expect(written).not.toHaveProperty("result")
})

test("publish rejects filesystem paths before the public operation", async () => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-action-"))
  let calls = 0
  const current = fixture("publish", root, { prepared: join(root, "downloaded", digest) })

  await expect(runAction({
    release: async () => { calls += 1; return {} as never },
    prepare: async () => { calls += 1; return {} as never },
    inspect: async () => { calls += 1; return {} as never },
    publish: async () => { calls += 1; return report("complete") }
  }, current.runtime)).rejects.toThrow()

  expect(calls).toBe(0)
  expect(current.outputs["prepared-ref"]).toBeUndefined()
  expect(current.outputs["report-ref"]).toBe(".release/ts-release/action-report.json")
})

test("invalid combinations and escaping paths fail before the API call", async () => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-action-"))
  let calls = 0
  const api = {
    release: async () => { calls += 1; return {} as never },
    prepare: async () => { calls += 1; return {} as never },
    inspect: async () => { calls += 1; return {} as never },
    publish: async () => { calls += 1; return report("complete") }
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
  const prepared = await preparedReference()
  await expect(runAction({
    release: async () => {
      await current.preparedReference.emit(preparedRef)
      return { prepared, report: report("blocked") }
    },
    prepare: async () => prepared,
    inspect: async () => ({} as never),
    publish: async () => report("complete")
  }, current.runtime)).rejects.toThrow("report is blocked")

  expect(current.outputs["prepared-ref"]).toBe(preparedRef)
  const written = JSON.parse(readFileSync(join(root, current.outputs["report-ref"]!), "utf8")) as Record<string, unknown>
  expect(written).toMatchObject({ status: "blocked", report: { status: "blocked" } })
  expect(written).not.toHaveProperty("result")
  expect(JSON.stringify(written)).not.toContain("publications")
  expect(current.summaries.join("\n")).toContain("prepared_ref=")
  expect(current.summaries.join("\n")).toContain("re-run the failed publish job")
  expect(current.summaries.join("\n")).not.toContain("ts-release publish")
})

test("a non-complete publish report fails only after both recovery outputs are written", async () => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-action-"))
  const current = fixture("publish", root, { prepared: preparedRef })
  const prepared = await preparedReference()

  await expect(runAction({
    release: async () => ({ prepared, report: report("complete") }),
    prepare: async () => prepared,
    inspect: async () => ({} as never),
    publish: async () => report("uncertain")
  }, current.runtime)).rejects.toThrow("report is uncertain")

  expect(current.outputs).toMatchObject({
    "prepared-ref": preparedRef,
    "report-ref": ".release/ts-release/action-report.json"
  })
  const written = JSON.parse(readFileSync(join(root, current.outputs["report-ref"]!), "utf8")) as Record<string, unknown>
  expect(written).toMatchObject({ command: "publish", status: "uncertain", report: { status: "uncertain" } })
})

test("a caught post-commit failure emits hosted rerun guidance without a local command", async () => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-action-"))
  writeFileSync(join(root, "release.config.json"), "{}")
  const current = fixture("release", root, { config: "release.config.json" })
  const prepared = await preparedReference()
  await expect(runAction({
    release: async () => {
      await current.preparedReference.emit(preparedRef)
      throw new Error("forced post-commit failure")
    },
    prepare: async () => prepared,
    inspect: async () => ({} as never),
    publish: async () => report("complete")
  }, current.runtime)).rejects.toThrow("forced post-commit failure")

  expect(current.outputs["prepared-ref"]).toBe(preparedRef)
  expect(current.outputs["report-ref"]).toBe(".release/ts-release/action-report.json")
  const guidance = current.summaries.join("\n")
  expect(guidance).toContain(`prepared_ref=${preparedRef}`)
  expect(guidance).toContain("re-run the failed publish job")
  expect(guidance).not.toContain("ts-release publish")
  expect(guidance).toContain("dispatch the same exact candidate")
})
