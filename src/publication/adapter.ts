import * as Effect from "effect/Effect"
import { SubjectId } from "../model/authority.js"
import { encodePreparedRelease } from "../release/prepared.js"
import type { PreparedBundle } from "../release/prepared-store.js"
import { sha256 } from "../drivers/utils.js"
import {
  observeReleaseSubjects,
  publishReleaseSubjects,
  type ReleaseSubject
} from "./coordinator.js"
import { makeGithubSubjects } from "./github.js"
import { HttpAuthorizer } from "./http.js"
import { makeNpmSubject } from "./npm.js"

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
  const subjects: Array<ReleaseSubject> = []
  for (const publication of bundle.manifest.publications) {
    if (publication._tag === "PreparedNpmPublication") {
      subjects.push(makeNpmSubject(bundle, publication, http))
    } else {
      subjects.push(...makeGithubSubjects(bundle, publication, http))
    }
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
