import { createHash } from "node:crypto"
import * as Effect from "effect/Effect"
import type { Operation, ProviderContext } from "@mannyc1/ts-release"
import type { HttpRead, HttpResponse } from "@mannyc1/ts-release/http"
import { publicUrl, sameData } from "@mannyc1/ts-release/http"
import * as Model from "./Model.js"
import { intentOf } from "./Graph.js"
import { bindScope, encodeScope, parentFacts, type BoundScope } from "./Binding.js"
import { api, attempt, headers, invalid, object, own } from "./Native.js"
import { refFacts, responseJson, responseObject, sameUrl } from "./Native.js"
import { assetFacts, releaseFacts, tagFacts } from "./Native.js"
import { sha256 } from "./Wire.js"
import { AssetEvidence, Missing, Present, Unavailable } from "./Evidence.js"
import { classifyAssets, classifyObservation, type Observation } from "./Evidence.js"

const MAX_PAGES = 1000
const linkPattern = /^<([^<>]+)>;\s*rel=(?:"(first|prev|next|last)"|(first|prev|next|last))$/u
export const PUBLIC_DOWNLOAD = "github:public-download"
export const publicDownload = (value: string): boolean => {
  const url = publicUrl(value)
  return (
    url !== null &&
    ["release-assets.githubusercontent.com", "objects.githubusercontent.com"].includes(
      url.hostname,
    ) &&
    !url.port
  )
}
const header = (response: HttpResponse, name: string) => {
  const values = Object.entries(response.headers).filter(([key]) => key.toLowerCase() === name)
  if (values.length > 1) invalid("duplicate-header")
  return values[0]?.[1]
}
/** Used only as a lookup candidate. A missing object never fences an earlier send. */
const objectCandidate = (intent: Model.AnnotatedTag) => {
  const body = new TextEncoder().encode(
    `object ${intent.commit}\ntype commit\ntag ${intent.tag}\ntagger ${intent.tagger.name} <${intent.tagger.email}> ${Date.parse(intent.tagger.date) / 1000} ${intent.tagger.date.endsWith("Z") ? "+0000" : intent.tagger.date.slice(-6).replace(":", "")}\n\n${intent.message}`,
  )
  return createHash(intent.commit.length === 40 ? "sha1" : "sha256")
    .update(`tag ${body.length}\0`)
    .update(body)
    .digest("hex")
}
const unavailable = (operation: Operation, reason: Unavailable["reason"]) =>
  new Unavailable({ operationId: operation.operationId, reason })
export const observations = (read: HttpRead) => {
  const get = Effect.fn("github.get")(function* (
    scope: BoundScope,
    url: string,
    binary = false,
    publicAccess = false,
  ) {
    return yield* read({
      method: "GET",
      url,
      headers: binary ? [["accept", "application/octet-stream"], ...headers.slice(1)] : headers,
      principal: publicAccess ? PUBLIC_DOWNLOAD : intentOf(scope.operation).principal,
      scope: encodeScope(scope),
    })
  })
  const namespace = Effect.fn("github.namespace")(function* (scope: BoundScope) {
    const repository = intentOf(scope.operation).repository,
      response = yield* get(scope, api(repository))
    yield* attempt(() => {
      if (response.status !== 200) invalid("namespace-status")
      const raw = responseObject(response),
        permissions = object(raw.permissions)
      if (
        typeof raw.full_name !== "string" ||
        raw.full_name.toLowerCase() !== `${repository.owner}/${repository.name}`.toLowerCase() ||
        typeof raw.url !== "string" ||
        raw.url.toLowerCase() !== api(repository).toLowerCase() ||
        permissions.push !== true
      )
        invalid("namespace-authority")
    })
  })
  const list = Effect.fn("github.list")(function* (scope: BoundScope, endpoint: string) {
    const values: unknown[] = []
    let through = 1,
      last: number | undefined
    for (let page = 1; page <= MAX_PAGES; page++) {
      const response = yield* get(scope, `${endpoint}?per_page=100&page=${page}`)
      const result = yield* attempt(() => {
        if (response.status !== 200) invalid("pagination-status")
        const items = responseJson(response)
        if (!Array.isArray(items) || items.length > 100) return invalid("pagination-data")
        const link = header(response, "link"),
          relations = new Set<string>()
        for (const part of link === undefined ? [] : link.split(",")) {
          const parsed = linkPattern.exec(part.trim())
          if (!parsed) return invalid("pagination-link")
          const relation = (parsed[2] ?? parsed[3])!,
            prefix = `${endpoint}?per_page=100&page=`,
            number = parsed[1]!.slice(prefix.length),
            target = Number(number)
          if (
            !parsed[1]!.startsWith(prefix) ||
            !/^[1-9][0-9]{0,3}$/u.test(number) ||
            target > MAX_PAGES ||
            relations.has(relation) ||
            (relation === "next" && target !== page + 1) ||
            (relation === "prev" && target !== page - 1) ||
            (relation === "first" && target !== 1) ||
            (relation === "last" && target < page)
          )
            return invalid("pagination-link")
          relations.add(relation)
          if (relation === "last") {
            last ??= target
            if (last !== target) return invalid("pagination-changing-last")
          }
          if (relation === "last" || relation === "next") through = Math.max(through, target)
        }
        if (last !== undefined && through > last) return invalid("pagination-link")
        return { items, more: page < through || (last === undefined && items.length === 100) }
      })
      values.push(...result.items)
      if (!result.more) return values
    }
    return yield* attempt(() => invalid("pagination-bound"))
  })
  const tag = Effect.fn("github.tagCommit")(function* (scope: BoundScope, name: string) {
    const repository = intentOf(scope.operation).repository,
      base = api(repository),
      response = yield* get(scope, `${base}/git/ref/tags/${encodeURIComponent(name)}`)
    if (response.status === 404) return null
    let facts = yield* attempt(() => {
      if (response.status !== 200) invalid("tag-status")
      const facts = refFacts(responseObject(response), repository)
      if (facts.ref !== `refs/tags/${name}`) invalid("tag-name")
      return { sha: facts.objectOid, type: facts.objectType }
    })
    const seen = new Set<string>()
    for (let depth = 0; facts.type === "tag"; depth++) {
      if (depth >= 32 || seen.has(facts.sha)) return yield* attempt(() => invalid("tag-depth"))
      seen.add(facts.sha)
      const response = yield* get(scope, `${base}/git/tags/${facts.sha}`)
      facts = yield* attempt(() => {
        if (response.status !== 200) invalid("tag-status")
        const raw = responseObject(response),
          target = object(raw.object),
          sha = own(Model.oid, target.sha)
        if (
          raw.sha !== facts.sha ||
          !sameUrl(raw.url, `${base}/git/tags/${facts.sha}`, repository) ||
          !["tag", "commit"].includes(String(target.type)) ||
          !sameUrl(
            target.url,
            `${base}/git/${target.type === "tag" ? "tags" : "commits"}/${sha}`,
            repository,
          )
        )
          invalid("tag-object")
        return { sha, type: target.type as "tag" | "commit" }
      })
    }
    return facts.sha
  })
  const download = Effect.fn("github.assetDigest")(function* (
    scope: BoundScope,
    facts: Model.AssetFacts,
  ) {
    if (facts.sha256 !== null || facts.state !== "uploaded")
      return new AssetEvidence({ facts, downloadedSha256: null })
    let response = yield* get(scope, facts.apiUrl, true)
    if (response.status === 302) {
      const url = yield* attempt(() => {
        const url = header(response, "location")
        if (!url || !publicDownload(url)) invalid("download-redirect")
        return url!
      })
      response = yield* get(scope, url, true, true)
    }
    if (response.status !== 200 || response.body.length !== facts.bytes)
      return yield* attempt(() => invalid("download-unavailable"))
    return new AssetEvidence({ facts, downloadedSha256: sha256(response.body) })
  })
  const assets = Effect.fn("github.assets")(function* (
    scope: BoundScope,
    release: Model.ReleaseFacts,
  ) {
    const repository = intentOf(scope.operation).repository,
      values = yield* list(scope, `${api(repository)}/releases/${release.releaseId}/assets`)
    return yield* Effect.forEach(values, (value) =>
      attempt(() => assetFacts(value, repository, release.tag)).pipe(
        Effect.flatMap((facts) => download(scope, facts)),
      ),
    )
  })
  const evidence = Effect.fn("github.observeEvidence")(function* (
    operation: Operation,
    context: ProviderContext,
  ): Effect.fn.Return<Observation, import("@mannyc1/ts-release").ReleaseError> {
    const scope = yield* attempt(() => bindScope(operation, context)),
      intent = intentOf(operation),
      repository = intent.repository,
      base = api(repository)
    yield* namespace(scope)
    const present = (
      facts: Present["facts"],
      observedCommit: string | null = null,
      downloadedSha256: string | null = null,
      assets: readonly AssetEvidence[] = [],
    ) => new Present({ scope: encodeScope(scope), facts, observedCommit, downloadedSha256, assets })
    const missing = () => new Missing({ scope: encodeScope(scope) })
    if (intent instanceof Model.AnnotatedTag) {
      const known = context.own.receipts
          .map((value) => object(value).facts)
          .map((value) => own(Model.AnnotatedTagFacts, value)),
        oid = known.at(-1)?.objectOid ?? objectCandidate(intent)
      const response = yield* get(scope, `${base}/git/tags/${oid}`)
      if (response.status === 404) return missing()
      return yield* attempt(() => {
        if (response.status !== 200) invalid("object-status")
        const facts = tagFacts(responseObject(response), repository)
        if (facts.objectOid !== oid) invalid("object-identity")
        return present(facts)
      })
    }
    if (intent instanceof Model.LightweightTag || intent instanceof Model.AnnotatedRef) {
      const response = yield* get(scope, `${base}/git/ref/tags/${encodeURIComponent(intent.tag)}`)
      if (response.status === 404) return missing()
      return yield* attempt(() => {
        if (response.status !== 200) invalid("ref-status")
        return present(refFacts(responseObject(response), repository))
      })
    }
    if (intent instanceof Model.DraftIntent) {
      const commit = yield* tag(scope, intent.tag)
      if (commit === null) return unavailable(operation, "parent-unresolved")
      const values = yield* list(scope, `${base}/releases`),
        candidates = yield* attempt(() =>
          values
            .map((value) => releaseFacts(value, repository))
            .filter((value) => value.tag === intent.tag),
        )
      if (candidates.length > 1) return yield* attempt(() => invalid("ambiguous-release"))
      if (!candidates.length) {
        if (commit !== scope.targetCommit)
          return yield* attempt(() => invalid("existing-tag-target"))
        return missing()
      }
      return present(candidates[0]!, commit)
    }
    const parent = parentFacts(scope, intent.draftOperation, "draft") as Model.ReleaseFacts,
      response = yield* get(scope, `${base}/releases/${parent.releaseId}`)
    if (response.status === 404) return missing()
    const release = yield* attempt(() => {
      if (response.status !== 200) invalid("release-status")
      const facts = releaseFacts(responseObject(response), repository)
      if (
        facts.releaseId !== parent.releaseId ||
        !sameData({ ...facts, draft: true }, { ...parent, draft: true })
      )
        invalid("release-parent")
      return facts
    })
    const listed = yield* assets(scope, release)
    if (intent instanceof Model.PublishIntent)
      return present(release, yield* tag(scope, release.tag), null, listed)
    const selected = listed.filter((value) => value.facts.storedName === intent.publicName)
    if (selected.length > 1) return yield* attempt(() => invalid("ambiguous-asset"))
    return selected.length
      ? present(selected[0]!.facts, null, selected[0]!.downloadedSha256)
      : missing()
  })
  return {
    observe: Effect.fn("github.observe")(function* (
      operation: Operation,
      context: ProviderContext,
    ) {
      const value = yield* evidence(operation, context).pipe(
        Effect.catch(() => Effect.succeed(unavailable(operation, "malformed-native"))),
      )
      return {
        evidence: value,
        status: yield* attempt(() =>
          classifyObservation(operation, value, context.own.receipts, context),
        ),
      }
    }),
    preflight: Effect.fn("github.preflight")(function* (
      operation: Operation,
      context: ProviderContext,
    ) {
      const intent = intentOf(operation),
        scope = yield* attempt(() => bindScope(operation, context))
      if (intent instanceof Model.DraftIntent) {
        // GitHub permits multiple drafts at one tag. Initial core authority alone
        // cannot replace complete native absence, even with observations disabled.
        const value = yield* evidence(operation, context)
        if (value._tag !== "Missing") return yield* attempt(() => invalid("draft-precondition"))
      } else if (intent instanceof Model.AssetIntent) {
        const parent = parentFacts(scope, intent.draftOperation, "draft") as Model.ReleaseFacts,
          response = yield* get(scope, `${api(intent.repository)}/releases/${parent.releaseId}`)
        yield* attempt(() => {
          if (response.status !== 200) invalid("asset-parent-status")
          const facts = releaseFacts(responseObject(response), intent.repository)
          if (!facts.draft || !sameData(facts, parent)) invalid("asset-parent-state")
        })
      } else if (intent instanceof Model.PublishIntent) {
        const value = yield* evidence(operation, context)
        if (
          value._tag !== "Present" ||
          !(value.facts instanceof Model.ReleaseFacts) ||
          !value.facts.draft ||
          value.observedCommit !== scope.targetCommit ||
          classifyAssets(scope, value.assets, context) !== "Satisfied"
        )
          return yield* attempt(() => invalid("publish-precondition"))
      }
    }),
  }
}
