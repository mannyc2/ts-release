import { expect, test } from "bun:test"
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

const digest = "a".repeat(64)
const preparedRef = `prepared:gha:owner/repository/runs/123/attempts/1/artifacts/ts-release-prepared-${digest}#sha256-${digest}`

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
    resolvePrepared: async (reference) => {
      await preparedReference.emit(reference)
      return join(root, "downloaded")
    },
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
  const events: string[] = []
  let calls = 0
  await runAction({
    release: async (input) => {
      calls += 1
      events.push("release:start")
      expect(input.workspace).toBe(root)
      await fixture.preparedReference.emit(preparedRef)
      events.push("release:return")
      return { publications: [] } as never
    },
    prepare: async () => ({}) as never,
    publish: async () => []
  }, fixture.runtime)
  expect(calls).toBe(1)
  expect(events).toEqual(["release:start", "release:return"])
  expect(fixture.outputs["prepared-ref"]).toBe(preparedRef)
  expect(fixture.outputs["report-ref"]).toBe(".release/ts-release/action-report.json")
  expect(existsSync(join(root, fixture.outputs["report-ref"]!))).toBe(true)
  expect(readFileSync(join(root, fixture.outputs["report-ref"]!), "utf8")).toContain('"command": "release"')
})

test("prepare emits only a reference projection, never its local bundle path", async () => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-action-"))
  writeFileSync(join(root, "release.config.json"), "{}")
  const fixture = harness(root, { command: "prepare", config: "release.config.json" })
  const secretDirectory = join(root, ".release", "ts-release", "prepared", digest)
  await runAction({
    release: async () => ({}) as never,
    prepare: async () => {
      await fixture.preparedReference.emit(preparedRef)
      return { directory: secretDirectory } as never
    },
    publish: async () => []
  }, fixture.runtime)
  const report = readFileSync(join(root, fixture.outputs["report-ref"]!), "utf8")
  expect(report).toContain(preparedRef)
  expect(report).not.toContain(secretDirectory)
  expect(Object.keys(fixture.outputs).sort()).toEqual(["prepared-ref", "report-ref"])
})
