import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { makeReleaseApi } from "../src/index.js"
import {
  ReleaseInputError
} from "../src/api/errors.js"
import {
  encodeCompletePreparedReleaseRef,
  makeLocalCompletePreparedReleaseRef
} from "../src/release/prepared-ref.js"
import {
  PreparedCommitHandoffError,
  PreparedStoreError,
  makeLocalPreparedReleaseStore
} from "../src/release/prepared-store.js"
import { fixtureConfig, runtimeLayer } from "./core/runtime-fixture.js"

const workspace = (): string => {
  const root = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "ts-release-api-"))
  mkdirSync(join(root, "src"), { recursive: true })
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", version: "1.0.0" }))
  writeFileSync(join(root, "payload.txt"), "payload\n")
  return root
}

const testApi = (root: string) => makeReleaseApi(runtimeLayer(
  undefined,
  makeLocalPreparedReleaseStore(join(root, "prepared-store"))
))

describe("public lifecycle API", () => {
  test("uses durable references for prepare, inspect, observe, and publish", async () => {
    const root = workspace()
    const api = testApi(root)
    try {
      const inspection = await api.inspect({ config: fixtureConfig, workspace: root })
      expect(inspection.source.commit.toString()).toBe("abc123")

      const prepared = await api.prepare({ config: fixtureConfig, workspace: root })
      expect(encodeCompletePreparedReleaseRef(prepared)).toMatch(
        /^prepared:local:sha256-[a-f0-9]{64}$/u
      )

      const preparedInspection = await api.inspect({ prepared })
      expect("project" in preparedInspection ? preparedInspection.project.version : undefined)
        .toBe("1.0.0")

      const observed = await api.observe({ prepared })
      expect(observed.status).toBe("equivalent")
      expect(observed.subjects).toHaveLength(1)

      const published = await api.publish({ prepared })
      expect(published.status).toBe("complete")
      expect(published.subjects).toHaveLength(1)
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("release composes durable preparation and a total publication report", async () => {
    const root = workspace()
    const api = testApi(root)
    try {
      const result = await api.release({ config: fixtureConfig, workspace: root })
      expect(encodeCompletePreparedReleaseRef(result.prepared)).toMatch(
        /^prepared:local:sha256-[a-f0-9]{64}$/u
      )
      expect(result.report.status).toBe("complete")
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("release refuses an accidental empty graph unless diagnostics opt in", async () => {
    const root = workspace()
    const api = testApi(root)
    const config = {
      project: { name: "fixture", version: "1.0.0", tag: "v1.0.0", commit: "abc123" },
      publish: {}
    }
    try {
      await expect(api.release({ config, workspace: root })).rejects.toBeInstanceOf(ReleaseInputError)
      const diagnostic = await api.release({ config, workspace: root, allowEmpty: true })
      expect(diagnostic.report.status).toBe("complete")
      expect(diagnostic.report.subjects).toHaveLength(1)
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("correct verifies the reference and returns safe unsupported data", async () => {
    const root = workspace()
    const api = testApi(root)
    try {
      const prepared = await api.prepare({ config: fixtureConfig, workspace: root })
      const report = await api.correct({
        prepared,
        correction: JSON.stringify({ provider: "npm", kind: "deprecate", message: "Use 1.0.1." })
      })
      expect(report).toMatchObject({ prepared, status: "unsupported" })
      expect(report.reason).toContain("plan 229")
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("load failures after a prepared reference are carried as release aborts", async () => {
    const root = workspace()
    const storeDirectory = join(root, "prepared-store")
    const api = makeReleaseApi(runtimeLayer(undefined, makeLocalPreparedReleaseStore(storeDirectory)))
    try {
      const prepared = await api.prepare({ config: fixtureConfig, workspace: root })
      rmSync(storeDirectory, { recursive: true, force: true })
      await expect(api.publish({ prepared })).rejects.toMatchObject({
        _tag: "ReleaseAbortedError",
        prepared
      })
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("a failed host handoff after durable commit carries the exact recovery reference", async () => {
    const root = workspace()
    const prepared = await Effect.runPromise(makeLocalCompletePreparedReleaseRef("a".repeat(64)))
    const api = makeReleaseApi(runtimeLayer(undefined, {
      commit: () => Effect.fail(new PreparedCommitHandoffError({
        prepared,
        reason: "the host output channel rejected the durable reference"
      })),
      load: () => Effect.fail(new PreparedStoreError({ reason: "not used" }))
    }))
    try {
      await expect(api.release({ config: fixtureConfig, workspace: root })).rejects.toMatchObject({
        _tag: "ReleaseAbortedError",
        prepared,
        cause: "the host output channel rejected the durable reference"
      })
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("inspect enforces its exclusive typed input boundary", async () => {
    const root = workspace()
    const api = testApi(root)
    try {
      await expect(api.inspect({
        config: fixtureConfig,
        prepared: "not-a-reference",
        workspace: root
      } as never)).rejects.toBeInstanceOf(ReleaseInputError)
      await expect(api.inspect({ workspace: root } as never)).rejects.toBeInstanceOf(ReleaseInputError)
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })
})
