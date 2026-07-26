import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { CandidateConfig, decodeConfig } from "../config/config.js"
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
import { acceptPlan, encodePlanBytes } from "./accept.js"

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
        kind: artifact.format
      })
    }))
  if (config.checksum === undefined || staticRecipes.length === 0) return staticRecipes
  const path = config.checksum.nameTemplate.replaceAll("{version}", config.project.version)
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
      algorithm: config.checksum.algorithm
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
      commit: invocation.commit,
      snapshot: invocation.snapshot
    }),
    stages,
    annotations: []
  })
})

export const compilePlan = Effect.fn("rewrite.compilePlan")(function*(
  input: unknown,
  invocation: Invocation
) {
  const config = yield* decodeConfig(input)
  const facts = yield* validatePlanningFacts(invocation)
  const stages = yield* lowerRecipes(recipeDefinitions(config))
  const plan = yield* finalizePlan(config, facts, stages)
  return yield* acceptPlan(encodePlanBytes(plan))
})
