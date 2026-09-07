export type {} from "@mannyc1/ts-release"
export {
  TokenAuthorization,
  TrustedAuthorization,
  Authorization,
  ProvenanceSource,
  NoProvenance,
  GitHubActionsProvenance,
  Provenance,
  PublishIntent,
  DistTagIntent,
  PrivatePackage,
  PublicPackage,
  PackageCandidate,
  type AttestationRequest,
  type Attest,
  type VerifyProvenance,
  PackageMetadata,
} from "./Model.js"
export { publish, distTag, author, definitions, inspectTarball } from "./Protocol.js"
export {
  authorizeToken,
  authorizeTrusted,
  makeSigstoreAttester,
  makeSigstoreVerifier,
  type SigstoreTrustOptions,
  createProvenance,
} from "./Auth.js"
