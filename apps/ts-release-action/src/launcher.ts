import { spawnSync } from "node:child_process"
import { isAbsolute, join } from "node:path"

export type ActionLauncherEnvironment = Readonly<Record<string, string | undefined>>

export interface ActionLauncherSpawnInput {
  readonly executable: string
  readonly argv: ReadonlyArray<string>
  readonly environment: ActionLauncherEnvironment
}

export type ActionLauncherSpawn = (input: ActionLauncherSpawnInput) => number

const defaultSpawn: ActionLauncherSpawn = ({ executable, argv, environment }) => {
  const result = spawnSync(executable, [...argv], {
    env: { ...environment },
    stdio: "inherit"
  })
  if (result.error !== undefined) throw result.error
  return result.status ?? 1
}

const required = (environment: ActionLauncherEnvironment, name: string): string => {
  const value = environment[name]?.trim()
  if (value === undefined || value.length === 0) {
    throw new Error(`Native Action launcher requires ${name}.`)
  }
  return value
}

export const runActionLauncher = (input: {
  readonly actionDirectory: string
  readonly nodeExecutable: string
  readonly environment: ActionLauncherEnvironment
  readonly spawn?: ActionLauncherSpawn
}): number => {
  if (!isAbsolute(input.actionDirectory)) throw new Error("Native Action directory must be absolute.")
  if (!isAbsolute(input.nodeExecutable)) throw new Error("Native Action Node executable must be absolute.")
  const spawn = input.spawn ?? defaultSpawn
  const command = required(input.environment, "INPUT_COMMAND")
  const path = required(input.environment, "PATH")
  const home = required(input.environment, "HOME")

  // These credentials are injected only by GitHub's native JavaScript Action
  // handler. Refuse before preparation if the durable artifact boundary cannot
  // be reached; never pass either value to the runtime preloader.
  required(input.environment, "ACTIONS_RUNTIME_TOKEN")
  required(input.environment, "ACTIONS_RESULTS_URL")

  const cache = input.environment.BUN_INSTALL_CACHE_DIR?.trim() ||
    join(home, ".bun", "install", "cache")
  if (command !== "publish") {
    const preload = spawn({
      executable: "bun",
      argv: [
        "--no-env-file", "--no-install",
        join(input.actionDirectory, "scripts", "preload-bun-compile-runtimes.ts")
      ],
      environment: { PATH: path, BUN_INSTALL_CACHE_DIR: cache }
    })
    if (preload !== 0) return preload
  }

  return spawn({
    executable: "bun",
    argv: [join(input.actionDirectory, "dist", "index.js")],
    environment: {
      ...input.environment,
      TS_RELEASE_ACTION_NODE: input.nodeExecutable,
      TS_RELEASE_ARTIFACT_BRIDGE: join(input.actionDirectory, "dist", "artifact-bridge.cjs")
    }
  })
}
