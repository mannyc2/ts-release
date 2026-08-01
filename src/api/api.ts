import * as Effect from "effect/Effect"
import * as ManagedRuntime from "effect/ManagedRuntime"
import { executionReviewId } from "../apply/approval.js"
import { NonEmptyName } from "../model/primitives.js"
import { compilePlan, decodePlanningConfig, Invocation } from "../plan/compiler.js"
import { NodeReleaseLayer } from "../platform/node.js"
import { makeApply } from "./apply-boundary.js"
import {
  exact,
  selectScope,
  topology,
  workspace,
  type ApiRun
} from "./input.js"
import { acceptExpected } from "../plan/review.js"
import { ReleaseApiError, type ReleaseApiPhase } from "./errors.js"
import type {
  PlanInput,
  ReleaseApi,
  ReleaseApiLayer,
  ReleaseApiServices,
  ReviewExecutionInput
} from "./types.js"

export type {
  ApplyInput, ApplyOutput, ApplyStatus, EvidenceProjection, ExecutionScopeInput, ExecutionTopology,
  OperatorResolution, PlanInput, ReleaseApi, ReleaseApiLayer, ReleaseApiServices, ReviewerIdentity,
  ReviewExecutionInput
} from "./types.js"

const decoder = new TextDecoder()
export const makeReleaseApi = (layer: ReleaseApiLayer): ReleaseApi => {
  const runtime = ManagedRuntime.make(layer)
  const run: ApiRun = <A, E>(
    phase: ReleaseApiPhase,
    effect: Effect.Effect<A, E, ReleaseApiServices>
  ) => runtime.runPromise(effect).catch((cause) => {
    throw ReleaseApiError.from(phase, cause)
  })
  const plan = async (input: PlanInput) => {
    exact("plan", input, ["config", "workspace"], "plan input")
    const config = await run("plan", decodePlanningConfig(input.config))
    const root = workspace("plan", input.workspace)
    const result = await run("plan", compilePlan(input.config, Invocation.make({
      workspace: root,
      commit: NonEmptyName.make(config.project.commit ?? "unknown"),
      snapshot: false
    })))
    return { plan: result.plan, bytes: decoder.decode(result.bytes), planId: result.planId }
  }
  const reviewExecution = async (input: ReviewExecutionInput) => {
    exact("review", input, ["planBytes", "expectedPlanId", "scope", "topology"], "review input")
    const accepted = await run("review", acceptExpected(input.planBytes, input.expectedPlanId))
    const scope = selectScope(accepted, input.scope)
    return {
      scope,
      executionReviewId: executionReviewId(accepted, scope, topology(input.topology))
    }
  }
  return Object.freeze({
    plan,
    reviewExecution,
    apply: makeApply(run),
    dispose: () => runtime.dispose()
  })
}

// The convenience singletons bind to the Node boundary, which is correct on
// both shipped hosts: Bun runs it through Node compatibility. A host that wants
// its own platform composes makeReleaseApi with an exported layer instead.
const defaultApi = makeReleaseApi(NodeReleaseLayer)
export const plan = defaultApi.plan
export const reviewExecution = defaultApi.reviewExecution
export const apply = defaultApi.apply
