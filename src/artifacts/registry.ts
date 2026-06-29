import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import type * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import { ArtifactRecipe } from "../domain/artifact.js"
import {
  ArtifactRecipeStageContext,
  ArtifactRecipeStageError,
  StagedArtifactRecipeResult
} from "./adapter.js"

export type * from "../types/effect-internal.js"

export class MissingArtifactRecipeAdapterError extends Schema.TaggedErrorClass<MissingArtifactRecipeAdapterError>()(
  "MissingArtifactRecipeAdapterError",
  {
    recipeTag: Schema.String
  }
) {}

export interface ArtifactRecipeRegistryShape {
  readonly stageArtifactRecipe: (
    recipe: ArtifactRecipe,
    context: ArtifactRecipeStageContext
  ) => Effect.Effect<StagedArtifactRecipeResult, MissingArtifactRecipeAdapterError | ArtifactRecipeStageError, Path.Path>
}

export class ArtifactRecipeRegistry extends Context.Service<
  ArtifactRecipeRegistry,
  ArtifactRecipeRegistryShape
>()("ArtifactRecipeRegistry") {}

export const stageArtifactRecipe = Effect.fn("stageArtifactRecipe")(function*(
  recipe: ArtifactRecipe,
  context: ArtifactRecipeStageContext
) {
  const registry = yield* ArtifactRecipeRegistry
  return yield* registry.stageArtifactRecipe(recipe, context)
})

export const stageAllArtifactRecipes = Effect.fn("stageAllArtifactRecipes")(function*(
  recipes: ReadonlyArray<ArtifactRecipe>,
  context: ArtifactRecipeStageContext
) {
  const results: Array<StagedArtifactRecipeResult> = []
  for (const recipe of recipes) {
    results.push(yield* stageArtifactRecipe(recipe, context))
  }
  return results
})
