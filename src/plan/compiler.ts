import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { CandidateConfig, decodeConfig } from "../config/config.js"
import { lowerCurrentConfig } from "../recipes/current.js"
import { Check, DigestOp, OutputDeclaration } from "../model/operation.js"
import { ReleaseIdentityV6, ReleasePlanV6, ReleaseStages } from "../model/plan.js"
import {
  NonEmptyName, OperationId, OutputId, RecipeId, SafeRelativePath, WorkspaceRoot
} from "../model/primitives.js"
import { DigestRecipe, StaticOutputRecipe, type RecipeDefinition } from "../recipes/definition.js"
import { acceptPlan, encodePlanBytes } from "./accepted.js"

export const decodePlanningConfig = decodeConfig

export class Invocation extends Schema.Class<Invocation>("Invocation")({
  workspace: WorkspaceRoot, commit: NonEmptyName, snapshot: Schema.Boolean
}) {}

export const recipeDefinitions = (config: CandidateConfig): ReadonlyArray<RecipeDefinition> => {
  const staticRecipes = (config.artifacts ?? []).map((artifact) =>
    StaticOutputRecipe.make({
      id: RecipeId.make(`artifact:${artifact.id}`),
      output: OutputDeclaration.make({
        id: artifact.id,
        path: artifact.path,
        kind: artifact.format === "tarball" || artifact.format === "zip"
          ? "archive"
          : artifact.format === "binary"
          ? "executable"
          : artifact.format,
        provenance: "import",
        ...(artifact.variant === undefined ? {} : { platform: artifact.variant })
      })
    }))
  if (config.checksum === undefined || staticRecipes.length === 0) return staticRecipes
  const path = (config.checksum.nameTemplate ?? "checksums-{version}.txt")
    .replaceAll("{name}", config.project.name)
    .replaceAll("{version}", config.project.version)
  return [
    ...staticRecipes,
    DigestRecipe.make({
      id: RecipeId.make("checksum"),
      inputs: [
        staticRecipes[0]!.output.id,
        ...staticRecipes.slice(1).map((recipe) => recipe.output.id)
      ],
      output: OutputDeclaration.make({
        id: OutputId.make("checksum"),
        path: SafeRelativePath.make(path),
        kind: "digest"
      }),
      algorithm: config.checksum.algorithm ?? "sha256"
    })
  ]
}

const lowerRecipes = (definitions: ReadonlyArray<RecipeDefinition>): ReleaseStages => {
  const build = definitions.flatMap((definition) =>
    definition._tag === "StaticOutputRecipe"
      ? [Check.make({
          id: OperationId.make(`check:${definition.id}`),
          inputs: [],
          outputs: [definition.output],
          path: definition.output.path
        })]
      : [])
  const process = definitions.flatMap((definition) =>
    definition._tag === "DigestRecipe"
      ? [DigestOp.make({
          id: OperationId.make(`digest:${definition.id}`),
          inputs: definition.inputs,
          outputs: [definition.output],
          algorithm: definition.algorithm
        })]
      : [])
  return ReleaseStages.make({
    build,
    process,
    catalog: [],
    validate: [],
    publish: [],
    announce: [],
    verify: []
  })
}

const finalizePlan = (
  config: CandidateConfig,
  invocation: Invocation,
  stages: ReleaseStages
): ReleasePlanV6 => {
  return ReleasePlanV6.make({
    schemaVersion: "release-plan/v6",
    identity: ReleaseIdentityV6.make({
      name: config.project.name,
      version: config.project.version,
      tag: config.project.tag,
      commit: NonEmptyName.make(config.project.commit ?? invocation.commit),
      snapshot: invocation.snapshot
    }),
    stages,
    annotations: []
  })
}

const minimalConfig = (config: CandidateConfig): boolean =>
  config.builds === undefined &&
  config.npmPackage === undefined &&
  config.archives === undefined &&
  config.catalogs === undefined &&
  Object.keys(config.publish ?? {}).length === 0 &&
  Object.keys(config.project).every((key) => ["name", "version", "tag"].includes(key)) &&
  (config.artifacts ?? []).every((artifact) =>
    ["file", "directory", "executable"].includes(artifact.format) &&
    artifact.checksum === undefined &&
    artifact.variant === undefined)

export const compilePlan = Effect.fn("compilePlan")(function*(
  input: unknown,
  invocation: Invocation
) {
  const config = yield* decodeConfig(input)
  const baseStages = minimalConfig(config)
    ? lowerRecipes(recipeDefinitions(config))
    : yield* lowerCurrentConfig(config)
  return yield* acceptPlan(encodePlanBytes(finalizePlan(config, invocation, baseStages)))
})
