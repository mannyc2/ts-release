import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import { readdir } from "node:fs/promises"
import { join } from "node:path"
import { ReleaseCliOptions, runReleaseCli } from "../src/cli/programmatic.js"
import { makeSystemScratchDirectory, removeScratchDirectory } from "./lib/scratch-workspace.js"

const root = process.cwd()
const examplesRoot = join(root, "examples")
const scratchPrefix = "ts-release-example-plans-"

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
