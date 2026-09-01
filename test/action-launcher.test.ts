import { expect, test } from "bun:test"
import { join } from "node:path"
import {
  runActionLauncher,
  type ActionLauncherSpawnInput
} from "../apps/ts-release-action/src/launcher.js"

const root = "/tmp/ts-release-action-fixture"
const node = "/fixture/node"
const environment = (command: string): Record<string, string> => ({
  PATH: "/fixture/bin",
  HOME: "/fixture/home",
  TS_RELEASE_BUN_BIN: "/fixture/bin/bun-1.3.14",
  BUN_INSTALL_CACHE_DIR: "/fixture/cache",
  ACTIONS_RUNTIME_TOKEN: "runtime-token-sentinel",
  ACTIONS_RESULTS_URL: "https://results.example.invalid/",
  GITHUB_TOKEN: "github-token-sentinel",
  INPUT_COMMAND: command,
  INPUT_CONFIG: "release.config.json",
  INPUT_PREPARED: ""
})

test("native Action launcher confines runner credentials to the Bun release child", () => {
  const calls: ActionLauncherSpawnInput[] = []
  const source = environment("release")
  expect(runActionLauncher({
    actionDirectory: root,
    nodeExecutable: node,
    environment: source,
    spawn: (input) => { calls.push(input); return 0 }
  })).toBe(0)
  expect(calls).toHaveLength(2)
  expect(calls[0]).toEqual({
    executable: "/fixture/bin/bun-1.3.14",
    argv: ["--no-env-file", "--no-install", join(root, "scripts", "preload-bun-compile-runtimes.ts")],
    environment: {
      PATH: "/fixture/bin",
      BUN_INSTALL_CACHE_DIR: "/fixture/cache"
    }
  })
  expect(calls[1]).toEqual({
    executable: "/fixture/bin/bun-1.3.14",
    argv: [join(root, "dist", "index.js")],
    environment: {
      ...source,
      TS_RELEASE_ACTION_NODE: node,
      TS_RELEASE_ARTIFACT_BRIDGE: join(root, "dist", "artifact-bridge.cjs")
    }
  })
  expect(JSON.stringify(calls[0])).not.toContain("sentinel")
})

test("native Action launcher skips preload for inspect/publish and stops on preload failure", () => {
  for (const command of ["inspect", "publish"]) {
    const calls: ActionLauncherSpawnInput[] = []
    expect(runActionLauncher({
      actionDirectory: root,
      nodeExecutable: node,
      environment: environment(command),
      spawn: (input) => { calls.push(input); return 0 }
    })).toBe(0)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.argv).toEqual([join(root, "dist", "index.js")])
  }

  const failedCalls: ActionLauncherSpawnInput[] = []
  expect(runActionLauncher({
    actionDirectory: root,
    nodeExecutable: node,
    environment: environment("prepare"),
    spawn: (input) => { failedCalls.push(input); return 23 }
  })).toBe(23)
  expect(failedCalls).toHaveLength(1)
})

test("native Action launcher refuses before preparation without resolved tools or runner artifact credentials", () => {
  for (const name of ["TS_RELEASE_BUN_BIN", "ACTIONS_RUNTIME_TOKEN", "ACTIONS_RESULTS_URL"] as const) {
    const selected = environment("release")
    delete selected[name]
    let calls = 0
    expect(() => runActionLauncher({
      actionDirectory: root,
      nodeExecutable: node,
      environment: selected,
      spawn: () => { calls += 1; return 0 }
    })).toThrow(`Native Action launcher requires ${name}.`)
    expect(calls).toBe(0)
  }
})
