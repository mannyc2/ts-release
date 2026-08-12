declare global {
  const SchemaErrorTypeId: unique symbol
}
// The root is the intentionally small public lifecycle surface.
export {
  CorrectionReport,
  correct,
  inspect,
  makeReleaseApi,
  observe,
  prepare,
  publish,
  release
} from "./api/api.js"
export type {
  CorrectInput,
  InspectInput,
  InspectOutput,
  ObserveInput,
  PrepareInput,
  PublishInput,
  ReleaseApi,
  ReleaseApiLayer,
  ReleaseInput,
  ReleaseResult
} from "./api/types.js"
export {
  PreparationModeUnsupported, ReleaseAbortedError, ReleaseIncompleteError,
  ReleaseInputError, ReleasePreparationError
} from "./api/errors.js"
export {
  CredentialStrategyUnsupported,
  CredentialUnavailable
} from "./publication/authority.js"
export {
  CredentialFailureCause,
  CredentialStrategyUnsupportedCause,
  CredentialUnavailableCause,
  ObservationReport,
  ReleaseReport
} from "./publication/report.js"
export {
  CompletePreparedReleaseRef, GitHubActionsCompletePreparedReleaseRef,
  LocalCompletePreparedReleaseRef, PreparedReleaseRefCodecError,
  PreparedReleaseRefMalformedError, PreparedReleaseRefUnknownSchemeError,
  decodeCompletePreparedReleaseRef, encodeCompletePreparedReleaseRef,
  makeGitHubActionsCompletePreparedReleaseRef, makeLocalCompletePreparedReleaseRef
} from "./release/prepared-ref.js"
export type { PreparedReleaseSha256 } from "./release/prepared-ref.js"
export { ReleaseRuntime } from "./api/runtime.js"
export { unsupportedExecutionHost } from "./platform/host-support.js"
export { resolveConfig } from "./resolve/resolve.js"
export type { AuthoredConfig, AuthoredProject } from "./resolve/authored.js"
export type { ObservedFacts } from "./resolve/facts.js"
export { encodeResolvedConfig } from "./resolve/encode.js"
export const defineRelease = <const Config>(config: Config): Config => config
