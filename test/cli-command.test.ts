import { describe, expect, test } from "@effect/bun-test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Command from "effect/unstable/cli/Command"
import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import { join, relative } from "node:path"
import { parseReleaseIntent } from "../src/config/load.js"
import {
  planReleaseInit,
  ReleaseInitOptions
} from "../apps/release-ts/src/cli/init.js"
import { doctorRelease } from "../src/workflows/doctor.js"
import { planRelease, renderReleasePlan } from "../src/engine/engine.js"
import { cli } from "../apps/release-ts/src/cli/command.js"
import { CommandSpec } from "../src/pipeline/operation.js"
import { BunExecutableBuild, makeArtifactStagerLayer, makeBunReleaseWorkflowRuntimeLayer } from "../apps/release-ts/src/runtime.js"
import { commandKey } from "./host-fakes.js"
import {
  expectExitFailureTag,
  makeObservableCommandRunnerLayer,
  minimalConfig,
  noOpConfig,
  partialWorkflowConfig,
  runBunProcess,
  withTempDirectoryPromise,
} from "./helpers.js"
const runBun = (args: ReadonlyArray<string>) => runBunProcess(args, { cwd: process.cwd() })
const cliProgram = Command.runWith(cli, { version: "0.0.0" })
const initEffect = (args: ReadonlyArray<string>) =>
  cliProgram(["init", ...args]).pipe(Effect.provide(BunServices.layer))
const runInit = (args: ReadonlyArray<string>) => Effect.runPromise(initEffect(args))
const workflowEffect = (root: string, args: ReadonlyArray<string>) =>
  cliProgram([...args]).pipe(Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root })))
const runWorkflow = (root: string, args: ReadonlyArray<string>) =>
  Effect.runPromise(workflowEffect(root, args))
const planWithRuntime = (root: string, config?: string) => Effect.runPromise(
  planRelease({ workspace: root, ...(config === undefined ? {} : { config }) }).pipe(
    Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
  )
)
const npmGitHubInitArgs = (config: string, extra: ReadonlyArray<string> = []) => [
  "--template", "npm-github",
  "--package", "@scope/pkg",
  "--repo", "owner/repo",
  "--config", config,
  ...extra
]
const buildConfig = JSON.stringify({
  project: { name: "release", version: "0.1.0", commit: "abc123", tag: "v0.1.0" },
  builds: [{
    builder: "bun",
    id: "release-cli",
    entry: "src/cli.ts",
    targets: ["linux-x64"],
    output: "dist/release-{version}-{targetTriple}"
  }],
  publish: {}
})
// The remaining direct Effect.provide calls in this file exercise CLI entrypoints
// around one-off temp-directory setup.
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
  test("build command stages build outputs and writes text output", () =>
    withTempDirectoryPromise("ts-release-cli-build-", async (root) => {
      const configPath = join(root, "release.config.json")
      const out = join(root, "stage.txt")
      await writeFile(configPath, buildConfig)
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
        makeArtifactStagerLayer(build).pipe(Layer.provideMerge(BunServices.layer)),
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
      expect(contents).toContain("staged artifact operations: 1")
      expect(contents).toContain("cli-linux-x64 dist/release-0.1.0-linux-x64")
    }))
  test("build command succeeds with no staged operations", () =>
    withTempDirectoryPromise("ts-release-cli-build-empty-", async (root) => {
      const configPath = join(root, "release.config.json")
      const out = join(root, "stage.json")
      await writeFile(configPath, noOpConfig)
      const layer = Layer.mergeAll(
        makeObservableCommandRunnerLayer({
          env: new Map(),
          commands: new Map()
        }),
        makeArtifactStagerLayer(async () => ({ success: true, logs: [] })).pipe(
          Layer.provideMerge(BunServices.layer)
        ),
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
      expect(JSON.stringify(parsed)).toContain("\"operations\":[]")
    }))
  test("build command reports build failures", () =>
    withTempDirectoryPromise("ts-release-cli-build-failure-", async (root) => {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, buildConfig)
      const layer = Layer.mergeAll(
        makeObservableCommandRunnerLayer({
          env: new Map(),
          commands: new Map()
        }),
        makeArtifactStagerLayer(async () => ({
          success: false,
          logs: ["compile failed"]
        })).pipe(Layer.provideMerge(BunServices.layer)),
        BunServices.layer
      )
      const exit = await Effect.runPromiseExit(
        Command.runWith(cli, { version: "0.0.0" })([
          "build",
          "--config",
          configPath
        ]).pipe(Effect.provide(layer))
      )
      expectExitFailureTag(exit, "ArtifactStageError")
    }))
  test("internal catalog render script writes planned files without publishing", () =>
    withTempDirectoryPromise("ts-release-catalog-render-", async (root) => {
      const configPath = join(root, "release.config.json")
      const archivePath = join(root, "artifacts", "release-0.1.0.tgz")
      const formulaPath = join(root, ".release", "generated", "release.rb")
      await mkdir(join(root, "artifacts"), { recursive: true })
      await writeFile(archivePath, "homebrew archive")
      await writeFile(configPath, JSON.stringify({
        project: {
          name: "release",
          version: "0.1.0",
          commit: "abc123",
          tag: "v0.1.0"
        },
        artifacts: [
          {
            id: "archive",
            path: "artifacts/release-0.1.0.tgz",
            format: "tarball"
          }
        ],
        publish: {
          homebrew: {
            repository: "owner/homebrew-tap",
            formulaName: "release",
            formulaPath: ".release/generated/release.rb",
            artifactIds: ["archive"]
          }
        },
        evidence: ".release/evidence"
      }))
      const result = await runBun([
        "bun",
        "run",
        "apps/release-ts/scripts/render-catalogs.ts",
        "--config",
        configPath
      ])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("\"operationId\": \"homebrew:homebrew-render-formula\"")
      expect(result.stderr).toBe("")
      const contents = await readFile(formulaPath, "utf8")
      expect(contents).toContain("class Release < Formula")
      expect(contents).toContain("sha256")
    }))
  test("root cli script preserves caller-relative config paths", async () => {
    await withTempDirectoryPromise("ts-release-cli-relative-", async (root) => {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, noOpConfig)
      const result = await runBun([
        "bun",
        "run",
        "cli",
        "plan",
        "--config",
        relative(process.cwd(), configPath),
        "--format",
        "text"
      ])
      expect(result.stdout).toContain("release@")
      expect(result.stderr).not.toContain("ConfigError")
      expect(result.exitCode).toBe(0)
    })
  })
  test("plan command exposes snapshot mode", async () => {
    await withTempDirectoryPromise("ts-release-cli-snapshot-", async (root) => {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, noOpConfig)
      const result = await runBun([
        "bun",
        "run",
        "cli",
        "plan",
        "--config",
        configPath,
        "--snapshot",
        "--format",
        "text"
      ])
      expect(result.stdout).toContain("0.1.0-SNAPSHOT-abc123")
      expect(result.stderr).not.toContain("ConfigError")
      expect(result.exitCode).toBe(0)
    })
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
        evidence: ".release/evidence"
      }))
      const out = join(root, "plan-summary.txt")
      await runWorkflow(root, [
          "plan",
          "--root",
          root,
          "--config",
          "app/release.config.json",
          "--format",
          "summary",
          "--out",
          out
      ])
      const summary = await readFile(out, "utf8")
      expect(summary).toContain("@scope/root-package@1.2.3")
    }))
  test("renders release configs through the explicit config workflow", () =>
    withTempDirectoryPromise("ts-release-cli-root-", async (root) => {
      await writeFile(join(root, "release.config.json"), minimalConfig)
      const plan = await planWithRuntime(root, "release.config.json")
      const output = renderReleasePlan(plan, "text")
      expect(output).toContain("release@0.1.0")
    }))
  test("renders summary and markdown plan formats through the workflow", () =>
    withTempDirectoryPromise("ts-release-cli-plan-formats-", async (root) => {
      await writeFile(join(root, "release.config.json"), minimalConfig)
      const plan = await planWithRuntime(root, "release.config.json")
      const summary = renderReleasePlan(plan, "summary")
      const markdown = renderReleasePlan(plan, "markdown")
      expect(summary).toContain("approval-required operations")
      expect(markdown).toContain("### npm:npm-publish")
    }))
  test("init previews without writing and writes only when approved", () =>
    withTempDirectoryPromise("ts-release-cli-init-", async (root) => {
      const configPath = join(root, "release.config.json")
      await runInit(npmGitHubInitArgs(configPath))
      await expect(readFile(configPath, "utf8")).rejects.toThrow()
      await runInit(npmGitHubInitArgs(configPath, ["--write"]))
      const config = await readFile(configPath, "utf8")
      expect(config).toContain("\"$schema\"")
      expect(config).toContain("\"repository\": \"owner/repo\"")
      const intent = await Effect.runPromise(parseReleaseIntent(config))
      expect(intent.npmPackage).toBeDefined()
      expect(intent.publish.npm).toBeDefined()
      const blocked = await Effect.runPromiseExit(
        initEffect([
          "--config",
          configPath,
          "--write"
        ])
      )
      expectExitFailureTag(blocked, "ReleaseInitWriteError")
    }))
  test("init with all optional flags omitted writes the default npm-only config", () =>
    withTempDirectoryPromise("ts-release-cli-init-defaults-", async (root) => {
      const configPath = join(root, "release.config.json")
      await runInit([
          "--config",
          configPath,
          "--write"
      ])
      const config = await readFile(configPath, "utf8")
      const expected = await Effect.runPromise(
        planReleaseInit({}).pipe(Effect.provide(BunServices.layer))
      )
      expect(config).toBe(expected.files[0]?.contents ?? "")
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
            expect(intent.npmPackage).toBeDefined()
            expect(intent.publish.github).toBeDefined()
          }
          if (template === "bun-cli-github") {
            const build = intent.builds?.[0]
            expect(build?.builder).toBe("bun")
            if (build?.builder === "bun") {
              expect(build.id).toBe("cli")
              expect([...(build.targets ?? [])].sort()).toEqual([
                "darwin-arm64",
                "darwin-x64",
                "linux-arm64",
                "linux-x64",
                "windows-x64"
              ])
            }
          }
          if (template === "portable-cli") {
            const build = intent.builds?.[0]
            expect(build?.builder).toBe("bun")
            if (build?.builder === "bun") {
              expect(build.entry).toBe("src/cli.ts")
            }
            expect(intent.publish.homebrew).toBeDefined()
            expect(intent.publish.scoop).toBeDefined()
            expect(intent.publish.pypi).toBeDefined()
            if (build?.builder === "bun") {
              expect(build.targets).toContain("darwin-arm64")
              expect(build.targets).toContain("windows-x64")
              expect(build.binaryName).toBe("pkg")
            }
            const wheels = intent.pypiWheel
            expect(Array.isArray(wheels) ? wheels.length : 0).toBe(5)
          }
        }
      })
    }
  })
  test("init renders the portable CLI template with explicit package-manager fields", () =>
    withTempDirectoryPromise("ts-release-cli-init-portable-", async (root) => {
      const configPath = join(root, "release.config.json")
      await runInit([
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
      ])
      const config = await readFile(configPath, "utf8")
      const intent = await Effect.runPromise(parseReleaseIntent(config))
      const build = intent.builds?.[0]
      const wheels = intent.pypiWheel
      expect(build?.builder).toBe("bun")
      if (build?.builder === "bun") {
        expect(build.entry).toBe("src/main.ts")
        expect(build.targets).toContain("darwin-x64")
        expect(build.binaryName).toBe("rocket")
      }
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
      await runInit(npmGitHubInitArgs(configPath, ["--github-actions", "--write"]))
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
      await runInit(npmGitHubInitArgs(configPath, [
        "--github-actions", "--package-manager", "npm", "--write"
      ]))
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
      await runInit(npmGitHubInitArgs(configPath, [
        "--github-actions", "--package-manager", "npm",
        "--install-command", "npm install --legacy-peer-deps",
        "--build-command", "npm run compile", "--write"
      ]))
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
        initEffect([
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
        ])
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
      await runWorkflow(root, [
          "doctor",
          "--config",
          configPath,
          "--format",
          "json"
      ])
    }))
  test("plans release configs programmatically", () =>
    withTempDirectoryPromise("ts-release-plan-root-", async (root) => {
      await writeFile(join(root, "release.config.json"), minimalConfig)
      const plan = await planWithRuntime(root)
      expect(plan.identity.name).toBe("release")
      expect(plan.source.root).toBe(root)
      expect(plan.source.configPath).toBe("release.config.json")
    }))
  test("supports named Bun workflow runtime layer composition", () =>
    withTempDirectoryPromise("ts-release-workflow-runtime-", async (root) => {
      await writeFile(join(root, "release.config.json"), minimalConfig)
      const plan = await planWithRuntime(root, "release.config.json")
      expect(plan.identity.name).toBe("release")
    }))
  test("release command plans without execute approval", () =>
    withTempDirectoryPromise("ts-release-cli-release-plan-only-", async (root) => {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, minimalConfig)
      await runWorkflow(root, [
          "release",
          "--config",
          configPath
      ])
      await expect(access(join(root, ".release", "evidence", "evidence.json"))).rejects.toThrow()
    }))
  test("release command writes one workflow evidence file", () =>
    withTempDirectoryPromise("ts-release-release-root-", async (root) => {
      const configPath = join(root, "release.config.json")
      await writeFile(configPath, noOpConfig)
      await runWorkflow(root, [
          "release",
          "--config",
          configPath,
          "--execute",
          "--approve-publish"
      ])
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
      expect(evidence).toContain("\"operationId\": \"homebrew:homebrew-render-formula\"")
      expect(evidence).toContain("\"operationId\": \"npm:npm-version\"")
      expect(evidence).toContain("\"phase\": \"catalog\"")
      expect(evidence).toContain("\"phase\": \"publish\"")
    }))
})
