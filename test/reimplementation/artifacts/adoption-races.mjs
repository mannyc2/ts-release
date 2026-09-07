import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtemp, readdir, rm, symlink, unlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { Effect, FileSystem } from "effect"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Artifact from "effect-build/Artifact"
import * as Tree from "effect-build/Author/Tree"
import { adoptTree } from "../../../packages/ts-release/dist/EffectBuild.js"
import { fileContentOwner, nodeDirectoryReader } from "../../../packages/ts-release/dist/Node.js"

const root = await mkdtemp("/tmp/ts-release-adoption-races-")
const run = (effect) => Effect.runPromise(effect.pipe(Effect.provide(NodeServices.layer)))
const cells = []
try {
  for (const stage of ["source", "snapshot"]) {
    for (const kind of ["fifo", "symlink"]) {
      const name = `${stage}-${kind}`
      const source = await run(
        Tree.publish(
          {
            outdir: join(root, name),
            observation: "hashed",
            provenance: Artifact.intrinsicProvenance("native-adoption-race"),
          },
          (candidate) =>
            Effect.gen(function* () {
              const fs = yield* FileSystem.FileSystem
              yield* fs.writeFileString(join(candidate, "file"), "exact content")
            }),
        ),
      )
      const owner = fileContentOwner(
        join(root, `${name}-objects`),
        nodeDirectoryReader(process.env.TS_RELEASE_HTTP_PEER_NODE ?? "/usr/bin/node"),
      )
      const snapshots = []
      let swapped = false
      const raced = {
        ...owner,
        putFileOwned: (input) =>
          Effect.gen(function* () {
            assert(Object.isFrozen(input))
            if (!swapped && input.path.startsWith(source.root + "/") === (stage === "source")) {
              swapped = true
              yield* Effect.promise(async () => {
                await unlink(input.path)
                if (kind === "fifo") execFileSync("mkfifo", [input.path])
                else {
                  const target = join(root, `${name}-target`)
                  await writeFile(target, "exact content")
                  await symlink(target, input.path)
                }
              })
            }
            return yield* owner.putFileOwned(input)
          }),
      }
      const before = Date.now()
      const result = await run(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem
          const observed = {
            ...fs,
            makeTempDirectory: (options) =>
              fs.makeTempDirectory({ ...options, directory: root }).pipe(
                Effect.tap((path) =>
                  Effect.sync(() => {
                    snapshots.push(path)
                  }),
                ),
              ),
          }
          return yield* adoptTree(raced, "tree", source).pipe(
            Effect.provideService(FileSystem.FileSystem, observed),
            Effect.catch((error) => Effect.succeed(error)),
          )
        }),
      )
      assert(swapped)
      assert.equal(result._tag, "TreeVerificationFailed")
      const remaining = await readdir(root)
      assert(snapshots.every((path) => !remaining.includes(path.split("/").at(-1))))
      cells.push({
        stage,
        kind,
        status: result._tag,
        milliseconds: Date.now() - before,
        privateSnapshots: snapshots.length,
        retainedSnapshots: 0,
      })
    }
  }
  console.log(
    JSON.stringify({ runtime: process.version, bun: process.versions.bun ?? null, cells }),
  )
} finally {
  await rm(root, { recursive: true, force: true })
}
