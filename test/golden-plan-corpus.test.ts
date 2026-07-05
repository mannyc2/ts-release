import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { makeBunReleaseWorkflowRuntimeLayer } from "../apps/release-ts/src/runtime.js"
import { formatPlanOperationSnapshot } from "../scripts/plan-operations-snapshot.js"
import { deferredContentArtifactIds, renderDeferredContent } from "../src/engine/content.js"
import { planRelease, renderReleasePlan } from "../src/engine/engine.js"
import type { ReleasePlanDocument } from "../src/engine/plan-document.js"
import type { DeferredFileContent } from "../src/pipeline/operation.js"
import { runEffect } from "./helpers.js"

const root = process.cwd()

const exampleNames = [
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
  ["homebrew-tap", [
    { operationId: "homebrew:homebrew-render-formula", fileName: "formula.rb" }
  ]],
  ["multi-target", [
    { operationId: "homebrew:homebrew-render-formula", fileName: "formula.rb" }
  ]],
  ["portable-cli", [
    { operationId: "homebrew:homebrew-render-formula", fileName: "formula.rb" },
    { operationId: "scoop:scoop-render-manifest", fileName: "manifest.json" }
  ]],
  ["scoop-bucket", [
    { operationId: "scoop:scoop-render-manifest", fileName: "manifest.json" }
  ]]
])

const updateGolden = process.env.UPDATE_GOLDEN === "1"

const fixturePath = (exampleName: ExampleName, fileName: string): string =>
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
    root: exampleDirectory,
    configPath: "release.config.json",
    format: "text"
  }).pipe(
    Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root: exampleDirectory }))
  )
}

const isDeferredFileContent = (value: unknown): value is DeferredFileContent =>
  typeof value === "object" &&
  value !== null &&
  "_tag" in value &&
  (value._tag === "homebrew-formula" || value._tag === "scoop-manifest")

const sha256File = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex")

const resolvedPlanOperationContents = (
  plan: ReleasePlanDocument,
  exampleName: ExampleName,
  operationId: string
): string => {
  const operation = plan.state.operations.find((candidate) => candidate.id === operationId)
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
    const artifact = plan.state.artifacts.artifacts.find((candidate) => candidate.id === artifactId)
    if (artifact === undefined) {
      throw new Error(`Artifact ${artifactId} was not found for operation ${operationId}.`)
    }
    hashes.set(artifactId, sha256File(join(exampleRoot, artifact.path)))
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

      for (const fixture of renderFixtures.get(exampleName) ?? []) {
        writeOrExpectFixture(
          fixturePath(exampleName, fixture.fileName),
          resolvedPlanOperationContents(plan, exampleName, fixture.operationId)
        )
      }
    })
  }
})
