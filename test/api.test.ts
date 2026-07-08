import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  defineRelease,
  disposeReleaseRuntime,
  plan,
  release,
  ReleaseApiError
} from "../src/index.js"
import {
  resetReleaseRuntimeLayerFactoryForTesting,
  setReleaseRuntimeLayerFactoryForTesting,
  type ReleaseRuntimeLayer
} from "../src/api/api.js"
import { UnsupportedArtifactStagerLayer } from "../src/engine/stager.js"
import { makeTestReleaseHttpLayer } from "./host-fakes.js"
import { commandKey, makeTestCommandRunnerLayer } from "./host-fakes.js"
import { CommandSpec } from "../src/pipeline/operation.js"
import { TestGitHubApiLayer } from "./helpers.js"

const inlineConfig = defineRelease({
  project: {
    name: "release",
    version: "0.1.0",
    commit: "abc123",
    tag: "v0.1.0"
  },
  publish: {},
  evidence: ".release/evidence"
})

const npmPublishConfig = defineRelease({
  project: {
    name: "release",
    version: "0.1.0",
    commit: "abc123",
    tag: "v0.1.0"
  },
  npmPackage: {
    path: "."
  },
  publish: {
    npm: {
      registry: "https://registry.npmjs.org",
      packageName: "release",
      packagePath: ".",
      tokenEnv: "NPM_TOKEN"
    }
  },
  evidence: ".release/evidence"
})

const npmCommand = (args: ReadonlyArray<string>): CommandSpec =>
  CommandSpec.make({
    executable: "npm",
    args: [...args],
    requiredEnv: [],
    redactedEnv: []
  })

const passedCommand = {
  exitCode: 0,
  stdout: "ok\n",
  stderr: ""
}

const testRuntimeLayer = (): ReleaseRuntimeLayer =>
  Layer.mergeAll(
    makeTestCommandRunnerLayer({
      directories: new Set(["."])
    }),
    makeTestReleaseHttpLayer(),
    TestGitHubApiLayer,
    UnsupportedArtifactStagerLayer
  )

describe("public API", () => {
  it("plans from an inline config object", async () => {
    await setReleaseRuntimeLayerFactoryForTesting(testRuntimeLayer)
    try {
      const summary = await plan({ config: inlineConfig })

      expect(summary.identity).toMatchObject({
        name: "release",
        version: "0.1.0",
        commit: "abc123",
        tag: "v0.1.0"
      })
      expect(summary.operations).toEqual([])
    } finally {
      await resetReleaseRuntimeLayerFactoryForTesting()
    }
  })

  it("keeps bare release plan-only", async () => {
    await setReleaseRuntimeLayerFactoryForTesting(testRuntimeLayer)
    try {
      const summary = await release({ config: inlineConfig })

      expect(summary.executed).toEqual([])
      expect(summary.refused).toEqual([])
      expect(summary.identity.version).toBe("0.1.0")
    } finally {
      await resetReleaseRuntimeLayerFactoryForTesting()
    }
  })

  it("records snapshot publish refusals", async () => {
    await setReleaseRuntimeLayerFactoryForTesting(() =>
      Layer.mergeAll(
        makeTestCommandRunnerLayer({
          directories: new Set(["."]),
          env: new Map([["NPM_TOKEN", "npm_secret"]]),
          commands: new Map([
            [commandKey(npmCommand(["--version"])), passedCommand],
            [commandKey(npmCommand(["whoami", "--registry", "https://registry.npmjs.org"])), passedCommand],
            [commandKey(npmCommand(["pack", "--dry-run", "--json", "."])), {
              ...passedCommand,
              stdout: "[]\n"
            }],
            [commandKey(npmCommand([
              "view",
              "release@0.1.0-SNAPSHOT-abc123",
              "version",
              "--registry",
              "https://registry.npmjs.org"
            ])), {
              ...passedCommand,
              stdout: "0.1.0-SNAPSHOT-abc123\n"
            }]
          ])
        }),
        makeTestReleaseHttpLayer(),
        TestGitHubApiLayer,
        UnsupportedArtifactStagerLayer
      )
    )
    try {
      const summary = await release({
        config: npmPublishConfig,
        execute: true,
        approvePublish: true,
        snapshot: true
      })

      expect(summary.identity.version).toBe("0.1.0-SNAPSHOT-abc123")
      expect(summary.refused.map((operation) => operation.id)).toEqual(["npm:npm-publish"])
      expect(summary.refused.every((operation) => operation.status === "refused")).toBe(true)
    } finally {
      await resetReleaseRuntimeLayerFactoryForTesting()
    }
  })

  it("reuses the runtime until disposal", async () => {
    let built = 0
    let released = 0
    const resourceLayer = Layer.effectDiscard(
      Effect.acquireRelease(
        Effect.sync(() => {
          built += 1
        }),
        () =>
          Effect.sync(() => {
            released += 1
          })
      )
    )
    await setReleaseRuntimeLayerFactoryForTesting(() =>
      Layer.mergeAll(testRuntimeLayer(), resourceLayer)
    )
    try {
      await plan({ config: inlineConfig })
      await plan({ config: inlineConfig })

      expect(built).toBe(1)
      expect(released).toBe(0)

      await disposeReleaseRuntime()
      expect(released).toBe(1)

      await plan({ config: inlineConfig })
      expect(built).toBe(2)
    } finally {
      await resetReleaseRuntimeLayerFactoryForTesting()
    }
  })

  it("collapses failures into ReleaseApiError", async () => {
    await setReleaseRuntimeLayerFactoryForTesting(testRuntimeLayer)
    try {
      await expect(plan({ config: "missing-release.config.json" })).rejects.toBeInstanceOf(ReleaseApiError)
    } finally {
      await resetReleaseRuntimeLayerFactoryForTesting()
    }
  })
})
