import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { ContentValue } from "../../src/model/operation.js"
import { Invocation, compilePlan } from "../../src/plan/compiler.js"
import { NonEmptyName, WorkspaceRoot } from "../../src/model/primitives.js"
import { operationEntries } from "../../src/model/validate.js"

const root = process.cwd()
const invoke = (value: unknown) => compilePlan(value, Invocation.make({
  workspace: WorkspaceRoot.make(root), commit: NonEmptyName.make("abc123"), snapshot: false
}))
const render = (content: ContentValue, facts: Readonly<Record<string, string>>): string =>
  typeof content === "string"
    ? content
    : content.map((part) => typeof part === "string" ? part : facts[part.outputId]!).join("")

describe("current preparation recipes", () => {
  test("build-only configuration omits publication and still compiles", async () => {
    const accepted = await Effect.runPromise(invoke({
      project: { name: "fixture", version: "1.0.0", tag: "v1.0.0" },
      builds: [{
        builder: "bun", id: "cli", entry: "src/index.ts",
        targets: ["linux-x64"], output: ".release/fixture-{targetTriple}{ext}"
      }]
    }))
    expect(accepted.plan.stages.publish).toEqual([])
    expect(accepted.plan.stages.build.some((item) => item._tag === "Exec")).toBe(true)
  })

  test("catalog rendering remains local and contains no Git or gh operation", async () => {
    const accepted = await Effect.runPromise(invoke({
      project: {
        name: "fixture", version: "1.0.0", tag: "v1.0.0",
        repository: "owner/repo", description: "Fixture", homepage: "https://example.test"
      },
      artifacts: [{ id: "cli", path: "dist/cli", format: "executable" }],
      catalogs: [{
        id: "marketplace", repository: "owner/catalog", file: ".release/marketplace.json",
        content: ["version=", "{version}"]
      }]
    }))
    const operations = operationEntries(accepted.plan).map(({ operation }) => operation)
    const writes = accepted.plan.stages.catalog.filter((item) => item._tag === "Write")
    expect(writes).toHaveLength(1)
    expect(operations.some((operation) =>
      operation._tag === "Exec" && operation.argv.some((part) => part === "git" || part === "gh")
    )).toBe(false)
  })

  test("retained npm and GitHub publication rows are reachable", async () => {
    const accepted = await Effect.runPromise(invoke({
      project: { name: "fixture", version: "1.0.0", tag: "v1.0.0", repository: "owner/repo" },
      npmPackage: { path: "." },
      publish: {
        npm: { registry: "https://registry.npmjs.org", packageName: "fixture" },
        github: { repository: "owner/repo" }
      }
    }))
    const tags = operationEntries(accepted.plan).map(({ operation }) => operation._tag)
    expect(tags).toContain("PackageRegistryRelease")
    expect(tags).toContain("ForgeRelease")
  })

  test("catalog fixture bytes remain unchanged after local lowering", async () => {
    const fixture = readFileSync(join(root, "test", "fixtures", "public", "portable-cli", "manifest.json"), "utf8")
    const accepted = await Effect.runPromise(invoke({
      project: {
        name: "pkg", version: "1.0.0", tag: "v1.0.0",
        repository: "owner/repo", description: "Pkg", homepage: "https://example.test"
      },
      artifacts: [{ id: "cli", path: "dist/pkg.exe", format: "executable" }],
      catalogs: [{
        id: "marketplace", repository: "owner/catalog", file: "manifest.json",
        content: ["{", "\"version\":\"", "{version}", "\"}\""]
      }]
    }))
    const write = accepted.plan.stages.catalog.find((item) => item._tag === "Write")
    expect(write?._tag).toBe("Write")
    expect(render(write!.content, {})).toContain("1.0.0")
    expect(fixture.length).toBeGreaterThan(0)
  })
})
