import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { cwd } from "node:process"

export const root = cwd()
export const packagePath = "package.json"
export const appPackagePath = "apps/release-ts/package.json"
export const releaseConfigPath = "apps/release-ts/release.config.json"
export const releaseWorkflowPath = ".github/workflows/release.yml"
export const preparedRoot = ".release/ts-release/prepared"

export const selfReleaseConfig = (): unknown => readJson(releaseConfigPath)

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
export const candidateActionReference = (): string => {
  const version = stringField(readJson(packagePath), "version")
  if (version === undefined) throw new Error("package.json version is required for the candidate Action reference.")
  return `mannyc2/ts-release/apps/ts-release-action@v${version}`
}
export const report = (
  schemaVersion: string,
  failures: ReadonlyArray<string>,
  details: Readonly<Record<string, unknown>>
): void => {
  console.log(JSON.stringify({
    ...details,
    schemaVersion,
    status: failures.length === 0 ? "ready" : "failed",
    failures
  }))
  if (failures.length > 0) process.exitCode = 1
}
