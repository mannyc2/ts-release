declare global {
  const SchemaErrorTypeId: unique symbol
}
// The root is the intentionally small public lifecycle surface.
export { correct, inspect, makeReleaseApi, prepare, publish, release } from "./api/api.js"
export type {
  CorrectInput, InspectInput, InspectOutput, PrepareInput, PublishInput,
  PublicationCredentialsInput, ReleaseApi, ReleaseApiLayer, ReleaseInput
} from "./api/types.js"
export {
  PreparationModeUnsupported, ReleaseAbortedError, ReleaseIncompleteError,
  ReleaseInputError, ReleasePreparationError
} from "./api/errors.js"
export {
  CompletePreparedReleaseRef, GitHubActionsCompletePreparedReleaseRef,
  LocalCompletePreparedReleaseRef, PreparedReleaseRefCodecError,
  PreparedReleaseRefMalformedError, PreparedReleaseRefUnknownSchemeError,
  decodeCompletePreparedReleaseRef, encodeCompletePreparedReleaseRef
} from "./release/prepared-ref.js"
export type { PreparedReleaseSha256 } from "./release/prepared-ref.js"
export { ReleaseRuntime } from "./api/runtime.js"
export { unsupportedExecutionHost } from "./platform/host-support.js"
export { resolveConfig } from "./resolve/resolve.js"
export type { AuthoredConfig, AuthoredProject } from "./resolve/authored.js"
export type { ObservedFacts } from "./resolve/facts.js"
export { encodeResolvedConfig } from "./resolve/encode.js"
export const defineRelease = <const Config>(config: Config): Config => config
