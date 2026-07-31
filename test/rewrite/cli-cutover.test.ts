import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  commandNames,
  runCli,
  selectCliWorkspace
} from "../../apps/release-ts/src/cli/commands.js"
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

describe("candidate cutover CLI", () => {
  test("has exactly four lifecycle commands", () => {
    expect(commandNames).toEqual(["init", "doctor", "plan", "apply"])
  })

  test("plan reads JSON once and writes exact canonical API bytes", async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "ts-release-cli-cutover-")))
    mkdirSync(join(root, "dist"))
    writeFileSync(join(root, "dist/fixture"), "fixture")
    writeFileSync(join(root, "release.config.json"), JSON.stringify(config, null, 2))
    const api = makeReleaseApi(releaseLayer)
    let reads = 0
    const logs: Array<string> = []
    try {
      await runCli(
        api,
        ["plan", "--config", "release.config.json", "--out", "release-plan.json"],
        root,
        {
          read: (path) => {
            reads += 1
            return readFileSync(path, "utf8")
          },
          write: writeFileSync,
          log: (value) => logs.push(value)
        }
      )
      const direct = await api.plan({ config, workspace: root })
      expect(readFileSync(join(root, "release-plan.json"), "utf8")).toBe(direct.bytes)
      expect(logs).toContain(JSON.stringify({ planId: direct.planId }))
      expect(reads).toBe(1)
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("review-only never applies and workspace selection follows the frozen table", async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "ts-release-cli-review-")))
    mkdirSync(join(root, "dist"))
    writeFileSync(join(root, "dist/fixture"), "fixture")
    const api = makeReleaseApi(releaseLayer)
    try {
      const planned = await api.plan({ config, workspace: root })
      writeFileSync(join(root, "plan.json"), planned.bytes)
      const output: Array<string> = []
      await runCli(
        api,
        ["apply", "plan.json", "--plan-id", planned.planId, "--review-only", "--scope", "all"],
        root,
        { read: (path) => readFileSync(path, "utf8"), write: writeFileSync, log: (value) => output.push(value) }
      )
      expect(JSON.parse(output[0]!).status).toBe("review-required")
      expect(selectCliWorkspace(root, "release.config.json")).toBe(root)
      expect(selectCliWorkspace(root, "/tmp/config.json")).toBe("/tmp")
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })
})
