import * as Effect from "effect/Effect"
import type * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import {
  ArtifactId,
  ArtifactRecipe,
  ArtifactRecipeId
} from "../domain/artifact.js"
import { ReleaseIdentity } from "../domain/release.js"

export type * from "../types/effect-internal.js"

export interface ArtifactRecipeStageContext {
  readonly root: string
  readonly identity: ReleaseIdentity
  readonly configPath?: string | undefined
}

export class StagedArtifact extends Schema.Class<StagedArtifact>("StagedArtifact")({
  id: ArtifactId,
  path: Schema.String
}) {}

export class StagedArtifactRecipeResult extends Schema.Class<StagedArtifactRecipeResult>(
  "StagedArtifactRecipeResult"
)({
  recipeId: ArtifactRecipeId,
  recipeTag: Schema.String,
  artifacts: Schema.Array(StagedArtifact)
}) {}

export class ArtifactRecipeStageError extends Schema.TaggedErrorClass<ArtifactRecipeStageError>()(
  "ArtifactRecipeStageError",
  {
    recipeId: ArtifactRecipeId,
    recipeTag: Schema.String,
    artifactId: Schema.optionalKey(ArtifactId),
    path: Schema.optionalKey(Schema.String),
    reason: Schema.String,
    cause: Schema.optionalKey(Schema.Defect())
  }
) {}

export interface ArtifactRecipeAdapter<Recipe extends ArtifactRecipe> {
  readonly recipeTag: Recipe["_tag"]
  readonly stage: (
    recipe: Recipe,
    context: ArtifactRecipeStageContext
  ) => Effect.Effect<StagedArtifactRecipeResult, ArtifactRecipeStageError, Path.Path>
}
