import * as Effect from "effect/Effect"
import * as HttpBody from "effect/unstable/http/HttpBody"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import type * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"
import {
  Committed, CommitmentUnknown, isClosedProfilePublish, NotDispatched, ReadResult,
  type CatalogPublishRequest, type DriverCatalogShape
} from "./services.js"
import { Digest } from "../model/primitives.js"
import { DriverError } from "../model/run.js"
import type { RunCommand } from "./process.js"
import { failure, sha256 } from "./utils.js"

// HTTP and spawning are the two host capabilities the remote catalog needs;
// both arrive as values so the catalog itself is host-generic.
export type RemoteTransport = {
  readonly client: HttpClient.HttpClient, readonly run: RunCommand
}

const ok = (response: HttpClientResponse.HttpClientResponse): boolean =>
  response.status >= 200 && response.status < 300
const commandPublish = (
  transport: RemoteTransport,
  request: CatalogPublishRequest,
  argv: ReadonlyArray<string>
) => {
  const operation = request.operation
  const names = operation._tag === "OpaquePublish" ||
    operation._tag === "PackageRegistryRelease"
    ? operation.environmentNames
    : []
  // Durable dispatch intent already exists when this runs, so "the process
  // never started" must stay retryable NotDispatched (nothing reached the
  // registry), while any non-zero exit from a process that DID run stays
  // CommitmentUnknown, because package managers can fail after committing.
  return transport.run({ argv, cwd: ".", environmentNames: names }).pipe(
    Effect.map((result) => result.exitCode === 0
      ? Committed.make({ observedOutcome: result.stdout.trim() || "exit-0" })
      : CommitmentUnknown.make({ failure: `Publisher exited ${result.exitCode} after dispatch.` })),
    Effect.catch((cause) => Effect.succeed(
      NotDispatched.make({ reason: `Publisher could not start: ${cause.reason}`, retryable: true })))
  )
}
const httpRequest = (
  transport: RemoteTransport,
  request: CatalogPublishRequest,
  bytes: Uint8Array | undefined,
  credential: string
) => Effect.gen(function*() {
  const operation = request.operation
  if (operation._tag !== "HttpPublish") return yield* Effect.fail(failure("Expected HTTP publication."))
  const response = yield* transport.client.execute(HttpClientRequest.make(operation.method)(
    `${operation.wire.baseUrl}${operation.wire.pathTemplate}`,
    {
      headers: {
        authorization: `Bearer ${credential}`,
        "idempotency-key": request.clientReconciliationKey
      },
      ...(bytes === undefined ? {} : { body: HttpBody.uint8Array(bytes) })
    }
  ))
  return ok(response)
    ? Committed.make({ observedOutcome: String(response.status) })
    : NotDispatched.make({ reason: `HTTP ${response.status}`, retryable: false })
})
const forgeRelease = (
  transport: RemoteTransport,
  request: CatalogPublishRequest,
  credential: string
) => Effect.gen(function*() {
  const operation = request.operation
  if (operation._tag !== "ForgeRelease") return yield* Effect.fail(failure("Expected forge release."))
  const response = yield* transport.client.execute(HttpClientRequest.post(
    `https://api.github.com/repos/${operation.repository}/releases`,
    {
      headers: {
        authorization: `Bearer ${credential}`,
        accept: "application/vnd.github+json"
      },
      body: HttpBody.jsonUnsafe({
        tag_name: operation.tag,
        name: operation.title,
        draft: operation.draft,
        prerelease: operation.prerelease
      })
    }
  ))
  return ok(response)
    ? Committed.make({ observedOutcome: String(response.status) })
    : NotDispatched.make({ reason: `GitHub HTTP ${response.status}`, retryable: false })
})
const forgeAsset = (
  transport: RemoteTransport,
  request: CatalogPublishRequest,
  bytes: Uint8Array | undefined,
  credential: string
) => Effect.gen(function*() {
  const operation = request.operation
  if (operation._tag !== "ForgeRelease") return yield* Effect.fail(failure("Expected forge release."))
  const headers = {
    authorization: `Bearer ${credential}`,
    accept: "application/vnd.github+json"
  }
  const release = yield* transport.client.execute(HttpClientRequest.get(
    `https://api.github.com/repos/${operation.repository}/releases/tags/${
      encodeURIComponent(operation.tag)
    }`,
    { headers }
  ))
  if (!ok(release)) {
    return NotDispatched.make({
      reason: `GitHub release lookup HTTP ${release.status}`,
      retryable: false
    })
  }
  const value = (yield* release.json) as unknown as { readonly id: number }
  const outputId = String(request.checkpointId).replace(/^asset:/u, "")
  const asset = operation.assets.find((item) => item.outputId === outputId)
  if (asset === undefined || bytes === undefined) {
    return NotDispatched.make({ reason: "Forge asset bytes are unavailable.", retryable: false })
  }
  const uploaded = yield* transport.client.execute(HttpClientRequest.post(
    `https://uploads.github.com/repos/${operation.repository}/releases/${
      value.id
    }/assets?name=${encodeURIComponent(asset.name)}`,
    { headers, body: HttpBody.uint8Array(bytes, asset.contentType) }
  ))
  return ok(uploaded)
    ? Committed.make({
        observedOutcome: String(uploaded.status),
        transmittedDigest: Digest.make(sha256(bytes))
      })
    : NotDispatched.make({ reason: `GitHub upload HTTP ${uploaded.status}`, retryable: false })
})
// A transport failure after the request left the process is indistinguishable
// from a commitment, so every remote publish error is commitment "unknown".
const remotePublish = (
  transport: RemoteTransport,
  request: CatalogPublishRequest,
  bytes: Uint8Array | undefined,
  credential: string
) => (request.operation._tag === "HttpPublish"
  ? httpRequest(transport, request, bytes, credential)
  : request.checkpointId === "release"
  ? forgeRelease(transport, request, credential)
  : forgeAsset(transport, request, bytes, credential)
).pipe(Effect.mapError((cause) => failure(String(cause), "unknown")))
const reconcile = (transport: RemoteTransport): DriverCatalogShape["reconcile"] =>
  (request, credential) => Effect.gen(function*() {
    const operation = request.operation
    if (operation._tag === "OpaquePublish")
      return yield* Effect.fail(failure("Opaque publication is manual-only."))
    if (isClosedProfilePublish(operation))
      return yield* Effect.fail(failure("No live closed-profile reconciliation transport is installed."))
    if (operation._tag === "ForgeRelease") {
      const response = yield* transport.client.execute(HttpClientRequest.get(
        `https://api.github.com/repos/${operation.repository}/releases/tags/${
          encodeURIComponent(operation.tag)
        }`,
        { headers: { authorization: `Bearer ${credential}`, accept: "application/vnd.github+json" } }
      ))
      if (!ok(response)) return ReadResult.make({ found: false })
      if (request.checkpointId === "release") return ReadResult.make({ found: true })
      const value = (yield* response.json) as unknown as {
        readonly assets?: ReadonlyArray<{ readonly name: string }>
      }
      const id = String(request.checkpointId).replace(/^asset:/u, "")
      const name = operation.assets.find((item) => item.outputId === id)?.name
      return ReadResult.make({
        found: value.assets?.some((asset) => asset.name === name) === true
      })
    }
    if (operation._tag === "HttpPublish") {
      const response = yield* transport.client.execute(HttpClientRequest.get(
        `${operation.wire.baseUrl}${operation.wire.pathTemplate}`,
        { headers: { authorization: `Bearer ${credential}` } }
      ))
      return ReadResult.make({ found: ok(response) })
    }
    if (operation._tag !== "PackageRegistryRelease")
      return yield* Effect.fail(failure("Closed profile transport is unavailable."))
    return ReadResult.make({ found: ok(yield* transport.client.get(operation.probeUrl)) })
  }).pipe(Effect.mapError((cause) => cause instanceof DriverError ? cause : failure(String(cause))))

export const makeCatalog = (
  structured: DriverCatalogShape["structured"],
  transport: RemoteTransport
): DriverCatalogShape => ({
  structured,
  publish: (request, handle, credential) => {
    if (isClosedProfilePublish(request.operation)) {
      return Effect.fail(failure("No live closed-profile publish transport is installed."))
    }
    if (request.operation._tag === "OpaquePublish") {
      return commandPublish(transport, request, request.operation.argv)
    }
    if (request.operation._tag === "PackageRegistryRelease") {
      return commandPublish(transport, request, request.operation.publishArgv)
    }
    return remotePublish(transport, request, handle?.bytes, credential)
  },
  reconcile: reconcile(transport)
})
