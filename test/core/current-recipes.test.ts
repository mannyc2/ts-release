import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { PackageRegistryRelease } from "../../src/model/operation.js"
import type { ContentValue, Operation } from "../../src/model/operation.js"
import {
  NonEmptyName,
  WorkspaceRoot
} from "../../src/model/primitives.js"
import {
  Invocation,
  compilePlan
} from "../../src/plan/compiler.js"
import { operationEntries } from "../../src/model/validate.js"

const root = process.cwd()
const compile = (name: string) => Effect.runPromise(compilePlan(
  JSON.parse(readFileSync(join(root, "examples", name, "release.config.json"), "utf8")),
  Invocation.make({
    workspace: WorkspaceRoot.make(root),
    commit: NonEmptyName.make("abc123"),
    snapshot: false
  })
))
const render = (content: ContentValue, facts: Readonly<Record<string, string>>): string =>
  typeof content === "string"
    ? content
    : content.map((part) => typeof part === "string" ? part : facts[part.outputId]!).join("")

describe("Plan 176 current recipe port", () => {
  for (const item of [
    ["homebrew-tap", "homebrew", "formula.rb", {
      archive: "6a6d5a6e19c74024a6cbe11ed33dc1dec5ff47acc863599137a97cd3fee1871e"
    }],
    ["scoop-bucket", "scoop", "manifest.json", {
      archive: "821233f5d40c1df83d54dcbd403e4cec109d4a5c7f055160b0c88833f272ba22"
    }],
    ["portable-cli", "homebrew", "formula.rb", {
      "cli-darwin-arm64": "420c09ffefd15b0ab90134aa1149b76b46933145c19f1335bde9d8960e84ff9e",
      "cli-darwin-x64": "6244805d219cc43ebe6693ee3b5aff6a56bfe6671846120a7adf8a57f360d52f"
    }],
    ["portable-cli", "scoop", "manifest.json", {
      "cli-windows-x64": "94dd0a9016b5e3b0c12a1bccb74ca3bab8fef50540548228a9fca8b25284c782"
    }]
  ] as const) {
    test(`${item[0]} ${item[1]} preset renders immutable public bytes`, async () => {
      const accepted = await compile(item[0])
      const operation = accepted.plan.stages.catalog.find((candidate) =>
        candidate._tag === "Write" && candidate.id === `catalog:${item[1]}:render`)
      if (operation?._tag !== "Write") throw new Error("Missing catalog preset write.")
      expect(render(operation.content, item[3])).toBe(readFileSync(
        join(root, "test", "fixtures", "public", item[0], item[2]),
        "utf8"
      ))
    })
  }

  test("publication uses only closed composites with explicit verification", async () => {
    const accepted = await compile("portable-cli")
    const operations = operationEntries(accepted.plan).map(({ operation }) => operation)
    expect(operations.some((operation) =>
      operation._tag === "PackageRegistryRelease" &&
      operation.registryKind === "pypi" &&
      operation.verifyPublished)).toBe(true)
    expect(operations.some((operation) => operation._tag === "ForgeRelease")).toBe(true)
    expect(operations.filter((operation) => operation._tag === "OpaquePublish").every((operation) =>
      operation.reconciliation === "manual-only")).toBe(true)
  })

  test("custom publishers cannot masquerade as local Exec", async () => {
    const input = JSON.parse(readFileSync(
      join(root, "test", "fixtures", "oracle", "command-builder.json"),
      "utf8"
    ))
    input.publish.custom = [{
      id: "marketplace",
      run: ["tool", "publish", "{version}"],
      risk: "externally-visible"
    }]
    const accepted = await Effect.runPromise(compilePlan(input, Invocation.make({
      workspace: WorkspaceRoot.make(root),
      commit: NonEmptyName.make("abc123"),
      snapshot: false
    })))
    const custom = operationEntries(accepted.plan).map(({ operation }) => operation)
      .find((operation): operation is Extract<Operation, { readonly _tag: "OpaquePublish" }> =>
        operation.id === "publish:custom:marketplace")
    expect(custom?._tag).toBe("OpaquePublish")
    expect(custom?.reconciliation).toBe("manual-only")
    expect(custom?.argv.length).toBeGreaterThan(0)
  })

  test("agent-plugin renders both marketplace catalogs to exact public bytes", async () => {
    const accepted = await compile("agent-plugin")
    const facts: Readonly<Record<string, string>> = {
      "sha256:plugin": "3f7c1c0e9d4b5a68721c3d0f8e5a9b2c4d6e8f0a1b3c5d7e9f1a2b4c6d8e0f2a",
      "downloadUrl:plugin":
        "https://github.com/owner/agent-plugin/releases/download/v0.1.0/release-example-agent-plugin_0.1.0.zip"
    }
    const renderFacts = (content: ContentValue): string => typeof content === "string"
      ? content
      : content.map((part) =>
          typeof part === "string" ? part : facts[`${part.fact}:${part.outputId}`]!).join("")
    for (const [id, fixture] of [
      ["codex-marketplace", "codex-marketplace.json"],
      ["claude-marketplace", "claude-marketplace.json"]
    ] as const) {
      const operation = accepted.plan.stages.catalog.find((candidate) =>
        candidate._tag === "Write" && candidate.id === `catalog:${id}:render`)
      if (operation?._tag !== "Write") throw new Error(`Missing ${id} catalog write.`)
      expect(renderFacts(operation.content)).toBe(readFileSync(
        join(root, "test", "fixtures", "public", "agent-plugin", fixture),
        "utf8"
      ))
    }
  })

  test("agent-plugin keeps files-only archive, checksum, and forge asset flow connected", async () => {
    const accepted = await compile("agent-plugin")
    const operations = operationEntries(accepted.plan).map(({ operation }) => operation)
    const pack = operations.find((operation) => operation._tag === "Pack")
    if (pack?._tag !== "Pack") throw new Error("Missing files-only Pack.")
    expect([...(pack.files ?? [])].map(String)).toEqual(["plugin/**"])
    expect(pack.inputs).toEqual([])
    expect(String(pack.outputs[0]?.path)).toBe(".release/artifacts/release-example-agent-plugin_0.1.0.zip")
    const digest = operations.find((operation) => operation._tag === "Digest")
    expect(digest?.inputs.map(String)).toContain("plugin")
    const checksum = operations.find((operation) =>
      operation._tag === "Write" && operation.id === "checksum:write")
    expect(checksum?._tag).toBe("Write")
    const forge = operations.find((operation) => operation._tag === "ForgeRelease")
    if (forge?._tag !== "ForgeRelease") throw new Error("Missing ForgeRelease.")
    const assets = forge.assets.map((asset) => asset.name)
    expect(assets).toContain("release-example-agent-plugin_0.1.0.zip")
    expect(assets.some((name) => name.endsWith("checksums.txt"))).toBe(true)
  })

  test("typed variables are substituted as value tokens without evaluation", async () => {
    const config = JSON.parse(readFileSync(
      join(root, "test", "fixtures", "oracle", "command-builder.json"),
      "utf8"
    ))
    config.builds[0].run = ["tool", "{name}", "{version}", "{target}", "{binary}", "{ext}"]
    const accepted = await Effect.runPromise(compilePlan(config, Invocation.make({
      workspace: WorkspaceRoot.make(root),
      commit: NonEmptyName.make("abc123"),
      snapshot: false
    })))
    const operation = accepted.plan.stages.build.find((candidate) => candidate._tag === "Exec")
    expect(operation?._tag === "Exec" ? operation.argv : []).toEqual([
      "tool", "fixture", "1.0.0", "linux-x64", "fixture", ""
    ])
  })

  test("registry URLs pass the provider HTTPS policy and keep their spelling", async () => {
    const dogfood = JSON.parse(readFileSync(
      join(root, "apps/release-ts/release.config.json"),
      "utf8"
    )) as { publish: { npm: { registry?: string } } }
    const compileWith = (registry: string) => {
      const mutated = structuredClone(dogfood)
      mutated.publish.npm.registry = registry
      return Effect.runPromise(compilePlan(mutated, Invocation.make({
        workspace: WorkspaceRoot.make(root),
        commit: NonEmptyName.make("abc123"),
        snapshot: false
      })))
    }
    await expect(compileWith("http://registry.example")).rejects.toThrow()
    await expect(compileWith("https://localhost/registry")).rejects.toThrow()
    // The lowering failure keeps its TAG through the planning boundary; it
    // used to arrive flattened into an untyped PlanningFactsError string.
    await expect(compileWith("http://registry.example")).rejects.toMatchObject({
      _tag: "ConfigValueError",
      reason: "Provider URL violates the closed HTTPS/DNS policy."
    })
    const accepted = await compileWith("https://registry.npmjs.org/")
    const npm = operationEntries(accepted.plan)
      .map(({ operation }) => operation)
      .find((candidate): candidate is PackageRegistryRelease =>
        candidate._tag === "PackageRegistryRelease" && candidate.registryKind === "npm")
    if (npm === undefined) throw new Error("Missing npm release operation.")
    // The policy validates; the row keeps the caller's exact spelling so
    // shipped plan bytes stay stable.
    expect(npm.registryUrl).toBe("https://registry.npmjs.org/")
    expect(npm.probeUrl.startsWith("https://registry.npmjs.org/")).toBe(true)
  })

  // The lowering steps share one mutable CurrentRows and read each other's
  // outputs by bare id, so their CALL ORDER in current.ts decides plan bytes.
  // These assertions are that order's pin: each one fails if the producing
  // step stops running before its consumer.
  test("the lowering order is load-bearing: later steps consume earlier outputs", async () => {
    const config = {
      project: { name: "ordering", version: "1.0.0", tag: "v1.0.0" },
      publish: {
        changelog: {
          groups: [],
          mode: "reviewed-transform",
          pathFilters: [],
          profileId: "changelog.reviewed-transform/v1"
        },
        announce: [{
          id: "smtp", profileId: "announce.smtp/v1",
          destination: "release@example.com", credentialEnv: "SMTP_TOKEN"
        }]
      }
    }
    const accepted = await Effect.runPromise(compilePlan(config, Invocation.make({
      workspace: WorkspaceRoot.make(root),
      commit: NonEmptyName.make("abc123"),
      snapshot: false
    })))
    const operations = operationEntries(accepted.plan).map(({ operation }) => operation)
    const notes = operations.find((operation) => operation.outputs.some((output) =>
      String(output.id) === "final-notes"))
    expect(notes).toBeDefined()
    // lowerCurrentChangelog runs BEFORE lowerCurrentAnnouncements, so the
    // announcement binds the reviewed notes rather than refusing.
    const announcement = operations.find((operation) => operation._tag === "SmtpPublish")
    expect(announcement?.inputs.map(String)).toEqual(["final-notes"])
  })
})
