import { expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { File } from "@mannyc1/ts-release/bundle"
import { createOperation, createPlan, loadPlan } from "@mannyc1/ts-release"
import * as GitHub from "../../../packages/github/src/index.js"
import { descriptors, validatePlan } from "../../../packages/github/src/Graph.js"

const repository = new GitHub.Repository({
  apiUrl: "https://api.github.com",
  owner: "owner",
  name: "release",
})
const base = { repository, tag: "v1.0.0", principal: "fixture" }
const file = Schema.decodeUnknownSync(File)({
  _tag: "OwnedFile",
  logicalName: "asset",
  content: { bytes: "1", sha256: "a".repeat(64) },
  deliveryMode: 420,
  executable: null,
  provenance: { _tag: "IntrinsicProvenance", producer: "graph-fixture" },
})
async function fixture(count: number, annotated = false) {
  const object = annotated
    ? await Effect.runPromise(
        GitHub.annotatedTag(
          new GitHub.AnnotatedTag({
            ...base,
            commit: "a".repeat(40),
            message: "release",
            tagger: new GitHub.Tagger({
              name: "Author",
              email: "author@example.com",
              date: "2026-09-07T00:00:00Z",
            }),
          }),
        ),
      )
    : undefined
  const tag = object
    ? await Effect.runPromise(
        GitHub.annotatedRef(
          new GitHub.AnnotatedRef({ ...base, annotatedTagOperation: object.operationId }),
        ),
      )
    : await Effect.runPromise(
        GitHub.lightweightTag(new GitHub.LightweightTag({ ...base, commit: "a".repeat(40) })),
      )
  const draft = await Effect.runPromise(
    GitHub.draft(
      new GitHub.DraftIntent({
        ...base,
        tagSource: new GitHub.ManagedTag({ operationId: tag.operationId }),
        title: "Release",
        body: "Notes",
        prerelease: false,
      }),
    ),
  )
  const assets = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      Effect.runPromise(
        GitHub.uploadAsset(
          new GitHub.AssetIntent({
            repository,
            principal: base.principal,
            draftOperation: draft.operationId,
            file,
            publicName: `asset-${i}`,
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
        principal: base.principal,
        draftOperation: draft.operationId,
        assetOperations: assets.map((op) => op.operationId),
      }),
    ),
  )
  const operations = [...(object ? [object] : []), tag, draft, ...assets, publish]
  return { object, tag, draft, assets, publish, operations }
}
for (const count of [0, 3])
  for (const annotated of [false, true])
    test(`${annotated ? "annotated" : "lightweight"} graph derives every required edge for ${count} assets`, async () => {
      const f = await fixture(count, annotated)
      expect(() => validatePlan(f.operations)).not.toThrow()
      expect(f.operations).toHaveLength(count + (annotated ? 4 : 3))
      expect(f.draft.dependsOn).toEqual([f.tag.operationId])
      expect(f.publish.dependsOn).toEqual(
        [f.draft.operationId, ...f.assets.map((op) => op.operationId)].sort(),
      )
      const plan = await Effect.runPromise(createPlan("owned-bundle", f.operations))
      expect(
        await Effect.runPromise(
          loadPlan(
            plan,
            Object.values(descriptors).map((descriptor) => ({
              ...descriptor,
              validatePlan: validatePlan,
            })),
          ),
        ),
      ).toEqual(plan)
    })
test("complete GitHub graph rejects omitted assets, wrong parents/repositories, duplicate names and stripped dependency edges", async () => {
  const f = await fixture(3, true)
  const forgedPublish = await Effect.runPromise(
    GitHub.publish(
      new GitHub.PublishIntent({
        ...(f.publish.intent as GitHub.PublishIntent),
        assetOperations: f.assets.slice(0, 2).map((op) => op.operationId),
      }),
    ),
  )
  const wrongDraft = await Effect.runPromise(
    GitHub.uploadAsset(
      new GitHub.AssetIntent({
        ...(f.assets[0]!.intent as GitHub.AssetIntent),
        draftOperation: f.tag.operationId,
      }),
    ),
  )
  const foreign = await Effect.runPromise(
    GitHub.uploadAsset(
      new GitHub.AssetIntent({
        ...(f.assets[0]!.intent as GitHub.AssetIntent),
        repository: new GitHub.Repository({ ...repository, name: "foreign" }),
      }),
    ),
  )
  const duplicateName = await Effect.runPromise(
    GitHub.uploadAsset(
      new GitHub.AssetIntent({
        ...(f.assets[0]!.intent as GitHub.AssetIntent),
        mediaType: "application/zip",
      }),
    ),
  )
  const stripped = await Effect.runPromise(createOperation(descriptors.ref, f.tag.intent))
  for (const operations of [
    [...f.operations.filter((op) => op !== f.publish), forgedPublish],
    [...f.operations, wrongDraft],
    [...f.operations, foreign],
    [...f.operations, duplicateName],
    f.operations.map((op) => (op === f.tag ? stripped : op)),
  ])
    expect(() => validatePlan(operations)).toThrow()
})
