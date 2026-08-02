import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { cwd } from "node:process"
import { resolveConfig } from "@mannyc1/ts-release"

export const root = cwd()
export const packagePath = "package.json"
export const appPackagePath = "apps/release-ts/package.json"
export const releaseConfigPath = "apps/release-ts/release.config.json"
export const releaseWorkflowPath = ".github/workflows/release.yml"

// The dogfood config omits `project.commit`: `release.yml` passes
// `resolve: github` so the release identity is OBSERVED from the runner rather
// than asserted by a checked-in string. The gates resolve it the same way, with
// one fixed fact — they prove the authored shape plans, not that a particular
// commit is checked out. Same stance as check:examples.
export const SELF_COMMIT = "0000000000000000000000000000000000000000"
export const selfReleaseConfig = (): unknown =>
  resolveConfig(readJson(releaseConfigPath), { commit: SELF_COMMIT })

export type JsonObject = Record<string, unknown>
export const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value)
export const readText = (path: string): string =>
  readFileSync(resolve(root, path), "utf8")
export const readJson = (path: string): unknown => JSON.parse(readText(path))
export const stringField = (value: unknown, key: string): string | undefined =>
  isJsonObject(value) && typeof value[key] === "string" && value[key].length > 0
    ? value[key]
    : undefined
export const report = (
  schemaVersion: string,
  failures: ReadonlyArray<string>,
  details: Readonly<Record<string, unknown>>
): void => {
  console.log(JSON.stringify({
    schemaVersion,
    status: failures.length === 0 ? "ready" : "failed",
    failures,
    ...details
  }))
  if (failures.length > 0) process.exitCode = 1
}
