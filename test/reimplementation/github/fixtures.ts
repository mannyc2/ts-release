import { Effect, Redacted, Schema } from "effect"
import { createPlan, type HostShape, type PreparedRequest } from "@mannyc1/ts-release"
import { Bundle, File, type ArtifactAccess } from "@mannyc1/ts-release/bundle"
import type { HttpReadRequest, HttpResponse } from "@mannyc1/ts-release/http"
import * as GitHub from "../../../packages/github/src/index.js"
import { sha256 } from "../../../packages/github/src/Wire.js"
import { MemoryJournal } from "../kernel/fixtures.js"

export const response = (
  status: number,
  body: unknown = {},
  headers: Record<string, string> = {},
): HttpResponse => ({
  status,
  headers: { "content-type": "application/json", ...headers },
  body: new TextEncoder().encode(JSON.stringify(body)),
})
export const repository = new GitHub.Repository({
  apiUrl: "https://api.github.com",
  owner: "owner",
  name: "repo",
})
export const base = "https://api.github.com/repos/owner/repo"
export const commit = "a".repeat(40)
export const tagger = new GitHub.Tagger({
  name: "Release Runner",
  email: "release@example.com",
  date: "2026-09-07T00:00:00Z",
})
export const refDocument = (sha = commit, type = "commit") => ({
  ref: "refs/tags/v1.0.0",
  url: `${base}/git/refs/tags/v1.0.0`,
  object: { sha, type, url: `${base}/git/${type === "tag" ? "tags" : "commits"}/${sha}` },
})
export const releaseDocument = (id = 731, draft = true) => ({
  id,
  tag_name: "v1.0.0",
  name: "Release",
  body: "Notes",
  prerelease: false,
  draft,
  url: `${base}/releases/${id}`,
  assets_url: `${base}/releases/${id}/assets`,
  upload_url: `https://uploads.github.com/repos/owner/repo/releases/${id}/assets{?name,label}`,
})
export const assetDocument = (id: number, name: string, bytes: Uint8Array) => ({
  id,
  name,
  state: "uploaded",
  content_type: "application/octet-stream",
  size: bytes.length,
  digest: `sha256:${sha256(bytes)}` as string | null,
  url: `${base}/releases/assets/${id}`,
  browser_download_url: `https://github.com/owner/repo/releases/download/v1.0.0/${encodeURIComponent(name)}`,
})
/** Stateful REST protocol double. Hosted GitHub mutation acceptance is separate. */
export async function fixture(count = 3, annotated = false) {
  const bytes = Array.from({ length: count }, (_, i) =>
      new TextEncoder().encode(`asset bytes ${i}`),
    ),
    files = bytes.map((value, i) =>
      Schema.decodeUnknownSync(File)({
        _tag: "OwnedFile",
        logicalName: `asset${i}.bin`,
        content: { bytes: String(value.length), sha256: sha256(value) },
        deliveryMode: 420,
        executable: null,
        provenance: { _tag: "IntrinsicProvenance", producer: "github-protocol-fixture" },
      }),
    )
  const access: ArtifactAccess = {
    bundle: new Bundle({ format: "ts-release/bundle/1", artifacts: files }),
    readContent: (content) =>
      Effect.sync(() =>
        bytes[files.findIndex((file) => file.content.sha256 === content.sha256)]!.slice(),
      ),
  }
  const tag = await Effect.runPromise(
    annotated
      ? GitHub.annotatedTag(
          new GitHub.AnnotatedTag({
            repository,
            principal: "tag-token",
            tag: "v1.0.0",
            commit,
            message: "Release tag\n",
            tagger,
          }),
        )
      : GitHub.lightweightTag(
          new GitHub.LightweightTag({ repository, principal: "tag-token", tag: "v1.0.0", commit }),
        ),
  )
  const ref = annotated
    ? await Effect.runPromise(
        GitHub.annotatedRef(
          new GitHub.AnnotatedRef({
            repository,
            principal: "ref-token",
            tag: "v1.0.0",
            annotatedTagOperation: tag.operationId,
          }),
        ),
      )
    : tag
  const draft = await Effect.runPromise(
    GitHub.draft(
      new GitHub.DraftIntent({
        repository,
        principal: "draft-token",
        tag: "v1.0.0",
        tagSource: new GitHub.ManagedTag({ operationId: ref.operationId }),
        title: "Release",
        body: "Notes",
        prerelease: false,
      }),
    ),
  )
  const assets = await Promise.all(
    files.map((file) =>
      Effect.runPromise(
        GitHub.uploadAsset(
          new GitHub.AssetIntent({
            repository,
            principal: "asset-token",
            draftOperation: draft.operationId,
            file,
            publicName: file.logicalName,
            mediaType: "application/octet-stream",
          }),
        ),
      ),
    ),
  )
  const publish = await Effect.runPromise(
    GitHub.publish(
      new GitHub.PublishIntent({
        repository,
        principal: "publish-token",
        draftOperation: draft.operationId,
        assetOperations: assets.map((asset) => asset.operationId),
      }),
    ),
  )
  const operations = [tag, ...(annotated ? [ref] : []), draft, ...assets, publish],
    plan = await Effect.runPromise(createPlan("owned:github", operations))
  const state = {
    ref: null as ReturnType<typeof refDocument> | null,
    object: null as Record<string, unknown> | null,
    releases: [] as ReturnType<typeof releaseDocument>[],
    assets: [] as ReturnType<typeof assetDocument>[],
    hidden: false,
    lost: "",
    reads: [] as HttpReadRequest[],
    sends: [] as PreparedRequest[],
    override: undefined as undefined | ((request: HttpReadRequest) => HttpResponse | undefined),
  }
  const read = (request: HttpReadRequest) =>
    Effect.gen(function* () {
      yield* GitHub.authorizeToken({
        repository,
        binding: { endpoint: request.url, principal: request.principal, scope: request.scope },
        token: Redacted.make("fixture-token"),
      })
      state.reads.push(request)
      const custom = state.override?.(request)
      if (custom) return custom
      const url = new URL(request.url),
        path = url.pathname.replace("/repos/owner/repo", "")
      if (path === "")
        return response(200, { full_name: "owner/repo", url: base, permissions: { push: true } })
      if (path === "/git/ref/tags/v1.0.0")
        return state.ref ? response(200, state.ref) : response(404)
      if (path.startsWith("/git/tags/"))
        return state.object && path.endsWith(String(state.object.sha))
          ? response(200, state.object)
          : response(404)
      if (path === "/releases") return response(200, state.hidden ? [] : state.releases)
      if (path === "/releases/731")
        return !state.hidden && state.releases[0] ? response(200, state.releases[0]) : response(404)
      if (path === "/releases/731/assets") return response(200, state.assets)
      if (path.startsWith("/releases/assets/")) {
        const asset = state.assets.find((asset) => String(asset.id) === path.split("/").at(-1))
        const i = files.findIndex((file) => file.logicalName === asset?.name)
        return i >= 0
          ? {
              status: 200,
              headers: { "content-type": "application/octet-stream" },
              body: bytes[i]!,
            }
          : response(404)
      }
      throw new Error(`Unexpected fixture read: ${request.url}`)
    })
  const providers = GitHub.definitions({ ...access, read }),
    store = new MemoryJournal()
  let serial = 0
  const host: HostShape = {
    providers,
    store,
    now: () => 1,
    uniqueId: () => `github:${++serial}`,
    transport: {
      send: (request) =>
        Effect.gen(function* () {
          const owners = providers.filter((provider) => provider.ownsRequest(request))
          if (owners.length !== 1) throw new Error("Expected one exact owner")
          yield* GitHub.authorizeToken({
            repository,
            binding: {
              endpoint: request.facts.endpoint,
              principal: request.facts.principal,
              scope: request.facts.scope,
            },
            token: Redacted.make("fixture-token"),
          })
          state.sends.push(request)
          const url = new URL(request.facts.endpoint),
            path = url.pathname.replace("/repos/owner/repo", ""),
            data = path.endsWith("/assets")
              ? null
              : JSON.parse(new TextDecoder().decode(request.body))
          let result: HttpResponse
          if (path === "/git/tags") {
            state.object = {
              sha: "b".repeat(40),
              tag: data.tag,
              message: data.message,
              tagger: data.tagger,
              url: `${base}/git/tags/${"b".repeat(40)}`,
              object: {
                sha: data.object,
                type: "commit",
                url: `${base}/git/commits/${data.object}`,
              },
            }
            result = response(201, state.object)
          } else if (path === "/git/refs") {
            state.ref = refDocument(data.sha, annotated ? "tag" : "commit")
            result = response(201, state.ref)
          } else if (path === "/releases") {
            state.releases.push(releaseDocument())
            result = response(201, state.releases[0])
          } else if (path === "/releases/731/assets") {
            const asset = assetDocument(
              1001 + state.assets.length,
              url.searchParams.get("name")!,
              request.body,
            )
            state.assets.push(asset)
            result = response(201, asset)
          } else if (path === "/releases/731" && request.facts.method === "PATCH") {
            state.releases[0]!.draft = false
            result = response(200, state.releases[0])
          } else throw new Error(`Unexpected fixture send: ${request.facts.endpoint}`)
          if (state.lost === owners[0]!.definitionId) {
            state.lost = ""
            return { _tag: "Unknown" as const, reason: "Fixture response lost after native commit" }
          }
          return yield* owners[0]!.decodeResponse(request, result)
        }),
    },
  }
  return {
    state,
    access,
    providers,
    host,
    store,
    plan,
    operations,
    tag,
    ref,
    draft,
    assets,
    publish,
    bytes,
    files,
  }
}
