import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { Effect, Schema, Redacted } from "effect"
import * as GitHub from "@mannyc1/ts-release-github"
import { Bundle, File } from "@mannyc1/ts-release/bundle"
import { makeHttpRead } from "@mannyc1/ts-release/node"
const repository = new GitHub.Repository({
  apiUrl: "https://api.github.com",
  owner: "mannyc2",
  name: "ts-release",
})
// Existing account; token stays in this process and never enters the retained result.
const token = Redacted.make(
  execFileSync("gh", ["auth", "token"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim(),
)
const urls = [],
  read = makeHttpRead({
    credentials: (binding) => GitHub.authorizeToken({ repository, binding, token }),
    timeoutMilliseconds: 15000,
    maximumResponseBytes: 4 * 1024 * 1024,
  })
const draft = await Effect.runPromise(
  GitHub.draft(
    new GitHub.DraftIntent({
      repository,
      principal: "existing-github-account",
      tag: "v0.3.0",
      tagSource: new GitHub.ExistingTag({ commit: "cea8c957090d89c88838782c4d3265521f47d895" }),
      title: "@mannyc1/ts-release 0.3.0",
      body: "",
      prerelease: false,
    }),
  ),
)
// Load selected public metadata through the actual native HTTP host first.
const scope = JSON.stringify({
  operation: draft,
  targetCommit: "cea8c957090d89c88838782c4d3265521f47d895",
  parents: [],
})
const metadataResponse = await Effect.runPromise(
  read({
    method: "GET",
    url: "https://api.github.com/repos/mannyc2/ts-release/releases/380698559",
    headers: [
      ["accept", "application/vnd.github+json"],
      ["x-github-api-version", "2022-11-28"],
      ["user-agent", "ts-release"],
    ],
    principal: "existing-github-account",
    scope,
  }),
)
assert.equal(metadataResponse.status, 200)
const metadata = JSON.parse(new TextDecoder().decode(metadataResponse.body)),
  artifacts = []
const operation = await Effect.runPromise(
  GitHub.draft(new GitHub.DraftIntent({ ...draft.intent, body: metadata.body ?? "" })),
)
const providers = GitHub.definitions({
  bundle: new Bundle({ format: "ts-release/bundle/2", artifacts }),
  readContent: () => Effect.die(new Error("Live GET acceptance never reads owned bytes")),
  read: (request) => {
    urls.push(request.url)
    return read(request)
  },
})
const context = { own: { operation, receipts: [], observations: [] }, dependencies: [] }
const observed = await Effect.runPromise(
  providers.find((p) => p.definitionId === "github.draft").observe(operation, context),
)
assert.equal(observed.status, "Satisfied")
assert.equal(observed.evidence.facts.releaseId, "380698559")
assert.equal(observed.evidence.observedCommit, "cea8c957090d89c88838782c4d3265521f47d895")
const asset = metadata.assets.find((asset) => asset.name === "checksum-sha256")
assert.ok(asset)
const binaryRequest = {
  method: "GET",
  url: asset.url,
  principal: "existing-github-account",
  scope: observed.evidence.scope,
  headers: [
    ["accept", "application/octet-stream"],
    ["x-github-api-version", "2022-11-28"],
    ["user-agent", "ts-release"],
  ],
}
let binary = await Effect.runPromise(read(binaryRequest))
const downloadStatuses = [binary.status]
if (binary.status === 302) {
  const location = new URL(binary.headers.location)
  assert.equal(location.protocol, "https:")
  assert.ok(
    ["release-assets.githubusercontent.com", "objects.githubusercontent.com"].includes(
      location.hostname,
    ),
  )
  binary = await Effect.runPromise(
    read({ ...binaryRequest, url: location.href, principal: "github:public-download" }),
  )
  downloadStatuses.push(binary.status)
}
assert.equal(binary.status, 200)
const bytes = new Uint8Array(binary.body),
  digest = createHash("sha256").update(bytes).digest("hex")
assert.equal(bytes.length, asset.size)
assert.equal(`sha256:${digest}`, asset.digest)
const file = Schema.decodeUnknownSync(File)({
  _tag: "OwnedFile",
  logicalName: asset.name,
  content: { bytes: bytes.length, sha256: digest },
  deliveryMode: 420,
  executable: null,
  producedBy: { name: "native-github-download", version: "fixture" },
})
const assetOperation = await Effect.runPromise(
  GitHub.uploadAsset(
    new GitHub.AssetIntent({
      repository,
      principal: "existing-github-account",
      draftOperation: operation.operationId,
      file,
      publicName: asset.name,
      mediaType: asset.content_type,
    }),
  ),
)
const assetProviders = GitHub.definitions({
  bundle: new Bundle({ format: "ts-release/bundle/2", artifacts: [file] }),
  readContent: () => Effect.succeed(bytes.slice()),
  read,
})
const assetObservation = await Effect.runPromise(
  assetProviders
    .find((p) => p.definitionId === "github.asset")
    .observe(assetOperation, {
      own: { operation: assetOperation, receipts: [], observations: [] },
      dependencies: [{ operation, receipts: [], observations: [observed] }],
    }),
)
assert.equal(assetObservation.status, "Satisfied")
assert.equal(assetObservation.evidence.facts.assetId, String(asset.id))
process.stdout.write(
  JSON.stringify({
    runtime: process.versions.bun ? `Bun${process.versions.bun}` : `Node${process.versions.node}`,
    status: observed.status,
    releaseId: observed.evidence.facts.releaseId,
    commit: observed.evidence.observedCommit,
    apiVersion: "2022-11-28",
    urls,
    asset: {
      id: String(asset.id),
      name: asset.name,
      bytes: bytes.length,
      sha256: digest,
      downloadStatuses,
      status: assetObservation.status,
    },
    mutationCount: 0,
    limitations:
      "Historical hosted GET and checksum download only; no hosted mutation or new publication acceptance",
  }) + "\n",
)
