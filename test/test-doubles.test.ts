import { describe, expect, test } from "@effect/bun-test"
import { existsSync } from "node:fs"
import { join } from "node:path"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import {
  CommandSpec,
  ExecutionApproval,
  NoteAction,
  Operation,
  ReleaseCommandRunner,
  ReleaseHttp,
  commandKey,
  httpRequestKey,
  makeCommandRunnerLayer,
  makeTestCommandRunnerLayer,
  makeTestReleaseHttpLayer
} from "./host-fakes.js"
import {
  makePipelineIdentity,
  releaseConfig,
  releaseIdentity,
  runEffect,
  runOperation,
  TestGitHubApiLayer,
  UnsupportedArtifactStagerLayer,
  withTempDirectory,
  withTempDirectoryPromise,
  withTempDirectorySync
} from "./helpers.js"
import { createTestPlan } from "./plan-helpers.js"

const readFixture = (path: string) => Effect.flatMap(
  FileSystem.FileSystem,
  (fs) => fs.readFileString(path)
)

describe("test doubles", () => {
  test("normalizes relative, dot-relative, and absolute fixture paths", async () => {
    const layer = makeTestCommandRunnerLayer({ files: new Map([["artifacts/x", "fixture"]]) })
    for (const path of ["artifacts/x", "./artifacts/x", join(process.cwd(), "artifacts/x")]) {
      expect(await runEffect(readFixture(path), layer)).toBe("fixture")
    }
  })

  test("normalizes backslash-style fixture lookups", async () => {
    const layer = makeTestCommandRunnerLayer({ files: new Map([["artifacts/x", "fixture"]]) })
    expect(await runEffect(readFixture("artifacts\\x"), layer)).toBe("fixture")
  })

  test("matches configured commands and defaults unmatched commands", async () => {
    const hit = CommandSpec.make({
      executable: "tool", args: ["hit"], requiredEnv: [], redactedEnv: []
    })
    const miss = CommandSpec.make({
      executable: "tool", args: ["miss"], requiredEnv: [], redactedEnv: []
    })
    const layer = makeCommandRunnerLayer({
      commands: new Map([[commandKey(hit), { exitCode: 7, stdout: "hit", stderr: "warn" }]])
    })
    const run = (command: CommandSpec) => Effect.flatMap(
      ReleaseCommandRunner,
      (runner) => runner.runCommand(command)
    )

    expect(await runEffect(run(hit), layer)).toMatchObject({ exitCode: 7, stdout: "hit", stderr: "warn" })
    expect(await runEffect(run(miss), layer)).toMatchObject({ exitCode: 0, stdout: "", stderr: "" })
  })

  test("fails fake commands with missing required environment", async () => {
    const command = CommandSpec.make({
      executable: "tool", args: [], requiredEnv: ["TOKEN"], redactedEnv: ["TOKEN"]
    })
    const error = await runEffect(Effect.flatMap(
      ReleaseCommandRunner,
      (runner) => runner.runCommand(command)
    ).pipe(Effect.flip), makeCommandRunnerLayer())

    expect(error).toMatchObject({
      _tag: "CommandRunnerError",
      operation: "runCommand"
    })
    expect(error.reason).toContain("TOKEN")
  })

  test("matches fake HTTP requests by method and URL", async () => {
    const request = {
      method: "GET" as const,
      url: "https://example.test/releases",
      headers: [],
      envHeaders: []
    }
    const seen: Array<{ readonly method: string; readonly url: string }> = []
    const result = await runEffect(Effect.flatMap(
      ReleaseHttp,
      (http) => http.runJson(request)
    ), makeTestReleaseHttpLayer({
      responses: new Map([[httpRequestKey(request), { status: 200, json: { ok: true } }]]),
      onRequest: ({ method, url }) => seen.push({ method, url })
    }))

    expect(result).toMatchObject({ status: 200, json: { ok: true } })
    expect(seen).toEqual([{ method: request.method, url: request.url }])
  })

  test("fails unregistered fake HTTP requests with the typed API error", async () => {
    const request = {
      method: "POST" as const,
      url: "https://example.test/missing",
      headers: [],
      envHeaders: []
    }
    const error = await runEffect(Effect.flatMap(
      ReleaseHttp,
      (http) => http.runJson(request)
    ).pipe(Effect.flip), makeTestReleaseHttpLayer())

    expect(error).toMatchObject({
      _tag: "GitHubApiError",
      operation: "runJson",
      url: request.url
    })
  })

  test("isolates sequential plans from different configs", async () => {
    const config = (name: string, artifactId: string) => releaseConfig({
      identity: releaseIdentity({ name, packageName: name }),
      artifacts: [{ id: artifactId, path: `dist/${artifactId}`, format: "file" }]
    })
    const [first, second] = await runEffect(Effect.gen(function*() {
      const first = yield* createTestPlan(config("first", "one"))
      const second = yield* createTestPlan(config("second", "two"))
      return [first, second] as const
    }), makeTestCommandRunnerLayer())

    expect([first.identity.name, ...first.artifacts.map(({ id }) => id)]).toEqual(["first", "one"])
    expect([second.identity.name, ...second.artifacts.map(({ id }) => id)]).toEqual(["second", "two"])
  })

  test("omits optional config sections and lets identity overrides win", () => {
    const config = JSON.parse(releaseConfig({
      identity: releaseIdentity({ name: "override", packageName: "package", notes: "notes" }),
      artifacts: [],
      builds: [],
      publish: {}
    }))

    expect(config).not.toHaveProperty("builds")
    expect(config).not.toHaveProperty("artifacts")
    expect(config).not.toHaveProperty("npmPackage")
    expect(config.project).toEqual({
      name: "override",
      packageName: "package",
      version: "0.1.0",
      commit: "abc123",
      tag: "v0.1.0",
      notes: "notes"
    })
    expect(config).not.toHaveProperty("name")
  })

  test("keeps pipeline identity defaults stable and applies overrides", () => {
    expect(makePipelineIdentity()).toMatchObject({
      name: "release", normalizedName: "release", version: "0.1.0", tag: "v0.1.0", snapshot: false
    })
    expect(makePipelineIdentity({ name: "override", normalizedName: "override", snapshot: true }))
      .toMatchObject({ name: "override", normalizedName: "override", snapshot: true, version: "0.1.0" })
  })

  test("cleans Effect temp directories after success and failure", async () => {
    let success = ""
    await Effect.runPromise(Effect.scoped(withTempDirectory("ts-release-double-effect-ok-", (root) =>
      Effect.sync(() => { success = root }))))
    expect(existsSync(success)).toBe(false)

    let failure = ""
    const exit = await Effect.runPromise(Effect.scoped(withTempDirectory("ts-release-double-effect-fail-", (root) =>
      Effect.sync(() => { failure = root }).pipe(Effect.andThen(Effect.fail("expected"))))).pipe(Effect.exit))
    expect(exit._tag).toBe("Failure")
    expect(existsSync(failure)).toBe(false)
  })

  test("cleans Promise temp directories after success and failure", async () => {
    let success = ""
    await withTempDirectoryPromise("ts-release-double-promise-ok-", async (root) => { success = root })
    expect(existsSync(success)).toBe(false)

    let failure = ""
    await expect(withTempDirectoryPromise("ts-release-double-promise-fail-", async (root) => {
      failure = root
      throw new Error("expected")
    })).rejects.toThrow("expected")
    expect(existsSync(failure)).toBe(false)
  })

  test("cleans sync temp directories after success and failure", () => {
    let success = ""
    withTempDirectorySync("ts-release-double-sync-ok-", (root) => { success = root })
    expect(existsSync(success)).toBe(false)

    let failure = ""
    expect(() => withTempDirectorySync("ts-release-double-sync-fail-", (root) => {
      failure = root
      throw new Error("expected")
    })).toThrow("expected")
    expect(existsSync(failure)).toBe(false)
  })

  test("returns one independent evidence record per runOperation call", async () => {
    const operation = (id: string) => Operation.make({
      id,
      pipeId: "test",
      phase: "verify",
      risk: "read-only",
      description: id,
      action: NoteAction.make({ message: id, severity: "info", skipped: false })
    })
    const context = { root: ".", identity: makePipelineIdentity(), artifacts: [] }
    const layer = Layer.mergeAll(
      makeTestCommandRunnerLayer(),
      TestGitHubApiLayer,
      UnsupportedArtifactStagerLayer
    )
    const first = await runEffect(runOperation(operation("one"), ExecutionApproval.none, context), layer)
    const second = await runEffect(runOperation(operation("two"), ExecutionApproval.none, context), layer)

    expect(first.operationId).toBe("one")
    expect(second.operationId).toBe("two")
  })
})
