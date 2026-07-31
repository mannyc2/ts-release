import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  makeReleaseApi
} from "../../src/api/api.js"
import {
  LocalApprovalSignerLayer
} from "../../src/apply/approval.js"
import {
  RunStore,
  makeFileRunStore
} from "../../src/apply/store.js"
import {
  CredentialStore,
  DriverCatalog,
  ReadResult,
  WorkspaceStore
} from "../../src/drivers/services.js"
import {
  makeNodeWorkspaceStore
} from "../../src/drivers/workspace.js"

const layer = (calls: { structured: number }) => Layer.mergeAll(
  Layer.succeed(RunStore)(makeFileRunStore()),
  Layer.succeed(WorkspaceStore)(makeNodeWorkspaceStore()),
  Layer.succeed(DriverCatalog)({
    structured: () => Effect.sync(() => {
      calls.structured += 1
      return { outcome: "observed", outputs: [] }
    }),
    publish: () => Effect.die("publish not expected"),
    reconcile: () => Effect.succeed(ReadResult.make({ found: false }))
  }),
  Layer.succeed(CredentialStore)({
    getRead: () => Effect.die("credential not expected"),
    getPublish: () => Effect.die("credential not expected")
  }),
  LocalApprovalSignerLayer
)
const config = {
  project: {
    name: "fixture",
    version: "1.0.0",
    tag: "v1.0.0",
    commit: "abc123"
  },
  artifacts: [{ id: "fixture", path: "dist/fixture", format: "file" }],
  publish: {}
}

describe("public plan/review/apply API", () => {
  test("value identity is source-neutral and workspace symlinks canonicalize", async () => {
    const directory = mkdtempSync(join(tmpdir(), "ts-release-api-"))
    const root = join(directory, "workspace")
    const link = join(directory, "workspace-link")
    mkdirSync(join(root, "dist"), { recursive: true })
    writeFileSync(join(root, "dist/fixture"), "fixture")
    symlinkSync(root, link)
    const api = makeReleaseApi(layer({ structured: 0 }))
    try {
      const direct = await api.plan({ config, workspace: root })
      const parsed = await api.plan({
        config: JSON.parse(JSON.stringify(config)),
        workspace: link
      })
      expect(direct.bytes).toBe(parsed.bytes)
      expect(direct.planId).toBe(parsed.planId)
      expect(direct.plan).toEqual(parsed.plan)
      expect(direct.bytes).not.toContain(realpathSync(root))
    } finally {
      await api.dispose()
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test("outer excess fields, path-like config, and invalid workspace refuse", async () => {
    const calls = { structured: 0 }
    const api = makeReleaseApi(layer(calls))
    try {
      await expect(api.plan({
        config,
        workspace: "/missing",
        configPath: "release.json"
      } as never)).rejects.toMatchObject({ _tag: "ReleaseApiError" })
      await expect(api.plan({
        config: "release.json",
        workspace: "/missing"
      })).rejects.toMatchObject({ _tag: "ReleaseApiError" })
      await expect(api.plan({ config, workspace: "." }))
        .rejects.toMatchObject({ _tag: "ReleaseApiError" })
      expect(calls.structured).toBe(0)
    } finally {
      await api.dispose()
    }
  })

  test("review is pure and new-run apply executes supplied canonical bytes", async () => {
    const directory = mkdtempSync(join(tmpdir(), "ts-release-apply-api-"))
    const root = join(directory, "workspace")
    mkdirSync(join(root, "dist"), { recursive: true })
    writeFileSync(join(root, "dist/fixture"), "fixture")
    const calls = { structured: 0 }
    const api = makeReleaseApi(layer(calls))
    try {
      const planned = await api.plan({ config, workspace: root })
      const review = await api.reviewExecution({
        planBytes: planned.bytes,
        expectedPlanId: planned.planId,
        scope: "all"
      })
      expect(calls.structured).toBe(0)
      const output = await api.apply({
        planBytes: planned.bytes,
        expectedPlanId: planned.planId,
        workspace: root,
        through: "build",
        newRun: {
          path: ".release/run.json",
          scope: "all",
          executionReviewId: review.executionReviewId,
          reviewer: "maintainer"
        }
      })
      expect(output.status).toBe("complete")
      expect(output.ledger.schemaVersion).toBe("run-ledger/v1")
      expect(readFileSync(output.runPath, "utf8")).toContain("\"run-ledger/v1\"")
      expect(calls.structured).toBe(1)
    } finally {
      await api.dispose()
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test("public input types reject config paths and apply-time config", () => {
    const api = makeReleaseApi(layer({ structured: 0 }))
    if (false) {
      // @ts-expect-error core planning never accepts configPath
      void api.plan({ config, workspace: "/workspace", configPath: "release.json" })
      // @ts-expect-error apply never accepts config
      void api.apply({ planBytes: "{}", expectedPlanId: "id", workspace: "/workspace", config })
    }
    expect(api).toBeDefined()
  })
})
