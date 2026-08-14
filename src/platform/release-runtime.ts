import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as HttpBody from "effect/unstable/http/HttpBody"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import { ReleaseRuntime } from "../api/runtime.js"
import { makeRunCommand } from "../drivers/process.js"
import { PublicationHttpError, type HttpRequest, type HttpResponse, type PublicationHttp } from "../publication/http.js"
import { SourceObserver } from "../release/context.js"

const makeWireRequest = (request: HttpRequest): HttpClientRequest.HttpClientRequest => {
  const wire = HttpClientRequest.make(request.method)(request.url, request.body === undefined ? {} : {
    body: HttpBody.uint8Array(typeof request.body === "string"
      ? new TextEncoder().encode(request.body)
      : request.body)
  })
  return request.headers === undefined ? wire : HttpClientRequest.setHeaders(wire, request.headers)
}

export const makePublicationHttp = (client: HttpClient.HttpClient): PublicationHttp => ({
  request: (request: HttpRequest) => makeWireRequest(request).pipe(
    (wire) => client.execute(wire),
    Effect.flatMap((response) => response.arrayBuffer.pipe(Effect.map((body) => ({
      status: response.status,
      headers: Object.fromEntries(Object.entries(response.headers)),
      body: new Uint8Array(body)
    } satisfies HttpResponse)))),
    Effect.mapError(() => PublicationHttpError.make({
      commitment: "unknown",
      reason: "The provider HTTP transport failed after dispatch."
    }))
  )
})

/** Runtime-only process and source services. Durable storage is a direct service. */
export const ReleaseRuntimeLive: Layer.Layer<
  ReleaseRuntime,
  never,
  SourceObserver | ChildProcessSpawner
> = Layer.effect(ReleaseRuntime, Effect.gen(function*() {
  const source = yield* SourceObserver
  const run = yield* makeRunCommand
  return { source, run }
}))

export const makeReleaseRuntimeLive = (): typeof ReleaseRuntimeLive => ReleaseRuntimeLive
