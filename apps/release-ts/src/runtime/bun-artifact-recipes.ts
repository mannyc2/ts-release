import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import {
  ArtifactRecipeAdapter,
  ArtifactRecipeStageContext,
  ArtifactRecipeStageError,
  StagedArtifact,
  StagedArtifactRecipeResult
} from "../../../../src/artifacts/adapter.js"
import {
  ArtifactRecipeRegistry,
  MissingArtifactRecipeAdapterError
} from "../../../../src/artifacts/registry.js"
import {
  BunExecutableArtifactRecipe,
  PyPiWheelArtifactRecipe
} from "../../../../src/domain/artifact.js"
import { renderReleaseTemplate } from "../../../../src/planner/normalize-release.js"
import { stagePyPiWheelArtifactRecipe } from "./pypi-wheel-artifact-recipes.js"

export interface BunExecutableBuildInput {
  readonly entrypoint: string
  readonly target: Bun.Build.CompileTarget
  readonly outfile: string
  readonly minify?: boolean | undefined
}

export interface BunExecutableBuildOutput {
  readonly success: boolean
  readonly logs: ReadonlyArray<unknown>
}

export type BunExecutableBuild = (
  input: BunExecutableBuildInput
) => Promise<BunExecutableBuildOutput>

export const liveBunExecutableBuild: BunExecutableBuild = (input) =>
  Bun.build({
    entrypoints: [input.entrypoint],
    ...(input.minify === undefined ? {} : { minify: input.minify }),
    compile: {
      target: input.target,
      outfile: input.outfile
    }
  })

const logsReason = (
  logs: ReadonlyArray<unknown>,
  fallback: string
): string => {
  const reason = logs.map((log) => String(log)).join("\n").trim()
  return reason.length === 0 ? fallback : reason
}

const hasParentTraversal = (pathName: string): boolean =>
  pathName.split(/[\\/]+/).includes("..")

const isInsideRoot = (path: Path.Path, root: string, target: string): boolean => {
  const rootPath = path.resolve(root)
  const relative = path.relative(rootPath, target)
  return relative.length === 0 || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

const resolveStagePath = (
  path: Path.Path,
  recipe: BunExecutableArtifactRecipe,
  context: ArtifactRecipeStageContext,
  pathName: string,
  artifactId?: string | undefined
): Effect.Effect<string, ArtifactRecipeStageError> => {
  const trimmed = pathName.trim()
  if (trimmed.length === 0 || path.isAbsolute(pathName) || hasParentTraversal(pathName)) {
    return Effect.fail(
      ArtifactRecipeStageError.make({
        recipeId: recipe.id,
        recipeTag: recipe._tag,
        ...(artifactId === undefined ? {} : { artifactId }),
        path: pathName,
        reason: "Recipe paths must be non-empty, relative, and must not contain parent traversal."
      })
    )
  }
  const resolved = path.resolve(context.root, pathName)
  if (!isInsideRoot(path, context.root, resolved)) {
    return Effect.fail(
      ArtifactRecipeStageError.make({
        recipeId: recipe.id,
        recipeTag: recipe._tag,
        ...(artifactId === undefined ? {} : { artifactId }),
        path: pathName,
        reason: "Recipe paths must resolve inside the workspace root."
      })
    )
  }
  return Effect.succeed(resolved)
}

const stageBunExecutableArtifactRecipe = (
  build: BunExecutableBuild
) => Effect.fn("BunExecutableArtifactRecipe.stage")(function*(
  recipe: BunExecutableArtifactRecipe,
  context: ArtifactRecipeStageContext
) {
  const path = yield* Path.Path
  const entrypoint = yield* resolveStagePath(path, recipe, context, recipe.entrypoint)
  const staged: Array<StagedArtifact> = []

  for (const output of recipe.outputs) {
    const renderedPath = renderReleaseTemplate(output.path, context.identity)
    const outfile = yield* resolveStagePath(path, recipe, context, renderedPath, output.id)
    const buildOutput = yield* Effect.tryPromise({
      try: () =>
        build({
          entrypoint,
          target: output.target,
          outfile,
          ...(recipe.minify === undefined ? {} : { minify: recipe.minify })
        }),
      catch: (cause) =>
        ArtifactRecipeStageError.make({
          recipeId: recipe.id,
          recipeTag: recipe._tag,
          artifactId: output.id,
          path: renderedPath,
          reason: `Bun.build rejected while compiling ${output.id}.`,
          cause
        })
    })

    if (!buildOutput.success) {
      return yield* Effect.fail(
        ArtifactRecipeStageError.make({
          recipeId: recipe.id,
          recipeTag: recipe._tag,
          artifactId: output.id,
          path: renderedPath,
          reason: logsReason(buildOutput.logs, `Bun.build failed for ${output.id}.`)
        })
      )
    }

    staged.push(StagedArtifact.make({
      id: output.id,
      path: renderedPath
    }))
  }

  return StagedArtifactRecipeResult.make({
    recipeId: recipe.id,
    recipeTag: recipe._tag,
    artifacts: staged
  })
})

export const makeBunArtifactRecipeAdapter = (
  build: BunExecutableBuild = liveBunExecutableBuild
): ArtifactRecipeAdapter<BunExecutableArtifactRecipe> => ({
  recipeTag: "BunExecutableArtifactRecipe",
  stage: stageBunExecutableArtifactRecipe(build)
})

const stageBunRecipe = (
  build: BunExecutableBuild,
  recipe: BunExecutableArtifactRecipe,
  context: ArtifactRecipeStageContext
) => makeBunArtifactRecipeAdapter(build).stage(recipe, context)

const stagePyPiWheelRecipe = (
  recipe: PyPiWheelArtifactRecipe,
  context: ArtifactRecipeStageContext
) => stagePyPiWheelArtifactRecipe(recipe, context)

export const makeBunArtifactRecipeRegistryLayer = (
  build: BunExecutableBuild = liveBunExecutableBuild
) =>
  Layer.succeed(ArtifactRecipeRegistry)({
    stageArtifactRecipe: (recipe, context) => {
      const recipeTag: string = recipe._tag
      switch (recipe._tag) {
        case "BunExecutableArtifactRecipe":
          return stageBunRecipe(build, recipe, context)
        case "PyPiWheelArtifactRecipe":
          return stagePyPiWheelRecipe(recipe, context)
      }
      return Effect.fail(
        MissingArtifactRecipeAdapterError.make({
          recipeTag
        })
      )
    }
  })

export const LiveBunArtifactRecipeRegistryLayer = makeBunArtifactRecipeRegistryLayer()
