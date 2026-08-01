import { describe, expect, test } from "@effect/bun-test"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as HttpClient from "effect/unstable/http/HttpClient"
import { LiveDriversLayer } from "../../src/drivers/local.js"
import { makeCatalog } from "../../src/drivers/remote.js"
import {
  CatalogPublishRequest,
  DriverCatalog,
  VerifiedContentHandle
} from "../../src/drivers/services.js"
import {
  ForgeRelease,
  HttpPublish,
  OpaquePublish,
  PublishCredential,
  WireContract
} from "../../src/model/operation.js"
import {
  CheckpointId,
  CredentialName,
  Digest,
  OperationId,
  OutputId,
  ProfileId,
  SafeRelativePath,
  SnapshotId
} from "../../src/model/primitives.js"
import { DriverError, MaterializedOutput } from "../../src/model/run.js"
import {
  recordingHttpClient,
  recordingSpawner,
  type HttpExchange,
  type SpawnedCommand
} from "./host-doubles.js"

const asset = { name: "plugin.zip", contentType: "application/zip" }
const forge = ForgeRelease.make({
  id: OperationId.make("publish:forge"), inputs: [OutputId.make("plugin")], outputs: [],
  repository: "mannyc2/ts-release", tag: "v1.2.3", title: "v1.2.3",
  draft: false, prerelease: false,
  assets: [{
    outputId: OutputId.make("plugin"), path: SafeRelativePath.make("dist/plugin.zip"),
    name: asset.name, contentType: asset.contentType
  }],
  credential: PublishCredential.make({ name: CredentialName.make("GITHUB_TOKEN") }),
  contractFixtureId: "forge/github/v1"
})
const http = HttpPublish.make({
  id: OperationId.make("publish:http"), inputs: [], outputs: [], method: "POST",
  wire: WireContract.make({
    profileId: ProfileId.make("http/webhook"), contractFixtureId: "http/v1",
    baseUrl: "https://example.test", pathTemplate: "/hook",
    responseShapeId: "empty-v1", pagination: "none",
    commitment: "status-2xx", reconciliation: "get-same-resource"
  }),
  credential: PublishCredential.make({ name: CredentialName.make("HOOK_TOKEN") })
})
const opaque = OpaquePublish.make({
  id: OperationId.make("publish:opaque"), inputs: [], outputs: [],
  argv: ["publisher", "--now"], cwd: SafeRelativePath.make("."),
  environmentNames: [CredentialName.make("OPAQUE_TOKEN")],
  credential: PublishCredential.make({ name: CredentialName.make("OPAQUE_TOKEN") }),
  contractFixtureId: "opaque/v1", reconciliation: "manual-only", irreversible: true
})

const bytes = new TextEncoder().encode("archive-bytes")
const facts = MaterializedOutput.make({
  outputId: OutputId.make("plugin"),
  snapshotId: SnapshotId.make("a".repeat(64)),
  digest: Digest.make(
    "2a3b0e1e9a37a5b18b13b1a6ba0e1d9e9c46f36a2e9b13cb3e5a5e07dfd5f30d"
  ),
  size: bytes.length,
  inode: 1
})
const request = (operation: typeof forge | typeof http | typeof opaque, checkpointId: string) =>
  CatalogPublishRequest.make({
    operation, checkpointId: CheckpointId.make(checkpointId),
    clientReconciliationKey: "stable-key"
  })
const handle = () => VerifiedContentHandle.from(
  MaterializedOutput.make({ ...facts, digest: Digest.make(
    new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
  ) }),
  bytes
)
const withCatalog = <A>(
  reply: (exchange: HttpExchange) => { readonly status: number, readonly body?: unknown },
  spawn: (command: SpawnedCommand) => { readonly exitCode: number, readonly stdout?: string },
  use: (catalog: {
    readonly exchanges: Array<HttpExchange>, readonly commands: Array<SpawnedCommand>
  }) => Effect.Effect<A, DriverError, DriverCatalog>,
  env: Record<string, string> = {}
): Promise<A> => {
  const client = recordingHttpClient(reply)
  const spawner = recordingSpawner(spawn)
  return Effect.runPromise(use({ exchanges: client.exchanges, commands: spawner.commands }).pipe(
    Effect.provide(LiveDriversLayer.pipe(
      Layer.provide(Layer.mergeAll(client.layer, spawner.layer))
    )),
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env })))
  ))
}
const publish = (request: CatalogPublishRequest, content?: VerifiedContentHandle) =>
  Effect.gen(function*() {
    const catalog = yield* DriverCatalog
    return yield* catalog.publish(request, content, "token")
  })
const reconcile = (request: CatalogPublishRequest) => Effect.gen(function*() {
  const catalog = yield* DriverCatalog
  return yield* catalog.reconcile(request, "token")
})

describe("remote driver transports", () => {
  test("forge release posts the tag body and reports the observed status", async () => {
    const result = await withCatalog(
      () => ({ status: 201 }),
      () => ({ exitCode: 0 }),
      ({ exchanges }) => publish(request(forge, "release")).pipe(
        Effect.map((outcome) => ({ outcome, exchanges: [...exchanges] })))
    )
    expect(result.outcome._tag).toBe("Committed")
    expect(result.outcome).toMatchObject({ observedOutcome: "201" })
    expect(result.exchanges).toHaveLength(1)
    expect(result.exchanges[0]?.method).toBe("POST")
    expect(result.exchanges[0]?.url).toBe("https://api.github.com/repos/mannyc2/ts-release/releases")
    expect(result.exchanges[0]?.headers.authorization).toBe("Bearer token")
  })

  test("forge release reports a refused status without dispatching", async () => {
    const outcome = await withCatalog(
      () => ({ status: 422 }),
      () => ({ exitCode: 0 }),
      () => publish(request(forge, "release"))
    )
    expect(outcome).toMatchObject({ _tag: "NotDispatched", reason: "GitHub HTTP 422" })
  })

  test("forge asset looks the release up, uploads bytes, and transmits their digest", async () => {
    const result = await withCatalog(
      (exchange) => exchange.method === "GET" ? { status: 200, body: { id: 99 } } : { status: 201 },
      () => ({ exitCode: 0 }),
      ({ exchanges }) => publish(request(forge, "asset:plugin"), handle()).pipe(
        Effect.map((outcome) => ({ outcome, exchanges: [...exchanges] })))
    )
    expect(result.outcome._tag).toBe("Committed")
    expect(result.exchanges.map((item) => item.url)).toEqual([
      "https://api.github.com/repos/mannyc2/ts-release/releases/tags/v1.2.3",
      "https://uploads.github.com/repos/mannyc2/ts-release/releases/99/assets?name=plugin.zip"
    ])
  })

  test("a missing forge release refuses the asset with the lookup status", async () => {
    const outcome = await withCatalog(
      () => ({ status: 404 }),
      () => ({ exitCode: 0 }),
      () => publish(request(forge, "asset:plugin"), handle())
    )
    expect(outcome).toMatchObject({
      _tag: "NotDispatched", reason: "GitHub release lookup HTTP 404"
    })
  })

  test("an asset checkpoint without bytes refuses instead of uploading nothing", async () => {
    const outcome = await withCatalog(
      () => ({ status: 200, body: { id: 99 } }),
      () => ({ exitCode: 0 }),
      () => publish(request(forge, "asset:plugin"))
    )
    expect(outcome).toMatchObject({
      _tag: "NotDispatched", reason: "Forge asset bytes are unavailable."
    })
  })

  test("http publication carries the bearer credential and the wire path", async () => {
    const result = await withCatalog(
      () => ({ status: 204 }),
      () => ({ exitCode: 0 }),
      ({ exchanges }) => publish(request(http, "dispatch")).pipe(
        Effect.map((outcome) => ({ outcome, exchanges: [...exchanges] })))
    )
    expect(result.outcome).toMatchObject({ _tag: "Committed", observedOutcome: "204" })
    expect(result.exchanges[0]?.url).toBe("https://example.test/hook")
    expect(result.exchanges[0]?.method).toBe("POST")
  })

  test("a refused http publication reports the status as not dispatched", async () => {
    const outcome = await withCatalog(
      () => ({ status: 500 }),
      () => ({ exitCode: 0 }),
      () => publish(request(http, "dispatch"))
    )
    expect(outcome).toMatchObject({ _tag: "NotDispatched", reason: "HTTP 500" })
  })

  test("reconciliation observes a forge asset by name and a missing tag as absent", async () => {
    const found = await withCatalog(
      () => ({ status: 200, body: { assets: [{ name: asset.name }] } }),
      () => ({ exitCode: 0 }),
      () => reconcile(request(forge, "asset:plugin"))
    )
    expect(found.found).toBe(true)
    const absent = await withCatalog(
      () => ({ status: 404 }),
      () => ({ exitCode: 0 }),
      () => reconcile(request(forge, "asset:plugin"))
    )
    expect(absent.found).toBe(false)
    const other = await withCatalog(
      () => ({ status: 200, body: { assets: [{ name: "unrelated.zip" }] } }),
      () => ({ exitCode: 0 }),
      () => reconcile(request(forge, "asset:plugin"))
    )
    expect(other.found).toBe(false)
  })

  test("command publish spawns the argv with a closed environment", async () => {
    const result = await withCatalog(
      () => ({ status: 200 }),
      () => ({ exitCode: 0, stdout: "published\n" }),
      ({ commands }) => publish(request(opaque, "dispatch")).pipe(
        Effect.map((outcome) => ({ outcome, commands: [...commands] }))),
      { PATH: "/usr/bin", OPAQUE_TOKEN: "secret", UNRELATED_SECRET: "leak" }
    )
    expect(result.outcome).toMatchObject({ _tag: "Committed", observedOutcome: "published" })
    expect(result.commands).toHaveLength(1)
    expect(result.commands[0]?.argv).toEqual(["publisher", "--now"])
    expect(result.commands[0]?.env).toEqual({ PATH: "/usr/bin", OPAQUE_TOKEN: "secret" })
  })

  test("a nonzero publisher exit is a commitment the client cannot resolve", async () => {
    const outcome = await withCatalog(
      () => ({ status: 200 }),
      () => ({ exitCode: 7 }),
      () => publish(request(opaque, "dispatch"))
    )
    expect(outcome).toMatchObject({
      _tag: "CommitmentUnknown", failure: "Publisher exited 7 after dispatch."
    })
  })

  test("a publisher that never starts resolves retryable, not dead or unknown", async () => {
    const catalog = makeCatalog(() => Effect.die("structured is unused"), {
      client: HttpClient.make(() => Effect.die("http is unused")),
      run: () => Effect.fail(DriverError.make({
        reason: "spawn ENOENT",
        commitment: "before-commit"
      }))
    })
    const outcome = await Effect.runPromise(
      catalog.publish(request(opaque, "dispatch"), undefined, "token")
    )
    expect(outcome).toMatchObject({
      _tag: "NotDispatched",
      reason: "Publisher could not start: spawn ENOENT",
      retryable: true
    })
  })

  test("http publication transmits the reconciliation key as the idempotency key", async () => {
    const result = await withCatalog(
      () => ({ status: 204 }),
      () => ({ exitCode: 0 }),
      ({ exchanges }) => publish(request(http, "dispatch")).pipe(
        Effect.map((outcome) => ({ outcome, exchanges: [...exchanges] })))
    )
    expect(result.outcome._tag).toBe("Committed")
    expect(result.exchanges[0]?.headers["idempotency-key"]).toBe("stable-key")
  })
})
