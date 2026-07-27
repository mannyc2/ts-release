import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import {
  chmodSync,
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
  CatalogPublishRequest,
  Committed,
  CommitmentUnknown,
  NotDispatched,
  ProcessRequest,
  ReadResult,
  SnapshotRequest,
  VerifiedContentHandle
} from "../../src/drivers/services.js"
import {
  makeNodeWorkspaceStore
} from "../../src/drivers/workspace.js"
import {
  CheckpointId,
  Digest,
  NonEmptyName,
  OutputId,
  SafeRelativePath,
  SnapshotId,
  WorkspaceRoot
} from "../../src/model/primitives.js"
import {
  Operation
} from "../../src/model/operation.js"
import {
  MaterializedOutput
} from "../../src/model/run.js"
import {
  Invocation,
  compilePlan
} from "../../src/plan/compiler.js"
import { acceptedRunPlan } from "./run-fixture.js"

const failure = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(effect.pipe(Effect.flip))

describe("candidate driver conformance", () => {
  test("strict request and response schemas reject excess or malformed fields", () => {
    const process = {
      _tag: "ProcessRequest",
      argv: ["tool", "--exact"],
      cwd: ".",
      environmentNames: ["TOKEN_NAME"]
    }
    const decoded = Schema.decodeUnknownSync(ProcessRequest, {
      onExcessProperty: "error"
    })(process)
    expect(decoded.argv).toEqual(["tool", "--exact"])
    expect(decoded.environmentNames).toEqual(["TOKEN_NAME"])
    expect(() => Schema.decodeUnknownSync(ProcessRequest, {
      onExcessProperty: "error"
    })({ ...process, shell: true })).toThrow()
    expect(() => Schema.decodeUnknownSync(ReadResult, {
      onExcessProperty: "error"
    })({ found: true, body: {} })).toThrow()
  })

  test("closed mutation results classify precommit, commit, and uncertainty", () => {
    expect(NotDispatched.make({ reason: "rejected", retryable: false })._tag)
      .toBe("NotDispatched")
    expect(Committed.make({
      observedOutcome: "201",
      transmittedDigest: Digest.make("digest")
    })._tag).toBe("Committed")
    expect(CommitmentUnknown.make({ failure: "response dropped" })._tag)
      .toBe("CommitmentUnknown")
  })

  test("workspace snapshots exact bytes and verified handles ignore original-path swaps", async () => {
    const directory = mkdtempSync(join(tmpdir(), "ts-release-workspace-"))
    try {
      const root = join(directory, "workspace")
      const snapshotDirectory = join(directory, "snapshots")
      mkdirSync(join(root, "dist"), { recursive: true })
      writeFileSync(join(root, "dist/source"), "first")
      const store = makeNodeWorkspaceStore()
      const facts = await Effect.runPromise(store.snapshot(SnapshotRequest.make({
        root: WorkspaceRoot.make(realpathSync(root)),
        source: SafeRelativePath.make("dist/source"),
        snapshotDirectory,
        outputId: OutputId.make("source")
      })))
      expect(readFileSync(join(snapshotDirectory, facts.snapshotId), "utf8")).toBe("first")
      writeFileSync(join(root, "dist/source"), "second")
      const handle = await Effect.runPromise(store.verify(snapshotDirectory, facts))
      expect(handle.bytes).toEqual(new TextEncoder().encode("first"))
      expect(() => {
        handle.bytes[0] = 0
      }).not.toThrow()
      expect(new TextDecoder().decode(handle.bytes)).toBe("first")
      const verifiedAgain = await Effect.runPromise(store.verify(snapshotDirectory, facts))
      expect(new TextDecoder().decode(verifiedAgain.bytes)).toBe("first")
    } finally {
      chmodSync(directory, 0o700)
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test("intermediate, final, root, snapshot, and digest path symlinks refuse", async () => {
    const directory = mkdtempSync(join(tmpdir(), "ts-release-symlink-"))
    try {
      const root = join(directory, "workspace")
      const outside = join(directory, "outside")
      const snapshots = join(directory, "snapshots")
      mkdirSync(join(root, "dist"), { recursive: true })
      mkdirSync(outside)
      writeFileSync(join(outside, "payload"), "outside")
      symlinkSync(outside, join(root, "linked-directory"))
      symlinkSync(join(outside, "payload"), join(root, "dist/linked-file"))
      const store = makeNodeWorkspaceStore()
      const base = {
        root: WorkspaceRoot.make(realpathSync(root)),
        snapshotDirectory: snapshots,
        outputId: OutputId.make("source")
      }
      for (const source of ["linked-directory/payload", "dist/linked-file"]) {
        const error = await failure(store.snapshot(SnapshotRequest.make({
          ...base,
          source: SafeRelativePath.make(source)
        })))
        expect(error._tag).toBe("DriverError")
      }
      symlinkSync(root, join(directory, "root-link"))
      expect((await failure(store.snapshot(SnapshotRequest.make({
        ...base,
        root: WorkspaceRoot.make(join(directory, "root-link")),
        source: SafeRelativePath.make("dist/linked-file")
      }))))._tag).toBe("DriverError")
      mkdirSync(join(directory, "actual-snapshots"))
      symlinkSync(join(directory, "actual-snapshots"), join(directory, "snapshot-link"))
      expect((await failure(store.snapshot(SnapshotRequest.make({
        ...base,
        snapshotDirectory: join(directory, "snapshot-link"),
        source: SafeRelativePath.make("dist/linked-file")
      }))))._tag).toBe("DriverError")
      const forged = MaterializedOutput.make({
        outputId: OutputId.make("source"),
        snapshotId: SnapshotId.make("../outside/payload"),
        digest: Digest.make("forged"),
        size: 7,
        inode: 1
      })
      expect((await failure(store.verify(snapshots, forged)))._tag).toBe("DriverError")
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test("publish parameters are limited to the closed remote composite union", async () => {
    const accepted = await acceptedRunPlan()
    const operation = accepted.plan.stages.publish[0]!
    if (operation._tag !== "HttpPublish") throw new Error("Expected HTTP publish fixture.")
    const request = CatalogPublishRequest.make({
      operation,
      checkpointId: CheckpointId.make("dispatch"),
      clientReconciliationKey: "stable-key"
    })
    expect(request.operation._tag).toBe("HttpPublish")
    expect(request.clientReconciliationKey).toBe("stable-key")
    expect(VerifiedContentHandle).not.toHaveProperty("make")
  })

  test("package, forge, and opaque composites reject injected execution policy", async () => {
    for (const name of ["portable-cli", "agent-plugin"]) {
      const config = JSON.parse(readFileSync(
        join(process.cwd(), "examples", name, "release.config.json"),
        "utf8"
      ))
      const accepted = await Effect.runPromise(compilePlan(config, Invocation.make({
        workspace: WorkspaceRoot.make(process.cwd()),
        commit: NonEmptyName.make("abc123"),
        snapshot: false
      })))
      for (const operation of accepted.plan.stages.publish.filter((candidate) =>
        ["PackageRegistryRelease", "ForgeRelease", "OpaquePublish"].includes(candidate._tag))) {
        expect(Schema.decodeUnknownSync(Operation, {
          onExcessProperty: "error"
        })(operation)._tag).toBe(operation._tag)
        expect(() => Schema.decodeUnknownSync(Operation, {
          onExcessProperty: "error"
        })({ ...operation, autoRetry: true })).toThrow()
      }
    }
  })
})
