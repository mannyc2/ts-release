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
// The services makeReleaseApi composes. Exported as tags plus shapes so a host
// or a test can build a ReleaseApiLayer from its own implementations, and as
// ReleaseServicesLive for everything but the two host capabilities.
export { ApprovalSigner } from "./apply/approval.js"
export type { ApprovalSignerShape } from "./apply/approval.js"
export { RunStore } from "./apply/store.js"
export type { RunStoreShape } from "./apply/store.js"
export { CredentialStore, DriverCatalog, WorkspaceStore } from "./drivers/services.js"
export type {
  CredentialStoreShape,
  DriverCatalogShape,
  WorkspaceStoreShape
} from "./drivers/services.js"
// ApprovalSignerShape returns permits, which are constructible only through
// these classes, so an implementable shape has to carry them.
export { ExecutionPermit, PublishPermit } from "./model/permit.js"
export { ReleaseServicesLive } from "./platform/services.js"
export const defineRelease = <const Config>(config: Config): Config => config
