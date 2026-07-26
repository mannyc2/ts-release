import { describe, expect, test } from "@effect/bun-test"
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { makeBunReleaseWorkflowRuntimeLayer } from "../../apps/release-ts/src/runtime.js"
import { encodeCanonicalJson } from "../../scripts/lib/canonical-json.js"
import { countSourceTree } from "../../scripts/lib/source-budget.js"
import { parseStrictJson } from "../../scripts/lib/strict-json.js"
import { planRelease } from "../../src/engine/engine.js"
import { runEffect } from "../helpers.js"
import {
  behaviorFromLegacyPlan,
  decodeBehaviorContract,
  encodeBehaviorContract
} from "./behavior-contract.js"

const root = process.cwd()
const updateGolden = process.env.UPDATE_REWRITE_GOLDEN === "1"
const examples = readdirSync(join(root, "examples"), { withFileTypes: true })
  .filter((entry) =>
    entry.isDirectory() &&
    existsSync(join(root, "examples", entry.name, "release.config.json")))
  .map((entry) => entry.name)
  .sort()
const additions = ["command-builder", "prebuilt-builder"] as const

const plan = (workspace: string, config: string) =>
  runEffect(
    planRelease({ workspace, config }),
    makeBunReleaseWorkflowRuntimeLayer({ root: workspace })
  )

const behaviorBytes = async (workspace: string, config: string): Promise<string> => {
  const document = await plan(workspace, config)
  return encodeCanonicalJson(encodeBehaviorContract(behaviorFromLegacyPlan(document, workspace)))
}

describe("representation-neutral current behavior oracle", () => {
  test("legacy adapter is total across the incumbent example corpus", async () => {
    expect(examples).toEqual([
      "agent-plugin",
      "github-release",
      "homebrew-tap",
      "multi-target",
      "npm-first-publish",
      "npm-only",
      "portable-cli",
      "pypi-registry",
      "scoop-bucket"
    ])
    for (const name of examples) {
      const workspace = join(root, "examples", name)
      const bytes = await behaviorBytes(workspace, "release.config.json")
      const contract = decodeBehaviorContract(parseStrictJson(bytes))
      expect(contract.outcome).toBe("planned")
      expect(bytes).not.toContain("fingerprint")
      expect(bytes).not.toContain("\"operationId\"")
      expect(bytes).not.toContain("\"className\"")
    }
  })

  for (const name of additions) {
    test(`${name} has a supplementary immutable behavior golden`, async () => {
      const actual = await behaviorBytes(root, `test/fixtures/rewrite/oracle/${name}.json`)
      const path = join(root, "test", "fixtures", "golden", name, "behavior.json")
      if (updateGolden) {
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, actual)
      } else {
        expect(readFileSync(path, "utf8")).toBe(actual)
      }
      expect(decodeBehaviorContract(parseStrictJson(actual)).outputs).toHaveLength(1)
    })
  }

  test("every frozen M0 product surface has an oracle mapping", async () => {
    const report = await countSourceTree(root, "M0")
    const oracle = parseStrictJson(readFileSync(
      join(root, "contracts", "rewrite", "oracle.json"),
      "utf8"
    )) as { readonly sourceSurfaces: ReadonlyArray<{ readonly path: string }> }
    expect(oracle.sourceSurfaces.map((surface) => surface.path).sort()).toEqual(
      report.files
        .filter((file) => file.lane === "product")
        .map((file) => file.path)
        .sort()
    )
  })
})
