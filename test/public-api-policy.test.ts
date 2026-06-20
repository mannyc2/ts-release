import { describe, expect, test } from "@effect/bun-test"
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

const rootPackage = (): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(readFileSync("package.json", "utf8"))
  if (!isRecord(parsed)) {
    throw new Error("package.json must be an object")
  }
  return parsed
}

const appPackage = (path: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(
    readFileSync(path, "utf8")
  )
  if (!isRecord(parsed)) {
    throw new Error(`${path} must be an object`)
  }
  return parsed
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

  test("publishes explicit workflows instead of the old api facade or programmatic CLI surface", () => {
    const subpaths = new Set(publicExportPolicies.map((policy) => policy.subpath))
    expect(subpaths.has("./api")).toBe(false)
    expect(subpaths.has("./api/live")).toBe(false)
    expect(subpaths.has("./workflows")).toBe(true)
    expect(subpaths.has("./workflows/config")).toBe(true)
    expect(subpaths.has("./workflows/evidence")).toBe(true)
    expect(subpaths.has("./workflows/live")).toBe(true)
    expect(subpaths.has("./cli/programmatic")).toBe(false)
  })

  test("keeps official CLI and Bun runtime out of root public exports", () => {
    const subpaths = new Set(Object.keys(packageExports()))
    expect(subpaths.has("./cli")).toBe(false)
    expect(subpaths.has("./cli/command")).toBe(false)
    expect(subpaths.has("./runtime/bun")).toBe(false)
  })

  test("keeps Bun runtime dependency out of root runtime dependencies", () => {
    const pkg = rootPackage()
    expect(isRecord(pkg.dependencies) && Object.hasOwn(pkg.dependencies, "@effect/platform-bun")).toBe(false)
    expect(isRecord(pkg.devDependencies) && Object.hasOwn(pkg.devDependencies, "@effect/platform-bun")).toBe(true)
    expect(pkg.bin).toBeUndefined()
  })

  test("uses source-relative runtime paths", () => {
    for (const policy of publicExportPolicies) {
      for (const sourcePath of policy.allowedRuntimeSourcePaths) {
        expect(isAbsolute(sourcePath)).toBe(false)
        expect(sourcePath.startsWith("../")).toBe(false)
      }
    }
  })

  test("documents the private release-ts app boundary", () => {
    const pkg = appPackage("apps/release-ts/package.json")
    expect(pkg.private).toBe(true)
    expect(pkg.name).toBe("@mannyc1/release-ts-app")
    expect(pkg.bin).toEqual({ release: "dist/cli/main.js" })
    expect(pkg.sideEffects).toEqual(["./dist/cli/main.js"])
    expect(pkg.dependencies).toEqual({
      "@mannyc1/ts-release": "file:../..",
      "@effect/platform-bun": "4.0.0-beta.83",
      effect: "4.0.0-beta.83"
    })
  })

  test("documents the private action app boundary", () => {
    const pkg = appPackage("apps/ts-release-action/package.json")
    expect(pkg.private).toBe(true)
    expect(pkg.name).toBe("@mannyc1/ts-release-action-app")
    expect(pkg.bin).toBeUndefined()
    expect(pkg.dependencies).toMatchObject({
      "@mannyc1/ts-release": "file:../..",
      "@effect/platform-node": "4.0.0-beta.83",
      effect: "4.0.0-beta.83"
    })
  })
})
