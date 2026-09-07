import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { Effect, Schema, Redacted } from "effect"
import { createPlan, loadPlan } from "@mannyc1/ts-release"
import { File, Bundle } from "@mannyc1/ts-release/bundle"
import { makeHttpTransport } from "@mannyc1/ts-release/node"
import * as GitHub from "@mannyc1/ts-release-github"
const repository = new GitHub.Repository({
  apiUrl: "https://api.github.com",
  owner: "consumer",
  name: "fixture",
})
const bytes = new TextEncoder().encode("fresh packed consumer bytes"),
  content = {
    bytes: String(bytes.length),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  }
const files = Array.from({ length: 3 }, (_, i) =>
  Schema.decodeUnknownSync(File)({
    _tag: "OwnedFile",
    logicalName: `asset${i}.bin`,
    content,
    deliveryMode: 420,
    executable: null,
    provenance: { _tag: "IntrinsicProvenance", producer: "packed-consumer" },
  }),
)
let reads = 0,
  credentials = 0
const providers = GitHub.definitions({
  bundle: new Bundle({ format: "ts-release/bundle/1", artifacts: files }),
  readContent: () => Effect.succeed(bytes.slice()),
  read: () =>
    Effect.sync(() => {
      reads++
      throw new Error("No network in this packed authoring witness")
    }),
})
assert.equal(providers.length, 6)
let cases = 0
for (const annotated of [false, true])
  for (const count of [0, 3]) {
    const common = {
      repository,
      principal: "consumer-token",
      tag: "v1.0.0",
      commit: "a".repeat(40),
    }
    const tag = await Effect.runPromise(
      annotated
        ? GitHub.annotatedTag(
            new GitHub.AnnotatedTag({
              ...common,
              message: "release\n",
              tagger: new GitHub.Tagger({
                name: "Consumer",
                email: "consumer@example.com",
                date: "2026-09-07T00:00:00Z",
              }),
            }),
          )
        : GitHub.lightweightTag(new GitHub.LightweightTag(common)),
    )
    const ref = annotated
      ? await Effect.runPromise(
          GitHub.annotatedRef(
            new GitHub.AnnotatedRef({
              repository,
              principal: common.principal,
              tag: common.tag,
              annotatedTagOperation: tag.operationId,
            }),
          ),
        )
      : tag
    const draft = await Effect.runPromise(
      GitHub.draft(
        new GitHub.DraftIntent({
          repository,
          principal: common.principal,
          tag: common.tag,
          tagSource: new GitHub.ManagedTag({ operationId: ref.operationId }),
          title: "Release",
          body: "Notes",
          prerelease: false,
        }),
      ),
    )
    const assets = await Promise.all(
      files
        .slice(0, count)
        .map((file) =>
          Effect.runPromise(
            GitHub.uploadAsset(
              new GitHub.AssetIntent({
                repository,
                principal: common.principal,
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
          principal: common.principal,
          draftOperation: draft.operationId,
          assetOperations: assets.map((asset) => asset.operationId),
        }),
      ),
    )
    const plan = await Effect.runPromise(
      createPlan("owned:packed", [tag, ...(annotated ? [ref] : []), draft, ...assets, publish]),
    )
    const loaded = await Effect.runPromise(loadPlan(JSON.parse(JSON.stringify(plan)), providers))
    assert.equal(loaded.operations.length, count + (annotated ? 4 : 3))
    const provider = providers.find((provider) => provider.definitionId === tag.definitionId),
      request = await Effect.runPromise(
        provider.prepare(tag, {
          own: { operation: tag, receipts: [], observations: [] },
          dependencies: [],
        }),
      )
    assert.equal(providers.filter((provider) => provider.ownsRequest(request)).length, 1)
    assert.equal(request.facts.byteLength, String(request.body.length))
    const transport = makeHttpTransport({
      providers,
      credentials: (binding) => {
        credentials++
        return GitHub.authorizeToken({ repository, binding, token: Redacted.make("fixture-token") })
      },
      timeoutMilliseconds: 1000,
      maximumResponseBytes: 1024,
    })
    assert.equal(typeof (await Effect.runPromise(transport.prepare(request))), "function")
    cases++
  }
assert.equal(reads, 0)
assert.equal(credentials, 4)
process.stdout.write(
  JSON.stringify({
    runtime: process.versions.bun ? `Bun${process.versions.bun}` : `Node${process.versions.node}`,
    provider: "github",
    cases,
    providers: providers.length,
    strictGraph: true,
    ownedFiles: 3,
    transportPrepared: credentials,
    mutationCount: 0,
    limits:
      "Packed public authoring, Plan loading and real transport preparation; hosted mutation acceptance is separate",
  }) + "\n",
)
