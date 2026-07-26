import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { CandidateConfig, decodeConfig } from "../config/config.js"
import { lowerCurrentConfig } from "../current/lower.js"
import { PlanningFactsError } from "../model/errors.js"
import {
  Check,
  DigestOp,
  OutputDeclaration
} from "../model/operation.js"
import {
  ReleaseIdentityV6,
  ReleasePlanV6,
  ReleaseStages
} from "../model/plan.js"
import {
  NonEmptyName,
  OperationId,
  OutputId,
  RecipeId,
  SafeRelativePath,
  WorkspaceRoot
} from "../model/primitives.js"
import {
  DigestRecipe,
  StaticOutputRecipe,
  type RecipeDefinition
} from "../recipes/definition.js"
import { acceptPlan, encodePlanBytes } from "./accepted.js"

export class Invocation extends Schema.Class<Invocation>("Invocation")({
  workspace: WorkspaceRoot,
  commit: NonEmptyName,
  snapshot: Schema.Boolean
}) {}

export const validatePlanningFacts = Effect.fn("rewrite.validatePlanningFacts")(
  function*(invocation: Invocation) {
    if (!invocation.workspace.startsWith("/")) {
      return yield* PlanningFactsError.make({ reason: "Workspace must be canonical and absolute." })
    }
    return invocation
  }
)

export const recipeDefinitions = (config: CandidateConfig): ReadonlyArray<RecipeDefinition> => {
  const staticRecipes = (config.artifacts ?? []).map((artifact) =>
    StaticOutputRecipe.make({
      id: RecipeId.make(`artifact:${artifact.id}`),
      output: OutputDeclaration.make({
        id: artifact.id,
        path: artifact.path,
        kind: artifact.format === "tarball" || artifact.format === "zip"
          ? "archive"
          : artifact.format === "oci-image"
          ? "file"
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

export const lowerRecipes = Effect.fn("rewrite.lowerRecipes")(function*(
  definitions: ReadonlyArray<RecipeDefinition>
) {
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
})

export const finalizePlan = Effect.fn("rewrite.finalizePlan")(function*(
  config: CandidateConfig,
  invocation: Invocation,
  stages: ReleaseStages
) {
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
})

const minimalConfig = (config: CandidateConfig): boolean =>
  config.builds === undefined &&
  config.npmPackage === undefined &&
  config.pypiWheel === undefined &&
  config.archives === undefined &&
  config.catalogs === undefined &&
  config.hooks === undefined &&
  config.retry === undefined &&
  config.evidence === undefined &&
  Object.keys(config.publish).length === 0 &&
  Object.keys(config.project).every((key) => ["name", "version", "tag"].includes(key)) &&
  (config.artifacts ?? []).every((artifact) =>
    ["file", "directory", "executable"].includes(artifact.format) &&
    artifact.checksum === undefined &&
    artifact.variant === undefined)

export const compilePlan = Effect.fn("rewrite.compilePlan")(function*(
  input: unknown,
  invocation: Invocation
) {
  const config = yield* decodeConfig(input)
  const facts = yield* validatePlanningFacts(invocation)
  const stages = minimalConfig(config)
    ? yield* lowerRecipes(recipeDefinitions(config))
    : yield* lowerCurrentConfig(config)
  const plan = yield* finalizePlan(config, facts, stages)
  return yield* acceptPlan(encodePlanBytes(plan))
})
