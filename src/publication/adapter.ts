import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { SubjectId } from "../model/authority.js"
import { encodePreparedRelease } from "../release/prepared.js"
import type { PreparedBundle } from "../release/prepared-store.js"
import { sha256 } from "../drivers/utils.js"
import {
  observeReleaseSubjects,
  publishReleaseSubjects,
  type ReleaseSubject
} from "./coordinator.js"
import { AuthorizedMutationHttp, HttpAuthorizer } from "./http.js"
import {
  CertifiedPublisherSpawn,
  NpmUserConfigResource
} from "./publisher.js"
import {
  PublicationClaimStore,
  unavailablePublicationClaimStore
} from "./claim.js"
import {
  indexProviderAdapters,
  validateProviderSubjects,
  type ProviderAdapter
} from "./provider.js"

const preparedSubject = (bundle: PreparedBundle): SubjectId => SubjectId.make(
  `prepared:sha256-${sha256(encodePreparedRelease(bundle.manifest))}`
)

/**
 * Construct provider subjects only after the caller has loaded and verified
 * the complete prepared bundle. Dispatch is total over the manifest: every
 * prepared publication resolves through the one composed adapter registered
 * for its tag, or the release refuses by name — the subject set is a function
 * of the durable manifest, never of which adapters happen to be absent. The
 * host authorizer is captured as an opaque sink; transports and credential
 * values never enter the subject contract.
 */
export const subjectsForPreparedRelease = Effect.fn("subjectsForPreparedRelease")(function*(
  bundle: PreparedBundle,
  adapters: ReadonlyArray<ProviderAdapter>
) {
  const index = indexProviderAdapters(adapters)
  const http = yield* HttpAuthorizer
  const mutationHttp = yield* AuthorizedMutationHttp
  const userConfigs = yield* NpmUserConfigResource
  const publisher = yield* CertifiedPublisherSpawn
  const claimOption = yield* Effect.serviceOption(PublicationClaimStore)
  const claims = Option.getOrElse(claimOption, () => unavailablePublicationClaimStore)
  const services = { http, mutationHttp, userConfigs, publisher, claims }
  const subjects: Array<ReleaseSubject> = []
  const priorPublicationSubjects: Array<SubjectId> = []
  const usedIds = new Set([preparedSubject(bundle).toString()])
  for (const publication of bundle.manifest.publications) {
    const adapter = index.get(publication._tag)
    if (adapter === undefined) {
      throw new Error(`No composed provider adapter is registered for prepared publication ${publication._tag}.`)
    }
    const derived = adapter.subjects(bundle, publication, services)
    validateProviderSubjects(adapter, derived, usedIds)
    const ordered = derived.map((subject): ReleaseSubject => priorPublicationSubjects.length === 0
      ? subject
      : {
          ...subject,
          prerequisites: [...new Set([
            ...(subject.prerequisites ?? []),
            ...priorPublicationSubjects
          ])]
        })
    subjects.push(...ordered)
    priorPublicationSubjects.push(...derived.map((subject) => subject.id))
  }
  return subjects as ReadonlyArray<ReleaseSubject>
})

/** Remote, read-only observation through the same provider subjects as publish. */
export const observePreparedRelease = Effect.fn("observePreparedRelease")(function*(
  bundle: PreparedBundle,
  adapters: ReadonlyArray<ProviderAdapter>
) {
  const subjects = yield* subjectsForPreparedRelease(bundle, adapters)
  return yield* observeReleaseSubjects({ prepared: preparedSubject(bundle), subjects })
})

/** Dependency-ordered conservative publication through the shared coordinator. */
export const publishPreparedRelease = Effect.fn("publishPreparedRelease")(function*(
  bundle: PreparedBundle,
  adapters: ReadonlyArray<ProviderAdapter>
) {
  const subjects = yield* subjectsForPreparedRelease(bundle, adapters)
  return yield* publishReleaseSubjects({ prepared: preparedSubject(bundle), subjects })
})
