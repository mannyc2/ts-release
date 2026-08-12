import * as Layer from "effect/Layer"
import type { ReleaseRuntimeShape } from "./api/runtime.js"
import { ReleaseRuntime } from "./api/runtime.js"
import type { ReleaseApiLayer } from "./api/types.js"
import type { RunCommand } from "./drivers/process.js"
import { Sha256Digest, sha256Digest } from "./model/digest.js"
import type { CredentialRequest } from "./model/authority.js"
import {
  CredentialAudienceMismatch,
  CredentialProvider,
  CredentialPurposeMismatch,
  CredentialStrategyUnsupported,
  CredentialSubjectMismatch,
  CredentialUnavailable,
  makeCredentialProvider,
  type CredentialAuthorityError,
  type CredentialGrant,
  type CredentialGrantAcquirer,
  type CredentialGrantDescriptor,
  type CredentialProviderShape,
  type MutationCredentialGrant
} from "./publication/authority.js"
import {
  HttpAuthorizer,
  type HttpAuthorizationError,
  type HttpAuthorizerShape,
  type HttpObservationRequest,
  type HttpResponse
} from "./publication/http.js"
import {
  ReleaseContextError,
  makeSourceObserver,
  type SourceObserverRuntime,
  type SourceObserverShape,
  type VerifiedReleaseContext
} from "./release/context.js"
import {
  PreparedReleaseStore,
  type PreparedReleaseStoreShape
} from "./release/prepared-store.js"

export {
  CredentialAudienceMismatch,
  CredentialPurposeMismatch,
  CredentialStrategyUnsupported,
  CredentialSubjectMismatch,
  CredentialUnavailable,
  ReleaseContextError,
  Sha256Digest,
  makeCredentialProvider,
  makeSourceObserver,
  sha256Digest
}

export type {
  CredentialAuthorityError,
  CredentialGrant,
  CredentialGrantAcquirer,
  CredentialGrantDescriptor,
  CredentialProviderShape,
  CredentialRequest,
  HttpAuthorizationError,
  HttpAuthorizerShape,
  HttpObservationRequest,
  HttpResponse,
  MutationCredentialGrant,
  ReleaseRuntimeShape,
  RunCommand,
  SourceObserverRuntime,
  SourceObserverShape,
  VerifiedReleaseContext
}

/** Structural inputs for a library-owned host integration. */
export interface CustomReleaseLayerInput {
  readonly runtime: ReleaseRuntimeShape
  readonly preparedStore: PreparedReleaseStoreShape
  readonly credentialProvider: CredentialProviderShape
  readonly httpAuthorizer: HttpAuthorizerShape
}

/**
 * Compose the complete API service boundary without exposing Context service
 * tags. Credentials remain opaque grants and HTTP authorization remains a
 * host-owned elimination boundary.
 */
export const makeCustomReleaseLayer = (
  input: CustomReleaseLayerInput
): ReleaseApiLayer => Layer.mergeAll(
  Layer.succeed(ReleaseRuntime, input.runtime),
  Layer.succeed(PreparedReleaseStore, input.preparedStore),
  Layer.succeed(CredentialProvider, input.credentialProvider),
  Layer.succeed(HttpAuthorizer, input.httpAuthorizer)
)
