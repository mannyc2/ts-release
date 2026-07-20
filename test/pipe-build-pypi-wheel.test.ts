import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { parseReleaseIntent } from "../src/config/load.js"
import { pypiWheelPlanner } from "../src/features/build/pypi-wheel.js"
import { resolveRelease } from "../src/resolve/resolved-release.js"
import type { Operation, StageAction } from "../src/grammar/operation.js"
import { emptyPlanAccumulator } from "../src/grammar/accumulator.js"
import { makePipelineIdentity, releaseConfig, releaseIdentity } from "./helpers.js"

const identity = makePipelineIdentity()

type StageOperation = Operation & { readonly action: StageAction }

const isStageArtifactOperation = (operation: Operation): operation is StageOperation =>
  operation.action._tag === "stage"

const wheelFamily = {
  packageName: "release",
  moduleName: "release",
  consoleScript: "release",
  requiresPython: ">=3.8",
  wheels: [
    {
      id: "wheel-linux",
      path: "dist/release-{version}.whl",
      wheelTag: "py3-none-manylinux2014_x86_64",
      binaries: []
    }
  ]
}

const planWheels = (
  projectOverrides: Record<string, unknown>,
  publish: Record<string, unknown> = {}
) =>
  Effect.gen(function*() {
    const config = yield* parseReleaseIntent(releaseConfig({
      identity: releaseIdentity(projectOverrides),
      artifacts: [],
      pypiWheel: wheelFamily,
      publish
    }))
    const wheels = Option.getOrThrow(resolveRelease(config, identity).pypiWheels)
    return yield* pypiWheelPlanner(wheels, emptyPlanAccumulator(identity))
  })

describe("PyPI wheel build pipe", () => {
  it.effect("emits wheel artifacts and staging operations from family and project facts", () =>
    Effect.gen(function*() {
      const contribution = yield* planWheels({
        description: "Release CLI.",
        homepage: "https://example.com",
        license: "MIT"
      })
      const operation = contribution.operations.find(isStageArtifactOperation)

      expect(contribution.artifacts[0]).toMatchObject({
        id: "wheel-linux",
        kind: "wheel",
        path: "dist/release-0.1.0.whl"
      })
      expect(operation?.action.intent).toMatchObject({
        _tag: "pypi-wheel",
        outfile: "dist/release-0.1.0.whl",
        packageName: "release",
        moduleName: "release",
        consoleScript: "release",
        requiresPython: ">=3.8",
        summary: "Release CLI.",
        homepage: "https://example.com",
        license: "MIT"
      })
    }))
  it.effect("prefers project.summary over project.description for the wheel summary", () =>
    Effect.gen(function*() {
      const contribution = yield* planWheels({
        description: "Portable distribution for release.",
        summary: "Release CLI.",
        homepage: "https://example.com",
        license: "MIT"
      })
      const operation = contribution.operations.find(isStageArtifactOperation)
      expect(operation?.action.intent).toMatchObject({ summary: "Release CLI." })
    }))
  it.effect("derives the wheel homepage from the GitHub repository", () =>
    Effect.gen(function*() {
      const contribution = yield* planWheels(
        { description: "Release CLI.", license: "MIT" },
        { github: { repository: "owner/release" } }
      )
      const operation = contribution.operations.find(isStageArtifactOperation)
      expect(operation?.action.intent).toMatchObject({ homepage: "https://github.com/owner/release" })
    }))
  it.effect("requires the project summary, homepage, and license facts", () =>
    Effect.gen(function*() {
      const summaryError = yield* planWheels({ homepage: "https://example.com", license: "MIT" }).pipe(Effect.flip)
      expect(summaryError).toMatchObject({
        _tag: "PlanError",
        pipeId: "build:pypi-wheel",
        field: "project.summary"
      })
      const homepageError = yield* planWheels({ description: "Release CLI.", license: "MIT" }).pipe(Effect.flip)
      expect(homepageError).toMatchObject({
        _tag: "PlanError",
        pipeId: "build:pypi-wheel",
        field: "project.homepage"
      })
      const licenseError = yield* planWheels({ description: "Release CLI.", homepage: "https://example.com" })
        .pipe(Effect.flip)
      expect(licenseError).toMatchObject({
        _tag: "PlanError",
        pipeId: "build:pypi-wheel",
        field: "project.license"
      })
    }))
})
