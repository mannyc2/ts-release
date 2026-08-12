import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as HttpBody from "effect/unstable/http/HttpBody"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import { makeRunCommand } from "../drivers/process.js"
import { PublicationError, type HttpRequest, type HttpResponse, type PublicationHttp } from "../publication/index.js"
import type { CatalogRepositoryTransport } from "../publication/catalog-git.js"
import { ReleaseRuntime } from "../api/runtime.js"
import { SourceObserver } from "../release/context.js"
import { makeLocalPreparedReleaseStore, type PreparedReleaseStoreShape } from "../release/prepared-store.js"
import { join } from "node:path"

export const makePublicationHttp = (client: HttpClient.HttpClient): PublicationHttp => ({
  request: (request: HttpRequest) => HttpClientRequest.make(request.method)(request.url, {
    ...(request.headers === undefined ? {} : { headers: request.headers }),
    ...(request.body === undefined ? {} : { body: HttpBody.uint8Array(typeof request.body === "string" ? new TextEncoder().encode(request.body) : request.body) })
  }).pipe(
    (wire) => client.execute(wire),
    Effect.flatMap((response) => response.arrayBuffer.pipe(Effect.map((body) => ({
      status: response.status,
      headers: Object.fromEntries(Object.entries(response.headers)),
      body: new Uint8Array(body)
    } satisfies HttpResponse)))),
    Effect.mapError((cause) => PublicationError.make({ phase: "observe", commitment: "unknown", reason: String(cause) }))
  )
})

const unsupportedCatalog: CatalogRepositoryTransport = {
  observe: () => Effect.fail(PublicationError.make({ phase: "observe", commitment: "before-dispatch", reason: "No live catalog repository transport is configured for this host." })),
  write: () => Effect.fail(PublicationError.make({ phase: "mutate", commitment: "before-dispatch", reason: "No live catalog repository transport is configured for this host." }))
}

export type PreparedStoreSelector = (
  workspace: string,
  explicitDirectory?: string
) => PreparedReleaseStoreShape

const localPreparedStore: PreparedStoreSelector = (workspace, explicitDirectory) =>
  makeLocalPreparedReleaseStore(explicitDirectory ?? join(workspace, ".release", "ts-release", "prepared"))

export const makeReleaseRuntimeLive = (
  preparedStore: PreparedStoreSelector = localPreparedStore
): Layer.Layer<ReleaseRuntime, never, SourceObserver | ChildProcessSpawner | HttpClient.HttpClient> => Layer.effect(ReleaseRuntime, Effect.gen(function*() {
  const source = yield* SourceObserver
  const run = yield* makeRunCommand
  const client = yield* HttpClient.HttpClient
  return {
    source,
    run,
    http: makePublicationHttp(client),
    catalog: unsupportedCatalog,
    preparedStore
  }
}))

export const ReleaseRuntimeLive = makeReleaseRuntimeLive()
