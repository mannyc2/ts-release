import * as Schema from "effect/Schema"
import { OutputDeclaration, WireContract } from "../model/operation.js"
import {
  OutputId,
  ProfileId,
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

const genericUploadProfile = WireContract.make({
  profileId: ProfileId.make("http.generic-upload/v1"),
  contractFixtureId: "contract.http.generic-upload/v1",
  baseUrl: "https://uploads.example.invalid",
  pathTemplate: "/artifacts/{name}",
  responseShapeId: "empty-v1",
  pagination: "none",
  commitment: "status-2xx",
  reconciliation: "get-same-resource"
})

export const profileRegistry = Object.freeze({
  "http.generic-upload/v1": Object.freeze(genericUploadProfile)
})
export type RegisteredProfileId = keyof typeof profileRegistry

export const lowerProfile = (id: RegisteredProfileId): WireContract =>
  WireContract.make({ ...profileRegistry[id] })
