import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { SubjectId } from "../model/authority.js"
import {
  githubPublicationCapability,
  catalogPublicationCapability,
  npmPublicationCapability,
  pyPiPublicationCapability
} from "../capabilities/registry.js"
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
  validateRecoveryProfileSubjects,
  type PublicationProfileRegistration
} from "./recovery.js"
import {
  PublicationClaimStore,
  unavailablePublicationClaimStore
} from "./claim.js"
import { customProviderSubjects, type CustomProviderAdapter } from "../extensions/provider-adapter.js"
export { installedPublicationProfiles } from "./profiles.js"

const registerSubjects = (
  registration: PublicationProfileRegistration,
  subjects: ReadonlyArray<ReleaseSubject>
): ReadonlyArray<ReleaseSubject> => {
  validateRecoveryProfileSubjects(
    registration.id,
    registration.recovery,
    subjects.map((subject) => subject.recovery)
  )
  return subjects
}

const preparedSubject = (bundle: PreparedBundle): SubjectId => SubjectId.make(
  `prepared:sha256-${sha256(encodePreparedRelease(bundle.manifest))}`
)

/**
 * Construct provider subjects only after the caller has loaded and verified
 * the complete prepared bundle. The host authorizer is captured as an opaque
 * sink; transports and credential values never enter the subject contract.
 */
export const subjectsForPreparedRelease = Effect.fn("subjectsForPreparedRelease")(function*(
  bundle: PreparedBundle,
  adapters: ReadonlyArray<CustomProviderAdapter> = []
) {
  const http = yield* HttpAuthorizer
  const mutationHttp = yield* AuthorizedMutationHttp
  const userConfigs = yield* NpmUserConfigResource
  const publisher = yield* CertifiedPublisherSpawn
  const claimOption = yield* Effect.serviceOption(PublicationClaimStore)
  const claims = Option.getOrElse(claimOption, () => unavailablePublicationClaimStore)
  const subjects: Array<ReleaseSubject> = []
  const priorPublicationSubjects: Array<SubjectId> = []
  const services = { http, mutationHttp, userConfigs, publisher, claims }
  for (const publication of bundle.manifest.publications) {
    const moduleSubjects = publication._tag === "PreparedNpmPublication"
      ? npmPublicationCapability.subjects(bundle, publication, services)
      : publication._tag === "PreparedPyPiPublication"
      ? pyPiPublicationCapability.subjects(bundle, publication, services)
      : publication._tag === "PreparedGitHubPublication"
      ? githubPublicationCapability.subjects(bundle, publication, services)
      : catalogPublicationCapability.subjects(bundle, publication, services)
    const registered = registerSubjects(
      publication._tag === "PreparedNpmPublication"
        ? npmPublicationCapability.profile
        : publication._tag === "PreparedPyPiPublication"
        ? pyPiPublicationCapability.profile
        : publication._tag === "PreparedGitHubPublication"
        ? githubPublicationCapability.profile
        : catalogPublicationCapability.profile,
      moduleSubjects
    )
    const ordered = registered.map((subject): ReleaseSubject => priorPublicationSubjects.length === 0
      ? subject
      : {
          ...subject,
          prerequisites: [...new Set([
            ...(subject.prerequisites ?? []),
            ...priorPublicationSubjects
          ])]
        })
    subjects.push(...ordered)
    priorPublicationSubjects.push(...registered.map((subject) => subject.id))
  }
  const custom = customProviderSubjects(
    bundle,
    adapters,
    services,
    new Set([preparedSubject(bundle).toString(), ...priorPublicationSubjects.map((id) => id.toString())])
  ).map((subject): ReleaseSubject => priorPublicationSubjects.length === 0
    ? subject
    : {
        ...subject,
        prerequisites: [...new Set([
          ...(subject.prerequisites ?? []),
          ...priorPublicationSubjects
        ])]
      })
  subjects.push(...custom)
  return subjects as ReadonlyArray<ReleaseSubject>
})

/** Remote, read-only observation through the same provider subjects as publish. */
export const observePreparedRelease = Effect.fn("observePreparedRelease")(function*(
  bundle: PreparedBundle,
  adapters: ReadonlyArray<CustomProviderAdapter> = []
) {
  const subjects = yield* subjectsForPreparedRelease(bundle, adapters)
  return yield* observeReleaseSubjects({ prepared: preparedSubject(bundle), subjects })
})

/** Dependency-ordered conservative publication through the shared coordinator. */
export const publishPreparedRelease = Effect.fn("publishPreparedRelease")(function*(
  bundle: PreparedBundle,
  adapters: ReadonlyArray<CustomProviderAdapter> = []
) {
  const subjects = yield* subjectsForPreparedRelease(bundle, adapters)
  return yield* publishReleaseSubjects({ prepared: preparedSubject(bundle), subjects })
})
