import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { makeReleaseApi } from "../src/index.js"
import {
  ReleaseInputError
} from "../src/api/errors.js"
import { ReleaseRuntime } from "../src/api/runtime.js"
import { WorkspaceRoot } from "../src/model/primitives.js"
import {
  CredentialProvider,
  makeCredentialProvider
} from "../src/publication/authority.js"
import { HttpAuthorizer } from "../src/publication/http.js"
import {
  encodeCompletePreparedReleaseRef,
  makeLocalCompletePreparedReleaseRef
} from "../src/release/prepared-ref.js"
import {
  PreparedCommitHandoffError,
  PreparedReleaseStore,
  PreparedStoreError,
  makeLocalPreparedReleaseStore
} from "../src/release/prepared-store.js"
import {
  contextFor,
  fixtureConfig,
  materializeFixtureWorkspace,
  noopRun,
  runtimeLayer
} from "./core/runtime-fixture.js"
import { unavailableMutationServicesLayer } from "./fixtures/mutation-services.js"

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

  test("release keeps preparation and publication inside one managed-runtime entry", async () => {
    const root = workspace()
    const fibers: Array<string> = []
    const recordFiber = Effect.fn("recordApiLifecycleFiber")(function*() {
      fibers.push(String(yield* Effect.fiberId))
    })
    const store = makeLocalPreparedReleaseStore(join(root, "prepared-store"))
    const credentials = makeCredentialProvider({
      acquire: Effect.fn("recordApiLifecycleCredential")(function*(request) {
        yield* recordFiber()
        switch (request.strategy.kind) {
          case "anonymous":
            return { _tag: "AnonymousAccess", purposes: ["observe"] } as const
          case "token":
            return {
              _tag: "ScopedSecret",
              purposes: ["observe"] as const,
              ref: request.strategy.credential
            } as const
          case "trusted-publishing":
            return yield* Effect.die("The lifecycle fixture does not use trusted publishing.")
        }
      })
    })
    const api = makeReleaseApi(Layer.mergeAll(
      Layer.succeed(ReleaseRuntime, {
        source: {
          observe: (currentWorkspace: WorkspaceRoot) => recordFiber().pipe(
            Effect.as(contextFor(currentWorkspace.toString()))
          ),
          materialize: materializeFixtureWorkspace
        },
        run: noopRun
      }),
      Layer.succeed(PreparedReleaseStore, store),
      Layer.succeed(CredentialProvider, credentials),
      Layer.succeed(HttpAuthorizer, {
        execute: () => Effect.succeed({ status: 404, headers: {}, body: "{}" })
      }),
      unavailableMutationServicesLayer
    ))
    try {
      const result = await api.release({
        workspace: root,
        config: {
          ...fixtureConfig,
          project: { ...fixtureConfig.project, repository: "owner/fixture" },
          publish: { github: { repository: "owner/fixture" } }
        }
      })

      expect(result.report.status).toBe("blocked")
      expect(fibers.length).toBeGreaterThan(1)
      expect(new Set(fibers).size).toBe(1)
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("strict config and resolution failures are ReleaseInputError on every local-config API", async () => {
    const root = workspace()
    const observations = { count: { value: 0 } }
    const api = makeReleaseApi(runtimeLayer(
      observations,
      makeLocalPreparedReleaseStore(join(root, "prepared-store"))
    ))
    const strictFailure = { ...fixtureConfig, unexpected: true }
    const resolutionFailure = {
      ...fixtureConfig,
      project: { ...fixtureConfig.project, version: "2.0.0" },
      versionFrom: "manifest"
    }
    try {
      for (const config of [strictFailure, resolutionFailure]) {
        const calls = [
          () => api.inspect({ config, workspace: root }),
          () => api.prepare({ config, workspace: root }),
          () => api.release({ config, workspace: root })
        ]
        for (const call of calls) {
          await expect(call()).rejects.toMatchObject({
            _tag: "ReleaseInputError",
            reason: expect.any(String)
          })
        }
      }
      const missingWorkspace = join(root, "missing-workspace")
      const workspaceCalls = [
        () => api.inspect({ config: fixtureConfig, workspace: missingWorkspace }),
        () => api.prepare({ config: fixtureConfig, workspace: missingWorkspace }),
        () => api.release({ config: fixtureConfig, workspace: missingWorkspace })
      ]
      for (const call of workspaceCalls) {
        await expect(call()).rejects.toMatchObject({
          _tag: "ReleaseInputError",
          reason: "workspace must be an existing absolute directory."
        })
      }
      expect(observations.count.value).toBe(3)
    } finally {
      await api.dispose()
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("release refuses an accidental empty graph unless diagnostics opt in", async () => {
    const root = workspace()
    const api = testApi(root)
    const config = {
      project: { name: "fixture", version: "1.0.0", tag: "v1.0.0" },
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
      const prepared = await api.prepare({
        config: {
          ...fixtureConfig,
          project: { ...fixtureConfig.project, repository: "owner/fixture" },
          publish: { github: { repository: "owner/fixture" } }
        },
        workspace: root
      })
      const report = await api.correct({
        prepared,
        correction: {
          provider: "github",
          kind: "amend-release-metadata",
          message: "Use 1.0.1."
        }
      })
      expect(report).toMatchObject({
        prepared,
        status: "unsupported",
        provider: "github"
      })
      expect(report.reason).toContain("conditional release-metadata")
      expect(report.proposal).toContain("correction-intent/v2")
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
