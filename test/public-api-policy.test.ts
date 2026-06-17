import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { isAbsolute } from "node:path"
import {
  bannedAggregateExports,
  publicExportPolicies
} from "../scripts/lib/public-api-policy.js"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const packageExports = (): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(readFileSync("package.json", "utf8"))
  if (!isRecord(parsed) || !isRecord(parsed.exports)) {
    throw new Error("package.json exports must be an object")
  }
  return parsed.exports
}

describe("public API policy", () => {
  test("has unique public export subpaths", () => {
    const subpaths = publicExportPolicies.map((policy) => policy.subpath)
    expect(new Set(subpaths).size).toBe(subpaths.length)
    expect(subpaths).toContain(".")
  })

  test("does not include banned aggregate exports", () => {
    const subpaths = new Set(publicExportPolicies.map((policy) => policy.subpath))
    for (const subpath of bannedAggregateExports) {
      expect(subpaths.has(subpath)).toBe(false)
    }
  })

  test("matches package.json exports exactly", () => {
    const policySubpaths = new Set(publicExportPolicies.map((policy) => policy.subpath))
    const actualSubpaths = new Set(Object.keys(packageExports()))
    expect(policySubpaths).toEqual(actualSubpaths)
  })

  test("publishes the TypeScript API instead of the old programmatic CLI surface", () => {
    const subpaths = new Set(publicExportPolicies.map((policy) => policy.subpath))
    expect(subpaths.has("./api")).toBe(true)
    expect(subpaths.has("./cli/programmatic")).toBe(false)
  })

  test("uses source-relative runtime paths", () => {
    for (const policy of publicExportPolicies) {
      for (const sourcePath of policy.allowedRuntimeSourcePaths) {
        expect(isAbsolute(sourcePath)).toBe(false)
        expect(sourcePath.startsWith("../")).toBe(false)
      }
    }
  })
})
