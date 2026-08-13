import * as Effect from "effect/Effect"
import type { CredentialGrant, ScopedSecret } from "../../../src/publication/authority.js"
import type {
  AuthorizedMutationHttpShape,
  HttpAuthorizerShape,
  HttpResponse,
  MutationHttpRequest
} from "../../../src/publication/http.js"
import { CredentialPlatformError } from "../../../src/platform/credentials.js"
import {
  faultInjected,
  httpExchange,
  protocolBodyFingerprint,
  type ProtocolEvent
} from "../events.js"

export const GithubProtocolScenarioSchemaVersion = "github-protocol-scenario/v1" as const

export interface GithubTagTargetV1 {
  readonly type: "commit" | "tag"
  readonly sha: string
}

export interface GithubAssetStateV1 {
  readonly id: number
  readonly name: string
  readonly mediaType: string
  readonly bytes: Uint8Array
  readonly digest?: "present" | "missing" | "malformed"
  readonly state?: "uploaded" | "starter"
}

export interface GithubReleaseStateV1 {
  readonly id: number
  readonly tag: string
  readonly title: string
  readonly body: string
  readonly draft: boolean
  readonly prerelease: boolean
  readonly assets: Array<GithubAssetStateV1>
  readonly pageSize?: number
}

export interface GithubProtocolFaultV1 {
  readonly phase: "observe" | "mutate"
  readonly method: "GET" | "POST"
  readonly url: string
  /** Optional state threshold for deterministic post-mutation visibility faults. */
  readonly afterMutationCount?: number
  readonly outcome:
    | { readonly _tag: "HttpStatus", readonly status: number }
    | {
      readonly _tag: "HttpResponse"
      readonly status: number
      readonly body: unknown
      readonly headers?: Readonly<Record<string, string>>
    }
    | { readonly _tag: "TransportUnknown", readonly afterApply?: boolean }
}

export interface GithubProtocolScenarioV1 {
  readonly schemaVersion: typeof GithubProtocolScenarioSchemaVersion
  readonly repository: string
  readonly tag: string
  readonly targetCommit: string
  tagRef?: GithubTagTargetV1
  readonly tagObjects?: Readonly<Record<string, GithubTagTargetV1>>
  release?: GithubReleaseStateV1
  readonly faults?: Array<GithubProtocolFaultV1>
}

const json = (status: number, value: unknown, headers: Readonly<Record<string, string>> = {}): HttpResponse => ({
  status,
  headers,
  body: JSON.stringify(value)
})

const bytesResponse = (status: number, bytes: Uint8Array): HttpResponse => ({
  status,
  headers: {},
  body: bytes
})

const sha256 = (bytes: Uint8Array): string => protocolBodyFingerprint(bytes).sha256

const uploadTemplate = (scenario: GithubProtocolScenarioV1, id: number): string =>
  `https://uploads.github.com/repos/${scenario.repository}/releases/${id}/assets{?name,label}`

const releaseJson = (scenario: GithubProtocolScenarioV1, release: GithubReleaseStateV1): unknown => ({
  id: release.id,
  tag_name: release.tag,
  name: release.title,
  body: release.body,
  draft: release.draft,
  prerelease: release.prerelease,
  upload_url: uploadTemplate(scenario, release.id)
})

const assetJson = (scenario: GithubProtocolScenarioV1, asset: GithubAssetStateV1): unknown => ({
  id: asset.id,
  name: asset.name,
  size: asset.bytes.length,
  content_type: asset.mediaType,
  state: asset.state ?? "uploaded",
  url: `https://api.github.com/repos/${scenario.repository}/releases/assets/${asset.id}`,
  ...(asset.digest === "missing"
    ? {}
    : { digest: asset.digest === "malformed" ? "sha256:not-canonical" : `sha256:${sha256(asset.bytes)}` })
})

const bodyBytes = (body: Uint8Array | string | undefined): Uint8Array => body === undefined
  ? new Uint8Array()
  : typeof body === "string"
  ? new TextEncoder().encode(body)
  : body

const recordExchange = (
  events: Array<ProtocolEvent>,
  input: {
    readonly phase: "observe" | "mutate"
    readonly method: "GET" | "POST"
    readonly url: string
    readonly headers?: Readonly<Record<string, string>>
    readonly body?: Uint8Array | string
    readonly grant: CredentialGrant
    readonly status?: number
  }
): void => {
  const request = input.body === undefined ? undefined : protocolBodyFingerprint(input.body)
  events.push(httpExchange({
    provider: "github",
    phase: input.phase,
    method: input.method,
    url: input.url,
    grantKind: input.grant._tag,
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(input.headers === undefined ? {} : { requestHeaders: input.headers }),
    ...(request === undefined ? {} : {
      requestBodySha256: request.sha256,
      requestBodyLength: request.length
    })
  }))
}

const takeFault = (
  scenario: GithubProtocolScenarioV1,
  phase: "observe" | "mutate",
  method: "GET" | "POST",
  url: string,
  mutationCount: number
): GithubProtocolFaultV1 | undefined => {
  const index = scenario.faults?.findIndex((fault) =>
    fault.phase === phase && fault.method === method && fault.url === url &&
    (fault.afterMutationCount === undefined || mutationCount >= fault.afterMutationCount)
  ) ?? -1
  if (index < 0) return undefined
  return scenario.faults!.splice(index, 1)[0]
}

export interface GithubProtocolDouble {
  readonly scenario: GithubProtocolScenarioV1
  readonly events: Array<ProtocolEvent>
  readonly http: HttpAuthorizerShape
  readonly mutationHttp: AuthorizedMutationHttpShape
  readonly mutationCount: () => number
}

/** A stateful, versioned in-memory implementation of the exact GitHub wires. */
export const makeGithubProtocolDouble = (
  scenario: GithubProtocolScenarioV1
): GithubProtocolDouble => {
  const events: Array<ProtocolEvent> = []
  const apiBase = `https://api.github.com/repos/${scenario.repository}`
  let mutations = 0
  let nextAssetId = Math.max(100, ...(scenario.release?.assets.map((asset) => asset.id + 1) ?? []))

  const observe = (
    method: "GET",
    url: string,
    headers: Readonly<Record<string, string>> | undefined,
    grant: Exclude<CredentialGrant, { readonly _tag: "WorkloadIdentity" }>
  ): Effect.Effect<HttpResponse, CredentialPlatformError> => Effect.gen(function*() {
    const fault = takeFault(scenario, "observe", method, url, mutations)
    if (fault !== undefined) {
      events.push(faultInjected({
        provider: "github",
        phase: "observe",
        point: `${method} ${url}`,
        commitment: fault.outcome._tag === "TransportUnknown" ? "unknown" : "before-dispatch"
      }))
      if (fault.outcome._tag === "TransportUnknown") {
        recordExchange(events, { phase: "observe", method, url, ...(headers === undefined ? {} : { headers }), grant })
        return yield* new CredentialPlatformError({
          phase: "observe",
          commitment: "unknown",
          reason: "Injected observation transport failure."
        })
      }
      recordExchange(events, {
        phase: "observe", method, url, ...(headers === undefined ? {} : { headers }), grant,
        status: fault.outcome.status
      })
      return fault.outcome._tag === "HttpResponse"
        ? json(fault.outcome.status, fault.outcome.body, fault.outcome.headers)
        : json(fault.outcome.status, {})
    }

    let response: HttpResponse
    if (url === apiBase) {
      response = json(200, { full_name: scenario.repository })
    } else if (url === `${apiBase}/git/ref/tags/${encodeURIComponent(scenario.tag)}`) {
      response = scenario.tagRef === undefined
        ? json(404, {})
        : json(200, { ref: `refs/tags/${scenario.tag}`, object: scenario.tagRef })
    } else if (url.startsWith(`${apiBase}/git/tags/`)) {
      const sha = url.slice(`${apiBase}/git/tags/`.length)
      const object = scenario.tagObjects?.[sha]
      response = object === undefined ? json(404, {}) : json(200, { sha, object })
    } else if (url === `${apiBase}/releases/tags/${encodeURIComponent(scenario.tag)}`) {
      response = scenario.release === undefined ? json(404, {}) : json(200, releaseJson(scenario, scenario.release))
    } else {
      const list = new RegExp(`^${apiBase.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}/releases/([1-9][0-9]*)/assets\\?per_page=100&page=([1-9][0-9]*)$`, "u").exec(url)
      const asset = new RegExp(`^${apiBase.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}/releases/assets/([1-9][0-9]*)$`, "u").exec(url)
      if (list !== null && scenario.release?.id === Number(list[1])) {
        const page = Number(list[2])
        const pageSize = scenario.release.pageSize ?? 100
        const offset = (page - 1) * pageSize
        const values = scenario.release.assets.slice(offset, offset + pageSize)
        const hasNext = offset + pageSize < scenario.release.assets.length
        response = json(200, values.map((value) => assetJson(scenario, value)), hasNext
          ? { link: `<${apiBase}/releases/${scenario.release.id}/assets?per_page=100&page=${page + 1}>; rel="next"` }
          : {})
      } else if (asset !== null) {
        const current = scenario.release?.assets.find((value) => value.id === Number(asset[1]))
        response = current === undefined ? json(404, {}) : bytesResponse(200, current.bytes)
      } else {
        response = json(404, {})
      }
    }
    recordExchange(events, {
      phase: "observe", method, url, ...(headers === undefined ? {} : { headers }), grant,
      status: response.status
    })
    return response
  })

  const applyMutation = (request: MutationHttpRequest): HttpResponse => {
    if (request.url === `${apiBase}/releases`) {
      const body = JSON.parse(new TextDecoder().decode(bodyBytes(request.body))) as {
        readonly tag_name: string
        readonly target_commitish: string
        readonly name: string
        readonly body: string
        readonly draft: boolean
        readonly prerelease: boolean
      }
      if (scenario.release !== undefined) return json(422, {})
      scenario.tagRef ??= { type: "commit", sha: body.target_commitish }
      scenario.release = {
        id: 700,
        tag: body.tag_name,
        title: body.name,
        body: body.body,
        draft: body.draft,
        prerelease: body.prerelease,
        assets: []
      }
      return json(201, releaseJson(scenario, scenario.release))
    }
    const upload = new RegExp(`^https://uploads\\.github\\.com/repos/${scenario.repository.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}/releases/([1-9][0-9]*)/assets\\?name=([^&]+)$`, "u").exec(request.url)
    if (upload === null || scenario.release?.id !== Number(upload[1])) return json(404, {})
    const name = decodeURIComponent(upload[2]!)
    if (scenario.release.assets.some((asset) => asset.name === name)) return json(422, {})
    const bytes = bodyBytes(request.body)
    const asset: GithubAssetStateV1 = {
      id: nextAssetId++,
      name,
      mediaType: request.headers?.["content-type"] ?? "application/octet-stream",
      bytes,
      digest: "present"
    }
    scenario.release.assets.push(asset)
    return json(201, assetJson(scenario, asset))
  }

  const mutationHttp: AuthorizedMutationHttpShape = {
    execute: (operation, request, grant: ScopedSecret) => Effect.gen(function*() {
      const fault = takeFault(scenario, "mutate", request.method, request.url, mutations)
      if (fault?.outcome._tag === "HttpStatus" || fault?.outcome._tag === "HttpResponse") {
        events.push(faultInjected({
          provider: "github", phase: "mutate", point: `${request.method} ${request.url}`,
          commitment: "started"
        }))
        recordExchange(events, {
          phase: "mutate", method: request.method, url: request.url,
          ...(request.headers === undefined ? {} : { headers: request.headers }),
          ...(request.body === undefined ? {} : { body: request.body }),
          grant, status: fault.outcome.status
        })
        return fault.outcome._tag === "HttpResponse"
          ? json(fault.outcome.status, fault.outcome.body, fault.outcome.headers)
          : json(fault.outcome.status, {})
      }
      let response: HttpResponse | undefined
      if (fault?.outcome._tag === "TransportUnknown" && fault.outcome.afterApply === true) {
        response = applyMutation(request)
        mutations += response.status === 201 ? 1 : 0
      }
      if (fault?.outcome._tag === "TransportUnknown") {
        events.push(faultInjected({
          provider: "github", phase: "mutate", point: `${request.method} ${request.url}`,
          commitment: "unknown"
        }))
        recordExchange(events, {
          phase: "mutate", method: request.method, url: request.url,
          ...(request.headers === undefined ? {} : { headers: request.headers }),
          ...(request.body === undefined ? {} : { body: request.body }), grant
        })
        return yield* new CredentialPlatformError({
          phase: "mutate",
          commitment: "unknown",
          reason: "Injected mutation transport failure."
        })
      }
      if (operation.provider !== "github" || operation.subject !== grant.subject) {
        return yield* new CredentialPlatformError({
          phase: "mutate",
          commitment: "before-dispatch",
          reason: "Protocol double received an operation outside its exact grant."
        })
      }
      response = applyMutation(request)
      mutations += response.status === 201 ? 1 : 0
      recordExchange(events, {
        phase: "mutate", method: request.method, url: request.url,
        ...(request.headers === undefined ? {} : { headers: request.headers }),
        ...(request.body === undefined ? {} : { body: request.body }),
        grant, status: response.status
      })
      return response
    })
  }

  return {
    scenario,
    events,
    http: { execute: (input, grant) => observe(input.method, input.url, input.headers, grant) },
    mutationHttp,
    mutationCount: () => mutations
  }
}
