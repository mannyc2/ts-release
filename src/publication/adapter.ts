import * as Effect from "effect/Effect"
import type { PreparedGitHubPublication, PreparedNpmPublication } from "../release/prepared.js"
import type { PreparedBundle } from "../release/prepared-store.js"
import { makeGithubSubjects } from "./github.js"
import { makeNpmSubject, type NpmPublishProcess } from "./npm.js"
import type { PublicationHttp } from "./http.js"
import {
  PublicationConverged, PublicationError, type PublicationCredentials, type PublicationOutcome,
  publishSubject, type PublicationSubject
} from "./observation.js"

export type PreparedPublicationCredentials = {
  readonly npm: PublicationCredentials
  readonly github: PublicationCredentials
}
export type PreparedPublicationAdapterInput = {
  readonly bundle: PreparedBundle
  readonly http: PublicationHttp
  readonly credentials: PreparedPublicationCredentials
  readonly npmProcess: NpmPublishProcess
}

export const subjectsForPreparedRelease = (input: PreparedPublicationAdapterInput): ReadonlyArray<PublicationSubject> =>
  input.bundle.manifest.publications.flatMap((publication) => publication._tag === "PreparedNpmPublication"
    ? [makeNpmSubject(input.bundle, publication as PreparedNpmPublication, input.http, input.credentials.npm, input.npmProcess)]
    : makeGithubSubjects(input.bundle, publication as PreparedGitHubPublication, input.http, input.credentials.github))

/** Runs subjects in dependency order; a blocked release prevents its assets from uploading. */
export const publishPreparedRelease = Effect.fn("publishPreparedRelease")(function*(input: PreparedPublicationAdapterInput) {
  const outcomes: PublicationOutcome[] = []
  for (const subject of subjectsForPreparedRelease(input)) {
    const outcome = yield* publishSubject(subject)
    outcomes.push(outcome)
    if (outcome._tag !== "PublicationConverged") return outcomes
  }
  return outcomes
})

export { PublicationConverged, PublicationError }
