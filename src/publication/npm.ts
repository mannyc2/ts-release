import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { createHash } from "node:crypto"
import type { PreparedBundle } from "../release/prepared-store.js"
import type { PreparedNpmPublication } from "../release/prepared.js"
import { NonEmptyName } from "../model/primitives.js"
import { authHeaders, bodyJson, type PublicationHttp } from "./http.js"
import {
  Conflict, Equivalent, Inconclusive, NeedsMutation, ObservationDifference, OutcomeUnknown,
  Applied, PublicationError, type PublicationCredentials, type PublicationSubject, Rejected, type MutationResult, type Observation
} from "./observation.js"

export type NpmPublishRequest = {
  readonly registryUrl: string, readonly packageName: string, readonly version: string,
  readonly bytes: Uint8Array, readonly credential: string
}
export type NpmPublishProcess = {
  readonly publish: (request: NpmPublishRequest) => Effect.Effect<{ readonly started: boolean, readonly exitCode: number }, PublicationError>
}

export class NpmSubjectError
  extends Schema.TaggedErrorClass<NpmSubjectError>()("NpmSubjectError", { reason: Schema.String }) {}

const integrity = (bytes: Uint8Array): string => `sha512-${createHash("sha512").update(bytes).digest("base64")}`
const shasum = (bytes: Uint8Array): string => createHash("sha1").update(bytes).digest("hex")
const registryVersionUrl = (publication: PreparedNpmPublication): string =>
  `${publication.registryUrl.replace(/\/$/u, "")}/${encodeURIComponent(publication.packageName)}/${encodeURIComponent(publication.version)}`
const stringValue = (value: unknown): string | undefined => typeof value === "string" && value.length > 0 ? value : undefined
const registryFacts = (value: unknown): { readonly integrity?: string, readonly shasum?: string } | undefined => {
  if (typeof value !== "object" || value === null) return undefined
  const dist = (value as { readonly dist?: unknown }).dist
  if (typeof dist !== "object" || dist === null) return undefined
  const integrityValue = stringValue((dist as { readonly integrity?: unknown }).integrity)
  const shasumValue = stringValue((dist as { readonly shasum?: unknown }).shasum)
  return integrityValue === undefined && shasumValue === undefined ? undefined : {
    ...(integrityValue === undefined ? {} : { integrity: integrityValue }),
    ...(shasumValue === undefined ? {} : { shasum: shasumValue })
  }
}

export const makeNpmSubject = (
  bundle: PreparedBundle, publication: PreparedNpmPublication, http: PublicationHttp,
  credentials: PublicationCredentials, process: NpmPublishProcess
): PublicationSubject => {
  const artifact = bundle.manifest.artifacts.find((item) => item.id === publication.artifactId)
  const bytes = artifact === undefined ? undefined : bundle.blobs.get(artifact.id.toString())
  const subject = NonEmptyName.make(`npm:${publication.registryUrl}:${publication.packageName}@${publication.version}`)
  const expectedIntegrity = bytes === undefined ? undefined : integrity(bytes)
  const expectedShasum = bytes === undefined ? undefined : shasum(bytes)
  const url = registryVersionUrl(publication)
  return {
    id: subject,
    observe: (): Effect.Effect<Observation, PublicationError> => Effect.gen(function*() {
      if (bytes === undefined || artifact === undefined) return yield* new PublicationError({ phase: "observe", commitment: "before-dispatch", reason: `Prepared npm artifact ${publication.artifactId} is unavailable.` })
      const response = yield* http.request({ method: "GET", url, headers: authHeaders(credentials.read) })
      if (response.status === 404) return NeedsMutation.make({ subject, precondition: NonEmptyName.make("version-absent") })
      if (response.status < 200 || response.status >= 300) return Inconclusive.make({ subject, reason: `Registry observation returned HTTP ${response.status}.` })
      let facts: { readonly integrity?: string, readonly shasum?: string } | undefined
      try { facts = registryFacts(bodyJson(response)) } catch (cause) {
        return Inconclusive.make({ subject, reason: cause instanceof Error ? cause.message : String(cause) })
      }
      if (facts === undefined) return Inconclusive.make({ subject, reason: "Registry metadata omitted both integrity and shasum." })
      const differences: ObservationDifference[] = []
      if (facts.integrity !== undefined && facts.integrity !== expectedIntegrity) differences.push(ObservationDifference.make({ field: NonEmptyName.make("integrity"), expected: expectedIntegrity!, observed: facts.integrity }))
      if (facts.shasum !== undefined && facts.shasum !== expectedShasum) differences.push(ObservationDifference.make({ field: NonEmptyName.make("shasum"), expected: expectedShasum!, observed: facts.shasum }))
      return differences.length === 0 ? Equivalent.make({ subject }) : Conflict.make({ subject, differences })
    }).pipe(Effect.catchTag("PublicationError", (cause) => Effect.succeed(Inconclusive.make({ subject, reason: cause.reason })))),
    mutate: (needs): Effect.Effect<MutationResult, PublicationError> => Effect.gen(function*() {
      if (needs.precondition !== "version-absent" || bytes === undefined) return yield* Effect.fail(new PublicationError({ phase: "mutate", commitment: "before-dispatch", reason: "npm mutation lacks the exact absence precondition or bytes." }))
      const result = yield* process.publish({ registryUrl: publication.registryUrl, packageName: publication.packageName.toString(), version: publication.version.toString(), bytes, credential: credentials.publish })
      if (!result.started) return Rejected.make({ subject, phase: "before-dispatch", reason: "npm publish process did not start." })
      if (result.exitCode === 0) return Applied.make({ subject, detail: "npm publish exited successfully." })
      return Rejected.make({ subject, phase: "provider", reason: `npm publish exited ${result.exitCode}.` })
    }).pipe(Effect.catchTag("PublicationError", (cause) => cause.commitment === "before-dispatch"
      ? Effect.succeed<MutationResult>(Rejected.make({ subject, phase: "before-dispatch", reason: cause.reason }))
      : Effect.succeed<MutationResult>(OutcomeUnknown.make({ subject, reason: cause.reason })))) as Effect.Effect<MutationResult, PublicationError>
  }
}
