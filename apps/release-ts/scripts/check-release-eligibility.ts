import * as Effect from "effect/Effect"
import { appendFileSync } from "node:fs"
import { cwd, env, exit } from "node:process"
import { makeBunCommandRuntimeLayer } from "../src/runtime.js"
import {
  checkReleaseConfigEligibility,
  ReleaseEligibilityConfigOptions
} from "@mannyc1/ts-release/workflows/config"

const root = cwd()

const writeGithubOutput = (name: string, value: string): void => {
  const output = env.GITHUB_OUTPUT
  const line = `${name}=${value}\n`
  if (output === undefined || output.length === 0) {
    console.log(line.trimEnd())
    return
  }
  appendFileSync(output, line)
}

const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const ScriptLayer = makeBunCommandRuntimeLayer({ root })

const result = await Effect.runPromise(
  checkReleaseConfigEligibility(
    ReleaseEligibilityConfigOptions.make({
      root,
      configPath: "apps/release-ts/release.config.json",
      packagePath: "package.json"
    })
  ).pipe(
    Effect.match({
      onFailure: (error) => ({
        ok: false as const,
        error: formatError(error)
      }),
      onSuccess: (decision) => ({
        ok: true as const,
        decision
      })
    }),
    Effect.provide(ScriptLayer)
  )
)

if (!result.ok) {
  console.error(result.error)
  exit(1)
}

if (result.decision.status === "partial") {
  console.error(result.decision.reason)
  exit(1)
}

writeGithubOutput("should_release", result.decision.shouldRelease ? "true" : "false")
console.log(result.decision.reason)
