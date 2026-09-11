import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, unlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { Effect } from "effect"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Artifact from "effect-build/Artifact"
import { adoptTree, restoreTree } from "../../../packages/ts-release/dist/EffectBuild.js"
import { fileContentOwner } from "../../../packages/ts-release/dist/Node.js"

// A produced directory is swapped for a FIFO or a symbolic link between the
// producer's record and the release system's copy. Both must reject without
// blocking on the FIFO and without following the link.
const root = await mkdtemp("/tmp/ts-release-adoption-races-")
const run = (effect) => Effect.runPromise(effect.pipe(Effect.provide(NodeServices.layer)))
const cells = []
try {
  for (const kind of ["fifo", "symlink"]) {
    const directory = join(root, kind)
    await mkdir(directory)
    await writeFile(join(directory, "file"), "exact content")
    const source = await run(Artifact.directory(directory, { name: "race-fixture", version: "0" }))
    const owner = fileContentOwner(join(root, `${kind}-objects`))
    let swapped = false
    const raced = {
      ...owner,
      putFileOwned: (input) =>
        Effect.gen(function* () {
          swapped = true
          yield* Effect.promise(async () => {
            await unlink(input.path)
            if (kind === "fifo") execFileSync("mkfifo", [input.path])
            else {
              const target = join(root, `${kind}-target`)
              await writeFile(target, "exact content")
              await symlink(target, input.path)
            }
          })
          return yield* owner.putFileOwned(input)
        }),
    }
    const before = Date.now()
    const result = await run(adoptTree(raced, "tree", source).pipe(Effect.flip))
    assert(swapped)
    assert.equal(result._tag, "AdoptionError")
    assert.deepEqual(await readdir(join(root, `${kind}-objects`)).catch(() => []), [])
    cells.push({ kind, status: result._tag, milliseconds: Date.now() - before })
  }
  const directory = join(root, "restore-source")
  await mkdir(directory)
  await writeFile(join(directory, "file"), "exact content")
  const source = await run(Artifact.directory(directory, { name: "race-fixture", version: "0" }))
  const owner = fileContentOwner(join(root, "restore-objects"))
  const owned = await run(adoptTree(owner, "tree", source))
  const destination = join(root, "destination")
  const racedOwner = {
    ...owner,
    read: (content) =>
      Effect.gen(function* () {
        yield* Effect.promise(async () => {
          await mkdir(destination)
          await writeFile(join(destination, "keep.txt"), "other writer")
        })
        return yield* owner.read(content)
      }),
  }
  const result = await run(restoreTree(racedOwner, owned, destination).pipe(Effect.flip))
  assert.equal(result._tag, "AdoptionError")
  assert.equal(await readFile(join(destination, "keep.txt"), "utf8"), "other writer")
  assert.deepEqual(await readdir(destination), ["keep.txt"])
  // The same native host can still restore into an unoccupied destination.
  const restored = await run(restoreTree(owner, owned, join(root, "unoccupied")))
  assert.equal(await readFile(join(restored.path, "file"), "utf8"), "exact content")
  cells.push({ kind: "restore-destination", status: result._tag })
  console.log(
    JSON.stringify({ runtime: process.version, bun: process.versions.bun ?? null, cells }),
  )
} finally {
  await rm(root, { recursive: true, force: true })
}
