import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import { ReleaseCliOptions, runReleaseCli } from "../src/cli/programmatic.js"
import { makeSystemScratchDirectory, removeScratchDirectory } from "./lib/scratch-workspace.js"

const root = process.cwd()
const examplesRoot = join(root, "examples")
const scratchPrefix = "ts-release-example-plans-"

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
  exampleName: string,
  outputDirectory: string
) {
  const exampleDirectory = join(examplesRoot, exampleName)
  const outputPath = join(outputDirectory, `${exampleName}.plan.txt`)

  yield* runReleaseCli([
    "plan",
    "--config",
    "release.config.json",
    "--format",
    "text",
    "--out",
    outputPath
  ], ReleaseCliOptions.make({ root: exampleDirectory }))

  const plan = yield* Effect.tryPromise({
    try: () => readFile(outputPath, "utf8"),
    catch: (cause) => cause
  })
  for (const snippet of expectedSnippets.get(exampleName) ?? []) {
    if (!plan.includes(snippet)) {
      return yield* Effect.fail(new Error(`Example ${exampleName} plan is missing expected snippet: ${snippet}`))
    }
  }
})

const main = Effect.fn("scripts.checkExamples")(function*() {
  const exampleNames = yield* readExampleNames()
  return yield* Effect.acquireUseRelease(
    makeSystemScratchDirectory(scratchPrefix),
    (outputDirectory) =>
      Effect.forEach(
        exampleNames,
        (exampleName) => runExamplePlan(exampleName, outputDirectory),
        { discard: true }
      ).pipe(Effect.as(exampleNames.length)),
    (outputDirectory) =>
      removeScratchDirectory(outputDirectory, {
        allowedPrefixes: [scratchPrefix]
      }).pipe(Effect.ignore)
  )
})

const checked = await Effect.runPromise(main().pipe(Effect.provide(BunServices.layer)))
console.log(`Checked ${checked} release examples`)
