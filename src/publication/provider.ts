import * as Schema from "effect/Schema"
import { decodeUnknownSync } from "../model/decode.js"
import { NonEmptyName } from "../model/primitives.js"
import type { PreparedPublication } from "../release/prepared.js"
import type { PreparedBundle } from "../release/prepared-store.js"
import type { PublicationClaimStoreShape } from "./claim.js"
import type { ReleaseSubject } from "./coordinator.js"
import type {
  AuthorizedMutationHttpShape,
  HttpAuthorizerShape
} from "./http.js"
import type {
  CertifiedPublisherSpawnShape,
  NpmUserConfigResourceShape
} from "./publisher.js"
import {
  validatePublicationProfiles,
  validateRecoveryProfileSubjects,
  type PublicationProfileRegistration
} from "./recovery.js"

/** Opaque provider services supplied only by the default or custom host layer. */
export interface PublicationSubjectServices {
  readonly http: HttpAuthorizerShape
  readonly mutationHttp: AuthorizedMutationHttpShape
  readonly userConfigs: NpmUserConfigResourceShape
  readonly publisher: CertifiedPublisherSpawnShape
  readonly claims: PublicationClaimStoreShape
}

/**
 * Closed acknowledgements required from every provider adapter, first- or
 * third-party. They are intentionally precise rather than extensible strings:
 * a boolean success callback or generic command publisher cannot satisfy this
 * contract.
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

/** The single provider dispatch key: a prepared publication's durable tag. */
export type PreparedPublicationTag = PreparedPublication["_tag"]

/**
 * The one publication the dispatcher can hand an adapter registered for Tag.
 * A tag outside the durable prepared union resolves to never: such an adapter
 * composes and validates today, and becomes dispatchable only when a
 * prepared-release schema event opens the union to its tag.
 */
export type PublicationForTag<Tag extends string> = Extract<PreparedPublication, { readonly _tag: Tag }>

export interface ProviderAdapterInput<Tag extends string> {
  readonly contract: ProviderAdapterContract
  readonly profile: PublicationProfileRegistration<Tag>
  /**
   * Derive typed subjects for one prepared publication of the registered tag,
   * from the verified bundle and opaque host sinks. Dispatch is total over
   * the manifest: every dispatched publication must yield at least one
   * subject.
   */
  subjects(
    bundle: PreparedBundle,
    publication: PublicationForTag<Tag>,
    services: PublicationSubjectServices
  ): ReadonlyArray<ReleaseSubject>
}

/**
 * The one provider contract. Tag appears only covariantly (the registered
 * prepared tag), so a tagged adapter composes into the heterogeneous
 * `ReadonlyArray<ProviderAdapter>` set. The stored `subjects` is typed over
 * the whole durable union because one field must hold every adapter; the
 * dispatcher owns the invariant the set type cannot state — subjects is only
 * ever called with a publication whose `_tag` equals `profile.preparedTag`,
 * and `makeProviderAdapter`'s input keeps authoring narrowed to that tag.
 */
export interface ProviderAdapter<Tag extends string = string> {
  readonly _tag: "ProviderAdapter"
  readonly id: NonEmptyName
  readonly contract: ProviderAdapterContract
  readonly profile: PublicationProfileRegistration<Tag>
  subjects(
    bundle: PreparedBundle,
    publication: PreparedPublication,
    services: PublicationSubjectServices
  ): ReadonlyArray<ReleaseSubject>
}

const decodeContract = decodeUnknownSync(ProviderAdapterContract, {
  onExcessProperty: "error"
})

/**
 * Validate once at composition time; the adapter identity is its registration
 * id, so a mismatch between the two is unrepresentable.
 */
export const makeProviderAdapter = <const Tag extends string>(
  input: ProviderAdapterInput<Tag>
): ProviderAdapter<Tag> => {
  const contract = decodeContract(input.contract)
  const profile = validatePublicationProfiles({ [input.profile.id]: input.profile })[input.profile.id]!
  return Object.freeze({
    _tag: "ProviderAdapter" as const,
    id: NonEmptyName.make(profile.id),
    contract,
    profile,
    subjects: input.subjects
  })
}

/**
 * Index a composed adapter set by prepared tag, refusing colliding
 * registrations — including a third-party adapter shadowing a first-party
 * one — before any provider operation.
 */
export const indexProviderAdapters = (
  adapters: ReadonlyArray<ProviderAdapter>
): ReadonlyMap<string, ProviderAdapter> => {
  const index = new Map<string, ProviderAdapter>()
  const ids = new Set<string>()
  for (const adapter of adapters) {
    if (ids.has(adapter.profile.id)) {
      throw new Error(`Provider adapters repeat registration id ${adapter.profile.id}.`)
    }
    if (index.has(adapter.profile.preparedTag)) {
      throw new Error(`Provider adapters repeat prepared publication tag ${adapter.profile.preparedTag}.`)
    }
    ids.add(adapter.profile.id)
    index.set(adapter.profile.preparedTag, adapter)
  }
  return index
}

/**
 * The one subject-validation path for every dispatched adapter: at least one
 * subject per prepared publication, exact registered recovery behavior,
 * credential authority confined to the registered provider, and globally
 * unique subject identity. Coordinator construction performs the final
 * request identity, audience, purpose, mutation, prerequisite, and
 * durable-history checks.
 */
export const validateProviderSubjects = (
  adapter: ProviderAdapter,
  subjects: ReadonlyArray<ReleaseSubject>,
  usedIds: Set<string>
): void => {
  validateRecoveryProfileSubjects(
    adapter.profile.id,
    adapter.profile.recovery,
    subjects.map((subject) => subject.recovery)
  )
  for (const subject of subjects) {
    if (usedIds.has(subject.id.toString())) {
      throw new Error(`Provider adapter ${adapter.profile.id} repeats subject ${subject.id}.`)
    }
    if (subject.observationRequests.some((request) => request.provider.toString() !== adapter.profile.provider) ||
        subject.mutationRequest.provider.toString() !== adapter.profile.provider) {
      throw new Error(`Provider adapter ${adapter.profile.id} emitted credential authority for a foreign provider.`)
    }
    usedIds.add(subject.id.toString())
  }
}
