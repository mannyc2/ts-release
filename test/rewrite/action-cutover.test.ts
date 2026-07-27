import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  actionCommands,
  actionOutputs,
  runCutoverAction
} from "../../apps/ts-release-action/src/cutover.js"
import { makeReleaseApi } from "../../src/api/api.js"
import { LocalApprovalSignerLayer } from "../../src/apply/approval.js"
import { RunStore, makeFileRunStore } from "../../src/apply/store.js"
import {
  CredentialStore,
  DriverCatalog,
  ReadResult,
  WorkspaceStore
} from "../../src/drivers/services.js"
import { makeNodeWorkspaceStore } from "../../src/drivers/workspace.js"

const releaseLayer = Layer.mergeAll(
  Layer.succeed(RunStore)(makeFileRunStore()),
  Layer.succeed(WorkspaceStore)(makeNodeWorkspaceStore()),
  Layer.succeed(DriverCatalog)({
    structured: () => Effect.succeed({ outcome: "observed", outputs: [] }),
    publish: () => Effect.die("unused"),
    reconcile: () => Effect.succeed(ReadResult.make({ found: false }))
  }),
  Layer.succeed(CredentialStore)({
    getRead: () => Effect.die("unused"),
    getPublish: () => Effect.die("unused")
  }),
  LocalApprovalSignerLayer
)
const config = {
  project: { name: "fixture", version: "1.0.0", tag: "v1.0.0", commit: "abc123" },
  artifacts: [{ id: "fixture", path: "dist/fixture", format: "file" }],
  publish: {}
}

describe("candidate Action cutover", () => {
  test("freezes command and output contracts", () => {
    expect(actionCommands).toEqual(["plan", "apply", "doctor"])
    expect(actionOutputs).toEqual([
      "plan_id", "execution_review_id", "execution_receipt_id", "publish_review_id",
      "publish_receipt_id", "run_id", "run_path", "status", "evidence_path"
    ])
  })

  test("plans from one contained JSON read and matches the direct value API", async () => {
    const root = mkdtempSync(join(tmpdir(), "ts-release-action-cutover-"))
    mkdirSync(join(root, "dist"))
    writeFileSync(join(root, "dist/fixture"), "fixture")
    writeFileSync(join(root, "release.config.json"), JSON.stringify(config, null, 2))
    const api = makeReleaseApi(releaseLayer)
    const outputs = new Map<string, string>()
    let reads = 0
    try {
      await runCutoverAction(api, {
        workspace: root,
        input: (name) => ({ command: "plan", config: "release.config.json" }[name] ?? ""),
        output: (name, value) => outputs.set(name, value),
        read: (path) => {
          reads += 1
          return readFileSync(path, "utf8")
        },
        write: writeFileSync
      })
      const direct = await api.plan({ config, workspace: root })
      expect(readFileSync(join(root, "release-plan.json"), "utf8")).toBe(direct.bytes)
      expect(outputs.get("plan_id")).toBe(direct.planId)
      expect(outputs.get("status")).toBe("planned")
      expect(reads).toBe(1)
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("outside config refuses before any read or core call", async () => {
    const directory = mkdtempSync(join(tmpdir(), "ts-release-action-outside-"))
    const root = join(directory, "workspace")
    mkdirSync(root)
    const outside = join(directory, "outside.json")
    writeFileSync(outside, JSON.stringify(config))
    const api = makeReleaseApi(releaseLayer)
    let reads = 0
    try {
      await expect(runCutoverAction(api, {
        workspace: root,
        input: (name) => name === "config" ? outside : "",
        output: () => undefined,
        read: () => {
          reads += 1
          return ""
        },
        write: () => undefined
      })).rejects.toThrow("outside GITHUB_WORKSPACE")
      expect(reads).toBe(0)
    } finally {
      await api.dispose()
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
