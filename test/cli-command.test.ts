import { describe, expect, layer, test } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as Scope from "effect/Scope"
import * as Command from "effect/unstable/cli/Command"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parseReleaseIntent } from "../src/config/load.js"
import {
  PlanReleaseConfigOptions,
  planReleaseConfig,
  renderReleaseConfigPlan
} from "../src/workflows/config.js"
import {
  checkAuthReleaseConfig,
  checkCiReleaseConfig,
  ReleaseDiagnosticsOptions
} from "../src/workflows/diagnostics.js"
import {
  planReleaseInit,
  ReleaseInitOptions,
  renderGithubActionsTrustedPublishingWorkflow
} from "../src/workflows/init.js"
import { cli } from "../apps/release-ts/src/cli/command.js"
import { CommandSpec } from "../src/domain/operation.js"
import { makeTestReleaseHttpLayer } from "../src/host/http.js"
import { BunExecutableBuild, makeBunArtifactRecipeRegistryLayer, makeBunReleaseWorkflowRuntimeLayer } from "../apps/release-ts/src/runtime.js"
import { commandKey } from "../src/host/test.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"
import {
  expectExitFailureTag,
  expectTaggedError,
  makeObservableCommandRunnerLayer,
  minimalConfig,
  noOpConfig,
  partialWorkflowConfig,
  reconcileConfig
} from "./helpers.js"

const streamText = async (stream: ReadableStream<Uint8Array> | null): Promise<string> =>
  stream === null ? "" : await new Response(stream).text()

const withTempDirectory = <A, E, R>(
  prefix: string,
  use: (root: string) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | Scope.Scope> =>
  Effect.acquireRelease(
    Effect.promise(() => mkdtemp(join(tmpdir(), prefix))),
    (root) => Effect.promise(() => rm(root, { recursive: true, force: true })).pipe(Effect.orDie)
  ).pipe(Effect.flatMap(use))

const withTempDirectoryPromise = async <A>(
  prefix: string,
  use: (root: string) => Promise<A>
): Promise<A> => {
  const root = await mkdtemp(join(tmpdir(), prefix))
  try {
    return await use(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

const approvalCliLayer = Layer.mergeAll(
  makeObservableCommandRunnerLayer({
    env: new Map([
      ["NPM_TOKEN", "npm_secret"],
      ["GH_TOKEN", "gh_secret"]
    ]),
    commands: new Map()
  }),
  LiveTargetRegistryLayer,
  BunServices.layer
)

// The remaining direct Effect.provide calls in this file exercise CLI entrypoints
// around one-off temp-directory setup; reusable Effect fixtures use layer(...).
describe("cli command", () => {
  test("exports the root release command", () => {
    expect(cli.name).toBe("release")
    expect(cli.subcommands.flatMap((group) => group.commands.map((command) => command.name)).sort()).toEqual([
      "check-auth",
      "check-ci",
      "check-intent",
      "doctor",
      "eligibility",
      "execute",
      "explain",
      "init",
      "plan",
      "print",
      "reconcile",
      "render",
      "run",
      "schema",
      "stage-artifacts",
      "validate",
      "validate-config",
      "verify"
    ])
  })

  test("parses plan command with a config path", () =>
    withTempDirectoryPromise("ts-release-cli-plan-", async (root) => {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, minimalConfig)
      const layer = Layer.mergeAll(
        makeObservableCommandRunnerLayer({
          env: new Map([
            ["NPM_TOKEN", "npm_secret"],
            ["GH_TOKEN", "gh_secret"]
          ]),
          commands: new Map()
        }),
        LiveTargetRegistryLayer,
        BunServices.layer
      )

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "plan",
          "--config",
          configPath,
          "--out",
          join(root, "release-plan.json")
        ]).pipe(Effect.provide(layer))
      )
    }))

  test("stage-artifacts command stages recipe outputs and writes text output", () =>
    withTempDirectoryPromise("ts-release-cli-stage-artifacts-", async (root) => {
      const configPath = join(root, "release.config.json")
      const out = join(root, "stage.txt")
      await writeFile(configPath, JSON.stringify({
        identity: {
          name: "release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
        artifacts: [],
        artifactRecipes: [
          {
            _tag: "BunExecutableArtifactRecipe",
            id: "release-cli",
            entrypoint: "src/cli.ts",
            outputs: [
              {
                id: "cli-linux-x64",
                target: "bun-linux-x64-baseline",
                path: "dist/release-{version}-linux-x64",
                consumers: ["github"]
              }
            ]
          }
        ],
        targets: []
      }))
      const build: BunExecutableBuild = async (input) => {
        await mkdir(join(root, "dist"), { recursive: true })
        await writeFile(input.outfile, "compiled binary")
        return { success: true, logs: [] }
      }
      const layer = Layer.mergeAll(
        makeObservableCommandRunnerLayer({
          env: new Map(),
          commands: new Map()
        }),
        makeBunArtifactRecipeRegistryLayer(build),
        LiveTargetRegistryLayer,
        BunServices.layer
      )

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "stage-artifacts",
          "--config",
          configPath,
          "--out",
          out
        ]).pipe(Effect.provide(layer))
      )

      const contents = await readFile(out, "utf8")
      expect(contents).toContain("staged artifact recipes: 1")
      expect(contents).toContain("cli-linux-x64 dist/release-0.1.0-linux-x64")
    }))

  test("stage-artifacts command succeeds with no recipes", () =>
    withTempDirectoryPromise("ts-release-cli-stage-artifacts-empty-", async (root) => {
      const configPath = join(root, "release.config.json")
      const out = join(root, "stage.json")
      await writeFile(configPath, noOpConfig)
      const layer = Layer.mergeAll(
        makeObservableCommandRunnerLayer({
          env: new Map(),
          commands: new Map()
        }),
        makeBunArtifactRecipeRegistryLayer(async () => ({ success: true, logs: [] })),
        LiveTargetRegistryLayer,
        BunServices.layer
      )

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "stage-artifacts",
          "--config",
          configPath,
          "--format",
          "json",
          "--out",
          out
        ]).pipe(Effect.provide(layer))
      )

      const parsed: unknown = JSON.parse(await readFile(out, "utf8"))
      expect(JSON.stringify(parsed)).toContain("\"schemaVersion\":\"artifact-stage/v1\"")
      expect(JSON.stringify(parsed)).toContain("\"recipes\":[]")
    }))

  test("stage-artifacts command reports build failures", () =>
    withTempDirectoryPromise("ts-release-cli-stage-artifacts-failure-", async (root) => {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, JSON.stringify({
        identity: {
          name: "release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
        artifacts: [],
        artifactRecipes: [
          {
            _tag: "BunExecutableArtifactRecipe",
            id: "release-cli",
            entrypoint: "src/cli.ts",
            outputs: [
              {
                id: "cli-linux-x64",
                target: "bun-linux-x64-baseline",
                path: "dist/release-{version}-linux-x64",
                consumers: ["github"]
              }
            ]
          }
        ],
        targets: []
      }))
      const layer = Layer.mergeAll(
        makeObservableCommandRunnerLayer({
          env: new Map(),
          commands: new Map()
        }),
        makeBunArtifactRecipeRegistryLayer(async () => ({
          success: false,
          logs: ["compile failed"]
        })),
        LiveTargetRegistryLayer,
        BunServices.layer
      )

      const exit = await Effect.runPromiseExit(
        Command.runWith(cli, { version: "0.0.0" })([
          "stage-artifacts",
          "--config",
          configPath
        ]).pipe(Effect.provide(layer))
      )

      expectExitFailureTag(exit, "ArtifactRecipeStageError")
    }))

  test("schema command writes parseable JSON Schema", () =>
    withTempDirectoryPromise("ts-release-cli-schema-", async (root) => {
      const out = join(root, "release-config.schema.json")
      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "schema",
          "--out",
          out
        ]).pipe(Effect.provide(BunServices.layer))
      )

      const parsed: unknown = JSON.parse(await readFile(out, "utf8"))
      expect(typeof parsed).toBe("object")
      expect(JSON.stringify(parsed)).toContain("ReleaseIntent")
    }))

  test("validate-config command checks config shape only", () =>
    withTempDirectoryPromise("ts-release-cli-validate-config-", async (root) => {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, minimalConfig)

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "validate-config",
          "--config",
          configPath,
          "--format",
          "json"
        ]).pipe(Effect.provide(BunServices.layer))
      )
    }))

  test("root cli script preserves caller-relative config paths", async () => {
    const subprocess = Bun.spawn([
      "bun",
      "run",
      "cli",
      "validate-config",
      "--config",
      "apps/release-ts/release.config.json",
      "--format",
      "text"
    ], {
      cwd: process.cwd(),
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe"
    })
    const stdout = streamText(subprocess.stdout)
    const stderr = streamText(subprocess.stderr)
    const exitCode = await subprocess.exited

    expect(await stdout).toContain("valid: true")
    expect(await stderr).not.toContain("ConfigReadError")
    expect(exitCode).toBe(0)
  })

  test("config-backed commands accept an explicit release root", () =>
    withTempDirectoryPromise("ts-release-cli-explicit-root-", async (root) => {
      await mkdir(join(root, "app"), { recursive: true })
      await writeFile(join(root, "package.json"), JSON.stringify({
        name: "@scope/root-package",
        version: "1.2.3"
      }))
      await writeFile(join(root, "app", "release.config.json"), JSON.stringify({
        identity: {
          _tag: "PackageManifestReleaseIdentitySource",
          packagePath: "package.json",
          commit: "abc123",
          tagTemplate: "v{version}"
        },
        releaseDecision: {
          _tag: "IntentFilesReleaseDecision",
          directory: ".release/intents",
          packagePath: "package.json",
          tagTemplate: "v{version}",
          requireIntent: true
        },
        artifacts: [],
        targets: [],
        strict: true,
        evidenceDirectory: ".release/evidence"
      }))
      await mkdir(join(root, ".release", "intents"), { recursive: true })
      await writeFile(join(root, ".release", "intents", "empty.json"), JSON.stringify({
        package: "@scope/root-package",
        release: "none",
        summary: "No release needed.",
        empty: true
      }))
      const out = join(root, "plan-summary.txt")
      const layer = makeBunReleaseWorkflowRuntimeLayer({ root })

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "plan",
          "--root",
          root,
          "--config",
          "app/release.config.json",
          "--format",
          "summary",
          "--out",
          out
        ]).pipe(Effect.provide(layer))
      )
      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "eligibility",
          "--root",
          root,
          "--config",
          "app/release.config.json"
        ]).pipe(Effect.provide(layer))
      )
      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "check-intent",
          "--root",
          root,
          "--config",
          "app/release.config.json"
        ]).pipe(Effect.provide(layer))
      )

      const summary = await readFile(out, "utf8")
      expect(summary).toContain("@scope/root-package@1.2.3")
    }))

  test("renders release configs through the explicit config workflow", () =>
    withTempDirectoryPromise("ts-release-cli-root-", async (root) => {
      await writeFile(join(root, "release.config.json"), minimalConfig)

      const output = await Effect.runPromise(
        renderReleaseConfigPlan(
          PlanReleaseConfigOptions.make({
            root,
            configPath: "release.config.json",
            format: "text"
          })
        ).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )

      expect(output).toContain("release@0.1.0")
    }))

  test("renders summary and markdown plan formats through the workflow", () =>
    withTempDirectoryPromise("ts-release-cli-plan-formats-", async (root) => {
      await writeFile(join(root, "release.config.json"), minimalConfig)

      const summary = await Effect.runPromise(
        renderReleaseConfigPlan(
          PlanReleaseConfigOptions.make({
            root,
            configPath: "release.config.json",
            format: "summary"
          })
        ).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )
      const markdown = await Effect.runPromise(
        renderReleaseConfigPlan(
          PlanReleaseConfigOptions.make({
            root,
            configPath: "release.config.json",
            format: "markdown"
          })
        ).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )

      expect(summary).toContain("approval-required operations")
      expect(markdown).toContain("### npm:npm-publish")
    }))

  test("explain command reports one operation without executing it", () =>
    withTempDirectoryPromise("ts-release-cli-explain-", async (root) => {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, minimalConfig)

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "explain",
          "npm:npm-publish",
          "--config",
          configPath
        ]).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )

      const missing = await Effect.runPromiseExit(
        Command.runWith(cli, { version: "0.0.0" })([
          "explain",
          "missing:operation",
          "--config",
          configPath
        ]).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )
      expectExitFailureTag(missing, "PlanOperationNotFoundError")
    }))

  test("init previews without writing and writes only when approved", () =>
    withTempDirectoryPromise("ts-release-cli-init-", async (root) => {
      const configPath = join(root, "release.config.json")

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "init",
          "--template",
          "npm-github",
          "--package",
          "@scope/pkg",
          "--repo",
          "owner/repo",
          "--config",
          configPath
        ]).pipe(Effect.provide(BunServices.layer))
      )
      await expect(readFile(configPath, "utf8")).rejects.toThrow()

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "init",
          "--template",
          "npm-github",
          "--package",
          "@scope/pkg",
          "--repo",
          "owner/repo",
          "--config",
          configPath,
          "--write"
        ]).pipe(Effect.provide(BunServices.layer))
      )
      const config = await readFile(configPath, "utf8")
      expect(config).toContain("\"$schema\"")
      expect(config).toContain("\"repository\": \"owner/repo\"")
      const intent = await Effect.runPromise(parseReleaseIntent(config))
      const packageArtifact = intent.artifacts.find((artifact) => artifact.id === "package")
      expect(packageArtifact?.consumers).toEqual(["npm"])

      const blocked = await Effect.runPromiseExit(
        Command.runWith(cli, { version: "0.0.0" })([
          "init",
          "--config",
          configPath,
          "--write"
        ]).pipe(Effect.provide(BunServices.layer))
      )
      expectExitFailureTag(blocked, "ReleaseInitWriteError")
    }))

  test("init generates schema-valid configs for every template", async () => {
    const templates: ReadonlyArray<
      "npm-only" | "npm-github" | "bun-cli-github" | "multi-target-homebrew" | "multi-target-scoop"
    > = [
      "npm-only",
      "npm-github",
      "bun-cli-github",
      "multi-target-homebrew",
      "multi-target-scoop"
    ]
    for (const template of templates) {
      await withTempDirectoryPromise(`ts-release-cli-init-${template}-`, async (root) => {
        const plan = await Effect.runPromise(
          planReleaseInit(ReleaseInitOptions.make({
            root,
            template,
            package: "@scope/pkg",
            repo: "owner/repo",
            tap: "owner/homebrew-tap",
            bucket: "owner/scoop-bucket"
          })).pipe(Effect.provide(BunServices.layer))
        )
        const configFile = plan.files.find((file) => file.path === "release.config.json")
        expect(configFile).toBeDefined()
        if (configFile !== undefined) {
          const intent = await Effect.runPromise(parseReleaseIntent(configFile.contents))
          expect("name" in intent.identity ? intent.identity.name : undefined).toBe("@scope/pkg")
          expect(configFile.contents).toContain("\"$schema\"")
          if (template === "multi-target-homebrew") {
            expect(configFile.contents).toContain("owner/homebrew-tap")
          }
          if (template === "multi-target-scoop") {
            expect(configFile.contents).toContain("owner/scoop-bucket")
          }
          if (template === "npm-github") {
            const packageArtifact = intent.artifacts.find((artifact) => artifact.id === "package")
            expect(packageArtifact?.consumers).toEqual(["npm"])
          }
          if (template === "bun-cli-github") {
            const recipe = intent.artifactRecipes?.find((candidate) => candidate.id === "cli")
            expect(recipe?._tag).toBe("BunExecutableArtifactRecipe")
            expect(recipe?.outputs.map((output) => output.target).sort()).toEqual([
              "bun-darwin-arm64",
              "bun-darwin-x64",
              "bun-linux-arm64",
              "bun-linux-x64-baseline",
              "bun-windows-x64-baseline"
            ])
          }
        }
      })
    }
  })

  test("init can include the GitHub Actions trusted-publishing template", () =>
    withTempDirectoryPromise("ts-release-cli-init-actions-", async (root) => {
      const configPath = join(root, "release.config.json")
      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "init",
          "--template",
          "npm-github",
          "--package",
          "@scope/pkg",
          "--repo",
          "owner/repo",
          "--config",
          configPath,
          "--github-actions",
          "--write"
        ]).pipe(Effect.provide(BunServices.layer))
      )

      const workflow = await readFile(join(root, ".github", "workflows", "release.yml"), "utf8")
      expect(workflow).toContain("uses: mannyc2/ts-release-action@v1")
      expect(workflow).toContain("config: release.config.json")
      expect(workflow).not.toContain(configPath)
      expect(workflow).toContain("command: plan")
      expect(workflow).toContain("format: markdown")
      expect(workflow).toContain("command: run")
      expect(workflow).toContain("execute: true")
      expect(workflow).toContain("approve-irreversible: true")
      expect(workflow).toContain("id-token: write")
      expect(workflow).toContain("oven-sh/setup-bun@v2")
      expect(workflow).toContain("bun install --frozen-lockfile")
      expect(workflow).toContain("bun run build")
      expect(workflow).not.toContain("NPM_TOKEN")
    }))

  test("init can render npm and pnpm GitHub Actions setup", () =>
    withTempDirectoryPromise("ts-release-cli-init-actions-npm-", async (root) => {
      const configPath = join(root, "release.config.json")
      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "init",
          "--template",
          "npm-github",
          "--package",
          "@scope/pkg",
          "--repo",
          "owner/repo",
          "--config",
          configPath,
          "--github-actions",
          "--package-manager",
          "npm",
          "--write"
        ]).pipe(Effect.provide(BunServices.layer))
      )

      const npmWorkflow = await readFile(join(root, ".github", "workflows", "release.yml"), "utf8")
      expect(npmWorkflow).toContain("npm ci")
      expect(npmWorkflow).toContain("npm run build --if-present")
      expect(npmWorkflow).not.toContain("oven-sh/setup-bun@v2")

      const pnpmPlan = await Effect.runPromise(
        planReleaseInit(ReleaseInitOptions.make({
          root,
          template: "npm-github",
          package: "@scope/pkg",
          repo: "owner/repo",
          githubActions: true,
          packageManager: "pnpm"
        })).pipe(Effect.provide(BunServices.layer))
      )
      const pnpmWorkflow = pnpmPlan.files.find((file) => file.path === ".github/workflows/release.yml")?.contents ?? ""
      expect(pnpmWorkflow).toContain("corepack enable && pnpm install --frozen-lockfile")
      expect(pnpmWorkflow).toContain("pnpm run build --if-present")
      expect(pnpmWorkflow).not.toContain("oven-sh/setup-bun@v2")
    }))

  test("init supports workflow command overrides and rejects multiline commands", () =>
    withTempDirectoryPromise("ts-release-cli-init-actions-commands-", async (root) => {
      const configPath = join(root, "release.config.json")
      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "init",
          "--template",
          "npm-github",
          "--package",
          "@scope/pkg",
          "--repo",
          "owner/repo",
          "--config",
          configPath,
          "--github-actions",
          "--package-manager",
          "npm",
          "--install-command",
          "npm install --legacy-peer-deps",
          "--build-command",
          "npm run compile",
          "--write"
        ]).pipe(Effect.provide(BunServices.layer))
      )

      const workflow = await readFile(join(root, ".github", "workflows", "release.yml"), "utf8")
      expect(workflow.split("npm install --legacy-peer-deps").length - 1).toBe(1)
      expect(workflow.split("npm run compile").length - 1).toBe(1)

      const rejected = await Effect.runPromiseExit(
        planReleaseInit(ReleaseInitOptions.make({
          root,
          githubActions: true,
          installCommand: "npm ci\nnpm run build"
        })).pipe(Effect.provide(BunServices.layer))
      )
      expectExitFailureTag(rejected, "ReleaseInitWriteError")
    }))

  test("init rejects workflow traversal without writing output", () =>
    withTempDirectoryPromise("ts-release-cli-init-unsafe-workflow-", async (root) => {
      const configPath = join(root, "release.config.json")
      const exit = await Effect.runPromiseExit(
        Command.runWith(cli, { version: "0.0.0" })([
          "init",
          "--template",
          "npm-github",
          "--package",
          "@scope/pkg",
          "--repo",
          "owner/repo",
          "--config",
          configPath,
          "--github-actions",
          "--workflow",
          "../outside.yml",
          "--write"
        ]).pipe(Effect.provide(BunServices.layer))
      )

      expectExitFailureTag(exit, "ReleaseInitWriteError")
      await expect(readFile(configPath, "utf8")).rejects.toThrow()
      await expect(readFile(join(root, ".github", "outside.yml"), "utf8")).rejects.toThrow()
    }))

  test("check-auth reports env names without secret values", () =>
    withTempDirectoryPromise("ts-release-cli-check-auth-", async (root) => {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, minimalConfig)
      const layer = Layer.mergeAll(
        makeObservableCommandRunnerLayer({
          env: new Map([
            ["NPM_TOKEN", "npm_secret"]
          ]),
          commands: new Map()
        }),
        LiveTargetRegistryLayer,
        BunServices.layer
      )

      const report = await Effect.runPromise(
        checkAuthReleaseConfig(ReleaseDiagnosticsOptions.make({
          configPath
        })).pipe(Effect.provide(layer))
      )
      const serialized = JSON.stringify(report)
      expect(serialized).toContain("NPM_TOKEN")
      expect(serialized).toContain("GH_TOKEN")
      expect(serialized).not.toContain("npm_secret")
      expect(report.checks.some((item) => item.status === "fail" && item.message.includes("GH_TOKEN"))).toBe(true)
    }))

  test("check-ci accepts the trusted publishing workflow template", () =>
    withTempDirectoryPromise("ts-release-cli-check-ci-", async (root) => {
      const configPath = join(root, "release.config.json")
      const trustedConfig = minimalConfig.replace(
        "\"tokenEnv\":\"NPM_TOKEN\",",
        "\"trustedPublishing\":{\"provider\":\"github-actions\",\"workflow\":\"release.yml\",\"packageExists\":true},"
      )
      await writeFile(configPath, trustedConfig)
      await mkdir(join(root, ".github", "workflows"), { recursive: true })
      await writeFile(
        join(root, ".github", "workflows", "release.yml"),
        renderGithubActionsTrustedPublishingWorkflow("release.config.json")
      )

      const report = await Effect.runPromise(
        checkCiReleaseConfig(ReleaseDiagnosticsOptions.make({
          configPath,
          workflow: ".github/workflows/release.yml"
        })).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )

      expect(report.checks.filter((item) => item.status === "fail")).toEqual([])
    }))

  test("check-ci does not require referenced release artifacts to exist", () =>
    withTempDirectoryPromise("ts-release-cli-check-ci-missing-artifacts-", async (root) => {
      const configPath = join(root, "release.config.json")
      await writeFile(join(root, "package.json"), JSON.stringify({
        name: "@scope/pkg",
        version: "1.2.3"
      }))
      await writeFile(configPath, JSON.stringify({
        identity: {
          _tag: "PackageManifestReleaseIdentitySource",
          commit: "abc123",
          tagTemplate: "v{version}"
        },
        artifacts: [
          {
            id: "github-asset",
            path: ".release/artifacts/{version}.bin",
            format: "file",
            consumers: ["github"]
          }
        ],
        targets: [
          {
            _tag: "NpmRegistryTarget",
            id: "npm",
            registry: "https://registry.npmjs.org",
            packageName: "@scope/pkg",
            packagePath: ".",
            trustedPublishing: {
              provider: "github-actions",
              workflow: "release.yml",
              packageExists: true
            },
            access: "public",
            provenance: true,
            dryRunSupport: "native",
            mutability: "immutable",
            recovery: "publish-new-version"
          },
          {
            _tag: "GitHubReleaseTarget",
            id: "github",
            repository: "owner/repo",
            tokenEnv: "GH_TOKEN",
            draft: true,
            prerelease: false,
            dryRunSupport: "simulated",
            mutability: "mutable-release",
            recovery: "delete-and-recreate"
          }
        ],
        strict: true,
        evidenceDirectory: ".release/evidence"
      }))
      await mkdir(join(root, ".github", "workflows"), { recursive: true })
      await writeFile(
        join(root, ".github", "workflows", "release.yml"),
        renderGithubActionsTrustedPublishingWorkflow("release.config.json")
      )

      const report = await Effect.runPromise(
        checkCiReleaseConfig(ReleaseDiagnosticsOptions.make({
          configPath,
          workflow: ".github/workflows/release.yml"
        })).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )

      expect(report.checks.some((item) => item.id === "ci:workflow-file")).toBe(true)
      expect(report.checks.filter((item) => item.status === "fail")).toEqual([])
    }))

  test("check-ci accepts the real self-release workflow", async () => {
    const root = process.cwd()
    const report = await Effect.runPromise(
      checkCiReleaseConfig(ReleaseDiagnosticsOptions.make({
        root,
        configPath: "apps/release-ts/release.config.json",
        workflow: ".github/workflows/release.yml"
      })).pipe(
        Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
      )
    )

    expect(report.checks.filter((item) => item.status === "fail")).toEqual([])
    expect(report.checks.find((item) => item.id === "ci:plan-job")?.status).toBe("ok")
    expect(report.checks.find((item) => item.id === "ci:execute-job")?.status).toBe("ok")
    expect(report.checks.find((item) => item.id === "ci:execute-id-token")?.status).toBe("ok")
    expect(report.checks.find((item) => item.id === "ci:execute-contents")?.status).toBe("ok")
    expect(report.checks.find((item) => item.id === "ci:execute-approval")?.status).toBe("ok")
  })

  test("check-ci accepts safely renamed workflow jobs", () =>
    withTempDirectoryPromise("ts-release-cli-check-ci-renamed-jobs-", async (root) => {
      const configPath = join(root, "release.config.json")
      const trustedConfig = minimalConfig.replace(
        "\"tokenEnv\":\"NPM_TOKEN\",",
        "\"trustedPublishing\":{\"provider\":\"github-actions\",\"workflow\":\"release.yml\",\"packageExists\":true},"
      )
      await writeFile(configPath, trustedConfig)
      await mkdir(join(root, ".github", "workflows"), { recursive: true })
      await writeFile(
        join(root, ".github", "workflows", "release.yml"),
        [
          "name: Release",
          "on:",
          "  workflow_dispatch:",
          "jobs:",
          "  review_release:",
          "    runs-on: ubuntu-latest",
          "    steps:",
          "      - uses: mannyc2/ts-release-action@v1",
          "        with:",
          "          command: plan",
          "          config: release.config.json",
          "          format: markdown",
          "      - uses: actions/upload-artifact@v4",
          "        if: always()",
          "  publish_release:",
          "    runs-on: ubuntu-latest",
          "    environment: release",
          "    permissions:",
          "      contents: write",
          "      id-token: write",
          "    steps:",
          "      - uses: mannyc2/ts-release-action@v1",
          "        with:",
          "          command: run",
          "          config: release.config.json",
          "          execute: true",
          "          approve-irreversible: true",
          "      - uses: actions/upload-artifact@v4",
          "        if: always()",
          ""
        ].join("\n")
      )

      const report = await Effect.runPromise(
        checkCiReleaseConfig(ReleaseDiagnosticsOptions.make({
          configPath,
          workflow: ".github/workflows/release.yml"
        })).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )

      expect(report.checks.filter((item) => item.status === "fail")).toEqual([])
    }))

  test("check-ci rejects action execution in the plan job", () =>
    withTempDirectoryPromise("ts-release-cli-check-ci-plan-exec-", async (root) => {
      const configPath = join(root, "release.config.json")
      const trustedConfig = minimalConfig.replace(
        "\"tokenEnv\":\"NPM_TOKEN\",",
        "\"trustedPublishing\":{\"provider\":\"github-actions\",\"workflow\":\"release.yml\",\"packageExists\":true},"
      )
      await writeFile(configPath, trustedConfig)
      await mkdir(join(root, ".github", "workflows"), { recursive: true })
      await writeFile(
        join(root, ".github", "workflows", "release.yml"),
        [
          "name: Release",
          "on:",
          "  workflow_dispatch:",
          "jobs:",
          "  plan:",
          "    runs-on: ubuntu-latest",
          "    steps:",
          "      - uses: mannyc2/ts-release-action@v1",
          "        with:",
          "          command: run",
          "          config: release.config.json",
          "          execute: true",
          "          approve-irreversible: true",
          "  execute:",
          "    runs-on: ubuntu-latest",
          "    environment: release",
          "    permissions:",
          "      contents: write",
          "      id-token: write",
          "    steps:",
          "      - uses: mannyc2/ts-release-action@v1",
          "        with:",
          "          command: run",
          "          config: release.config.json",
          "          execute: true",
          "          approve-irreversible: true",
          "      - uses: actions/upload-artifact@v4",
          "        if: always()",
          ""
        ].join("\n")
      )

      const report = await Effect.runPromise(
        checkCiReleaseConfig(ReleaseDiagnosticsOptions.make({
          configPath,
          workflow: ".github/workflows/release.yml"
        })).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )

      const planSafety = report.checks.find((item) => item.id === "ci:plan-job-no-execute")
      expect(planSafety?.status).toBe("fail")
    }))

  test("check-ci rejects an execute job without approved execution", () =>
    withTempDirectoryPromise("ts-release-cli-check-ci-execute-approval-", async (root) => {
      const configPath = join(root, "release.config.json")
      const trustedConfig = minimalConfig.replace(
        "\"tokenEnv\":\"NPM_TOKEN\",",
        "\"trustedPublishing\":{\"provider\":\"github-actions\",\"workflow\":\"release.yml\",\"packageExists\":true},"
      )
      await writeFile(configPath, trustedConfig)
      await mkdir(join(root, ".github", "workflows"), { recursive: true })
      await writeFile(
        join(root, ".github", "workflows", "release.yml"),
        [
          "name: Release",
          "on:",
          "  workflow_dispatch:",
          "jobs:",
          "  plan:",
          "    runs-on: ubuntu-latest",
          "    steps:",
          "      - uses: mannyc2/ts-release-action@v1",
          "        with:",
          "          command: plan",
          "          config: release.config.json",
          "          format: markdown",
          "      - uses: actions/upload-artifact@v4",
          "        if: always()",
          "  execute:",
          "    runs-on: ubuntu-latest",
          "    environment: release",
          "    permissions:",
          "      contents: write",
          "      id-token: write",
          "    steps:",
          "      - uses: mannyc2/ts-release-action@v1",
          "        with:",
          "          command: run",
          "          config: release.config.json",
          "          execute: true",
          "      - uses: actions/upload-artifact@v4",
          "        if: always()",
          ""
        ].join("\n")
      )

      const report = await Effect.runPromise(
        checkCiReleaseConfig(ReleaseDiagnosticsOptions.make({
          configPath,
          workflow: ".github/workflows/release.yml"
        })).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )

      expect(report.checks.find((item) => item.id === "ci:execute-approval")?.status).toBe("fail")
    }))

  test("doctor command composes static diagnostics", () =>
    withTempDirectoryPromise("ts-release-cli-doctor-", async (root) => {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, minimalConfig)

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "doctor",
          "--config",
          configPath,
          "--format",
          "json"
        ]).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )
    }))

  test("plans release configs programmatically", () =>
    withTempDirectoryPromise("ts-release-plan-root-", async (root) => {
      await writeFile(join(root, "release.config.json"), minimalConfig)

      const plan = await Effect.runPromise(
        planReleaseConfig(PlanReleaseConfigOptions.make({ root })).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )

      expect(plan.identity.name).toBe("release")
      expect(plan.source.root).toBe(root)
      expect(plan.source.configPath).toBe("release.config.json")
    }))

  test("supports named Bun workflow runtime layer composition", () =>
    withTempDirectoryPromise("ts-release-workflow-runtime-", async (root) => {
      await writeFile(join(root, "release.config.json"), minimalConfig)

      const plan = await Effect.runPromise(
        planReleaseConfig(PlanReleaseConfigOptions.make({ root, configPath: "release.config.json" })).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )

      expect(plan.identity.name).toBe("release")
    }))

  layer(approvalCliLayer)((it) => {
    it.effect("execute command fails without execute approval", () =>
      withTempDirectory("ts-release-cli-execute-", (root) =>
        Effect.gen(function*() {
          const configPath = join(root, "release.config.json")
          yield* Effect.promise(() => writeFile(configPath, minimalConfig))
          const error = yield* Command.runWith(cli, { version: "0.0.0" })([
            "execute",
            "--config",
            configPath
          ]).pipe(Effect.flip)

          expectTaggedError(error, "ExecutionApprovalError")
        })
      ))

    it.effect("run command fails without execute approval", () =>
      withTempDirectory("ts-release-cli-run-approval-", (root) =>
        Effect.gen(function*() {
          const configPath = join(root, "release.config.json")
          yield* Effect.promise(() => writeFile(configPath, minimalConfig))
          const error = yield* Command.runWith(cli, { version: "0.0.0" })([
            "run",
            "--config",
            configPath
          ]).pipe(Effect.flip)

          expectTaggedError(error, "ExecutionApprovalError")
        })
      ))
  })

  test("eligibility command checks remote state through the config workflow", () =>
    withTempDirectoryPromise("ts-release-cli-eligibility-", async (root) => {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, minimalConfig.replace("\"tag\":\"v0.1.0\"", "\"tag\":\"release-0.1.0\""))
      await writeFile(join(root, "package.json"), JSON.stringify({
        name: "release",
        version: "0.1.0"
      }))
      const npmView = CommandSpec.make({
        executable: "npm",
        args: ["view", "release@0.1.0", "version", "--registry", "https://registry.npmjs.org"],
        requiredEnv: [],
        redactedEnv: []
      })
      const ghReleaseView = CommandSpec.make({
        executable: "gh",
        args: [
          "release",
          "view",
          "release-0.1.0",
          "--repo",
          "owner/repo",
          "--json",
          "isDraft,tagName,publishedAt"
        ],
        requiredEnv: ["GH_TOKEN"],
        redactedEnv: ["GH_TOKEN"]
      })
      const layer = Layer.mergeAll(
        makeObservableCommandRunnerLayer({
          env: new Map([
            ["NPM_TOKEN", "npm_secret"],
            ["GH_TOKEN", "gh_secret"]
          ]),
          commands: new Map([
            [commandKey(npmView), {
              exitCode: 1,
              stdout: "",
              stderr: "E404 Not Found"
            }],
            [commandKey(ghReleaseView), {
              exitCode: 1,
              stdout: "",
              stderr: "not found"
            }]
          ])
        }),
        LiveTargetRegistryLayer,
        BunServices.layer
      )

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "eligibility",
          "--config",
          configPath
        ]).pipe(Effect.provide(layer))
      )
    }))

  test("check-intent command fails when required intent files are missing", () =>
    withTempDirectoryPromise("ts-release-cli-check-intent-", async (root) => {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, JSON.stringify({
        identity: {
          name: "@scope/pkg",
          version: "1.2.3",
          commit: "abc123",
          tag: "v1.2.3"
        },
        releaseDecision: {
          _tag: "IntentFilesReleaseDecision",
          directory: ".release/intents",
          packagePath: "package.json",
          tagTemplate: "v{version}",
          requireIntent: true
        },
        artifacts: [],
        targets: [],
        strict: true,
        evidenceDirectory: ".release/evidence"
      }))
      await writeFile(join(root, "package.json"), JSON.stringify({
        name: "@scope/pkg",
        version: "1.2.3"
      }))

      const exit = await Effect.runPromiseExit(
        Command.runWith(cli, { version: "0.0.0" })([
          "check-intent",
          "--config",
          configPath
        ]).pipe(Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root })))
      )

      expectExitFailureTag(exit, "ReleaseEligibilityCheckError")
    }))

  test("run command writes one workflow evidence file", () =>
    withTempDirectoryPromise("ts-release-run-root-", async (root) => {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, noOpConfig)

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "run",
          "--config",
          configPath,
          "--execute",
          "--approve-irreversible"
        ]).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )

      const output = await readFile(join(root, ".release", "evidence", "evidence.json"), "utf8")
      expect(output).toContain("\"releaseName\": \"release\"")
      expect(output).toContain("\"records\": []")
    }))

  test("reconcile command publishes a matching GitHub draft with execute approval", () =>
    withTempDirectoryPromise("ts-release-reconcile-root-", async (root) => {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, reconcileConfig)
      await mkdir(join(root, "dist"), { recursive: true })
      await writeFile(join(root, "dist", "release.tgz"), "fake archive text")
      const layer = Layer.mergeAll(
        makeObservableCommandRunnerLayer({
          env: new Map([
            ["NPM_TOKEN", "npm_secret"],
            ["GH_TOKEN", "gh_secret"]
          ]),
          commands: new Map()
        }),
        makeTestReleaseHttpLayer({
          responses: new Map([
            ["GET\u0000https://api.github.com/repos/owner/repo/releases/tags/v0.1.0", {
              status: 200,
              json: {
                tag_name: "v0.1.0",
                name: "release 0.1.0",
                draft: true,
                prerelease: false,
                assets: [{ name: "release.tgz" }]
              }
            }]
          ])
        }),
        LiveTargetRegistryLayer,
        BunServices.layer
      )

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "reconcile",
          "--config",
          configPath,
          "--execute"
        ]).pipe(Effect.provide(layer))
      )

      const evidence = await readFile(join(root, ".release", "evidence", "reconciliation.json"), "utf8")
      expect(evidence).toContain("github:gh-release-publish-draft:command")
      expect(evidence).toContain("--draft=false")
      expect(evidence).not.toContain("npm:npm-publish")
    }))

  test("run command writes partial workflow evidence on validation failure", () =>
    withTempDirectoryPromise("ts-release-cli-partial-evidence-", async (root) => {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, partialWorkflowConfig)
      await mkdir(join(root, "artifacts"), { recursive: true })
      await writeFile(join(root, "artifacts", "release-0.1.0.tgz"), "fake archive text")
      const npmVersionCommand = CommandSpec.make({
        executable: "npm",
        args: ["--version"],
        requiredEnv: [],
        redactedEnv: []
      })
      const layer = Layer.mergeAll(
        makeObservableCommandRunnerLayer({
          env: new Map([
            ["NPM_TOKEN", "npm_secret"],
            ["GH_TOKEN", "gh_secret"]
          ]),
          commands: new Map([
            [commandKey(npmVersionCommand), {
              exitCode: 1,
              stdout: "",
              stderr: "npm unavailable"
            }]
          ])
        }),
        LiveTargetRegistryLayer,
        BunServices.layer
      )

      const exit = await Effect.runPromiseExit(
        Command.runWith(cli, { version: "0.0.0" })([
          "run",
          "--config",
          configPath,
          "--execute",
          "--approve-irreversible"
        ]).pipe(Effect.provide(layer))
      )

      expectExitFailureTag(exit, "OperationFailedError")
      const evidence = await readFile(join(root, ".release", "evidence", "evidence.json"), "utf8")
      expect(evidence).toContain("homebrew:homebrew-render-formula:execution")
      expect(evidence).toContain("npm:npm-version:command")
      expect(evidence).toContain("\"phase\": \"render\"")
      expect(evidence).toContain("\"phase\": \"validation\"")
    }))

  test("render command succeeds without approval when there is nothing to render", () =>
    withTempDirectoryPromise("ts-release-cli-render-", async (root) => {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, minimalConfig)
      const layer = makeBunReleaseWorkflowRuntimeLayer({ root })

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "render",
          "--config",
          configPath
        ]).pipe(Effect.provide(layer))
      )
    }))
})
