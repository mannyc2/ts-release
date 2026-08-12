import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as HttpBody from "effect/unstable/http/HttpBody"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import { ReleaseRuntime } from "../api/runtime.js"
import { makeRunCommand } from "../drivers/process.js"
import { PublicationError } from "../publication/observation.js"
import type { HttpRequest, HttpResponse, PublicationHttp } from "../publication/http.js"
import { SourceObserver } from "../release/context.js"

export const makePublicationHttp = (client: HttpClient.HttpClient): PublicationHttp => ({
  request: (request: HttpRequest) => HttpClientRequest.make(request.method)(request.url, {
    ...(request.headers === undefined ? {} : { headers: request.headers }),
    ...(request.body === undefined ? {} : {
      body: HttpBody.uint8Array(typeof request.body === "string"
        ? new TextEncoder().encode(request.body)
        : request.body)
    })
  }).pipe(
    (wire) => client.execute(wire),
    Effect.flatMap((response) => response.arrayBuffer.pipe(Effect.map((body) => ({
      status: response.status,
      headers: Object.fromEntries(Object.entries(response.headers)),
      body: new Uint8Array(body)
    } satisfies HttpResponse)))),
    Effect.mapError(() => PublicationError.make({
      phase: "observe",
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
