import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  defineRelease, disposeReleaseRuntime, plan, release, ReleaseApiError, type ReleaseIntent
} from "../src/index.js"
import {
  resetReleaseRuntimeLayerFactoryForTesting,
  setReleaseRuntimeLayerFactoryForTesting,
  type ReleaseRuntimeLayer
} from "../src/api/api.js"
import { UnsupportedArtifactStagerLayer } from "../src/pack/stager.js"
import { commandKey, makeTestCommandRunnerLayer, makeTestReleaseHttpLayer } from "./host-fakes.js"
import { CommandSpec } from "../src/grammar/operation.js"
import { TestGitHubApiLayer } from "./helpers.js"

const project = { name: "release", version: "0.1.0", commit: "abc123", tag: "v0.1.0" } as const

const inlineConfig = defineRelease({
  project,
  publish: {},
  evidence: ".release/evidence"
})

const artifactConfig = defineRelease({
  project, publish: {}, evidence: ".release/evidence",
  artifacts: [{ id: "cli", path: "dist/cli", format: "executable",
    checksum: { algorithm: "sha256", value: "digest" },
    variant: { os: "linux", arch: "x64", binaryName: "cli" } }]
})

const npmPublishConfig = defineRelease({
  project,
  npmPackage: { path: "." },
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

const invalidInlineConfigs: ReadonlyArray<
  readonly [string, unknown, ReadonlyArray<string>]
> = [
  [
    "unknown top-level field",
    { ...inlineConfig, unexpectedTopLevel: true },
    [`["unexpectedTopLevel"]`]
  ],
  [
    "unknown nested publish field",
    {
      ...inlineConfig,
      publish: { ...inlineConfig.publish, github: false as const, unexpectedPublishField: true }
    },
    [`["publish"]["unexpectedPublishField"]`]
  ],
  [
    "removed npm packageExists field",
    {
      ...inlineConfig,
      publish: {
        npm: {
          trustedPublishing: { provider: "github-actions" as const, workflow: "release.yml", packageExists: true as const }
        }
      }
    },
    ["$.publish.npm.trustedPublishing.packageExists", "verifyPackageExists"]
  ]
]

const npmCommand = (args: ReadonlyArray<string>): CommandSpec => CommandSpec.make({
  executable: "npm", args: [...args], requiredEnv: [], redactedEnv: []
})

const passedCommand = { exitCode: 0, stdout: "ok\n", stderr: "" }

const testRuntimeLayer = (): ReleaseRuntimeLayer =>
  Layer.mergeAll(
    makeTestCommandRunnerLayer({ directories: new Set(["."]) }),
    makeTestReleaseHttpLayer(),
    TestGitHubApiLayer,
    UnsupportedArtifactStagerLayer
  )

const withRuntime = async <A>(
  use: () => Promise<A>,
  factory: () => ReleaseRuntimeLayer = testRuntimeLayer
): Promise<A> => {
  await setReleaseRuntimeLayerFactoryForTesting(factory)
  try {
    return await use()
  } finally {
    await resetReleaseRuntimeLayerFactoryForTesting()
  }
}

const expectInlinePlanFailure = async (
  config: unknown,
  reasonFragments: ReadonlyArray<string>
): Promise<void> => {
  const caught = await plan({ config: config as ReleaseIntent }).then(() => undefined, (error: unknown) => error)
  expect(caught).toBeInstanceOf(ReleaseApiError)
  if (!(caught instanceof ReleaseApiError)) return
  expect(caught.phase).toBe("plan")
  expect(caught.cause).toMatchObject({ _tag: "ConfigError" })
  const cause = caught.cause
  const reason = typeof cause === "object" && cause !== null && "reason" in cause ? cause.reason : undefined
  expect(typeof reason).toBe("string")
  for (const fragment of reasonFragments) expect(typeof reason === "string" ? reason : "").toContain(fragment)
}

describe("public API", () => {
  it("plans from an inline config object", () =>
    withRuntime(async () => {
      const summary = await plan({ config: inlineConfig })

      expect(summary.identity).toMatchObject(project)
      expect(summary.operations).toEqual([])
    }))

  it("returns canonical JSON-safe artifact summaries", () =>
    withRuntime(async () => {
      const artifact = (await plan({ config: artifactConfig })).artifacts[0]
      expect(artifact).toMatchObject({
        id: "cli", kind: "executable", path: "dist/cli", producedBy: "import-artifacts",
        platform: { os: "linux", arch: "x64", binaryName: "cli" },
        checksum: { algorithm: "sha256", value: "digest" },
        extra: { _tag: "executable", binary: "cli", builderId: "import-artifacts" } })
      expect(artifact).toEqual(JSON.parse(JSON.stringify(artifact)))
      expect(artifact).not.toHaveProperty("format"); expect(artifact).not.toHaveProperty("sizeBytes")
    }))

  for (const [label, config, reasonFragments] of invalidInlineConfigs) {
    it(`rejects an inline config object with ${label}`, () =>
      withRuntime(() => expectInlinePlanFailure(config, reasonFragments)))
  }

  it("keeps bare release plan-only", () =>
    withRuntime(async () => {
      const summary = await release({ config: inlineConfig })

      expect(summary.executed).toEqual([])
      expect(summary.refused).toEqual([])
      expect(summary.identity.version).toBe("0.1.0")
    }))

  it("records snapshot publish refusals", () =>
    withRuntime(async () => {
      const summary = await release({
        config: npmPublishConfig, execute: true, approvePublish: true, snapshot: true
      })

      expect(summary.identity.version).toBe("0.1.0-SNAPSHOT-abc123")
      expect(summary.refused.map((operation) => operation.id)).toEqual(["npm:npm-publish"])
      expect(summary.refused.every((operation) => operation.status === "refused")).toBe(true)
    }, () =>
      Layer.mergeAll(
        makeTestCommandRunnerLayer({
          directories: new Set(["."]),
          env: new Map([["NPM_TOKEN", "npm_secret"]]),
          commands: new Map([
            [commandKey(npmCommand(["--version"])), passedCommand],
            [commandKey(npmCommand(["whoami", "--registry", "https://registry.npmjs.org"])), passedCommand],
            [commandKey(npmCommand(["pack", "--dry-run", "--json", "."])), {
              ...passedCommand, stdout: "[]\n"
            }],
            [commandKey(npmCommand([
              "view", "release@0.1.0-SNAPSHOT-abc123", "version", "--registry",
              "https://registry.npmjs.org"
            ])), { ...passedCommand, stdout: "0.1.0-SNAPSHOT-abc123\n" }]
          ])
        }),
        makeTestReleaseHttpLayer(),
        TestGitHubApiLayer,
        UnsupportedArtifactStagerLayer
      )
    ))

  it("reuses the runtime until disposal", () => {
    let built = 0
    let released = 0
    const resourceLayer = Layer.effectDiscard(
      Effect.acquireRelease(
        Effect.sync(() => { built += 1 }),
        () => Effect.sync(() => { released += 1 })
      )
    )
    return withRuntime(async () => {
      await plan({ config: inlineConfig })
      await plan({ config: inlineConfig })

      expect(built).toBe(1)
      expect(released).toBe(0)

      await disposeReleaseRuntime()
      expect(released).toBe(1)

      await plan({ config: inlineConfig })
      expect(built).toBe(2)
    }, () => Layer.mergeAll(testRuntimeLayer(), resourceLayer))
  })

  it("collapses failures into ReleaseApiError", () =>
    withRuntime(async () => {
      await expect(plan({ config: "missing-release.config.json" })).rejects.toBeInstanceOf(ReleaseApiError)
    }))
})
