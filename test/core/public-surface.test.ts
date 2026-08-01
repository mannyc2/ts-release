import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
// Deliberately the only import of product code in this file: makeReleaseApi
// promises a caller can compose the api from its own services, and that promise
// is only real if it can be kept without reaching past the package root.
import {
  ApprovalSigner,
  CredentialStore,
  DriverCatalog,
  ExecutionPermit,
  PublishPermit,
  ReleaseServicesLive,
  RunStore,
  WorkspaceStore,
  makeReleaseApi,
  type ApprovalSignerShape,
  type CredentialStoreShape,
  type DriverCatalogShape,
  type RunStoreShape,
  type WorkspaceStoreShape
} from "../../src/index.js"

type Ledger = Parameters<RunStoreShape["create"]>[1]
const unavailable = <A>(what: string): Effect.Effect<A> => Effect.die(`${what} not expected`)

const fakeServices = () => {
  const ledgers = new Map<string, Ledger>()
  const executed: Array<string> = []
  const store: RunStoreShape = {
    path: (directory, logicalRunId) => join(directory, `${logicalRunId}.run-ledger.json`),
    load: (path) => {
      const found = ledgers.get(path)
      return found === undefined ? unavailable("resume") : Effect.succeed(found)
    },
    create: (path, ledger) => Effect.sync(() => {
      ledgers.set(path, ledger)
      return "file-rename"
    }),
    save: (path, _revision, ledger) => Effect.sync(() => {
      ledgers.set(path, ledger)
      return "file-rename"
    })
  }
  const catalog: DriverCatalogShape = {
    structured: (request) => Effect.sync(() => {
      executed.push(request.operation.id)
      return { outcome: "observed", outputs: [] }
    }),
    publish: () => unavailable("publish"),
    reconcile: () => unavailable("reconciliation")
  }
  const workspace: WorkspaceStoreShape = {
    snapshot: () => unavailable("snapshot"),
    verify: () => unavailable("verification")
  }
  const credentials: CredentialStoreShape = {
    getRead: () => unavailable("read credential"),
    getPublish: () => unavailable("publish credential")
  }
  const signer: ApprovalSignerShape = {
    execution: (receipt, runId, reviewId) =>
      Effect.sync(() => ExecutionPermit.from(receipt, runId, reviewId)),
    publish: (receipt, execution, reviewId) =>
      Effect.sync(() => PublishPermit.from(receipt, execution, reviewId))
  }
  return {
    executed,
    ledgers,
    layer: Layer.mergeAll(
      Layer.succeed(RunStore)(store),
      Layer.succeed(DriverCatalog)(catalog),
      Layer.succeed(WorkspaceStore)(workspace),
      Layer.succeed(CredentialStore)(credentials),
      Layer.succeed(ApprovalSigner)(signer)
    )
  }
}
const config = {
  project: { name: "fixture", version: "1.0.0", tag: "v1.0.0", commit: "abc123" },
  artifacts: [{ id: "fixture", path: "dist/fixture", format: "file" }],
  publish: {}
}

describe("public factory surface", () => {
  test("a caller composes plan, review, and apply from its own services", async () => {
    const directory = realpathSync(mkdtempSync(join(tmpdir(), "ts-release-public-surface-")))
    const services = fakeServices()
    const api = makeReleaseApi(services.layer)
    try {
      mkdirSync(join(directory, "dist"), { recursive: true })
      writeFileSync(join(directory, "dist/fixture"), "fixture")
      const planned = await api.plan({ config, workspace: directory })
      const review = await api.reviewExecution({
        planBytes: planned.bytes,
        expectedPlanId: planned.planId,
        scope: "all"
      })
      expect(services.executed).toEqual([])
      const output = await api.apply({
        planBytes: planned.bytes,
        expectedPlanId: planned.planId,
        workspace: directory,
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
      expect(services.executed.length).toBeGreaterThan(0)
      // Nothing durable was written: every service came from this test.
      expect(services.ledgers.has(output.runPath)).toBe(true)
    } finally {
      await api.dispose()
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test("the platform-generic live layer still owes the host capabilities", () => {
    // Typed proof that ReleaseServicesLive is not runnable on its own: only a
    // host layer that closes spawn and HTTP satisfies a ReleaseApiLayer.
    const hostFree = (layer: Layer.Layer<
      RunStore | WorkspaceStore | DriverCatalog | CredentialStore | ApprovalSigner
    >) => layer
    // @ts-expect-error ReleaseServicesLive still requires ChildProcessSpawner and HttpClient
    expect(hostFree(ReleaseServicesLive)).toBeDefined()
  })
})
