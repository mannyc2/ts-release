import * as Schema from "effect/Schema"
import { NonEmptyName } from "../model/primitives.js"
import type { ReleaseSubject } from "../publication/coordinator.js"
import {
  assertRecoveryProfileMatches,
  validatePublicationProfiles,
  type PublicationProfileRegistration
} from "../publication/recovery.js"
import type { PublicationSubjectServices } from "../capabilities/module.js"
import type { PreparedBundle } from "../release/prepared-store.js"

/**
 * Closed acknowledgements required from every custom application adapter.
 * They are intentionally precise rather than extensible strings: a boolean
 * success callback or generic command publisher cannot satisfy this contract.
 */
export class ProviderAdapterContract
  extends Schema.Class<ProviderAdapterContract>("ProviderAdapterContract")({
    schemaVersion: Schema.Literal("ts-release/provider-adapter-contract/v1"),
    preparedSubject: Schema.Literal("typed-canonical-data"),
    identity: Schema.Literal("canonical-subject-id"),
    observation: Schema.Literal("exact-equality-and-authoritative-absence"),
    mutation: Schema.Literal("typed-precondition-and-commitment"),
    credentials: Schema.Literal("audience-and-purpose-scoped"),
    recovery: Schema.Literal("coordinator-profile"),
    certification: Schema.Literal("provider-protocol-and-public-boundary-tests")
  }) {}

export interface CustomProviderAdapterInput {
  readonly id: string
  readonly contract: ProviderAdapterContract
  readonly profile: PublicationProfileRegistration
  /**
   * Derive typed subjects only from a verified prepared bundle and opaque host
   * sinks. Returning no subject means this installed application adapter does
   * not apply to that bundle.
   */
  readonly subjects: (
    bundle: PreparedBundle,
    services: PublicationSubjectServices
  ) => ReadonlyArray<ReleaseSubject>
}

export interface CustomProviderAdapter extends Omit<CustomProviderAdapterInput, "id"> {
  readonly _tag: "CustomProviderAdapter"
  readonly id: NonEmptyName
}

const decodeContract = Schema.decodeUnknownSync(ProviderAdapterContract, {
  onExcessProperty: "error"
})

/** Validate once at custom-application composition time. */
export const makeProviderAdapter = (input: CustomProviderAdapterInput): CustomProviderAdapter => {
  const contract = decodeContract(input.contract)
  const id = NonEmptyName.make(input.id)
  const profile = validatePublicationProfiles({ [id.toString()]: input.profile })[id.toString()]!
  if (profile.id !== id.toString()) {
    throw new Error("A custom provider adapter id must equal its recovery-profile registration id.")
  }
  return Object.freeze({
    _tag: "CustomProviderAdapter" as const,
    ...input,
    id,
    contract,
    profile
  })
}

/**
 * Build custom subjects behind the same profile and identity checks used by
 * built-ins. Coordinator construction performs the final request identity,
 * audience, purpose, mutation, prerequisite, and durable-history checks.
 */
export const customProviderSubjects = (
  bundle: PreparedBundle,
  adapters: ReadonlyArray<CustomProviderAdapter>,
  services: PublicationSubjectServices,
  reservedIds: ReadonlySet<string> = new Set()
): ReadonlyArray<ReleaseSubject> => {
  const result: Array<ReleaseSubject> = []
  const ids = new Set(reservedIds)
  for (const adapter of adapters) {
    const subjects = adapter.subjects(bundle, services)
    for (const subject of subjects) {
      if (ids.has(subject.id.toString())) {
        throw new Error(`Custom provider adapter ${adapter.id} repeats subject ${subject.id}.`)
      }
      assertRecoveryProfileMatches(adapter.profile.id, adapter.profile.recovery, subject.recovery)
      if (subject.observationRequests.some((request) => request.provider.toString() !== adapter.profile.provider) ||
          subject.mutationRequest.provider.toString() !== adapter.profile.provider) {
        throw new Error(`Custom provider adapter ${adapter.id} emitted credential authority for a foreign provider.`)
      }
      ids.add(subject.id.toString())
      result.push(subject)
    }
  }
  return result
}
