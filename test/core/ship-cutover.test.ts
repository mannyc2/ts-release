// `ship` composes the same public chain a staged release runs, so what these
// cases pin is not "does it work" but the four properties that make a one-shot
// run honest: the plan on disk is what was applied, the durable receipts say
// nobody independent approved, an uncertain publication still stops, and a
// stopped one-shot resumes into the staged flow with no migration at all.
import { describe, expect, test } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Command from "effect/unstable/cli/Command"
import { createHash } from "node:crypto"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { makeCli, SELF_REVIEWER, type CliIo } from "../../apps/release-ts/src/cli/command.js"
import { runApply } from "../../apps/release-ts/src/cli/commands.js"
import type { ReleaseApi } from "../../src/api/api.js"
import { makeReleaseApi } from "../../src/api/api.js"
import { LocalApprovalSignerLayer } from "../../src/apply/approval.js"
import { decodeLedger, makeFileRunStore, RunStore } from "../../src/apply/store.js"
import {
  Committed,
  CommitmentUnknown,
  CredentialStore,
  DriverCatalog,
  ReadResult,
  WorkspaceStore
} from "../../src/drivers/services.js"
import { makeNodeWorkspaceStore } from "../../src/drivers/workspace.js"
import { DriverError, MaterializedOutput, type RunLedger } from "../../src/model/run.js"
import { Digest, SnapshotId } from "../../src/model/primitives.js"

// One artifact and one forge release: the smallest config with both a local
// stage and something that reaches the wire, which is what the conspicuous
// surface and the publish review exist for.
const config = {
  project: {
    name: "fixture", version: "1.0.0", tag: "v1.0.0", commit: "abc123", notes: "fixture release"
  },
  artifacts: [{ id: "fixture", path: "dist/fixture", format: "file" }],
  publish: { github: { repository: "owner/repo", tokenEnv: "GH_TOKEN" } }
}

interface Publications {
  readonly dispatches: Array<string>
}
type PublishOutcome = "committed" | "unknown" | "credential-missing"

const makeLayer = (publications: Publications, outcome: PublishOutcome) =>
  Layer.mergeAll(
    Layer.succeed(RunStore)(makeFileRunStore()),
    Layer.succeed(WorkspaceStore)(makeNodeWorkspaceStore()),
    Layer.succeed(DriverCatalog)({
      structured: (request) =>
        Effect.sync(() => ({
          outcome: "observed" as const,
          outputs: request.operation.outputs.flatMap((output) => {
            const path = join(request.root, output.path)
            let bytes: Buffer
            try {
              bytes = readFileSync(path)
            } catch {
              return []
            }
            return [MaterializedOutput.make({
              outputId: output.id,
              snapshotId: SnapshotId.make("0".repeat(64)),
              digest: Digest.make(createHash("sha256").update(bytes).digest("hex")),
              size: bytes.length,
              inode: 1
            })]
          })
        })),
      publish: (request) =>
        Effect.suspend((): Effect.Effect<Committed | CommitmentUnknown, DriverError> => {
          publications.dispatches.push(request.checkpointId)
          if (outcome === "unknown") {
            return Effect.succeed(CommitmentUnknown.make({ failure: "response dropped" }))
          }
          return Effect.succeed(Committed.make({
            observedOutcome: `committed:${request.checkpointId}`
          }))
        }),
      reconcile: () => Effect.succeed(ReadResult.make({ found: false }))
    }),
    Layer.succeed(CredentialStore)({
      getRead: () => Effect.die("unused"),
      getPublish: () => outcome === "credential-missing"
        ? Effect.fail(DriverError.make({
          reason: "Publish credential GH_TOKEN is unset.", commitment: "before-commit"
        }))
        : Effect.succeed("token-value")
    }),
    LocalApprovalSignerLayer
  )

const setup = (outcome: PublishOutcome) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "ts-release-ship-")))
  mkdirSync(join(root, "dist"))
  writeFileSync(join(root, "dist/fixture"), "fixture")
  writeFileSync(join(root, "release.config.json"), JSON.stringify(config, null, 2))
  const publications: Publications = { dispatches: [] }
  return { root, publications, layer: makeLayer(publications, outcome) }
}

const io = (logs: Array<string>): CliIo => ({
  read: (path: string) => readFileSync(path, "utf8"),
  write: (path: string, value: string) => {
    mkdirSync(join(path, ".."), { recursive: true })
    writeFileSync(path, value)
  },
  log: (value: string) => logs.push(value)
})

const invoke = (
  api: ReleaseApi, cwd: string, cliIo: CliIo, argv: ReadonlyArray<string>
): Promise<void> =>
  Effect.runPromise(
    Command.runWith(makeCli(api, cwd, cliIo), { version: "0.0.0-test" })(argv).pipe(
      Effect.provide(BunServices.layer)
    )
  )

const ledgerAt = (root: string) => {
  const runs = join(root, ".release/runs")
  // The runs directory also holds the snapshot tree and the evidence sidecar;
  // the ledger is the `<logicalRunId>.run-ledger.json` file (plan 192's shape).
  const files = readdirSync(runs).filter((name) => name.endsWith(".run-ledger.json"))
  expect(files).toHaveLength(1)
  const path = join(runs, files[0]!)
  return { path, ledger: decodeLedger(readFileSync(path, "utf8")) }
}
// Receipts hang off attempts, so this is where reviewer identity is durable —
// the evidence projection carries none.
const reviewers = (ledger: RunLedger): {
  readonly execution: ReadonlyArray<string>, readonly publish: ReadonlyArray<string>
} => {
  const execution = new Set<string>()
  const publish = new Set<string>()
  for (const operation of ledger.operations) {
    for (const attempt of operation.attempts) {
      execution.add(attempt.executionReceipt.reviewer)
      if (attempt.publishReceipt !== undefined) publish.add(attempt.publishReceipt.reviewer)
    }
  }
  return { execution: [...execution], publish: [...publish] }
}

describe("ship — the one-shot orchestrator", () => {
  test("completes, and the durable record says nobody independent approved", async () => {
    const { layer, publications, root } = setup("committed")
    const api = makeReleaseApi(layer)
    const logs: Array<string> = []
    try {
      await invoke(api, root, io(logs), ["ship", "--config", "release.config.json"])
      const planId = JSON.parse(logs[0]!).planId as string

      // The bytes on disk are the bytes that were applied: a staged apply can
      // continue this run without replanning anything.
      const written = readFileSync(join(root, ".release/release-plan.json"), "utf8")
      const replanned = await api.plan({ config, workspace: root })
      expect(written).toBe(replanned.bytes)
      expect(planId).toBe(replanned.planId)

      // The conspicuous surface is rendered BEFORE anything is applied.
      const surface = JSON.parse(logs[1]!)
      expect(surface.review).toBe("execution")
      expect(surface.executionReviewId).toBeTruthy()
      expect(surface.remotePublish.length).toBeGreaterThan(0)
      expect(surface.stages.publish).toBeGreaterThan(0)

      const final = JSON.parse(logs.at(-1)!)
      expect(final.mode).toBe("one-shot")
      expect(final.status).toBe("complete")
      expect(final.publishReceiptId).toBeDefined()

      const { ledger } = ledgerAt(root)
      expect(reviewers(ledger)).toEqual({ execution: [SELF_REVIEWER], publish: [SELF_REVIEWER] })
      const evidence = JSON.parse(readFileSync(final.evidencePath as string, "utf8"))
      expect(evidence.schemaVersion).toBe("evidence-projection/v1")
      expect(evidence.planId).toBe(planId)
      // Dispatch is per CHECKPOINT, so the count tracks the plan's checkpoints
      // rather than its operations; what matters is that each fired exactly once.
      expect(publications.dispatches.length).toBeGreaterThan(0)
      expect(new Set(publications.dispatches).size).toBe(publications.dispatches.length)
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("a failed publish resumes into the staged flow with no migration", async () => {
    const { layer, publications, root } = setup("credential-missing")
    const api = makeReleaseApi(layer)
    const logs: Array<string> = []
    try {
      await expect(invoke(api, root, io(logs), ["ship", "--config", "release.config.json"]))
        .rejects.toThrow(/--resume/u)
      const before = ledgerAt(root)
      expect(reviewers(before.ledger).execution).toEqual([SELF_REVIEWER])
      // Nothing reached the wire, so nothing has to be reconciled.
      expect(publications.dispatches).toEqual([])
    } finally {
      await api.dispose()
    }

    // A FRESH api — the staged continuation shares only bytes and paths with
    // the process that stopped.
    const resumed = makeReleaseApi(makeLayer({ dispatches: [] }, "committed"))
    try {
      const planId = JSON.parse(logs[0]!).planId as string
      // Exactly the continuation the one-shot's guidance printed: resume the
      // same run, observe the publish review, and confirm it as a named person.
      const staged = { plan: ".release/release-plan.json", planId, root: ".", resume: ".release/runs" }
      await runApply(resumed, { ...staged, reviewer: "release-team" }, root, io(logs))
      const publishReviewId = JSON.parse(logs.at(-1)!).publishReviewId as string
      expect(publishReviewId).toBeTruthy()
      await runApply(resumed, {
        ...staged, reviewer: "release-team", confirmPublish: publishReviewId
      }, root, io(logs))
      const { ledger } = ledgerAt(root)
      // History is immutable: the execution the one-shot approved still says so,
      // and the publication a person approved says who.
      expect(reviewers(ledger)).toEqual({ execution: [SELF_REVIEWER], publish: ["release-team"] })
      expect(JSON.parse(logs.at(-1)!).status).toBe("complete")
    } finally {
      await resumed.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("an unknown publication outcome stops and is never re-dispatched", async () => {
    const { layer, publications, root } = setup("unknown")
    const api = makeReleaseApi(layer)
    const logs: Array<string> = []
    try {
      await expect(invoke(api, root, io(logs), ["ship", "--config", "release.config.json"]))
        .rejects.toThrow(/--reconcile/u)
      // No auto-retry, no auto-resolve: judgment is the operator's.
      expect(publications.dispatches).toHaveLength(1)
      const { ledger } = ledgerAt(root)
      expect(reviewers(ledger).execution).toEqual([SELF_REVIEWER])
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("a second ship without a reason is refused and the ledger is untouched", async () => {
    const { layer, root } = setup("committed")
    const api = makeReleaseApi(layer)
    const logs: Array<string> = []
    try {
      await invoke(api, root, io(logs), ["ship", "--config", "release.config.json"])
      const first = ledgerAt(root)
      const bytes = readFileSync(first.path, "utf8")
      await expect(invoke(api, root, io(logs), ["ship", "--config", "release.config.json"]))
        .rejects.toThrow(/--reason/u)
      expect(readFileSync(first.path, "utf8")).toBe(bytes)
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })
})
