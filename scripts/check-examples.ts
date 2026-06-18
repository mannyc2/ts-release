import * as Effect from "effect/Effect"
import { readdir } from "node:fs/promises"
import { join } from "node:path"
import { makeBunReleaseWorkflowRuntimeLayer } from "../src/runtime/bun.js"
import { PlanReleaseConfigOptions, renderReleaseConfigPlan } from "../src/workflows/config.js"

const root = process.cwd()
const examplesRoot = join(root, "examples")
const expectedSnippets = new Map<string, ReadonlyArray<string>>([
  ["github-release", [
    "[GitHubReleaseTarget]",
    "github:gh-release-dry-run",
    "github:gh-release-create"
  ]],
  ["homebrew-tap", [
    "[HomebrewTapTarget]",
    "homebrew:homebrew-render-formula",
    "write: .release/generated/"
  ]],
  ["multi-target", [
    "targets: 3",
    "[GitHubReleaseTarget]",
    "[NpmRegistryTarget]",
    "[HomebrewTapTarget]",
    "gate: execute"
  ]],
  ["non-strict-skips", [
    "strategy=skipped",
    "Record skipped GitHub release dry-run validation"
  ]],
  ["npm-only", [
    "[NpmRegistryTarget]",
    "npm:npm-pack-dry-run",
    "npm:npm-publish"
  ]],
  ["npm-first-publish", [
    "[NpmRegistryTarget]",
    "auth=env-token",
    "npm:npm-whoami",
    "npm:npm-publish"
  ]],
  ["pypi-registry", [
    "[PyPiRegistryTarget]",
    "pypi:twine-check",
    "pypi:twine-upload",
    "python -m twine upload --repository-url https://test.pypi.org/legacy/"
  ]],
  ["scoop-bucket", [
    "[ScoopBucketTarget]",
    "scoop:scoop-render-manifest",
    "scoop:scoop-push",
    "write: .release/generated/"
  ]]
])

const readExampleNames = Effect.fn("scripts.readExampleNames")(function*() {
  const entries = yield* Effect.tryPromise({
    try: () => readdir(examplesRoot, { withFileTypes: true }),
    catch: (cause) => cause
  })
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
})

const runExamplePlan = Effect.fn("scripts.runExamplePlan")(function*(
  exampleName: string
) {
  const exampleDirectory = join(examplesRoot, exampleName)
  const plan = yield* renderReleaseConfigPlan(
    PlanReleaseConfigOptions.make({
      root: exampleDirectory,
      configPath: "release.config.json",
      format: "text"
    })
  ).pipe(
    Effect.provide(makeBunReleaseWorkflowRuntimeLayer({ root: exampleDirectory }))
  )
  for (const snippet of expectedSnippets.get(exampleName) ?? []) {
    if (!plan.includes(snippet)) {
      return yield* Effect.fail(new Error(`Example ${exampleName} plan is missing expected snippet: ${snippet}`))
    }
  }
})

const main = Effect.fn("scripts.checkExamples")(function*() {
  const exampleNames = yield* readExampleNames()
  return yield* Effect.forEach(
    exampleNames,
    runExamplePlan,
    { discard: true }
  ).pipe(Effect.as(exampleNames.length))
})

const checked = await Effect.runPromise(main())
console.log(`Checked ${checked} release examples`)
