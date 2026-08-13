/**
 * Library/application-only provider composition. The stock CLI and Action do
 * not discover packages, import configured code, or install adapters from
 * serialized release configuration.
 */
export {
  ProviderAdapterContract,
  customProviderSubjects,
  makeProviderAdapter
} from "./extensions/provider-adapter.js"
export type {
  CustomProviderAdapter,
  CustomProviderAdapterInput
} from "./extensions/provider-adapter.js"
export type { PublicationSubjectServices } from "./capabilities/module.js"
export type {
  ReleaseObservationContext,
  ReleaseSubject
} from "./publication/coordinator.js"
export {
  conservativeUnknownRecoveryProfile,
  makeRecoveryCapabilityProfile
} from "./publication/recovery.js"
export type {
  PublicationProfileRegistration,
  RecoveryCapabilityProfile
} from "./publication/recovery.js"
export {
  SubjectId,
  CanonicalAudience,
  CredentialRef,
  CredentialRequest,
  ProviderId
} from "./model/authority.js"
export {
  AuthoritativelyAbsent,
  InconclusiveObservation,
  MutationPrecondition,
  NeedsMutation,
  OutcomeUnknown,
  PresentDifferent,
  PresentEquivalent,
  ProviderAlreadyEquivalent,
  ProviderBlocked,
  RejectedByProvider,
  SafeReason,
  Started
} from "./publication/report.js"
