import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { createHash } from "node:crypto"
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { makeBunReleaseWorkflowRuntimeLayer } from "../apps/release-ts/src/runtime.js"
import { formatPlanOperationSnapshot } from "../scripts/plan-operations-snapshot.js"
import { deferredContentArtifactIds } from "../src/grammar/content.js"
import { renderDeferredContent } from "../src/run/content.js"
import { build, planRelease, renderReleasePlan } from "../src/engine/engine.js"
import type { ReleasePlan } from "../src/grammar/plan.js"
import type { DeferredFileContent } from "../src/grammar/content.js"
import { runEffect, withTempDirectoryPromise } from "./helpers.js"
const root = process.cwd()
const exampleNames = [
  "agent-plugin",
  "github-release",
  "homebrew-tap",
  "multi-target",
  "npm-first-publish",
  "npm-only",
  "portable-cli",
  "pypi-registry",
  "scoop-bucket"
] as const
type ExampleName = typeof exampleNames[number]
interface RenderFixture {
  readonly operationId: string
  readonly fileName: string
}
const renderFixtures = new Map<ExampleName, ReadonlyArray<RenderFixture>>([
  ["agent-plugin", [{ operationId: "catalog:claude-marketplace:render", fileName: "marketplace.json" }]],
  ["homebrew-tap", [
    { operationId: "catalog:homebrew:render", fileName: "formula.rb" }
  ]],
  ["multi-target", [
    { operationId: "catalog:homebrew:render", fileName: "formula.rb" }
  ]],
  ["portable-cli", [
    { operationId: "catalog:homebrew:render", fileName: "formula.rb" },
    { operationId: "catalog:scoop:render", fileName: "manifest.json" }
  ]],
  ["scoop-bucket", [
    { operationId: "catalog:scoop:render", fileName: "manifest.json" }
  ]]
])
const updateGolden = process.env.UPDATE_GOLDEN === "1"
const fixturePath = (exampleName: ExampleName | "dogfood", fileName: string): string =>
  join(root, "test", "fixtures", "golden", exampleName, fileName)
const writeOrExpectFixture = (path: string, actual: string): void => {
  if (updateGolden) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, actual)
    return
  }
  expect(readFileSync(path, "utf8")).toBe(actual)
}
const currentExampleNames = (): ReadonlyArray<string> =>
  readdirSync(join(root, "examples"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, "examples", entry.name, "release.config.json")))
    .map((entry) => entry.name)
    .sort()
const planExample = (exampleName: ExampleName) => {
  const exampleDirectory = join(root, "examples", exampleName)
  return planRelease({
    workspace: exampleDirectory,
    config: "release.config.json"
  }).pipe(
    Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root: exampleDirectory }))
  )
}
const planDogfood = () =>
  planRelease({
    workspace: root,
    config: "apps/release-ts/release.config.json"
  }).pipe(
    Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root }))
  )
// v5 plans carry no machine-local facts (plan 169.1, D1/D3), so the durable document is
// already stable across machines and needs no root scrubbing — only the commit varies.
const stablePlanJson = (plan: ReleasePlan, stableCommit: boolean = true): string => {
  const encoded = JSON.parse(renderReleasePlan(plan, "json"))
  if (!stableCommit) {
    encoded.identity.commit = "<commit>"
    encoded.identity.shortCommit = "<short-commit>"
  }
  return `${JSON.stringify(encoded, null, 2)}\n`
}
const isDeferredFileContent = (value: unknown): value is DeferredFileContent =>
  typeof value === "object" &&
  value !== null &&
  "_tag" in value &&
  value._tag === "file-parts"
const sha256File = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex")
const stagedExampleArchiveHash = (exampleName: ExampleName, artifactPath: string): Promise<string> =>
  withTempDirectoryPromise("ts-release-golden-archive-", async (scratchRoot) => {
    const exampleRoot = join(root, "examples", exampleName)
    cpSync(join(exampleRoot, "plugin"), join(scratchRoot, "plugin"), { recursive: true })
    await runEffect(build({ workspace: scratchRoot, config: join(exampleRoot, "release.config.json") }),
      makeBunReleaseWorkflowRuntimeLayer({ root: scratchRoot })
    )
    return sha256File(join(scratchRoot, artifactPath))
  })
const resolvedPlanOperationContents = async (
  plan: ReleasePlan,
  exampleName: ExampleName,
  operationId: string
): Promise<string> => {
  const operation = plan.operations.find((candidate) => candidate.id === operationId)
  if (operation?.action._tag !== "write-file") {
    throw new Error(`Operation ${operationId} does not contain render contents.`)
  }
  const contents = operation.action.contents
  if (typeof contents === "string") {
    return contents
  }
  if (!isDeferredFileContent(contents)) {
    throw new Error(`Operation ${operationId} has unsupported deferred content.`)
  }
  const exampleRoot = join(root, "examples", exampleName)
  const hashes = new Map<string, string>()
  for (const artifactId of deferredContentArtifactIds(contents)) {
    const artifact = plan.artifacts.find((candidate) => candidate.id === artifactId)
    if (artifact === undefined) {
      throw new Error(`Artifact ${artifactId} was not found for operation ${operationId}.`)
    }
    const artifactPath = join(exampleRoot, artifact.path)
    if (existsSync(artifactPath)) {
      hashes.set(artifactId, sha256File(artifactPath))
    } else if (exampleName === "agent-plugin" && artifact.producedBy === "archive") {
      hashes.set(artifactId, await stagedExampleArchiveHash(exampleName, artifact.path))
    } else {
      throw new Error(`Artifact ${artifactId} is not available for operation ${operationId}.`)
    }
  }
  return renderDeferredContent(contents, hashes).contents
}

describe("golden plan corpus", () => {
  test("enumerates every example release config deliberately", () => {
    expect(currentExampleNames()).toEqual([...exampleNames].sort())
  })
  for (const exampleName of exampleNames) {
    test(`${exampleName} plan matches golden fixtures`, async () => {
      const plan = await runEffect(planExample(exampleName), makeBunReleaseWorkflowRuntimeLayer({
        root: join(root, "examples", exampleName)
      }))
      writeOrExpectFixture(fixturePath(exampleName, "ops.txt"), formatPlanOperationSnapshot(plan))
      writeOrExpectFixture(fixturePath(exampleName, "plan.txt"), renderReleasePlan(plan, "text"))
      writeOrExpectFixture(fixturePath(exampleName, "plan.md"), renderReleasePlan(plan, "markdown"))
      if (exampleName === "portable-cli" || exampleName === "multi-target") {
        writeOrExpectFixture(fixturePath(exampleName, "plan.json"), stablePlanJson(plan))
      }
      for (const fixture of renderFixtures.get(exampleName) ?? []) {
        writeOrExpectFixture(
          fixturePath(exampleName, fixture.fileName),
          await resolvedPlanOperationContents(plan, exampleName, fixture.operationId)
        )
      }
    })
  }

  test("dogfood plan has an exact canonical v4 JSON fixture", async () => {
    const plan = await runEffect(planDogfood(), makeBunReleaseWorkflowRuntimeLayer({ root }))
    writeOrExpectFixture(fixturePath("dogfood", "plan.json"), stablePlanJson(plan, false))
  })
})
