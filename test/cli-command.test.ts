import { describe, expect, test } from "bun:test"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Command from "effect/unstable/cli/Command"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { cli } from "../src/cli/command.js"
import {
  PlanReleaseConfigOptions,
  planReleaseConfig,
  ReleaseCliOptions,
  runReleaseCli
} from "../src/cli/programmatic.js"
import { CommandSpec } from "../src/domain/operation.js"
import { CommandResult, FileInfo, HostError, ReleaseHostTest } from "../src/host/host.js"
import { commandKey, makeTestReleaseHostLayer } from "../src/host/test.js"
import { LiveTargetRegistryLayer } from "../src/targets/live.js"
import { minimalConfig } from "./helpers.js"

const noOpConfig = JSON.stringify({
  identity: {
    name: "release",
    version: "0.1.0",
    commit: "abc123",
    tag: "v0.1.0"
  },
  artifacts: [],
  targets: [],
  strict: true,
  evidenceDirectory: ".release/evidence"
})

const partialWorkflowConfig = JSON.stringify({
  identity: {
    name: "release",
    version: "0.1.0",
    commit: "abc123",
    tag: "v0.1.0"
  },
  artifacts: [
    {
      id: "package",
      path: ".",
      format: "directory",
      consumers: ["npm"]
    },
    {
      id: "archive",
      path: "artifacts/release-0.1.0.tgz",
      format: "tarball",
      consumers: ["homebrew"]
    }
  ],
  targets: [
    {
      _tag: "HomebrewTapTarget",
      id: "homebrew",
      repository: "owner/homebrew-tap",
      formulaName: "release",
      formulaPath: ".release/generated/release.rb",
      artifactId: "archive",
      dryRunSupport: "simulated",
      mutability: "mutable-index",
      recovery: "manual"
    },
    {
      _tag: "NpmRegistryTarget",
      id: "npm",
      registry: "https://registry.npmjs.org",
      packagePath: ".",
      tokenEnv: "NPM_TOKEN",
      dryRunSupport: "native",
      mutability: "immutable",
      recovery: "publish-new-version"
    }
  ],
  strict: true,
  evidenceDirectory: ".release/evidence"
})

interface CliCommandResponse {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

const checksumPrefix = (algorithm: "sha256" | "sha512"): string =>
  algorithm === "sha256" ? "sha256" : "sha512"

const makeObservableReleaseHostLayer = (options: {
  readonly files: Map<string, string>
  readonly directories: ReadonlySet<string>
  readonly env: ReadonlyMap<string, string>
  readonly commands: ReadonlyMap<string, CliCommandResponse>
}) => {
  const timestamps = ["2026-06-17T00:00:00.000Z", "2026-06-17T00:00:00.001Z"]
  let timestampIndex = 0
  const nextTimestamp = (): string => {
    const value = timestamps[timestampIndex] ?? timestamps[timestamps.length - 1] ?? "2026-06-17T00:00:00.000Z"
    timestampIndex += 1
    return value
  }

  return ReleaseHostTest({
    readFileString: (path) =>
      Effect.sync(() => options.files.get(path)).pipe(
        Effect.flatMap((contents) =>
          contents === undefined
            ? Effect.fail(HostError.make({ operation: "readFileString", path, reason: "File not found" }))
            : Effect.succeed(contents)
        )
      ),

    writeFileString: (path, contents) =>
      Effect.sync(() => {
        options.files.set(path, contents)
      }),

    stat: (path) =>
      Effect.sync(() => {
        const contents = options.files.get(path)
        if (contents !== undefined) {
          return FileInfo.make({ path, sizeBytes: contents.length, kind: "file" })
        }
        if (options.directories.has(path)) {
          return FileInfo.make({ path, sizeBytes: 0, kind: "directory" })
        }
        return undefined
      }).pipe(
        Effect.flatMap((info) =>
          info === undefined
            ? Effect.fail(HostError.make({ operation: "stat", path, reason: "File not found" }))
            : Effect.succeed(info)
        )
      ),

    hashFile: (path, algorithm) =>
      Effect.sync(() => options.files.get(path)).pipe(
        Effect.flatMap((contents) =>
          options.directories.has(path)
            ? Effect.fail(HostError.make({ operation: "hashFile", path, reason: "Only file artifacts can be hashed" }))
            : contents === undefined
            ? Effect.fail(HostError.make({ operation: "hashFile", path, reason: "File not found" }))
            : Effect.succeed(`${checksumPrefix(algorithm)}:${contents.length}:${path}`)
        )
      ),

    readEnv: (name) => Effect.sync(() => options.env.get(name)),

    runCommand: (command) =>
      Effect.gen(function*() {
        const missing: Array<string> = []
        for (const name of command.requiredEnv) {
          if (!options.env.has(name)) {
            missing.push(name)
          }
        }
        if (missing.length > 0) {
          return yield* Effect.fail(
            HostError.make({
              operation: "runCommand",
              reason: `Missing required environment variables: ${missing.join(", ")}`
            })
          )
        }
        const startedAt = nextTimestamp()
        const endedAt = nextTimestamp()
        const response = options.commands.get(commandKey(command)) ?? {
          exitCode: 0,
          stdout: "",
          stderr: ""
        }
        return CommandResult.make({
          command,
          exitCode: response.exitCode,
          stdout: response.stdout,
          stderr: response.stderr,
          startedAt,
          endedAt,
          durationMillis: 1
        })
      }),

    now: Effect.sync(nextTimestamp)
  })
}

describe("cli command", () => {
  test("exports the root release command", () => {
    expect(cli.name).toBe("release")
    expect(cli.subcommands.flatMap((group) => group.commands.map((command) => command.name)).sort()).toEqual([
      "execute",
      "plan",
      "print",
      "render",
      "run",
      "validate",
      "verify"
    ])
  })

  test("parses plan command with a config path", async () => {
    const layer = Layer.mergeAll(
      makeTestReleaseHostLayer({
        files: new Map([["release.config.json", minimalConfig]]),
        directories: new Set(["."])
      }),
      LiveTargetRegistryLayer,
      BunServices.layer
    )

    await Effect.runPromise(
      Command.runWith(cli, { version: "0.0.0" })([
        "plan",
        "--config",
        "release.config.json",
        "--out",
        "release-plan.json"
      ]).pipe(Effect.provide(layer))
    )
  })

  test("runs programmatically against a scoped Bun host root", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-cli-root-"))
    try {
      await writeFile(join(root, "release.config.json"), minimalConfig)

      await Effect.runPromise(
        runReleaseCli([
          "plan",
          "--config",
          "release.config.json",
          "--format",
          "text",
          "--out",
          "plan.txt"
        ], ReleaseCliOptions.make({ root }))
      )

      const output = await readFile(join(root, "plan.txt"), "utf8")
      expect(output).toContain("release@0.1.0")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("plans release configs programmatically", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-plan-root-"))
    try {
      await writeFile(join(root, "release.config.json"), minimalConfig)

      const plan = await Effect.runPromise(
        planReleaseConfig(PlanReleaseConfigOptions.make({ root }))
      )

      expect(plan.identity.name).toBe("release")
      expect(plan.source.root).toBe(root)
      expect(plan.source.configPath).toBe("release.config.json")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("execute command fails without execute approval", async () => {
    const layer = Layer.mergeAll(
      makeTestReleaseHostLayer({
        files: new Map([["release.config.json", minimalConfig]]),
        directories: new Set(["."]),
        env: new Map([
          ["NPM_TOKEN", "npm_secret"],
          ["GH_TOKEN", "gh_secret"]
        ])
      }),
      LiveTargetRegistryLayer,
      BunServices.layer
    )

    const exit = await Effect.runPromiseExit(
      Command.runWith(cli, { version: "0.0.0" })([
        "execute",
        "--config",
        "release.config.json"
      ]).pipe(Effect.provide(layer))
    )
    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("ExecutionApprovalError")
    }
  })

  test("run command fails without execute approval", async () => {
    const layer = Layer.mergeAll(
      makeTestReleaseHostLayer({
        files: new Map([["release.config.json", minimalConfig]]),
        directories: new Set(["."]),
        env: new Map([
          ["NPM_TOKEN", "npm_secret"],
          ["GH_TOKEN", "gh_secret"]
        ])
      }),
      LiveTargetRegistryLayer,
      BunServices.layer
    )

    const exit = await Effect.runPromiseExit(
      Command.runWith(cli, { version: "0.0.0" })([
        "run",
        "--config",
        "release.config.json"
      ]).pipe(Effect.provide(layer))
    )
    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("ExecutionApprovalError")
    }
  })

  test("run command writes workflow evidence files", async () => {
    const root = await mkdtemp(join(tmpdir(), "ts-release-run-root-"))
    try {
      await writeFile(join(root, "release.config.json"), noOpConfig)

      await Effect.runPromise(
        runReleaseCli([
          "run",
          "--config",
          "release.config.json",
          "--execute",
          "--approve-irreversible"
        ], ReleaseCliOptions.make({ root }))
      )

      for (const name of ["render", "validation", "execution", "verification"]) {
        const output = await readFile(join(root, ".release", "evidence", `${name}.json`), "utf8")
        expect(output).toContain("\"releaseName\": \"release\"")
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("run command writes partial workflow evidence on validation failure", async () => {
    const files = new Map([
      ["release.config.json", partialWorkflowConfig],
      ["artifacts/release-0.1.0.tgz", "fake archive text"]
    ])
    const npmVersionCommand = CommandSpec.make({
      executable: "npm",
      args: ["--version"],
      requiredEnv: [],
      redactedEnv: []
    })
    const layer = Layer.mergeAll(
      makeObservableReleaseHostLayer({
        files,
        directories: new Set(["."]),
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
        "release.config.json",
        "--execute",
        "--approve-irreversible"
      ]).pipe(Effect.provide(layer))
    )

    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("OperationFailedError")
    }
    expect(files.get(".release/evidence/render.json")).toContain("homebrew:homebrew-render-formula:execution")
    expect(files.get(".release/evidence/validation.json")).toContain("npm:npm-version:command")
    expect(files.has(".release/evidence/execution.json")).toBe(false)
    expect(files.has(".release/evidence/verification.json")).toBe(false)
  })

  test("render command succeeds without approval when there is nothing to render", async () => {
    const layer = Layer.mergeAll(
      makeTestReleaseHostLayer({
        files: new Map([["release.config.json", minimalConfig]]),
        directories: new Set(["."])
      }),
      LiveTargetRegistryLayer,
      BunServices.layer
    )

    await Effect.runPromise(
      Command.runWith(cli, { version: "0.0.0" })([
        "render",
        "--config",
        "release.config.json"
      ]).pipe(Effect.provide(layer))
    )
  })
})
