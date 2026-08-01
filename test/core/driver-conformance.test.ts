import { describe, expect, test } from "@effect/bun-test"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
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
  CatalogStructuredRequest,
  Committed,
  CommitmentUnknown,
  DriverCatalog,
  NotDispatched,
  ProcessRequest,
  ReadResult,
  SnapshotRequest,
  VerifiedContentHandle
} from "../../src/drivers/services.js"
import { LiveDriversLayer } from "../../src/drivers/local.js"
import {
  makeNodeWorkspaceStore
} from "../../src/drivers/workspace.js"
import {
  CheckpointId,
  Digest,
  NonEmptyName,
  OperationId,
  OutputId,
  SafeRelativePath,
  SnapshotId,
  WorkspaceRoot
} from "../../src/model/primitives.js"
import {
  Check,
  DigestOp,
  Exec,
  Operation,
  OutputDeclaration,
  Pack,
  Write
} from "../../src/model/operation.js"
import {
  MaterializedOutput
} from "../../src/model/run.js"
import {
  Invocation,
  compilePlan
} from "../../src/plan/compiler.js"
import { acceptedRunPlan } from "./run-fixture.js"
import { recordingHttpClient, recordingSpawner, type SpawnRecorder } from "./host-doubles.js"

const failure = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(effect.pipe(Effect.flip))
// The live drivers under the real filesystem but doubled host capabilities:
// before Plan 186 the Exec path reached Bun.spawnSync directly and could only
// be exercised by actually running a command.
const structuredEffect = (request: CatalogStructuredRequest) => Effect.gen(function*() {
  const catalog = yield* DriverCatalog
  return yield* catalog.structured(request)
})
const liveLayers = (spawner: SpawnRecorder, env: Record<string, string>) =>
  <A, E>(effect: Effect.Effect<A, E, DriverCatalog>) => effect.pipe(
    Effect.provide(LiveDriversLayer.pipe(Layer.provide(Layer.mergeAll(
      spawner.layer,
      recordingHttpClient(() => ({ status: 500 })).layer
    )))),
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env })))
  )
const liveStructured = (
  spawner: SpawnRecorder,
  request: CatalogStructuredRequest,
  env: Record<string, string> = {}
) => Effect.runPromise(structuredEffect(request).pipe(liveLayers(spawner, env)))

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
    const directory = realpathSync(mkdtempSync(join(tmpdir(), "ts-release-workspace-")))
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
      root: WorkspaceRoot.make("/workspace-root"),
      checkpointId: CheckpointId.make("dispatch"),
      clientReconciliationKey: "stable-key"
    })
    expect(request.operation._tag).toBe("HttpPublish")
    expect(request.clientReconciliationKey).toBe("stable-key")
    expect(VerifiedContentHandle).not.toHaveProperty("make")
  })

  test("the live drivers reach spawning only through the injected capability", async () => {
    const directory = realpathSync(mkdtempSync(join(tmpdir(), "ts-release-live-exec-")))
    try {
      mkdirSync(join(directory, "build"), { recursive: true })
      const spawner = recordingSpawner(() => ({ exitCode: 0, stdout: "built\n" }))
      const result = await liveStructured(
        spawner,
        CatalogStructuredRequest.make({
          operation: Exec.make({
            id: OperationId.make("build:compile"), inputs: [], outputs: [],
            contractFixtureId: "exec/v1", argv: ["compiler", "--release"],
            cwd: SafeRelativePath.make("build"),
            environmentNames: [NonEmptyName.make("BUILD_TOKEN")]
          }),
          root: WorkspaceRoot.make(directory),
          availableOutputs: []
        }),
        { PATH: "/usr/bin", BUILD_TOKEN: "declared", UNDECLARED: "ambient" }
      )
      expect(result.outcome).toBe("observed")
      expect(spawner.commands).toHaveLength(1)
      expect(spawner.commands[0]?.argv).toEqual(["compiler", "--release"])
      expect(spawner.commands[0]?.cwd).toBe(join(directory, "build"))
      expect(spawner.commands[0]?.env).toEqual({ PATH: "/usr/bin", BUILD_TOKEN: "declared" })
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test("a nonzero exec exit reports the exact frozen command failure", async () => {
    const directory = realpathSync(mkdtempSync(join(tmpdir(), "ts-release-live-exec-fail-")))
    try {
      const spawner = recordingSpawner(() => ({ exitCode: 3, stderr: "compile error\n" }))
      const error = await Effect.runPromise(structuredEffect(CatalogStructuredRequest.make({
        operation: Exec.make({
          id: OperationId.make("build:compile"), inputs: [], outputs: [],
          contractFixtureId: "exec/v1", argv: ["compiler"], cwd: SafeRelativePath.make("."),
          environmentNames: []
        }),
        root: WorkspaceRoot.make(directory),
        availableOutputs: []
      })).pipe(liveLayers(spawner, {}), Effect.flip))
      expect(error._tag).toBe("DriverError")
      expect(error.reason).toBe("Command exited 3: compile error")
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test("the live drivers materialize local operations against a real workspace", async () => {
    const directory = realpathSync(mkdtempSync(join(tmpdir(), "ts-release-live-local-")))
    try {
      const spawner = recordingSpawner(() => ({ exitCode: 0 }))
      writeFileSync(join(directory, "notes.txt"), "notes\n")
      const written = await liveStructured(spawner, CatalogStructuredRequest.make({
        operation: Write.make({
          id: OperationId.make("process:notes"), inputs: [],
          outputs: [OutputDeclaration.make({
            id: OutputId.make("notes"), path: SafeRelativePath.make("dist/notes.md"), kind: "file"
          })],
          path: SafeRelativePath.make("dist/notes.md"), content: "released\n"
        }),
        root: WorkspaceRoot.make(directory),
        availableOutputs: []
      }))
      expect(readFileSync(join(directory, "dist/notes.md"), "utf8")).toBe("released\n")
      expect(written.outputs[0]?.size).toBe(9)
      const declared = OutputDeclaration.make({
        id: OutputId.make("notes"), path: SafeRelativePath.make("dist/notes.md"), kind: "file"
      })
      const packed = await liveStructured(spawner, CatalogStructuredRequest.make({
        operation: Pack.make({
          id: OperationId.make("process:archive"), inputs: [OutputId.make("notes")],
          outputs: [OutputDeclaration.make({
            id: OutputId.make("archive"),
            path: SafeRelativePath.make("dist/bundle.tar.gz"),
            kind: "archive"
          })],
          format: "tar.gz"
        }),
        root: WorkspaceRoot.make(directory),
        availableOutputs: [declared]
      }))
      const archive = readFileSync(join(directory, "dist/bundle.tar.gz"))
      expect([...archive.subarray(0, 4)]).toEqual([0x1f, 0x8b, 0x08, 0x00])
      expect([...archive.subarray(4, 10)]).toEqual([0, 0, 0, 0, 2, 0xff])
      expect(packed.outputs[0]?.digest).toHaveLength(64)
      const digested = await liveStructured(spawner, CatalogStructuredRequest.make({
        operation: DigestOp.make({
          id: OperationId.make("process:checksums"), inputs: [OutputId.make("notes")],
          outputs: [OutputDeclaration.make({
            id: OutputId.make("checksums"),
            path: SafeRelativePath.make("dist/checksums.txt"),
            kind: "checksum-file"
          })],
          algorithm: "sha256"
        }),
        root: WorkspaceRoot.make(directory),
        availableOutputs: [declared]
      }))
      expect(digested.outcome).toBe("observed")
      expect(readFileSync(join(directory, "dist/checksums.txt"), "utf8")).toMatch(/^[a-f0-9]{64} {2}notes\.md\n$/u)
      const missing = await Effect.runPromise(structuredEffect(CatalogStructuredRequest.make({
        operation: Check.make({
          id: OperationId.make("validate:present"), inputs: [], outputs: [],
          path: SafeRelativePath.make("dist/absent")
        }),
        root: WorkspaceRoot.make(directory),
        availableOutputs: []
      })).pipe(liveLayers(spawner, {}), Effect.flip))
      expect(missing.reason).toBe("Required path dist/absent is absent.")
      expect(spawner.commands).toHaveLength(0)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test("symlinks at write targets and declared outputs refuse", async () => {
    const directory = realpathSync(mkdtempSync(join(tmpdir(), "ts-release-symlink-refuse-")))
    try {
      const spawner = recordingSpawner(() => ({ exitCode: 0 }))
      const outside = join(directory, "outside.txt")
      writeFileSync(outside, "outside")
      const root = join(directory, "workspace")
      mkdirSync(join(root, "dist"), { recursive: true })
      symlinkSync(outside, join(root, "dist/notes.md"))
      const write = CatalogStructuredRequest.make({
        operation: Write.make({
          id: OperationId.make("process:notes"), inputs: [],
          outputs: [OutputDeclaration.make({
            id: OutputId.make("notes"), path: SafeRelativePath.make("dist/notes.md"), kind: "file"
          })],
          path: SafeRelativePath.make("dist/notes.md"), content: "released\n"
        }),
        root: WorkspaceRoot.make(root),
        availableOutputs: []
      })
      const refusal = await Effect.runPromise(
        structuredEffect(write).pipe(liveLayers(spawner, {}), Effect.flip))
      expect(refusal.reason).toBe("Structured write encountered a symlink.")
      expect(readFileSync(outside, "utf8")).toBe("outside")
      // A symlink at a declared output path refuses observation too: the
      // digest must never attest a link target's bytes.
      writeFileSync(join(root, "dist/real.md"), "real\n")
      const observed = CatalogStructuredRequest.make({
        operation: Check.make({
          id: OperationId.make("validate:real"), inputs: [],
          outputs: [OutputDeclaration.make({
            id: OutputId.make("linked"), path: SafeRelativePath.make("dist/notes.md"), kind: "file"
          })],
          path: SafeRelativePath.make("dist/real.md")
        }),
        root: WorkspaceRoot.make(root),
        availableOutputs: []
      })
      const observeRefusal = await Effect.runPromise(
        structuredEffect(observed).pipe(liveLayers(spawner, {}), Effect.flip))
      expect(observeRefusal.reason).toBe("Declared output linked was not materialized.")
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
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
