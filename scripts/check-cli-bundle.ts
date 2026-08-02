// The published bin's gate: build it, then run it under REAL node — the host
// an npm consumer actually has. It proves three things the type system cannot:
// the bundle carries no Bun surface, it starts under node, and the plan it
// produces is byte-identical to the library's for the same config.
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { cwd, exit } from "node:process"
import { NonEmptyName, WorkspaceRoot } from "../src/model/primitives.js"
import { compilePlan, Invocation } from "../src/plan/compiler.js"
import * as Effect from "effect/Effect"
import { commandNames } from "../apps/release-ts/src/cli/commands.js"
import { buildCliBundle, cliBundlePath } from "./build-cli-bundle.js"

const root = cwd()
const nodeMissingMessage =
  "check:cli-bundle requires a node binary on PATH: the published bin runs under node, and skipping this gate would recreate the defect it exists to catch."

// No Exec and no publish row, so the gate never spawns a tool or reaches a
// network — it only has to prove the bundle plans identically.
const fixtureConfig = {
  project: { name: "cli-bundle-fixture", version: "1.0.0", tag: "v1.0.0", commit: "fixture" },
  artifacts: [{ id: "payload", path: "dist/payload.txt", format: "file" }],
  archives: [{ id: "bundle", ids: ["payload"], formats: ["zip"] }],
  checksum: {},
  publish: {}
} as const

const write = (path: string, contents: string): void => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, contents)
}
const run = (command: string, argv: ReadonlyArray<string>, options: { cwd: string }) =>
  spawnSync(command, [...argv], { cwd: options.cwd, encoding: "utf8", stdio: "pipe" })

const requireNode = (): string => {
  const probe = run("node", ["--version"], { cwd: root })
  if (probe.error !== undefined || probe.status !== 0) throw new Error(nodeMissingMessage)
  const version = probe.stdout.trim()
  const major = Number(/^v(\d+)\./u.exec(version)?.[1] ?? "0")
  if (major < 20) throw new Error(`check:cli-bundle needs node >= 20, found ${version}.`)
  return version
}

const checkCliBundle = async (): Promise<string> => {
  const version = requireNode()
  await buildCliBundle()
  if (!existsSync(cliBundlePath)) throw new Error(`CLI bundle is absent at ${cliBundlePath}.`)
  const bundle = readFileSync(cliBundlePath, "utf8")
  if (!bundle.startsWith("#!/usr/bin/env node")) {
    throw new Error("CLI bundle must open with the node shebang.")
  }
  // The bundle must not reach a Bun module or global: under node that is a
  // mid-run ReferenceError no type or test would catch. The specifier check is
  // a bare substring one and MUST stay one — bun INLINES a dependency's
  // modules, so an import-position regex would miss the case that matters:
  // Bun-host code compiled into the bin. The entry carries no manifest import,
  // so the specifier cannot appear innocently.
  const violations = [
    ...(bundle.includes("@effect/platform-bun") ? ["carries @effect/platform-bun code"] : []),
    ...new Set([...bundle.matchAll(/\bBun\.[A-Za-z_$][A-Za-z0-9_$]*/gu)].map((m) => `reaches ${m[0]}`))
  ]
  if (violations.length > 0) {
    throw new Error(`CLI bundle depends on Bun, but the published bin runs under node:\n- ${
      violations.join("\n- ")}`)
  }

  const manifestVersion = String(
    (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version?: unknown }).version
  )
  const workspace = mkdtempSync(join(tmpdir(), "ts-release-cli-bundle-"))
  try {
    write(join(workspace, "release.config.json"), `${JSON.stringify(fixtureConfig, null, 2)}\n`)
    write(join(workspace, "dist", "payload.txt"), "payload\n")

    const printed = run("node", [cliBundlePath, "--version"], { cwd: workspace })
    if (printed.status !== 0 || !printed.stdout.includes(manifestVersion)) {
      throw new Error([
        `CLI bundle --version printed ${JSON.stringify(printed.stdout.trim())} under node, expected ${manifestVersion}.`,
        printed.stderr.trim()
      ].filter((line) => line.length > 0).join("\n"))
    }

    // The bundle must expose the command surface the sources declare: a command
    // that never reaches the published bin does not exist for an npm consumer.
    const help = run("node", [cliBundlePath, "--help"], { cwd: workspace })
    const missing = commandNames.filter((name) => !help.stdout.includes(name))
    if (missing.length > 0) {
      throw new Error(`CLI bundle --help omits ${missing.join(", ")}.`)
    }

    const planned = run("node", [
      cliBundlePath, "plan", "--config", "release.config.json", "--out", "release-plan.json"
    ], { cwd: workspace })
    if (planned.status !== 0) {
      throw new Error([
        `CLI bundle plan exited ${planned.status ?? "unknown"} under node.`,
        planned.stdout.trim(), planned.stderr.trim()
      ].filter((line) => line.length > 0).join("\n"))
    }
    const bundled = String((JSON.parse(planned.stdout.trim().split("\n").at(-1) ?? "{}") as {
      planId?: unknown
    }).planId ?? "")
    const direct = await Effect.runPromise(compilePlan(fixtureConfig, Invocation.make({
      workspace: WorkspaceRoot.make(workspace),
      commit: NonEmptyName.make("fixture"),
      snapshot: false
    })))
    if (bundled.length === 0 || bundled !== direct.planId) {
      throw new Error(
        `CLI bundle planned ${bundled || "nothing"} but the library planned ${direct.planId} for the same config.`
      )
    }
    return version
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}

try {
  const version = await checkCliBundle()
  console.log(`CLI bundle runs under ${version} and plans identically to the library.`)
} catch (cause) {
  console.error(String(cause instanceof Error ? cause.message : cause))
  exit(1)
}
