import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { createHash } from "node:crypto"
import { planRelease, renderReleasePlan } from "../src/engine/engine.js"
import {
  Operation,
  PublishedAssetsVerifyAction,
  RetryPolicy
} from "../src/grammar/operation.js"
import { ExecutionApproval } from "../src/grammar/approval.js"
import { runOperations } from "../src/run/executor.js"
import { publishedAssetUrl } from "../src/run/published.js"
import { UnsupportedArtifactStagerLayer } from "../src/pack/stager.js"
import {
  httpRequestKey,
  makeTestCommandRunnerLayer,
  makeTestReleaseHttpLayer,
  type TestHttpResponse
} from "./host-fakes.js"
import {
  makePipelineIdentity,
  releaseConfig,
  releaseIdentity,
  runEffect,
  TestGitHubApiLayer
} from "./helpers.js"

const encoder = new TextEncoder()
const bytes = (value: string) => encoder.encode(value)
const digest = (value: string, algorithm: "sha256" | "sha512") =>
  createHash(algorithm).update(bytes(value)).digest("hex")

const request = (url: string) => ({ method: "GET" as const, url, headers: [], envHeaders: [] })

const publishedConfig = (options: { github?: boolean; checksum?: boolean } = {}) => {
  const value = JSON.parse(releaseConfig({
    identity: releaseIdentity({
      description: "Release CLI.",
      homepage: "https://example.com",
      license: "MIT"
    }),
    artifacts: [{ id: "cli", path: "artifacts/release", format: "executable" }],
    pypiWheel: {
      packageName: "release",
      moduleName: "release",
      consoleScript: "release",
      requiresPython: ">=3.8",
      wheels: [{
        id: "wheel-linux",
        path: "dist/release-{version}.whl",
        wheelTag: "py3-none-manylinux2014_x86_64",
        binaries: []
      }]
    },
    ...(options.checksum === false ? {} : { checksum: { algorithm: "sha512" } }),
    publish: options.github === false ? {} : { github: { repository: "owner/repo" } }
  })) as Record<string, unknown>
  return JSON.stringify({ ...value, retry: { attempts: 3, delayMillis: 25 } })
}

const action = (algorithm: "sha256" | "sha512" = "sha256") => PublishedAssetsVerifyAction.make({
  repository: "owner/repo",
  tag: "v0.1.0",
  checksumAssetName: "checksums.txt",
  algorithm,
  assetNames: ["asset.bin"]
})

const operation = (published: PublishedAssetsVerifyAction) => Operation.make({
  id: "published:github-assets-verify",
  pipeId: "publish:github",
  phase: "verify",
  risk: "read-only",
  description: "Verify published GitHub assets against the release checksum file.",
  action: published
})

const executorLayer = (
  responses: ReadonlyMap<string, TestHttpResponse>,
  onRequest?: (url: string) => void
) => Layer.mergeAll(
  makeTestCommandRunnerLayer(),
  makeTestReleaseHttpLayer({
    responses,
    ...(onRequest === undefined ? {} : { onRequest: ({ url }) => onRequest(url) })
  }),
  TestGitHubApiLayer,
  UnsupportedArtifactStagerLayer
)

const responseMap = (
  published: PublishedAssetsVerifyAction,
  manifest: string,
  assetBytes: string,
  statuses: { readonly checksum?: number; readonly asset?: number } = {}
) => new Map([
  [httpRequestKey(request(publishedAssetUrl(
    published.repository, published.tag, published.checksumAssetName
  ))), { status: statuses.checksum ?? 200, bytes: bytes(manifest) }],
  [httpRequestKey(request(publishedAssetUrl(
    published.repository, published.tag, published.assetNames[0]!
  ))), { status: statuses.asset ?? 200, bytes: bytes(assetBytes) }]
])

const context = { root: ".", identity: makePipelineIdentity(), artifacts: [] }

const failedRecord = async (
  published: PublishedAssetsVerifyAction,
  responses: ReadonlyMap<string, TestHttpResponse>,
  onRequest?: (url: string) => void
) => {
  const error = await runEffect(runOperations(
    [operation(published)], ExecutionApproval.none, context
  ).pipe(Effect.flip), executorLayer(responses, onRequest))
  if (error._tag !== "OperationFailedError" || error.evidence === undefined) {
    throw new Error("Expected failed published verification evidence.")
  }
  return error.evidence.records[0]!
}

describe("published verification", () => {
  test("derives one flag-gated operation from GitHub and the uploaded checksum", async () => {
    const config = publishedConfig()
    const layer = makeTestCommandRunnerLayer()
    const absent = await runEffect(planRelease({ config: JSON.parse(config) }), layer)
    const disabled = await runEffect(planRelease({ config: JSON.parse(config), verifyPublished: false }), layer)
    const plan = await runEffect(planRelease({ config: JSON.parse(config), verifyPublished: true }), layer)
    const derived = plan.operations.at(-1)

    expect(JSON.stringify(absent)).toBe(JSON.stringify(disabled))
    expect(derived).toMatchObject({
      id: "published:github-assets-verify",
      pipeId: "publish:github",
      phase: "verify",
      risk: "read-only",
      description: "Verify published GitHub assets against the release checksum file.",
      retry: RetryPolicy.make({ attempts: 3, delayMillis: 25 }),
      action: {
        _tag: "published-assets-verify",
        repository: "owner/repo",
        tag: "v0.1.0",
        checksumAssetName: "release_0.1.0_checksums.txt",
        algorithm: "sha512",
        assetNames: ["release"]
      }
    })
    expect(plan.operations.filter(({ id }) => id === derived?.id)).toHaveLength(1)
    expect(derived?.action._tag === "published-assets-verify" && derived.action.assetNames)
      .not.toContain("release-0.1.0.whl")
    expect(renderReleasePlan(plan, "text")).toContain("github-assets: verify owner/repo v0.1.0 assets=1")
  })

  test("emits no operation without both GitHub and an uploaded checksum", async () => {
    for (const config of [publishedConfig({ github: false }), publishedConfig({ checksum: false })]) {
      const plan = await runEffect(planRelease({ config: JSON.parse(config), verifyPublished: true }),
        makeTestCommandRunnerLayer())
      expect(plan.operations.some(({ id }) => id === "published:github-assets-verify")).toBe(false)
    }
  })

  test("verifies sha256 and sha512 downloaded bytes", async () => {
    for (const algorithm of ["sha256", "sha512"] as const) {
      const published = action(algorithm)
      const manifest = `${digest("payload", algorithm)}  asset.bin\r\n`
      const evidence = await runEffect(runOperations(
        [operation(published)], ExecutionApproval.none, context
      ), executorLayer(responseMap(published, manifest, "payload")))

      expect(evidence.records[0]).toMatchObject({
        status: "passed",
        message: "Published GitHub asset checksum verification passed.",
        outcome: { _tag: "published-assets", checks: [{ passed: true }, { passed: true }] }
      })
    }
  })

  test("records digest mismatch and missing, duplicate, or malformed expected rows", async () => {
    const published = action()
    const good = digest("payload", "sha256")
    for (const [manifest, assetBytes] of [
      [`${good}  asset.bin\n`, "wrong"],
      [`${good}  foreign.bin\n`, "payload"],
      [`${good}  asset.bin\n${good}  asset.bin\n`, "payload"],
      [`bad  asset.bin\n`, "payload"]
    ] as const) {
      const record = await failedRecord(published, responseMap(published, manifest, assetBytes))
      expect(record.status).toBe("failed")
      expect(record.message).toContain("Published GitHub asset checksum verification failed:")
      expect(record.outcome?._tag === "published-assets" && record.outcome.checks.some(({ passed }) => !passed))
        .toBe(true)
    }
  })

  test("records non-2xx checksum and asset responses", async () => {
    const published = action()
    const manifest = `${digest("payload", "sha256")}  asset.bin\n`
    for (const statuses of [{ checksum: 404 }, { asset: 503 }]) {
      const record = await failedRecord(published, responseMap(published, manifest, "payload", statuses))
      expect(record.status).toBe("failed")
    }
  })

  test("never routes downloads from foreign manifest rows", async () => {
    const published = action()
    const requested: Array<string> = []
    const manifest = [
      `${digest("foreign", "sha256")}  foreign.bin`,
      `${digest("payload", "sha256")}  asset.bin`
    ].join("\n")
    const evidence = await runEffect(runOperations(
      [operation(published)], ExecutionApproval.none, context
    ), executorLayer(responseMap(published, `${manifest}\n`, "payload"), (url) => requested.push(url)))

    expect(evidence.records[0]?.status).toBe("passed")
    expect(requested.some((url) => url.endsWith("/foreign.bin"))).toBe(false)
    expect(requested).toHaveLength(2)
  })

  test("records an unreachable asset when no byte response is registered", async () => {
    const published = action()
    const checksumUrl = publishedAssetUrl(published.repository, published.tag, published.checksumAssetName)
    const responses = new Map([[httpRequestKey(request(checksumUrl)), {
      status: 200,
      bytes: bytes(`${digest("payload", "sha256")}  asset.bin\n`)
    }]])
    const record = await failedRecord(published, responses)
    expect(record.outcome).toMatchObject({
      _tag: "published-assets",
      checks: [{ passed: true }, { passed: false }]
    })
  })
})
