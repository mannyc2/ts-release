import {
  decodeJson,
  makeDataBoundary,
  publicUrl,
  type HttpResponse,
} from "@mannyc1/ts-release/http"
import * as Model from "./Model.js"

export const { invalid, attempt, matches, object, own, ownOperation, ownRequest } =
  makeDataBoundary("github", "GitHub")
export const api = (repository: Model.Repository) =>
  `${repository.apiUrl}/repos/${repository.owner}/${repository.name}`
export const uploadTemplate = (repository: Model.Repository, id: string) =>
  `https://uploads.github.com/repos/${repository.owner}/${repository.name}/releases/${own(Model.nativeId, id)}/assets{?name,label}`
/** GitHub repository coordinates are case-insensitive; native resource suffixes are exact. */
export const sameUrl = (
  actual: unknown,
  expected: string,
  repository: Model.Repository,
): boolean => {
  if (typeof actual !== "string") return false
  const origin = expected.startsWith("https://uploads.github.com/")
    ? "https://uploads.github.com"
    : repository.apiUrl
  const prefix = `${origin}/repos/${repository.owner}/${repository.name}/`
  return (
    expected.startsWith(prefix) &&
    actual.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase() &&
    actual.slice(prefix.length) === expected.slice(prefix.length)
  )
}
export const id = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? String(value)
    : invalid("native-id")
export const headers = [
  ["accept", "application/vnd.github+json"],
  ["x-github-api-version", "2022-11-28"],
  ["user-agent", "ts-release"],
] as const
export const responseJson = (response: HttpResponse): unknown => {
  const type = Object.entries(response.headers).filter(
    ([name]) => name.toLowerCase() === "content-type",
  )
  if (
    response.body.length > 1024 * 1024 ||
    type.length !== 1 ||
    !/^(?:application\/json|application\/vnd\.github\+json)(?:\s*;|$)/iu.test(type[0]![1])
  )
    invalid("json-response")
  return decodeJson(response.body)
}
export const responseObject = (response: HttpResponse): Record<string, unknown> =>
  object(responseJson(response))
export const refFacts = (value: unknown, repository: Model.Repository): Model.RefFacts => {
  const raw = object(value),
    target = object(raw.object)
  const facts = own(Model.RefFacts, {
    ref: raw.ref,
    objectOid: target.sha,
    objectType: target.type,
  })
  if (
    !facts.ref.startsWith("refs/tags/") ||
    !sameUrl(raw.url, `${api(repository)}/git/${facts.ref}`, repository) ||
    !sameUrl(
      target.url,
      `${api(repository)}/git/${facts.objectType === "tag" ? "tags" : "commits"}/${facts.objectOid}`,
      repository,
    )
  )
    invalid("ref-url")
  return facts
}
export const tagFacts = (value: unknown, repository: Model.Repository): Model.AnnotatedTagFacts => {
  const raw = object(value),
    target = object(raw.object),
    tagger = object(raw.tagger)
  const facts = own(Model.AnnotatedTagFacts, {
    objectOid: raw.sha,
    tag: raw.tag,
    message: raw.message,
    tagger: { name: tagger.name, email: tagger.email, date: tagger.date },
    targetOid: target.sha,
    targetType: target.type,
  })
  if (
    !sameUrl(raw.url, `${api(repository)}/git/tags/${facts.objectOid}`, repository) ||
    !sameUrl(target.url, `${api(repository)}/git/commits/${facts.targetOid}`, repository)
  )
    invalid("tag-url")
  return facts
}
export const releaseFacts = (value: unknown, repository: Model.Repository): Model.ReleaseFacts => {
  const raw = object(value),
    releaseId = id(raw.id)
  const facts = own(Model.ReleaseFacts, {
    releaseId,
    tag: raw.tag_name,
    title: raw.name === null ? "" : raw.name,
    body: raw.body === null ? "" : raw.body,
    prerelease: raw.prerelease,
    draft: raw.draft,
    uploadUrlTemplate: raw.upload_url,
  })
  if (
    !sameUrl(raw.url, `${api(repository)}/releases/${releaseId}`, repository) ||
    !sameUrl(raw.assets_url, `${api(repository)}/releases/${releaseId}/assets`, repository) ||
    !sameUrl(facts.uploadUrlTemplate, uploadTemplate(repository, releaseId), repository)
  )
    invalid("release-url")
  return facts
}
export const assetFacts = (
  value: unknown,
  repository: Model.Repository,
  tag: string,
): Model.AssetFacts => {
  const raw = object(value),
    assetId = id(raw.id)
  if (typeof raw.size !== "number" || !Number.isSafeInteger(raw.size) || raw.size < 0)
    invalid("asset-size")
  const digest =
    raw.digest === undefined || raw.digest === null
      ? null
      : typeof raw.digest === "string" && /^sha256:[0-9a-f]{64}$/u.test(raw.digest)
        ? raw.digest.slice(7)
        : invalid("asset-digest")
  const facts = own(Model.AssetFacts, {
    assetId,
    storedName: raw.name,
    state: raw.state,
    contentType: raw.content_type,
    bytes: String(raw.size),
    sha256: digest,
    apiUrl: raw.url,
    downloadUrl: raw.browser_download_url,
  })
  if (!assetUrls(facts, repository, tag)) invalid("asset-url")
  return facts
}
export const assetUrls = (facts: Model.AssetFacts, repository: Model.Repository, tag: string) => {
  const download = publicUrl(facts.downloadUrl)
  if (!download) return false
  const path = decodeURIComponent(download.pathname),
    prefix = `/${repository.owner}/${repository.name}/`
  if (
    !sameUrl(facts.apiUrl, `${api(repository)}/releases/assets/${facts.assetId}`, repository) ||
    download.origin !== "https://github.com" ||
    download.search ||
    path.slice(0, prefix.length).toLowerCase() !== prefix.toLowerCase() ||
    path.slice(prefix.length) !== `releases/download/${tag}/${facts.storedName}`
  )
    return false
  return true
}
