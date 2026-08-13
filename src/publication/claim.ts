import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { SubjectId } from "../model/authority.js"
import { Sha256Digest } from "../model/digest.js"
import { SafeReason } from "./report.js"

/** Exact immutable CAS key for one prepared mutation subject. */
export class PublicationClaimRequest
  extends Schema.Class<PublicationClaimRequest>("PublicationClaimRequest")({
    subject: SubjectId,
    preparedDigest: Sha256Digest
  }) {}

export class PublicationClaimUnavailable
  extends Schema.TaggedErrorClass<PublicationClaimUnavailable>()("PublicationClaimUnavailable", {
    subject: SubjectId,
    reason: SafeReason
  }) {}

export class PublicationClaimOccupied
  extends Schema.TaggedErrorClass<PublicationClaimOccupied>()("PublicationClaimOccupied", {
    subject: SubjectId,
    reason: SafeReason
  }) {}

export type PublicationClaimError = PublicationClaimUnavailable | PublicationClaimOccupied

export interface PublicationClaimStoreShape {
  /**
   * Atomically create one terminal claim. A successful call can never become
   * claimable again through lease expiry, process death, or local cleanup.
   * The implementation must be shared by every runner that can dispatch the
   * subject; process memory and runner-local files do not satisfy this seam.
   */
  readonly claim: (
    request: PublicationClaimRequest
  ) => Effect.Effect<void, PublicationClaimError>
}

export class PublicationClaimStore
  extends Context.Service<PublicationClaimStore, PublicationClaimStoreShape>()(
    "ts-release/PublicationClaimStore"
  ) {}

export const unavailablePublicationClaimStore: PublicationClaimStoreShape = {
  claim: (request) => Effect.fail(PublicationClaimUnavailable.make({
    subject: request.subject,
    reason: SafeReason.make("A shared durable terminal publication-claim store is not installed by this host.")
  }))
}
