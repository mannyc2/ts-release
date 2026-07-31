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

const productProfile = (kind: string, contractFixtureId: string) =>
  Object.freeze({ kind, contractFixtureId, registration: "product-immutable" as const })
export const profileRegistry = Object.freeze({
  "http.generic-upload/v1": Object.freeze(genericUploadProfile),
  "build.bun-compile/v1": productProfile("process", "contract.build.bun-compile/v1"),
  "build.command/v1": productProfile("process", "contract.build.command/v1"),
  "build.pypi-wheel/v1": productProfile("process", "contract.build.pypi-wheel/v1"),
  "process.hook/v1": productProfile("process", "contract.process.hook/v1"),
  "catalog.git-publish/v1": productProfile("opaque-publish", "contract.catalog.git/v1"),
  "registry.npm-publish/v1": productProfile("package-release", "contract.registry.npm/v1"),
  "registry.pypi-publish/v1": productProfile("package-release", "contract.registry.pypi/v1"),
  "forge.github-release/v1": productProfile("forge-release", "contract.forge.github/v1"),
  "opaque.publish-command/v1": productProfile("opaque-publish", "contract.opaque.publish/v1")
})
export type RegisteredProfileId = "http.generic-upload/v1"

export const lowerProfile = (id: RegisteredProfileId): WireContract =>
  WireContract.make({ ...profileRegistry[id] as WireContract })
