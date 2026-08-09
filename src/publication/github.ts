import * as Effect from "effect/Effect"
import { sha256 } from "../drivers/utils.js"
import type { PreparedBundle } from "../release/prepared-store.js"
import type { PreparedGitHubAsset, PreparedGitHubPublication } from "../release/prepared.js"
import { NonEmptyName } from "../model/primitives.js"
import { authHeaders, bodyJson, type PublicationHttp } from "./http.js"
import {
  Applied, Conflict, Equivalent, Inconclusive, NeedsMutation, ObservationDifference,
  OutcomeUnknown, PublicationError, Rejected, type MutationResult, type Observation, type PublicationCredentials, type PublicationSubject, type NeedsMutation as NeedsMutationValue
} from "./observation.js"

type ReleaseAsset = {
  readonly name: string, readonly size: number, readonly contentType: string,
  readonly digest?: string, readonly downloadUrl?: string
}
type ReleaseFacts = {
  readonly id: number, readonly uploadUrl: string, readonly tag: string, readonly target: string,
  readonly title: string, readonly body: string, readonly draft: boolean, readonly prerelease: boolean,
  readonly assets: ReadonlyArray<ReleaseAsset>
}
const asObject = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
const asString = (value: unknown): string | undefined => typeof value === "string" ? value : undefined
const asNumber = (value: unknown): number | undefined => typeof value === "number" && Number.isSafeInteger(value) ? value : undefined
const asBoolean = (value: unknown): boolean | undefined => typeof value === "boolean" ? value : undefined
const parseAsset = (value: unknown): ReleaseAsset | undefined => {
  const object = asObject(value)
  if (object === undefined) return undefined
  const name = object === undefined ? undefined : asString(object.name)
  const size = object === undefined ? undefined : asNumber(object.size)
  const contentType = object === undefined ? undefined : asString(object.content_type)
  if (name === undefined || size === undefined || contentType === undefined) return undefined
  const digest = asString(object.digest)
  const downloadUrl = asString(object.browser_download_url)
  return { name, size, contentType, ...(digest === undefined ? {} : { digest }), ...(downloadUrl === undefined ? {} : { downloadUrl }) }
}
const parseRelease = (value: unknown): ReleaseFacts | undefined => {
  const object = asObject(value)
  if (object === undefined) return undefined
  const id = asNumber(object.id), uploadUrl = asString(object.upload_url), tag = asString(object.tag_name)
  const target = asString(object.target_commitish), title = asString(object.name)
  const body = object.body === null ? "" : asString(object.body)
  const draft = asBoolean(object.draft), prerelease = asBoolean(object.prerelease)
  const assets = Array.isArray(object.assets) ? object.assets.map(parseAsset) : undefined
  if (id === undefined || uploadUrl === undefined || tag === undefined || target === undefined || title === undefined ||
    body === undefined || draft === undefined || prerelease === undefined || assets === undefined || assets.some((asset) => asset === undefined)) return undefined
  return { id, uploadUrl, tag, target, title, body, draft, prerelease, assets: assets as ReadonlyArray<ReleaseAsset> }
}
const releaseUrl = (publication: PreparedGitHubPublication): string =>
  `https://api.github.com/repos/${publication.repository}/releases/tags/${encodeURIComponent(publication.tag)}`
const assetSubject = (publication: PreparedGitHubPublication, asset: PreparedGitHubAsset): NonEmptyName =>
  NonEmptyName.make(`github:asset:${publication.repository}#${publication.tag}/${asset.name}`)
const differences = (expected: ReleaseFacts, publication: PreparedGitHubPublication): ObservationDifference[] => {
  const result: ObservationDifference[] = []
  const compare = (field: string, want: string, got: string) => { if (want !== got) result.push(ObservationDifference.make({ field: NonEmptyName.make(field), expected: want, observed: got })) }
  compare("tag", publication.tag.toString(), expected.tag)
  compare("targetCommit", publication.targetCommit.toString(), expected.target)
  compare("title", publication.title.toString(), expected.title)
  compare("body", publication.body ?? "", expected.body)
  compare("draft", String(publication.draft), String(expected.draft))
  compare("prerelease", String(publication.prerelease), String(expected.prerelease))
  return result
}
const failureOutcome = (subject: NonEmptyName, cause: PublicationError): Effect.Effect<MutationResult, never> => cause.commitment === "before-dispatch"
  ? Effect.succeed(Rejected.make({ subject, phase: "before-dispatch", reason: cause.reason }))
  : Effect.succeed(OutcomeUnknown.make({ subject, reason: cause.reason }))

export const makeGithubSubjects = (
  bundle: PreparedBundle, publication: PreparedGitHubPublication, http: PublicationHttp, credentials: PublicationCredentials
): ReadonlyArray<PublicationSubject> => {
  let release: ReleaseFacts | undefined
  const releaseSubject = NonEmptyName.make(`github:release:${publication.repository}#${publication.tag}`)
  const intendedNames = new Set(publication.assets.map((asset) => asset.name))
  const releaseSubjectValue: PublicationSubject = {
    id: releaseSubject,
    observe: (): Effect.Effect<Observation, PublicationError> => Effect.gen(function*() {
      const response = yield* http.request({ method: "GET", url: releaseUrl(publication), headers: authHeaders(credentials.read) })
      if (response.status === 404) return NeedsMutation.make({ subject: releaseSubject, precondition: NonEmptyName.make("release-absent") })
      if (response.status < 200 || response.status >= 300) return Inconclusive.make({ subject: releaseSubject, reason: `GitHub release observation returned HTTP ${response.status}.` })
      let parsed: ReleaseFacts | undefined
      try { parsed = parseRelease(bodyJson(response)) } catch (cause) { return Inconclusive.make({ subject: releaseSubject, reason: cause instanceof Error ? cause.message : String(cause) }) }
      if (parsed === undefined) return Inconclusive.make({ subject: releaseSubject, reason: "GitHub release response was malformed." })
      release = parsed
      const mismatch = differences(parsed, publication)
      for (const asset of parsed.assets) if (!intendedNames.has(asset.name)) mismatch.push(ObservationDifference.make({ field: NonEmptyName.make("asset.name"), expected: "declared asset", observed: asset.name }))
      return mismatch.length === 0 ? Equivalent.make({ subject: releaseSubject }) : Conflict.make({ subject: releaseSubject, differences: mismatch })
    }).pipe(Effect.catchTag("PublicationError", (cause) => Effect.succeed(Inconclusive.make({ subject: releaseSubject, reason: cause.reason })))),
    mutate: (needs): Effect.Effect<MutationResult, PublicationError> => Effect.gen(function*() {
      if (needs.precondition !== "release-absent") return yield* new PublicationError({ phase: "mutate", commitment: "before-dispatch", reason: "GitHub release mutation lacks the exact absence precondition." })
      const response = yield* http.request({ method: "POST", url: "https://api.github.com/repos/" + publication.repository + "/releases", headers: { ...authHeaders(credentials.publish), "content-type": "application/json" },
        body: JSON.stringify({ tag_name: publication.tag, target_commitish: publication.targetCommit, name: publication.title, body: publication.body ?? "", draft: publication.draft, prerelease: publication.prerelease }) })
      if (response.status >= 200 && response.status < 300) return Applied.make({ subject: releaseSubject, detail: `GitHub release HTTP ${response.status}.` })
      return Rejected.make({ subject: releaseSubject, phase: "provider", reason: `GitHub release mutation returned HTTP ${response.status}.` })
    }).pipe(Effect.catchTag("PublicationError", (cause) => failureOutcome(releaseSubject, cause)))
  }
  const assets = publication.assets.map((asset) => {
    const subject = assetSubject(publication, asset)
    const artifact = bundle.manifest.artifacts.find((item) => item.id === asset.artifactId)
    const bytes = artifact === undefined ? undefined : bundle.blobs.get(artifact.id.toString())
    const observe = (): Effect.Effect<Observation, PublicationError> => Effect.gen(function*() {
      const response = yield* http.request({ method: "GET", url: releaseUrl(publication), headers: authHeaders(credentials.read) })
      if (response.status === 404) return Inconclusive.make({ subject, reason: "GitHub release does not exist for the asset subject." })
      if (response.status < 200 || response.status >= 300) return Inconclusive.make({ subject, reason: `GitHub asset release lookup returned HTTP ${response.status}.` })
      let parsed: ReleaseFacts | undefined
      try { parsed = parseRelease(bodyJson(response)) } catch (cause) { return Inconclusive.make({ subject, reason: cause instanceof Error ? cause.message : String(cause) }) }
      if (parsed === undefined) return Inconclusive.make({ subject, reason: "GitHub asset release response was malformed." })
      release = parsed
      const existing = parsed.assets.filter((candidate) => candidate.name === asset.name)
      if (existing.length === 0) return NeedsMutation.make({ subject, precondition: NonEmptyName.make("asset-absent") })
      if (existing.length > 1) return Conflict.make({ subject, differences: [ObservationDifference.make({ field: NonEmptyName.make("asset.name"), expected: "one asset", observed: "duplicate asset names" })] })
      if (bytes === undefined || artifact === undefined) return Inconclusive.make({ subject, reason: `Prepared GitHub asset ${asset.artifactId} is unavailable.` })
      const candidate = existing[0]!
      const mismatch: ObservationDifference[] = []
      if (candidate.size !== bytes.length) mismatch.push(ObservationDifference.make({ field: NonEmptyName.make("size"), expected: String(bytes.length), observed: String(candidate.size) }))
      if (candidate.contentType !== asset.mediaType) mismatch.push(ObservationDifference.make({ field: NonEmptyName.make("mediaType"), expected: asset.mediaType, observed: candidate.contentType }))
      let digest: string | undefined = candidate.digest
      if (digest === undefined && candidate.downloadUrl !== undefined) {
        const downloaded = yield* http.request({ method: "GET", url: candidate.downloadUrl, headers: authHeaders(credentials.read) })
        if (downloaded.status < 200 || downloaded.status >= 300) return Inconclusive.make({ subject, reason: `GitHub asset download returned HTTP ${downloaded.status}.` })
        digest = sha256(typeof downloaded.body === "string" ? new TextEncoder().encode(downloaded.body) : downloaded.body)
      }
      const expectedDigest = `sha256:${sha256(bytes)}`
      if (digest === undefined) return Inconclusive.make({ subject, reason: "GitHub asset response omitted digest and download URL." })
      if (digest !== expectedDigest) mismatch.push(ObservationDifference.make({ field: NonEmptyName.make("digest"), expected: expectedDigest, observed: digest }))
      return mismatch.length === 0 ? Equivalent.make({ subject }) : Conflict.make({ subject, differences: mismatch })
    }).pipe(Effect.catchTag("PublicationError", (cause) => Effect.succeed(Inconclusive.make({ subject, reason: cause.reason }))))
    const mutate = (needs: NeedsMutationValue): Effect.Effect<MutationResult, PublicationError> => Effect.gen(function*() {
      if (needs.precondition !== "asset-absent" || release === undefined || bytes === undefined) return yield* new PublicationError({ phase: "mutate", commitment: "before-dispatch", reason: "GitHub asset mutation lacks the exact absence precondition, release, or bytes." })
      const response = yield* http.request({ method: "POST", url: `${release.uploadUrl}?name=${encodeURIComponent(asset.name)}`, headers: { ...authHeaders(credentials.publish), "content-type": asset.mediaType }, body: bytes })
      if (response.status >= 200 && response.status < 300) return Applied.make({ subject, detail: `GitHub asset HTTP ${response.status}.` })
      return Rejected.make({ subject, phase: "provider", reason: `GitHub asset mutation returned HTTP ${response.status}.` })
    }).pipe(Effect.catchTag("PublicationError", (cause) => failureOutcome(subject, cause)))
    return { id: subject, observe, mutate } satisfies PublicationSubject
  })
  return [releaseSubjectValue, ...assets]
}
