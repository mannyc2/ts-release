import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { appendFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { basename, join } from "node:path"
import { pathToFileURL } from "node:url"
import { Effect, FileSystem, Schema } from "effect"
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as File from "effect-build/Author/File"
import * as Archive from "effect-build-archives/Archive"
import * as Notary from "effect-build-apple/Notary"
import { Host, ReleaseError, createPlan } from "@mannyc1/ts-release"
import { encodeBundle, finalize, loadBundle } from "@mannyc1/ts-release/bundle"
import { adoptFile } from "@mannyc1/ts-release/effect-build"
import { fileContentOwner, nodeDirectoryReader, openGitJournal } from "@mannyc1/ts-release/node"
import {
  ApplePreparation,
  ReadyToPlan,
  createApplePreparations,
  loadApplePreparations,
  preparationProvider,
  preparationScopes,
  submitPrepared,
  finishPrepared,
  runPreparation,
  validateApplePublication,
  reportAppleContext,
} from "@mannyc1/ts-release/apple"
import { appleDoubles, makeSources } from "./apple-fixtures.js"

const [root, mode] = process.argv.slice(2)
assert(root && mode)
const run = (effect) => Effect.runPromise(effect.pipe(Effect.provide(NodeServices.layer)))
const owner = fileContentOwner(
  join(root, "objects"),
  nodeDirectoryReader(process.env.TS_RELEASE_HTTP_PEER_NODE),
)
if (mode === "init" || mode === "init-lost") {
  await mkdir(root, { recursive: true })
  await mkdir(join(root, "work"))
  const { inputs } = await makeSources(root)
  const collection = await run(
    createApplePreparations(mode === "init" ? [inputs[0], inputs[3]] : [inputs[1]]),
  )
  await writeFile(join(root, "collection.json"), JSON.stringify(collection))
  for (const name of await readdir(root))
    if (name.startsWith("source-")) await rm(join(root, name), { recursive: true })
  console.log(JSON.stringify({ mode, preparations: collection.preparations.length }))
} else {
  const collection = await run(
    loadApplePreparations(JSON.parse(await readFile(join(root, "collection.json"), "utf8"))),
  )
  const scopes = await run(preparationScopes(collection))
  const doubles = appleDoubles()
  if (mode === "ready" || mode === "report" || mode === "restart-lost")
    doubles.status(new Notary.Accepted({ providerStatus: "Accepted" }))
  const publication =
    mode === "report"
      ? JSON.parse(await readFile(join(root, "publication.json"), "utf8"))
      : undefined
  const ready = []
  const boundary = () =>
    new ReleaseError({
      code: "apple-process-fixture",
      message: "Protocol fixture operation failed",
    })
  const report = await run(
    Effect.scoped(
      Effect.gen(function* () {
        const journal = yield* openGitJournal({
          cacheDirectory: join(root, "journal-cache"),
          remote: pathToFileURL(join(root, "journal.git")).href,
          principal: "journal",
          scope: "history",
          gitExecutable: "/usr/bin/git",
          timeoutMilliseconds: 10_000,
          maximumOutputBytes: 8 * 1024 * 1024,
          credentials: () => Effect.succeed({ _tag: "Anonymous" }),
        })
        const store = {
          read: journal.read,
          append: (id, revision, event) =>
            Effect.gen(function* () {
              if (event.body._tag === "ReceiptAccepted" && mode === "kill-before-receipt")
                process.kill(process.pid, "SIGKILL")
              const appended = yield* journal.append(id, revision, event)
              if (event.body._tag === "ReceiptAccepted" && mode === "kill-after-receipt")
                process.kill(process.pid, "SIGKILL")
              return appended
            }),
        }
        const host = {
          store,
          providers: [preparationProvider],
          now: Date.now,
          uniqueId: randomUUID,
          journal: {
            journalId: collection.journalId,
            scopes: [
              ...scopes,
              ...(publication ? [{ _tag: "PublicationScope", plan: publication.plan }] : []),
            ],
          },
          transport: {
            send: (request) =>
              Effect.gen(function* () {
                const input = Schema.decodeUnknownSync(ApplePreparation)(
                  JSON.parse(new TextDecoder().decode(request.body)),
                )
                const receipt = yield* submitPrepared(input, owner, join(root, "work")).pipe(
                  Effect.provide(doubles.layer),
                )
                yield* Effect.tryPromise(() =>
                  appendFile(join(root, "native-submits.jsonl"), JSON.stringify(receipt) + "\n"),
                )
                return { _tag: "Accepted", receipt }
              }).pipe(Effect.mapError(boundary)),
          },
        }
        for (const [index, scope] of scopes.entries())
          yield* runPreparation(
            collection,
            scope.plan.operations[0].operationId,
            { authorize: true },
            (submission, id) =>
              finishPrepared(
                collection.preparations[index],
                submission,
                id,
                owner,
                join(root, "work"),
                (result) =>
                  Effect.gen(function* () {
                    if (result.kind !== "app") return []
                    const final = result.artifact
                    const fs = yield* FileSystem.FileSystem
                    const directory = yield* fs.makeTempDirectoryScoped()
                    const entries = []
                    for (const entry of final.entries) {
                      if (entry.kind !== "file") continue
                      const artifact = yield* File.publish(
                        {
                          destination: join(directory, String(entries.length)),
                          observation: "hashed",
                          provenance: final.provenance,
                        },
                        (candidate) => fs.copyFile(join(final.root, entry.relativePath), candidate),
                      )
                      entries.push(
                        new Archive.ArchiveEntry({
                          artifact,
                          path: entry.relativePath,
                          executable: Boolean(entry.mode & 0o111),
                        }),
                      )
                    }
                    assert(entries.length > 0, "Native final tree files are archived")
                    const archive = yield* Archive.archive(
                      new Archive.ArchiveInput({
                        format: "tar.gz",
                        entries,
                        outfile: join(directory, "app.tar.gz"),
                      }),
                    ).pipe(Effect.provide(Archive.layer))
                    return [yield* adoptFile(owner, basename(final.root) + ".tar.gz", archive)]
                  }),
              ).pipe(
                Effect.provide(doubles.layer),
                Effect.tap((value) =>
                  Effect.sync(() => {
                    if (value instanceof ReadyToPlan) ready.push(value)
                  }),
                ),
                Effect.mapError(boundary),
              ),
          ).pipe(Effect.provideService(Host, host))
        if (publication)
          yield* validateApplePublication(
            collection,
            publication.plan,
            publication.finalBundleContent,
            owner,
          ).pipe(Effect.provideService(Host, host))
        return yield* reportAppleContext(collection, owner, publication).pipe(
          Effect.provideService(Host, host),
        )
      }),
    ),
  )
  if (mode === "ready") {
    assert.equal(ready.length, 2)
    const outputs = []
    for (const item of ready)
      outputs.push(
        ...(await run(loadBundle(owner, await run(owner.read(item.outputsBundleContent)))))
          .artifacts,
      )
    const inputWork = process.env.TS_RELEASE_EXECUTABLE_WITNESS
    assert(inputWork)
    const inputOwner = fileContentOwner(join(inputWork, "owned"))
    const linux = (
      await run(loadBundle(inputOwner, await readFile(join(inputWork, "bundle.json"))))
    ).artifacts.find((file) => file.logicalName === "bun-linux-x64-gnu")
    assert(linux)
    const copied = await run(owner.putOwned(await run(inputOwner.read(linux.content))))
    assert.deepEqual({ ...copied }, { ...linux.content })
    const bundle = await run(finalize([...outputs, linux]))
    const finalBundleContent = await run(owner.putOwned(encodeBundle(bundle)))
    const plan = await run(createPlan(finalBundleContent.sha256, [], collection.journalId))
    await writeFile(join(root, "publication.json"), JSON.stringify({ plan, finalBundleContent }))
  }
  await writeFile(join(root, mode + "-report.json"), JSON.stringify(report, null, 2) + "\n")
  console.log(
    JSON.stringify({
      mode,
      calls: doubles.calls,
      report,
      workspaces: await readdir(join(root, "work")),
    }),
  )
}
