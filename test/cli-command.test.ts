import { describe, expect, layer, test } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as Scope from "effect/Scope"
import * as Command from "effect/unstable/cli/Command"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"
import { parseReleaseIntent } from "../src/config/load.js"
import {
  planReleaseInit,
  ReleaseInitOptions
} from "../src/workflows/init.js"
import {
  doctorRelease,
  planRelease,
  renderReleasePlan
} from "../src/workflows/release.js"
import { cli } from "../apps/release-ts/src/cli/command.js"
import { CommandSpec } from "../src/domain/operation.js"
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
      "build",
      "doctor",
      "init",
      "plan",
      "release",
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

  test("build command stages recipe outputs and writes text output", () =>
    withTempDirectoryPromise("ts-release-cli-build-", async (root) => {
      const configPath = join(root, "release.config.json")
      const out = join(root, "stage.txt")
      await writeFile(configPath, JSON.stringify({
        project: {
          name: "release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
        build: {
          bun: {
            id: "release-cli",
            entry: "src/cli.ts",
            outputs: [
              {
                id: "cli-linux-x64",
                target: "bun-linux-x64-baseline",
                path: "dist/release-{version}-linux-x64",
                consumers: ["github"]
              }
            ]
          }
        },
        publish: {}
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
          "build",
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

  test("build command succeeds with no recipes", () =>
    withTempDirectoryPromise("ts-release-cli-build-empty-", async (root) => {
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
          "build",
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

  test("build command reports build failures", () =>
    withTempDirectoryPromise("ts-release-cli-build-failure-", async (root) => {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, JSON.stringify({
        project: {
          name: "release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
        build: {
          bun: {
            id: "release-cli",
            entry: "src/cli.ts",
            outputs: [
              {
                id: "cli-linux-x64",
                target: "bun-linux-x64-baseline",
                path: "dist/release-{version}-linux-x64",
                consumers: ["github"]
              }
            ]
          }
        },
        publish: {}
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
          "build",
          "--config",
          configPath
        ]).pipe(Effect.provide(layer))
      )

      expectExitFailureTag(exit, "ArtifactRecipeStageError")
    }))

  test("root cli script preserves caller-relative config paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-cli-relative-"))
    try {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, noOpConfig)
      const subprocess = Bun.spawn([
        "bun",
        "run",
        "cli",
        "plan",
        "--config",
        relative(process.cwd(), configPath),
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

      expect(await stdout).toContain("release@")
      expect(await stderr).not.toContain("ConfigReadError")
      expect(exitCode).toBe(0)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("config-backed commands accept an explicit release root", () =>
    withTempDirectoryPromise("ts-release-cli-explicit-root-", async (root) => {
      await mkdir(join(root, "app"), { recursive: true })
      await writeFile(join(root, "package.json"), JSON.stringify({
        name: "@scope/root-package",
        version: "1.2.3"
      }))
      await writeFile(join(root, "app", "release.config.json"), JSON.stringify({
        project: {
          packagePath: "package.json",
          commit: "abc123",
          tagTemplate: "v{version}"
        },
        publish: {},
        strict: true,
        evidence: ".release/evidence"
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
      const summary = await readFile(out, "utf8")
      expect(summary).toContain("@scope/root-package@1.2.3")
    }))

  test("renders release configs through the explicit config workflow", () =>
    withTempDirectoryPromise("ts-release-cli-root-", async (root) => {
      await writeFile(join(root, "release.config.json"), minimalConfig)

      const plan = await Effect.runPromise(
        planRelease({
          root,
          configPath: "release.config.json",
          format: "text"
        }).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )
      const output = renderReleasePlan(plan, "text")

      expect(output).toContain("release@0.1.0")
    }))

  test("renders summary and markdown plan formats through the workflow", () =>
    withTempDirectoryPromise("ts-release-cli-plan-formats-", async (root) => {
      await writeFile(join(root, "release.config.json"), minimalConfig)

      const plan = await Effect.runPromise(
        planRelease({
          root,
          configPath: "release.config.json"
        }).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )
      const summary = renderReleasePlan(plan, "summary")
      const markdown = renderReleasePlan(plan, "markdown")

      expect(summary).toContain("approval-required operations")
      expect(markdown).toContain("### npm:npm-publish")
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
      expect(intent.build?.npmPackage).toBeDefined()
      expect(intent.publish.npm).toBeDefined()

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
      "npm-only" | "npm-github" | "bun-cli-github" | "portable-cli" | "multi-target-homebrew" | "multi-target-scoop"
    > = [
      "npm-only",
      "npm-github",
      "bun-cli-github",
      "portable-cli",
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
            bucket: "owner/scoop-bucket",
            binaryName: "pkg",
            pypiPackage: "pkg",
            pypiModule: "pkg",
            consoleScript: "pkg"
          })).pipe(Effect.provide(BunServices.layer))
        )
        const configFile = plan.files.find((file) => file.path === "release.config.json")
        expect(configFile).toBeDefined()
        if (configFile !== undefined) {
          const intent = await Effect.runPromise(parseReleaseIntent(configFile.contents))
          expect(intent.project.name).toBe("@scope/pkg")
          expect(configFile.contents).toContain("\"$schema\"")
          if (template === "multi-target-homebrew") {
            expect(configFile.contents).toContain("owner/homebrew-tap")
          }
          if (template === "multi-target-scoop") {
            expect(configFile.contents).toContain("owner/scoop-bucket")
          }
          if (template === "npm-github") {
            expect(intent.build?.npmPackage).toBeDefined()
            expect(intent.publish.github).toBeDefined()
          }
          if (template === "bun-cli-github") {
            const recipe = intent.build?.bun
            expect(recipe?.id).toBe("cli")
            if (recipe !== undefined) {
              expect(recipe.outputs?.map((output) => output.target).sort()).toEqual([
                "bun-darwin-arm64",
                "bun-darwin-x64",
                "bun-linux-arm64",
                "bun-linux-x64-baseline",
                "bun-windows-x64-baseline"
              ])
            }
          }
          if (template === "portable-cli") {
            const recipe = intent.build?.bun
            expect(recipe?.entry).toBe("src/cli.ts")
            expect(intent.publish.homebrew).toBeDefined()
            expect(intent.publish.scoop).toBeDefined()
            expect(intent.publish.pypi).toBeDefined()
            if (recipe !== undefined) {
              expect(recipe.outputs?.find((output) => output.id === "cli-darwin-arm64")?.consumers).toEqual([
                "github",
                "homebrew"
              ])
              expect(recipe.outputs?.find((output) => output.id === "cli-windows-x64")?.consumers).toEqual([
                "github",
                "scoop"
              ])
              expect(recipe.outputs?.every((output) => output.variant?.binaryName === "pkg")).toBe(true)
            }
            const wheels = intent.build?.pypiWheel
            expect(Array.isArray(wheels) ? wheels.length : 0).toBe(5)
          }
        }
      })
    }
  })

  test("init renders the portable CLI template with explicit package-manager fields", () =>
    withTempDirectoryPromise("ts-release-cli-init-portable-", async (root) => {
      const configPath = join(root, "release.config.json")
      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "init",
          "--template",
          "portable-cli",
          "--package",
          "@scope/rocket",
          "--repo",
          "owner/rocket",
          "--tap",
          "owner/homebrew-rocket",
          "--bucket",
          "owner/scoop-rocket",
          "--binary-name",
          "rocket",
          "--entrypoint",
          "src/main.ts",
          "--pypi-package",
          "rocket-cli",
          "--pypi-module",
          "rocket_cli",
          "--console-script",
          "rocket",
          "--config",
          configPath,
          "--write"
        ]).pipe(Effect.provide(BunServices.layer))
      )

      const config = await readFile(configPath, "utf8")
      const intent = await Effect.runPromise(parseReleaseIntent(config))
      const recipe = intent.build?.bun
      const wheels = intent.build?.pypiWheel

      expect(recipe?.entry).toBe("src/main.ts")
      expect(recipe?.outputs?.find((output) => output.id === "cli-darwin-x64")?.consumers).toEqual([
        "github",
        "homebrew"
      ])
      expect(intent.publish.homebrew).toBeDefined()
      expect(intent.publish.scoop).toBeDefined()
      expect(intent.publish.pypi).toBeDefined()
      expect(config).toContain("owner/homebrew-rocket")
      expect(config).toContain("owner/scoop-rocket")
      expect(config).toContain("\"packageName\": \"rocket-cli\"")
      expect(config).toContain("\"moduleName\": \"rocket_cli\"")
      expect(Array.isArray(wheels) ? wheels.length : 0).toBe(5)
    }))

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
      expect(workflow).toContain("command: release")
      expect(workflow).toContain("execute: true")
      expect(workflow).toContain("approve-publish: true")
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

  test("diagnostics report env names without secret values", () =>
    withTempDirectoryPromise("ts-release-cli-diagnostics-auth-", async (root) => {
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
        doctorRelease({
          configPath
        }).pipe(Effect.provide(layer))
      )
      const serialized = JSON.stringify(report)
      expect(serialized).toContain("NPM_TOKEN")
      expect(serialized).toContain("GH_TOKEN")
      expect(serialized).not.toContain("npm_secret")
      expect(report.checks.some((item) => item.status === "fail" && item.message.includes("GH_TOKEN"))).toBe(true)
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
        planRelease({ root }).pipe(
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
        planRelease({ root, configPath: "release.config.json" }).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )

      expect(plan.identity.name).toBe("release")
    }))

  layer(approvalCliLayer)((it) => {
    it.effect("release command fails without execute approval", () =>
      withTempDirectory("ts-release-cli-release-approval-", (root) =>
        Effect.gen(function*() {
          const configPath = join(root, "release.config.json")
          yield* Effect.promise(() => writeFile(configPath, minimalConfig))
          const error = yield* Command.runWith(cli, { version: "0.0.0" })([
            "release",
            "--config",
            configPath
          ]).pipe(Effect.flip)

          expectTaggedError(error, "ExecutionApprovalError")
        })
      ))
  })

  test("release command writes one workflow evidence file", () =>
    withTempDirectoryPromise("ts-release-release-root-", async (root) => {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, noOpConfig)

      await Effect.runPromise(
        Command.runWith(cli, { version: "0.0.0" })([
          "release",
          "--config",
          configPath,
          "--execute",
          "--approve-publish"
        ]).pipe(
          Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
        )
      )

      const output = await readFile(join(root, ".release", "evidence", "evidence.json"), "utf8")
      expect(output).toContain("\"releaseName\": \"release\"")
      expect(output).toContain("\"records\": []")
    }))

  test("release command writes partial workflow evidence on validation failure", () =>
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
          "release",
          "--config",
          configPath,
          "--execute",
          "--approve-publish"
        ]).pipe(Effect.provide(layer))
      )

      expectExitFailureTag(exit, "OperationFailedError")
      const evidence = await readFile(join(root, ".release", "evidence", "evidence.json"), "utf8")
      expect(evidence).toContain("homebrew:homebrew-render-formula:execution")
      expect(evidence).toContain("npm:npm-version:command")
      expect(evidence).toContain("\"phase\": \"render\"")
      expect(evidence).toContain("\"phase\": \"validation\"")
    }))
})
