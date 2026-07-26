import { describe, expect, test } from "@effect/bun-test"
import type {
  BuildOp,
  HttpPublish
} from "../../src/rewrite/model/operation.js"
import type { ReleasePlanV6 } from "../../src/rewrite/model/plan.js"
import type {
  CredentialName,
  OperationId,
  OutputId,
  PlanId,
  RecipeId,
  SafeRelativePath
} from "../../src/rewrite/model/primitives.js"
import { AcceptedPlan } from "../../src/rewrite/plan/accept.js"

declare const operationId: OperationId
declare const outputId: OutputId
declare const planId: PlanId
declare const recipeId: RecipeId
declare const credential: CredentialName
declare const path: SafeRelativePath
declare const publish: HttpPublish

// @ts-expect-error operation and output ids are nominally distinct
const wrongOutput: OutputId = operationId
// @ts-expect-error plan and recipe ids are nominally distinct
const wrongRecipe: RecipeId = planId
// @ts-expect-error credentials cannot be used as paths
const wrongPath: SafeRelativePath = credential
// @ts-expect-error paths cannot be used as credential names
const wrongCredential: CredentialName = path
// @ts-expect-error remote publication cannot inhabit the build-stage union
const wrongBuild: BuildOp = publish
// @ts-expect-error accepted capabilities have no public constructor
const minted = new AcceptedPlan(undefined, undefined, undefined, undefined)
// @ts-expect-error raw plans require all seven fixed stages
const incompletePlan: ReleasePlanV6 = { schemaVersion: "release-plan/v6" }

void wrongOutput
void wrongRecipe
void wrongPath
void wrongCredential
void wrongBuild
void minted
void incompletePlan
void outputId
void recipeId

describe("v6 compile-time contract", () => {
  test("negative assertions are checked by tsc", () => {
    expect(typeof AcceptedPlan.accept).toBe("function")
  })
})
