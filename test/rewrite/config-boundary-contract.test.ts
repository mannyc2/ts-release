import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import {
  mkdirSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync
} from "node:fs"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import {
  expectExactKeys,
  expectObject,
  parseStrictJson
} from "../../scripts/lib/strict-json.js"
import { decodeConfig as decodeCandidateConfig } from "../../src/config/config.js"
import {
  NonEmptyName,
  WorkspaceRoot
} from "../../src/model/primitives.js"
import {
  Invocation,
  compilePlan
} from "../../src/plan/compiler.js"

const root = process.cwd()
const contractPath = join(root, "contracts", "rewrite", "config-boundary.json")
const contract = expectObject(parseStrictJson(readFileSync(contractPath, "utf8")), "config boundary")
const fixturePaths = contract.fixtures as ReadonlyArray<string>
const withTempDirectoryPromise = async <A>(
  prefix: string,
  use: (path: string) => Promise<A>
): Promise<A> => {
  const path = mkdtempSync(join(tmpdir(), prefix))
  try {
    return await use(path)
  } finally {
    rmSync(path, { recursive: true, force: true })
  }
}

const assertJsonValue = (value: unknown, ancestors: Set<object> = new Set()): void => {
  if (value === null || typeof value === "boolean" || typeof value === "string") return
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw new Error("invalid number")
    return
  }
  if (typeof value !== "object") throw new Error("invalid JSON runtime value")
  if (ancestors.has(value)) throw new Error("cycle")
  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) throw new Error("sparse array")
        assertJsonValue(value[index], ancestors)
      }
      return
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) throw new Error("class instance")
    for (const item of Object.values(value)) assertJsonValue(item, ancestors)
  } finally {
    ancestors.delete(value)
  }
}

const selectCliWorkspace = (
  cwd: string,
  configPath: string,
  explicitRoot: string | null
): string => explicitRoot !== null
  ? resolve(cwd, explicitRoot)
  : isAbsolute(configPath) ? dirname(configPath) : cwd

const normalizeWorkspace = (path: string): string => {
  if (path.length === 0 || !isAbsolute(path)) throw new Error("workspace must be absolute")
  return realpathSync(path)
}

const readActionConfig = (
  workspace: string,
  path: string,
  read: (path: string) => string
): unknown => {
  const normalizedRoot = normalizeWorkspace(workspace)
  const candidate = realpathSync(isAbsolute(path) ? path : resolve(normalizedRoot, path))
  const fromRoot = relative(normalizedRoot, candidate)
  if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) throw new Error("outside workspace")
  return parseStrictJson(read(candidate))
}

describe("frozen v6 configuration boundary", () => {
  test("strict contract and canonical baseline fixtures are complete", async () => {
    expectExactKeys(contract, [
      "schemaVersion",
      "corePlanInput",
      "jsonCompatibility",
      "cliWorkspaceSelection",
      "directWorkspaceCases",
      "actionBoundary",
      "identityNeutralInputs",
      "applyInput",
      "baselineTopLevelFields",
      "presetOwnership",
      "fixtures",
      "activation"
    ])
    expect(fixturePaths).toHaveLength(4)
    for (const path of fixturePaths) {
      const value = parseStrictJson(readFileSync(join(root, path), "utf8"))
      assertJsonValue(value)
      const decoded = await Effect.runPromise(decodeCandidateConfig(value))
      expect(decoded).toBeDefined()
    }
  })

  test("inline and JSON-parsed values lower identically in the incumbent decoder", async () => {
    const text = readFileSync(join(root, fixturePaths[0]!), "utf8")
    const inline = parseStrictJson(text)
    const parsed = JSON.parse(JSON.stringify(inline))
    expect(await Effect.runPromise(decodeCandidateConfig(inline))).toEqual(
      await Effect.runPromise(decodeCandidateConfig(parsed))
    )
  })

  test("CLI workspace selection truth table is exact", () => {
    for (const item of contract.cliWorkspaceSelection as ReadonlyArray<Record<string, string | null>>) {
      expect(selectCliWorkspace(item.cwd!, item.configPath!, item.root ?? null)).toBe(item.selected!)
    }
  })

  test("absolute and symlink workspace roots normalize to the same directory", () =>
    withTempDirectoryPromise("ts-release-workspace-", async (workspace) => {
      const target = join(workspace, "target")
      const link = join(workspace, "link")
      mkdirSync(target)
      symlinkSync(target, link)
      expect(normalizeWorkspace(target)).toBe(normalizeWorkspace(link))
      expect(() => normalizeWorkspace("")).toThrow()
      expect(() => normalizeWorkspace("./relative")).toThrow()
    }))

  test("Action-style contained JSON loading reads exactly once and never rebases root", () =>
    withTempDirectoryPromise("ts-release-action-boundary-", async (workspace) => {
      const path = join(workspace, "config", "release.json")
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, readFileSync(join(root, fixturePaths[1]!), "utf8"))
      let reads = 0
      const read = (candidate: string): string => {
        reads += 1
        return readFileSync(candidate, "utf8")
      }
      expect(readActionConfig(workspace, "config/release.json", read)).toEqual(
        readActionConfig(workspace, path, read)
      )
      expect(reads).toBe(2)
      expect(() => readActionConfig(workspace, contractPath, read)).toThrow("outside workspace")
    }))

  test("all named non-JSON values are rejected before planning", () => {
    class Example {}
    const sparse = Array(2)
    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    const values = [
      () => undefined,
      Symbol("x"),
      1n,
      new Date(),
      new Example(),
      undefined,
      Number.POSITIVE_INFINITY,
      1.5,
      -0,
      sparse,
      cycle
    ]
    for (const value of values) expect(() => assertJsonValue(value)).toThrow()
  })

  test("candidate value API accepts every canonical fixture without path identity", async () => {
    const input = {
      project: { name: "fixture", version: "1.0.0", tag: "v1.0.0" },
      artifacts: [{ id: "fixture", path: "dist/fixture", format: "executable" }],
      publish: {}
    }
    expect(await Effect.runPromise(decodeCandidateConfig(input))).toEqual(
      await Effect.runPromise(decodeCandidateConfig(JSON.parse(JSON.stringify(input))))
    )
    for (const path of fixturePaths) {
      const value = parseStrictJson(readFileSync(join(root, path), "utf8"))
      const accepted = await Effect.runPromise(compilePlan(value, Invocation.make({
        workspace: WorkspaceRoot.make(root),
        commit: NonEmptyName.make("ignored-in-favor-of-config"),
        snapshot: false
      })))
      expect(String(accepted.plan.identity.commit)).toBe("0123456789abcdef")
    }
    for (const value of [
      "release.json",
      { ...input, configPath: "release.json" },
      { ...input, profiles: {} },
      { ...input, adapters: {} }
    ]) {
      expect((await Effect.runPromise(
        decodeCandidateConfig(value).pipe(Effect.flip)
      ))._tag).toMatch(/Config(?:Value|Decode)Error/u)
    }
  })

  test("product-owned presets expose no injected renderer, schema, authority, or credentials", () => {
    const forbidden = new Set([
      "renderer",
      "responseSchema",
      "authority",
      "credential",
      "adapter",
      "profileDefinition"
    ])
    for (const path of fixturePaths.filter((item) => /homebrew|scoop/u.test(item))) {
      const value = expectObject(parseStrictJson(readFileSync(join(root, path), "utf8")), path)
      const visit = (item: unknown): void => {
        if (Array.isArray(item)) return item.forEach(visit)
        if (typeof item !== "object" || item === null) return
        for (const [key, child] of Object.entries(item)) {
          expect(forbidden.has(key)).toBe(false)
          visit(child)
        }
      }
      visit(value)
    }
    const generic = readFileSync(join(root, fixturePaths[2]!), "utf8")
    expect(generic).toContain("\"content\"")
  })

  test("candidate rejects injected preset machinery but retains generic typed content", async () => {
    for (const path of fixturePaths.filter((item) => /homebrew|scoop/u.test(item))) {
      const value = parseStrictJson(readFileSync(join(root, path), "utf8")) as {
        readonly publish: Record<string, object>
      }
      const preset = path.includes("homebrew") ? "homebrew" : "scoop"
      for (const key of ["renderer", "template", "adapter", "authority"]) {
        const altered = {
          ...value,
          publish: {
            ...value.publish,
            [preset]: { ...value.publish[preset], [key]: "injected" }
          }
        }
        expect((await Effect.runPromise(
          decodeCandidateConfig(altered).pipe(Effect.flip)
        ))._tag).toBe("ConfigDecodeError")
      }
    }
    const generic = parseStrictJson(readFileSync(join(root, fixturePaths[2]!), "utf8"))
    const decoded = await Effect.runPromise(decodeCandidateConfig(generic))
    expect(decoded.catalogs?.[0]?.content).toEqual([
      "{\"name\":\"fixture\",\"version\":\"{version}\"}\n"
    ])
  })
})
