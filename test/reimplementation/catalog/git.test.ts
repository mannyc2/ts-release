import { expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { execFileSync } from "node:child_process"
import { pathToFileURL } from "node:url"
import { Host, createPlan, runRelease } from "@mannyc1/ts-release"
import * as Git from "@mannyc1/ts-release/git"
import { makeGitCatalogHost, openSqliteJournal } from "@mannyc1/ts-release/bun"
import * as Homebrew from "../../../packages/catalog/src/homebrew/index.js"
import * as Scoop from "../../../packages/catalog/src/scoop/index.js"
import { openGitRuntime } from "../../../packages/ts-release/src/platform/GitProcess.js"
import {
  contentFixture,
  identity,
  native,
  nativeGit,
  processOptions,
  seed,
} from "../transports/git-fixture.js"
import { fixture } from "./fixtures.js"

for (const family of ["homebrew", "scoop"] as const)
  for (const count of [1, 2])
    for (const format of ["sha1", "sha256"] as const)
      test(`${family} native ${format} atomically publishes ${count} paths and reopens its journal after lost push acknowledgement`, async () => {
        const directory = await mkdtemp(join(tmpdir(), "ts-release-catalog-git-"))
        try {
          // Real Git runs to completion. Only its acknowledgement is discarded.
          const wrapper = join(directory, "git-drop-ack")
          await writeFile(
            wrapper,
            `#!${process.execPath}\nimport { spawnSync } from "node:child_process";\nconst args=process.argv.slice(2);\nconst result=spawnSync(${JSON.stringify(nativeGit)},args,{stdio:["inherit","pipe","pipe"]});\nif(args.includes("push")){process.exit(1)}\nprocess.stdout.write(result.stdout);process.stderr.write(result.stderr);process.exit(result.status??1);\n`,
            { mode: 0o755 },
          )
          await Effect.runPromise(
            Effect.scoped(
              Effect.gen(function* () {
                const runtime = yield* openGitRuntime(processOptions),
                  repository = yield* runtime.repository(format)
                const old = seed(repository.directory),
                  contents = contentFixture(),
                  f = fixture()
                const coordinate = {
                  remote: pathToFileURL(repository.directory).href,
                  ref: "refs/heads/catalog",
                  scope: family,
                  principal: "publisher",
                }
                native(repository.directory, ["update-ref", coordinate.ref, old])
                const paths = Array.from({ length: count }, (_, i) =>
                  family === "homebrew" ? `Formula/tool${i}.rb` : `bucket/tool${i}.json`,
                )
                const bytes = yield* Effect.forEach(paths, (_, i) =>
                  family === "homebrew"
                    ? Homebrew.render({ ...f.formula, className: `Tool${i}` }, f.bundle)
                    : Scoop.render(f.manifest, f.bundle),
                )
                const files = paths.map(
                  (path, i) =>
                    new Git.FileEdit({ path, mode: "100644", content: contents.put(bytes[i]!) }),
                )
                const options = {
                  ...processOptions,
                  readContent: contents.read,
                  credentials: () => Effect.succeed({ _tag: "Anonymous" as const }),
                }
                const intent = yield* Effect.scoped(
                  Effect.gen(function* () {
                    const builder = yield* makeGitCatalogHost(options)
                    return yield* Git.prepare(
                      new Git.CommitInput({
                        ...coordinate,
                        expectedOld: old,
                        baseObjects: contents.put(
                          yield* builder.captureBase({ ...coordinate, expectedOld: old }),
                        ),
                        files,
                        message: "Publish exact catalog paths\n",
                        author: identity,
                        committer: identity,
                      }),
                      {
                        objects: builder.objects,
                        readContent: contents.read,
                        putContent: (bytes) => Effect.sync(() => contents.put(bytes)),
                      },
                    )
                  }),
                )
                const operation = yield* Git.update(intent),
                  plan = yield* createPlan(`catalog-${family}-${count}-${format}`, [operation])
                let serial = 0
                for (const loseAcknowledgement of [true, false, false]) {
                  yield* Effect.scoped(
                    Effect.gen(function* () {
                      const host = yield* makeGitCatalogHost({
                        ...options,
                        gitExecutable: loseAcknowledgement ? wrapper : nativeGit,
                      })
                      const store = yield* openSqliteJournal(join(directory, "release.sqlite"))
                      const report = yield* runRelease({
                        plan,
                        authorize: true,
                        maxDispatches: 1,
                      }).pipe(
                        Effect.provide(
                          Layer.succeed(Host, {
                            providers: [
                              Git.definition({
                                readContent: contents.read,
                                observeRef: host.observeRef,
                              }),
                            ],
                            transport: host.transport([intent]),
                            store,
                            now: () => 1000,
                            uniqueId: () => `catalog-${++serial}`,
                          }),
                        ),
                      )
                      const events = (yield* store.read(plan.journalId)).events
                      expect(
                        events.filter((event) => event.body._tag === "DispatchStarted"),
                      ).toHaveLength(1)
                      expect(
                        events.filter((event) => event.body._tag === "ReceiptAccepted"),
                      ).toHaveLength(0)
                      if (!loseAcknowledgement)
                        expect(report.operations[0]!.status).toBe("Satisfied")
                      expect(
                        native(repository.directory, ["rev-parse", coordinate.ref])
                          .toString()
                          .trim(),
                      ).toBe(intent.desiredNew)
                      for (const [i, path] of paths.entries()) {
                        expect(
                          native(repository.directory, ["show", `${coordinate.ref}:${path}`]),
                        ).toEqual(Buffer.from(bytes[i]!))
                        if (loseAcknowledgement && family === "homebrew") {
                          const nativePath = join(directory, `tool${i}.rb`)
                          yield* Effect.promise(() =>
                            writeFile(
                              nativePath,
                              native(repository.directory, ["show", `${coordinate.ref}:${path}`]),
                            ),
                          )
                          const loaded = JSON.parse(
                            execFileSync(
                              process.env.TS_RELEASE_ACCEPTANCE_BREW ??
                                "/tmp/ts-release-native-homebrew/bin/brew",
                              ["ruby", join(import.meta.dir, "homebrew-oracle.rb"), nativePath],
                              {
                                env: {
                                  ...process.env,
                                  HOMEBREW_NO_AUTO_UPDATE: "1",
                                  HOMEBREW_NO_ANALYTICS: "1",
                                },
                                encoding: "utf8",
                                timeout: 30000,
                                stdio: ["pipe", "pipe", "pipe"],
                              },
                            ),
                          )
                          expect(loaded.cells).toHaveLength(4)
                          expect(
                            loaded.cells.every(
                              (cell: { version: string }) => cell.version === f.formula.version,
                            ),
                          ).toBe(true)
                        }
                      }
                      expect(
                        native(repository.directory, [
                          "diff-tree",
                          "--no-commit-id",
                          "--name-only",
                          "-r",
                          old,
                          intent.desiredNew,
                        ])
                          .toString()
                          .trim()
                          .split("\n"),
                      ).toEqual(paths)
                      expect(
                        native(repository.directory, ["rev-parse", `${intent.desiredNew}^`])
                          .toString()
                          .trim(),
                      ).toBe(old)
                      expect(
                        native(repository.directory, [
                          "show",
                          `${coordinate.ref}:README.md`,
                        ]).toString(),
                      ).toBe("preserved unmanaged README\n")
                      for (const path of ["untouched-empty", "Formula/empty"])
                        expect(
                          native(repository.directory, [
                            "rev-parse",
                            `${coordinate.ref}:${path}`,
                          ]).toString(),
                        ).toBe(
                          native(repository.directory, ["rev-parse", `${old}:${path}`]).toString(),
                        )
                    }),
                  )
                }
              }),
            ),
          )
        } finally {
          await rm(directory, { recursive: true, force: true })
        }
      }, 60000)
