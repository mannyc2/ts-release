import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { Effect, Layer } from "effect"
import { Content } from "@mannyc1/ts-release/bundle"
import { Host, createPlan, runRelease } from "@mannyc1/ts-release"
import * as Git from "@mannyc1/ts-release/git"
const { makeGitCatalogHost, openGitJournal } = await import(
  process.versions.bun ? "@mannyc1/ts-release/bun" : "@mannyc1/ts-release/node"
)

const root = mkdtempSync(join(tmpdir(), "git-public-consumer-")),
  gitExecutable = process.argv[2]
const git = (directory, args, input) =>
  execFileSync(gitExecutable, ["--git-dir", directory, ...args], {
    env: {
      PATH: "/usr/bin:/bin",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Consumer",
      GIT_AUTHOR_EMAIL: "consumer@example.test",
      GIT_COMMITTER_NAME: "Consumer",
      GIT_COMMITTER_EMAIL: "consumer@example.test",
      GIT_AUTHOR_DATE: "@1700000000 +0000",
      GIT_COMMITTER_DATE: "@1700000000 +0000",
      LC_ALL: "C",
    },
    ...(input === undefined ? {} : { input }),
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 5000,
  })
let assertions = 0
const equal = (actual, expected) => {
  assert.deepEqual(actual, expected)
  assertions++
}
try {
  for (const format of ["sha1", "sha256"]) {
    const remote = join(root, format)
    git(remote, ["init", "--quiet", "--bare", "--template=", `--object-format=${format}`, remote])
    const empty = git(remote, ["mktree"], Buffer.alloc(0)).toString().trim()
    const old = git(remote, ["commit-tree", empty], Buffer.from("Initial\n")).toString().trim()
    git(remote, ["update-ref", "refs/heads/catalog", old])
    const bytes = new Map()
    const put = (input) => {
      const owned = new Uint8Array(input),
        content = new Content({
          bytes: String(owned.length),
          sha256: createHash("sha256").update(owned).digest("hex"),
        })
      bytes.set(content.sha256, owned)
      return content
    }
    const readContent = (content) => Effect.sync(() => new Uint8Array(bytes.get(content.sha256)))
    const coordinate = {
      remote: pathToFileURL(remote).href,
      ref: "refs/heads/catalog",
      principal: "consumer",
      scope: "catalog",
    }
    const options = {
      gitExecutable,
      temporaryRoot: root,
      timeoutMilliseconds: 5000,
      maximumOutputBytes: 4 * 1024 * 1024,
      readContent,
      credentials: () => Effect.succeed({ _tag: "Anonymous" }),
    }
    const intent = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const host = yield* makeGitCatalogHost(options)
          const baseObjects = put(yield* host.captureBase({ ...coordinate, expectedOld: old }))
          const identity = new Git.Identity({
            name: "Consumer",
            email: "consumer@example.test",
            timestamp: "1700000001",
            timezone: "+0000",
          })
          return yield* Git.prepare(
            new Git.CommitInput({
              ...coordinate,
              expectedOld: old,
              baseObjects,
              files: [
                new Git.FileEdit({
                  path: "Formula/tool.rb",
                  mode: "100644",
                  content: put(Buffer.from("class Tool < Formula\nend\n")),
                }),
              ],
              message: "Consumer release\n",
              author: identity,
              committer: identity,
            }),
            {
              objects: host.objects,
              readContent,
              putContent: (input) => Effect.sync(() => put(input)),
            },
          )
        }),
      ),
    )
    equal(git(remote, ["rev-parse", coordinate.ref]).toString().trim(), old)
    const plan = await Effect.runPromise(
      Effect.gen(function* () {
        return yield* createPlan("native-public-consumer", [yield* Git.update(intent)])
      }),
    )
    const journalOptions = {
      ...options,
      remote: coordinate.remote,
      principal: "journal",
      scope: "history",
      cacheDirectory: root,
      objectFormat: format,
    }
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const host = yield* makeGitCatalogHost(options),
            store = yield* openGitJournal(journalOptions)
          let serial = 0
          const application = {
            store,
            transport: host.transport([intent]),
            providers: [Git.definition({ readContent, observeRef: host.observeRef })],
            now: () => 1000,
            uniqueId: () => `consumer-${++serial}`,
          }
          const report = yield* runRelease({ plan, authorize: true }).pipe(
            Effect.provide(Layer.succeed(Host, application)),
          )
          equal(report.operations[0].status, "Satisfied")
          equal(git(remote, ["rev-parse", coordinate.ref]).toString().trim(), intent.desiredNew)
          equal(
            git(remote, ["show", `${coordinate.ref}:Formula/tool.rb`]).toString(),
            "class Tool < Formula\nend\n",
          )
          equal(
            (yield* store.read(plan.journalId)).events.filter(
              (event) => event.body._tag === "DispatchStarted",
            ).length,
            1,
          )
        }),
      ),
    )
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const store = yield* openGitJournal(journalOptions),
            history = yield* store.read(plan.journalId)
          equal(history.events.filter((event) => event.body._tag === "ReceiptAccepted").length, 1)
          const start = history.events.find((event) => event.body._tag === "DispatchStarted")
          equal((yield* store.append(plan.journalId, 0, start))._tag, "AlreadyRecorded")
        }),
      ),
    )
  }
} finally {
  rmSync(root, { recursive: true, force: true })
}
equal(existsSync(root), false)
process.stdout.write(JSON.stringify({ runtime: process.version, assertions }) + "\n")
