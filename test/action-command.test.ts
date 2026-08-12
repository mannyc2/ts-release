import { expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import {
  actionCommands,
  actionInputs,
  actionOutputs,
  makePreparedReferenceChannel,
  runAction,
  type ActionRuntime
} from "../apps/ts-release-action/src/commands.js"
import { decodeCompletePreparedReleaseRef } from "../src/release/prepared-ref.js"

const digest = "a".repeat(64)
const preparedRef = `prepared:gha:owner/repository/runs/123/attempts/1/artifacts/ts-release-prepared-${digest}#sha256-${digest}`
const preparedReference = () => Effect.runPromise(decodeCompletePreparedReleaseRef(preparedRef))
const completeReport = { status: "complete", subjects: [] } as never

const harness = (root: string, values: Record<string, string>) => {
  const outputs: Record<string, string> = {}
  const summaries: string[] = []
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

const sectionKeys = (manifest: string, start: string, end: string): ReadonlyArray<string> => {
  const body = manifest.split(`${start}:\n`)[1]?.split(`${end}:\n`)[0] ?? ""
  return [...body.matchAll(/^  ([a-z-]+):$/gmu)].map((match) => match[1]!)
}

test("Action metadata exposes only release, prepare, publish and two reference outputs", () => {
  const manifest = readFileSync("apps/ts-release-action/action.yml", "utf8")
  expect(actionCommands).toEqual(["release", "prepare", "publish"])
  expect(actionInputs).toEqual(["command", "config", "prepared"])
  expect(actionOutputs).toEqual(["prepared-ref", "report-ref"])
  expect(sectionKeys(manifest, "inputs", "outputs")).toEqual(actionInputs)
  expect(sectionKeys(manifest, "outputs", "runs")).toEqual(actionOutputs)
  expect(manifest).not.toMatch(/\b(?:ship|inspect|correct|status|prepared_path|report_path|approval|reviewer)\b/iu)
})

test("release makes one public call and receives the durable reference before it returns", async () => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-action-"))
  writeFileSync(join(root, "release.config.json"), JSON.stringify({ project: {} }))
  const fixture = harness(root, { command: "release", config: "release.config.json" })
  const prepared = await preparedReference()
  const events: string[] = []
  let calls = 0
  await runAction({
    release: async (input) => {
      calls += 1
      events.push("release:start")
      expect(input.workspace).toBe(root)
      await fixture.preparedReference.emit(preparedRef)
      events.push("release:prepared")
      events.push("release:return")
      return { prepared, report: completeReport }
    },
    prepare: async () => prepared,
    publish: async () => completeReport
  }, fixture.runtime)
  expect(calls).toBe(1)
  expect(events).toEqual(["release:start", "release:prepared", "release:return"])
  expect(fixture.outputs["prepared-ref"]).toBe(preparedRef)
  expect(fixture.outputs["report-ref"]).toBe(".release/ts-release/action-report.json")
  expect(existsSync(join(root, fixture.outputs["report-ref"]!))).toBe(true)
  const report = JSON.parse(readFileSync(join(root, fixture.outputs["report-ref"]!), "utf8")) as Record<string, unknown>
  expect(report).toMatchObject({ command: "release", status: "complete", prepared: preparedRef })
  expect(report).toHaveProperty("report", completeReport)
  expect(report).not.toHaveProperty("result")
  expect(JSON.stringify(report)).not.toContain("publications")
})

test("prepare emits only a reference projection, never its local bundle path", async () => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-action-"))
  writeFileSync(join(root, "release.config.json"), "{}")
  const fixture = harness(root, { command: "prepare", config: "release.config.json" })
  const prepared = await preparedReference()
  const secretDirectory = join(root, ".release", "ts-release", "prepared", digest)
  await runAction({
    release: async () => ({ prepared, report: completeReport }),
    prepare: async () => {
      await fixture.preparedReference.emit(preparedRef)
      return prepared
    },
    publish: async () => completeReport
  }, fixture.runtime)
  const report = readFileSync(join(root, fixture.outputs["report-ref"]!), "utf8")
  expect(report).toContain(preparedRef)
  expect(report).not.toContain(secretDirectory)
  expect(Object.keys(fixture.outputs).sort()).toEqual(["prepared-ref", "report-ref"])
})
