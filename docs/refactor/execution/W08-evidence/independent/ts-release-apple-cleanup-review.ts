import assert from "node:assert/strict"
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { Cause, Effect, Exit, Fiber, FileSystem } from "/tmp/ts-release-implementation/node_modules/effect/dist/index.js"
import * as BunServices from "/tmp/ts-release-implementation/node_modules/@effect/platform-bun/dist/BunServices.js"
import * as Notary from "/tmp/ts-release-implementation/node_modules/effect-build-apple/dist/Notary.js"
import { ReleaseError } from "/tmp/ts-release-implementation/packages/ts-release/src/index.ts"
import { ReadyToPlan, finishPrepared, submitPrepared } from "/tmp/ts-release-implementation/packages/ts-release/src/Apple.ts"
import { appleDoubles, makeSources, run } from "/tmp/ts-release-implementation/test/reimplementation/artifacts/apple-fixtures.ts"

const root = await mkdtemp("/tmp/ts-release-cleanup-review-")
const work = join(root, "work")
const external = join(root, "external")
const observations: string[] = []
const removable = async (directory: string): Promise<void> => {
  const info = await lstat(directory)
  if (!info.isDirectory() || info.isSymbolicLink()) return
  await chmod(directory, 0o700)
  for (const name of await readdir(directory)) await removable(join(directory, name))
}
try {
  assert.equal(process.getuid!(), 1000)
  await mkdir(work)
  await mkdir(external)
  await writeFile(join(external, "sentinel"), "outside private ownership")
  await chmod(external, 0o551)
  let oldRoot = ""
  let oldBodyFinished = false
  const oldExit = await run(Effect.exit(Effect.scoped(Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    oldRoot = yield* fs.makeTempDirectoryScoped({ directory: work, prefix: "old-" })
    yield* fs.makeDirectory(join(oldRoot, "Contents"))
    yield* fs.writeFileString(join(oldRoot, "Contents/Info.plist"), "fixture")
    yield* fs.chmod(join(oldRoot, "Contents"), 0o555)
    oldBodyFinished = true
    return "submission-id-before-finalizer"
  }))))
  assert.equal(oldBodyFinished, true)
  assert.equal(Exit.isFailure(oldExit), true)
  if (Exit.isFailure(oldExit)) assert.match(Cause.pretty(oldExit.cause), /EACCES|PermissionDenied/)
  assert.deepEqual(await readdir(join(oldRoot, "Contents")), ["Info.plist"])
  observations.push("Installed makeTempDirectoryScoped reproduces EACCES after successful body; child remains")
  await removable(oldRoot)
  await rm(oldRoot, { recursive: true })

  const { owner, collection } = await makeSources(root, true)
  const input = collection.preparations[0]!
  assert.equal(input._tag, "AppPreparation")
  if (input._tag !== "AppPreparation") throw new Error("missing app")
  assert.equal(input.source.entries.find((entry) => entry.relativePath === "Contents")!.mode, 0o555)
  const doubles = appleDoubles()
  const injectLinks = (privateRoot: string) => Effect.tryPromise(async () => {
    await symlink(external, join(privateRoot, "external-link"))
    await symlink(join(root, "absent-target"), join(privateRoot, "dangling-link"))
  })
  const checkClean = async (label: string) => {
    assert.deepEqual(await readdir(work), [])
    assert.equal((await lstat(external)).mode & 0o777, 0o551)
    assert.equal(await readFile(join(external, "sentinel"), "utf8"), "outside private ownership")
    observations.push(label + ": empty workspace, external symlink target mode/content unchanged")
  }
  const submission = await run(Effect.gen(function* () {
    const client = yield* Notary.Client
    return yield* submitPrepared(input, owner, work).pipe(Effect.provideService(Notary.Client, {
      ...client,
      submitApp: (native) => injectLinks(dirname(native.bundle.root)).pipe(Effect.andThen(client.submitApp(native))),
    }))
  }).pipe(Effect.provide(doubles.layer)))
  assert.match(submission.submissionId, /^[0-9a-f-]{36}$/)
  await checkClean("submit success")
  const submitFailure = new Notary.SubmissionPreparationFailed({ path: "protocol-fixture", reason: "injected failure" })
  const failedSubmit = await run(Effect.exit(Effect.gen(function* () {
    const client = yield* Notary.Client
    return yield* submitPrepared(input, owner, work).pipe(Effect.provideService(Notary.Client, {
      ...client,
      submitApp: (native) => injectLinks(dirname(native.bundle.root)).pipe(Effect.andThen(Effect.fail(submitFailure))),
    }))
  }).pipe(Effect.provide(doubles.layer))))
  assert.equal(Exit.isFailure(failedSubmit), true)
  if (Exit.isFailure(failedSubmit)) assert.match(Cause.pretty(failedSubmit.cause), /SubmissionPreparationFailed/)
  await checkClean("submit typed failure")

  let submitReached!: () => void
  const submitEntered = new Promise<void>((resolve) => { submitReached = resolve })
  const interruptedSubmit = Effect.runFork(Effect.gen(function* () {
    const client = yield* Notary.Client
    return yield* submitPrepared(input, owner, work).pipe(Effect.provideService(Notary.Client, {
      ...client,
      submitApp: (native) => injectLinks(dirname(native.bundle.root)).pipe(
        Effect.andThen(Effect.sync(submitReached)), Effect.andThen(Effect.never),
      ),
    }))
  }).pipe(Effect.provide(doubles.layer), Effect.provide(BunServices.layer)))
  await submitEntered
  await Effect.runPromise(Fiber.interrupt(interruptedSubmit))
  assert.equal(Exit.isFailure(await Effect.runPromise(Fiber.await(interruptedSubmit))), true)
  await checkClean("submit interruption")

  doubles.status(new Notary.Accepted({ providerStatus: "Accepted" }))
  const ready = await run(finishPrepared(input, submission, "review-preparation", owner, work,
    (final) => injectLinks(dirname(final.kind === "app" ? final.artifact.root : final.artifact.path)).pipe(Effect.as([])),
  ).pipe(Effect.provide(doubles.layer)))
  assert.equal(ready instanceof ReadyToPlan, true)
  await checkClean("finish success")
  const failedFinish = await run(Effect.exit(finishPrepared(input, submission, "review-preparation", owner, work,
    (final) => injectLinks(dirname(final.kind === "app" ? final.artifact.root : final.artifact.path)).pipe(
      Effect.andThen(Effect.fail(new ReleaseError({ code: "review-injected", message: "injected finish failure" }))),
    ),
  ).pipe(Effect.provide(doubles.layer))))
  assert.equal(Exit.isFailure(failedFinish), true)
  if (Exit.isFailure(failedFinish)) assert.match(Cause.pretty(failedFinish.cause), /injected finish failure/)
  await checkClean("finish typed failure")

  let finishReached!: () => void
  const finishEntered = new Promise<void>((resolve) => { finishReached = resolve })
  const interruptedFinish = Effect.runFork(finishPrepared(input, submission, "review-preparation", owner, work,
    (final) => injectLinks(dirname(final.kind === "app" ? final.artifact.root : final.artifact.path)).pipe(
      Effect.andThen(Effect.sync(finishReached)), Effect.andThen(Effect.never),
    ),
  ).pipe(Effect.provide(doubles.layer), Effect.provide(BunServices.layer)))
  await finishEntered
  await Effect.runPromise(Fiber.interrupt(interruptedFinish))
  assert.equal(Exit.isFailure(await Effect.runPromise(Fiber.await(interruptedFinish))), true)
  await checkClean("finish interruption")
  console.log(JSON.stringify({ uid: process.getuid!(), observations }, null, 2))
} finally {
  await removable(root)
  await rm(root, { recursive: true, force: true })
}
