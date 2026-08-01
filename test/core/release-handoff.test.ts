import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, join } from "node:path"
import { runAction } from "../../apps/ts-release-action/src/commands.js"
import { makeReleaseApi } from "../../src/api/api.js"
import { LocalApprovalSignerLayer } from "../../src/apply/approval.js"
import { RunStore, decodeLedger, makeFileRunStore } from "../../src/apply/store.js"
import {
  CredentialStore,
  DriverCatalog,
  ReadResult,
  WorkspaceStore
} from "../../src/drivers/services.js"
import { makeNodeWorkspaceStore } from "../../src/drivers/workspace.js"

// The production release path is three separate jobs handing state to each
// other only as serialized artifacts and string outputs. This test mirrors
// that shape exactly: three fresh api instances, three separate workspaces,
// and ONLY bytes and strings crossing the boundaries.
const releaseLayer = () => Layer.mergeAll(
  Layer.succeed(RunStore)(makeFileRunStore()),
  Layer.succeed(WorkspaceStore)(makeNodeWorkspaceStore()),
  Layer.succeed(DriverCatalog)({
    structured: () => Effect.succeed({ outcome: "observed", outputs: [] }),
    publish: () => Effect.die("publish is never confirmed in this test"),
    reconcile: () => Effect.succeed(ReadResult.make({ found: false }))
  }),
  Layer.succeed(CredentialStore)({
    getRead: () => Effect.die("unused"),
    getPublish: () => Effect.die("unused")
  }),
  LocalApprovalSignerLayer
)
const config = {
  project: { name: "handoff", version: "1.0.0", tag: "v1.0.0", commit: "abc123" },
  artifacts: [{ id: "fixture", path: "dist/fixture", format: "file" }],
  publish: { github: { repository: "owner/handoff" } }
}
const seedWorkspace = (): string => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "ts-release-handoff-")))
  mkdirSync(join(directory, "dist"), { recursive: true })
  writeFileSync(join(directory, "dist/fixture"), "handoff-bytes")
  writeFileSync(join(directory, "release.config.json"), JSON.stringify(config, null, 2))
  return directory
}
const invoke = async (
  workspace: string,
  inputs: Readonly<Record<string, string>>
): Promise<Record<string, string>> => {
  const api = makeReleaseApi(releaseLayer())
  const outputs: Record<string, string> = {}
  try {
    await runAction(api, {
      workspace,
      input: (name) => inputs[name] ?? "",
      output: (name, value) => {
        outputs[name] = value
      },
      read: (path) => readFileSync(path, "utf8"),
      write: (path, value) => {
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, value)
      }
    })
  } finally {
    await api.dispose()
  }
  return outputs
}

describe("three-job release handoff", () => {
  test("plan, materialize, and publish phases share only bytes and strings", async () => {
    const directories: Array<string> = []
    try {
      // Phase plan (runner A): plan + review-only. Persist ONLY the plan
      // file's bytes and two output strings.
      const runnerA = seedWorkspace()
      directories.push(runnerA)
      const planned = await invoke(runnerA, { command: "plan", "plan-path": "release-plan.json" })
      const planId = planned.plan_id!
      expect(planId).toHaveLength(64)
      const planBytes = readFileSync(join(runnerA, "release-plan.json"), "utf8")
      const reviewed = await invoke(runnerA, {
        command: "apply",
        "review-only": "true",
        "plan-path": "release-plan.json",
        "plan-id": planId,
        scope: "all"
      })
      const executionReviewId = reviewed.execution_review_id!
      expect(executionReviewId.length).toBeGreaterThan(0)

      // Phase materialize (runner B): a fresh workspace, a fresh api, the
      // plan arriving as bytes and the review id as a string.
      const runnerB = seedWorkspace()
      directories.push(runnerB)
      writeFileSync(join(runnerB, "release-plan.json"), planBytes)
      const materialized = await invoke(runnerB, {
        command: "apply",
        "plan-path": "release-plan.json",
        "plan-id": planId,
        "new-run": ".release/runs",
        through: "validate",
        scope: "all",
        "confirm-execution": executionReviewId,
        reviewer: "handoff-test"
      })
      expect(materialized.status).toBe("publish-review-required")
      const publishReviewId = materialized.publish_review_id!
      expect(publishReviewId.length).toBeGreaterThan(0)
      const runPath = materialized.run_path!
      expect(runPath.endsWith(".run-ledger.json")).toBe(true)
      const materializedRevision = decodeLedger(readFileSync(runPath, "utf8")).revision

      // Phase publish (runner C): the runs directory arrives as copied FILES.
      const runnerC = seedWorkspace()
      directories.push(runnerC)
      writeFileSync(join(runnerC, "release-plan.json"), planBytes)
      cpSync(join(runnerB, ".release"), join(runnerC, ".release"), { recursive: true })
      const resumeInputs = (resume: string) => ({
        command: "apply",
        "plan-path": "release-plan.json",
        "plan-id": planId,
        resume,
        through: "validate",
        reviewer: "handoff-test"
      })
      // Both resume spellings: the runs DIRECTORY and the ledger file path.
      const resumedByDirectory = await invoke(runnerC, resumeInputs(".release/runs"))
      expect(resumedByDirectory.status).toBe("publish-review-required")
      // The serialization property under test: a process that never saw the
      // minting process's memory derives the SAME publish review challenge.
      expect(resumedByDirectory.publish_review_id).toBe(publishReviewId)
      const resumedByFile = await invoke(
        runnerC,
        resumeInputs(join(".release/runs", basename(runPath)))
      )
      expect(resumedByFile.publish_review_id).toBe(publishReviewId)
      const resumed = decodeLedger(
        readFileSync(join(runnerC, ".release/runs", basename(runPath)), "utf8")
      )
      expect(resumed.revision).toBeGreaterThan(materializedRevision)
    } finally {
      for (const directory of directories) {
        rmSync(directory, { recursive: true, force: true })
      }
    }
  })
})
