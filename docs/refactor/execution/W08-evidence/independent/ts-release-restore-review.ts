import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { chmod, lstat, mkdir, mkdtemp, readdir, rm } from "node:fs/promises"
import { join } from "node:path"
import { Effect, Exit } from "/tmp/ts-release-implementation/node_modules/effect/dist/index.js"
import { restoreTree } from "/tmp/ts-release-implementation/packages/ts-release/src/EffectBuild.ts"
import { finalize } from "/tmp/ts-release-implementation/packages/ts-release/src/Bundle.ts"
import { treeManifest } from "/tmp/ts-release-implementation/packages/ts-release/src/internal/TreeManifest.ts"
import { makeSources, run } from "/tmp/ts-release-implementation/test/reimplementation/artifacts/apple-fixtures.ts"
const root = await mkdtemp("/tmp/ts-release-restore-review-")
try {
  const { owner, collection } = await makeSources(root)
  const input = collection.preparations[0]!
  if (input._tag !== "AppPreparation") throw new Error("fixture")
  const initial = { ...input.source, rootMode: 0o555 }
  const source = { ...initial, upstreamManifestSha256: createHash("sha256").update(treeManifest(initial)).digest("hex") }
  const admitted = await run(finalize([source]))
  assert.equal(admitted.artifacts[0]!.rootMode, 0o555)
  const destination = join(root,"restored")
  const result = await run(Effect.exit(restoreTree(owner,source,destination,source.provenance)))
  assert.equal(Exit.isFailure(result),true)
  const mode = (await lstat(destination)).mode & 0o777
  assert.equal(mode,0o755)
  assert.deepEqual(await readdir(destination),["Contents"])
  console.log(JSON.stringify({ admittedRootMode: "0555", outcome: result, destinationRemains: true, committedRootMode: "0755" },null,2))
} finally {
  await rm(root,{recursive:true,force:true})
}
