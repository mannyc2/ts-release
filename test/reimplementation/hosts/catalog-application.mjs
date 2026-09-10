// An authored application using only installed public APIs and native providers.
import { readFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { Effect, Schema } from "effect"
import { loadPlan, ReleaseError } from "@mannyc1/ts-release"
import { loadBundle } from "@mannyc1/ts-release/bundle"
import * as Git from "@mannyc1/ts-release/git"
import { fileContentOwner, makeGitCatalogHost, openGitJournal } from "@mannyc1/ts-release/node"
const read = (path) =>
  Effect.tryPromise({
    try: () => readFile(path),
    catch: () =>
      new ReleaseError({ code: "fixture-read", message: "Prepared input is unavailable" }),
  })
export const createApplication = Effect.fn("catalogApplication")(function* (input) {
  const owner = fileContentOwner(input.contentDirectory)
  const readContent = (content) =>
    owner
      .read(content)
      .pipe(
        Effect.mapError(
          () => new ReleaseError({ code: "fixture-content", message: "Content is unavailable" }),
        ),
      )
  const bundle = yield* loadBundle(owner, yield* read(input.bundleFile))
  const credentials = () => Effect.succeed({ _tag: "Anonymous" })
  const native = yield* makeGitCatalogHost({
    gitExecutable: input.publisherGit,
    temporaryRoot: input.contentDirectory,
    timeoutMilliseconds: 30000,
    maximumOutputBytes: 4 * 1024 * 1024,
    readContent,
    credentials,
  })
  const providers = [Git.definition({ readContent, observeRef: native.observeRef })]
  const plan = yield* loadPlan(
    JSON.parse(new TextDecoder().decode(yield* read(input.planFile))),
    providers,
  )
  const intents = plan.operations.map((operation) =>
    Schema.decodeUnknownSync(Git.Intent)(operation.intent),
  )
  const store = yield* openGitJournal({
    cacheDirectory: input.cacheDirectory,
    remote: input.journalRemote,
    principal: "fixture-journal",
    scope: "release",
    gitExecutable: input.gitExecutable,
    timeoutMilliseconds: 10000,
    maximumOutputBytes: 4 * 1024 * 1024,
    credentials,
  })
  return {
    bundle,
    options: { plan, authorize: input.authorize === true },
    host: {
      store,
      providers,
      transport: native.transport(intents),
      now: Date.now,
      uniqueId: randomUUID,
    },
  }
})
