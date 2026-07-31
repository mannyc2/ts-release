// The root is the package's sole public TypeScript surface.
declare global {
  const SchemaErrorTypeId: unique symbol
}
export {
  apply,
  makeReleaseApi,
  plan,
  reviewExecution
} from "./api/api.js"
export {
  ReleaseApiError
} from "./api/errors.js"
export type {
  ApplyInput,
  ApplyOutput,
  ApplyStatus,
  EvidenceProjection,
  ExecutionScopeInput,
  ExecutionTopology,
  OperatorResolution,
  PlanInput,
  ReleaseApi,
  ReleaseApiLayer,
  ReviewerIdentity,
  ReviewExecutionInput
} from "./api/api.js"
export type {
  ReleasePlanV6
} from "./model/plan.js"
export type {
  ExecutionReviewId,
  OperationId,
  PlanId,
  PublishReviewId
} from "./model/primitives.js"
export type { Stage } from "./model/run.js"
export const defineRelease = <const Config>(config: Config): Config => config
