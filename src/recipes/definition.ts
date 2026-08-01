import * as Schema from "effect/Schema"
import { OutputDeclaration } from "../model/operation.js"
import {
  OutputId,
  RecipeId
} from "../model/primitives.js"

export class StaticOutputRecipe
  extends Schema.TaggedClass<StaticOutputRecipe>()(
    "StaticOutputRecipe",
    {
      id: RecipeId,
      output: OutputDeclaration
    }
  )
{}

export class DigestRecipe extends Schema.TaggedClass<DigestRecipe>()(
  "DigestRecipe",
  {
    id: RecipeId,
    inputs: Schema.NonEmptyArray(OutputId),
    output: OutputDeclaration,
    algorithm: Schema.Literals(["sha256", "sha512"])
  }
) {}

export const RecipeDefinition = Schema.Union([StaticOutputRecipe, DigestRecipe])
export type RecipeDefinition = typeof RecipeDefinition.Type

