import * as Effect from "effect/Effect"
import {
  Committed, CommitmentUnknown, NotDispatched, ReadResult,
  type CatalogPublishRequest, type DriverCatalogShape
} from "./services.js"
import { Digest } from "../model/primitives.js"
import { DriverError } from "../model/run.js"
import { failure, selectedEnvironment, sha256 } from "./utils.js"

const commandPublish = (
  request: CatalogPublishRequest,
  argv: ReadonlyArray<string>
) => Effect.sync(() => {
  const operation = request.operation
  const names = operation._tag === "OpaquePublish" ||
    operation._tag === "PackageRegistryRelease"
    ? operation.environmentNames
    : []
  const result = Bun.spawnSync([...argv], {
    cwd: ".",
    env: selectedEnvironment(names),
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe"
  })
  return result.exitCode === 0
    ? Committed.make({ observedOutcome: result.stdout.toString().trim() || "exit-0" })
    : CommitmentUnknown.make({ failure: `Publisher exited ${result.exitCode} after dispatch.` })
})
const httpRequest = async (
  request: CatalogPublishRequest,
  bytes: Uint8Array | undefined,
  credential: string
) => {
  if (request.operation._tag !== "HttpPublish") throw failure("Expected HTTP publication.")
  const response = await fetch(
    `${request.operation.wire.baseUrl}${request.operation.wire.pathTemplate}`,
    {
      method: request.operation.method,
      headers: { authorization: `Bearer ${credential}` },
      ...(bytes === undefined ? {} : { body: Buffer.from(bytes) })
    }
  )
  return response.ok
    ? Committed.make({ observedOutcome: String(response.status) })
    : NotDispatched.make({ reason: `HTTP ${response.status}`, retryable: false })
}
const forgeRelease = async (request: CatalogPublishRequest, credential: string) => {
  if (request.operation._tag !== "ForgeRelease") throw failure("Expected forge release.")
  const response = await fetch(
    `https://api.github.com/repos/${request.operation.repository}/releases`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${credential}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        tag_name: request.operation.tag,
        name: request.operation.title,
        draft: request.operation.draft,
        prerelease: request.operation.prerelease
      })
    }
  )
  return response.ok
    ? Committed.make({ observedOutcome: String(response.status) })
    : NotDispatched.make({ reason: `GitHub HTTP ${response.status}`, retryable: false })
}
const forgeAsset = async (
  request: CatalogPublishRequest,
  bytes: Uint8Array | undefined,
  credential: string
) => {
  if (request.operation._tag !== "ForgeRelease") throw failure("Expected forge release.")
  const headers = {
    authorization: `Bearer ${credential}`,
    accept: "application/vnd.github+json"
  }
  const release = await fetch(
    `https://api.github.com/repos/${request.operation.repository}/releases/tags/${
      encodeURIComponent(request.operation.tag)
    }`,
    { headers }
  )
  if (!release.ok) {
    return NotDispatched.make({
      reason: `GitHub release lookup HTTP ${release.status}`,
      retryable: false
    })
  }
  const value = await release.json() as { readonly id: number }
  const outputId = String(request.checkpointId).replace(/^asset:/u, "")
  const asset = request.operation.assets.find((item) => item.outputId === outputId)
  if (asset === undefined || bytes === undefined) {
    return NotDispatched.make({ reason: "Forge asset bytes are unavailable.", retryable: false })
  }
  const uploaded = await fetch(
    `https://uploads.github.com/repos/${request.operation.repository}/releases/${
      value.id
    }/assets?name=${encodeURIComponent(asset.name)}`,
    {
      method: "POST",
      headers: { ...headers, "content-type": asset.contentType },
      body: Buffer.from(bytes)
    }
  )
  return uploaded.ok
    ? Committed.make({
        observedOutcome: String(uploaded.status),
        transmittedDigest: Digest.make(sha256(bytes))
      })
    : NotDispatched.make({ reason: `GitHub upload HTTP ${uploaded.status}`, retryable: false })
}
const remotePublish = (
  request: CatalogPublishRequest,
  bytes: Uint8Array | undefined,
  credential: string
) => Effect.tryPromise({
  try: () => request.operation._tag === "HttpPublish"
    ? httpRequest(request, bytes, credential)
    : request.checkpointId === "release"
    ? forgeRelease(request, credential)
    : forgeAsset(request, bytes, credential),
  catch: (cause) => failure(String(cause), "unknown")
})
const reconcile = (
  request: Parameters<DriverCatalogShape["reconcile"]>[0],
  credential: string
) => Effect.tryPromise({
  try: async () => {
    const operation = request.operation
    if (operation._tag === "OpaquePublish") throw failure("Opaque publication is manual-only.")
    if (operation._tag === "PackageStorePublish")
      throw failure("No live package store reconciliation transport is installed.")
    if (operation._tag === "ForgeRelease") {
      const response = await fetch(
        `https://api.github.com/repos/${operation.repository}/releases/tags/${
          encodeURIComponent(operation.tag)
        }`,
        { headers: { authorization: `Bearer ${credential}`, accept: "application/vnd.github+json" } }
      )
      if (!response.ok) return ReadResult.make({ found: false })
      if (request.checkpointId === "release") return ReadResult.make({ found: true })
      const value = await response.json() as {
        readonly assets?: ReadonlyArray<{ readonly name: string }>
      }
      const id = String(request.checkpointId).replace(/^asset:/u, "")
      const name = operation.assets.find((item) => item.outputId === id)?.name
      return ReadResult.make({
        found: value.assets?.some((asset) => asset.name === name) === true
      })
    }
    if (operation._tag === "HttpPublish") {
      const response = await fetch(`${operation.wire.baseUrl}${operation.wire.pathTemplate}`, {
        headers: { authorization: `Bearer ${credential}` }
      })
      return ReadResult.make({ found: response.ok })
    }
    return ReadResult.make({ found: (await fetch(operation.probeUrl)).ok })
  },
  catch: (cause) => cause instanceof DriverError ? cause : failure(String(cause))
})

export const makeNodeCatalog = (
  structured: DriverCatalogShape["structured"]
): DriverCatalogShape => ({
  structured,
  publish: (request, handle, credential) => {
    if (request.operation._tag === "PackageStorePublish") {
      return Effect.fail(failure("No live package store transport is installed."))
    }
    if (request.operation._tag === "OpaquePublish") {
      return commandPublish(request, request.operation.argv)
    }
    if (request.operation._tag === "PackageRegistryRelease") {
      return commandPublish(request, request.operation.publishArgv)
    }
    return remotePublish(request, handle?.bytes, credential)
  },
  reconcile
})
