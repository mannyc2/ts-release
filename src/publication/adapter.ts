import * as Effect from "effect/Effect"
import { SubjectId } from "../model/authority.js"
import {
  githubPublicationCapability,
  npmPublicationCapability
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
  bundle: PreparedBundle
) {
  const http = yield* HttpAuthorizer
  const mutationHttp = yield* AuthorizedMutationHttp
  const userConfigs = yield* NpmUserConfigResource
  const publisher = yield* CertifiedPublisherSpawn
  const subjects: Array<ReleaseSubject> = []
  const priorPublicationSubjects: Array<SubjectId> = []
  for (const publication of bundle.manifest.publications) {
    const moduleSubjects = publication._tag === "PreparedNpmPublication"
      ? npmPublicationCapability.subjects(bundle, publication, {
        http, mutationHttp, userConfigs, publisher
      })
      : githubPublicationCapability.subjects(bundle, publication, {
        http, mutationHttp, userConfigs, publisher
      })
    const registered = registerSubjects(
      publication._tag === "PreparedNpmPublication"
        ? npmPublicationCapability.profile
        : githubPublicationCapability.profile,
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
  return subjects as ReadonlyArray<ReleaseSubject>
})

/** Remote, read-only observation through the same provider subjects as publish. */
export const observePreparedRelease = Effect.fn("observePreparedRelease")(function*(
  bundle: PreparedBundle
) {
  const subjects = yield* subjectsForPreparedRelease(bundle)
  return yield* observeReleaseSubjects({ prepared: preparedSubject(bundle), subjects })
})

/** Dependency-ordered conservative publication through the shared coordinator. */
export const publishPreparedRelease = Effect.fn("publishPreparedRelease")(function*(
  bundle: PreparedBundle
) {
  const subjects = yield* subjectsForPreparedRelease(bundle)
  return yield* publishReleaseSubjects({ prepared: preparedSubject(bundle), subjects })
})
