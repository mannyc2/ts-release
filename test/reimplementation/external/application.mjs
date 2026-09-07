import { Context, Effect, Layer, Schema } from "effect"
import { appendFile, readFile, readdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { loadBundle } from "@mannyc1/ts-release/bundle"
import { historyMachine, ReleaseError } from "@mannyc1/ts-release"
import {
  fileContentOwner,
  makeHttpRead,
  makeHttpTransport,
  makeGitCatalogHost,
  openGitJournal,
} from "@mannyc1/ts-release/node"
import {
  CachingJournalStore,
  NativeError,
  Receipt,
  definition,
  gitDefinition,
  transitionMachine,
} from "@fixture/external-provider"

// One public service identity, supplied by distinct application-owned Layers.
// Instances are selected from the operation's public authority, not global state.
class Account extends Context.Service()("fixture/Account") {}
const io = (run) =>
  Effect.tryPromise({
    try: run,
    catch: () => new ReleaseError({ code: "fixture-io", message: "Fixture I/O failed" }),
  })
export const createApplication = (input) =>
  Effect.gen(function* () {
    const content = fileContentOwner(join(input.directory, "content"))
    const bundle = yield* loadBundle(
      content,
      yield* io(() => readFile(join(input.directory, "bundle.json"))),
    )
    const plan = JSON.parse(yield* io(() => readFile(join(input.directory, "plan.json"), "utf8")))
    const accounts = JSON.parse(yield* io(() => readFile(input.accounts, "utf8")))
    const layers = accounts.map((value) => ({ value, layer: Layer.succeed(Account, value) }))
    const forAuthority = (request) => {
      const matches = layers.filter(
        ({ value }) =>
          value.endpoint === request.endpoint &&
          value.account === request.principal &&
          value.key === request.scope,
      )
      if (matches.length !== 1)
        throw new ReleaseError({ code: "fixture-account", message: "No exact fixture authority" })
      return matches[0].layer
    }
    const credentials = Effect.fn("application.credentials")((request) =>
      Effect.gen(function* () {
        const account = yield* Account
        yield* io(() =>
          appendFile(
            input.acquisitions,
            JSON.stringify({
              endpoint: request.endpoint,
              principal: request.principal,
              scope: request.scope,
              process: process.pid,
              generation: account.generation,
            }) + "\n",
          ),
        )
        return { authorization: `Bearer ${account.token}` }
      }).pipe(Effect.provide(forAuthority(request))),
    )
    const httpOptions = { credentials, timeoutMilliseconds: 5000, maximumResponseBytes: 4096 }
    const external = definition({ readContent: content.read, read: makeHttpRead(httpOptions) })
    const opaque = external.opaqueTransport((intent) =>
      Effect.gen(function* () {
        const account = yield* Account
        yield* io(() =>
          appendFile(
            input.acquisitions,
            JSON.stringify({
              endpoint: intent.endpoint,
              principal: intent.account,
              scope: intent.key,
              process: process.pid,
              generation: account.generation,
            }) + "\n",
          ),
        )
        return Effect.fn("application.writeOnly")(function* (bytes) {
          yield* io(() =>
            appendFile(
              input.opaqueLog,
              JSON.stringify({
                endpoint: intent.endpoint,
                account: account.account,
                key: intent.key,
                digest: intent.payload.artifact.content.sha256,
                body: Buffer.from(bytes).toString("base64"),
                generation: account.generation,
              }) + "\n",
            ),
          )
          if (input.opaqueWait) return yield* Effect.never
          if (input.opaqueUnknown)
            return {
              _tag: "Unknown",
              reason: "Native acknowledgement was lost",
              nativeError: Schema.encodeSync(NativeError)(
                new NativeError({
                  endpoint: intent.endpoint,
                  account: intent.account,
                  key: intent.key,
                  digest: intent.payload.artifact.content.sha256,
                  code: "AcknowledgementLost",
                }),
              ),
            }
          return {
            _tag: "Accepted",
            receipt: new Receipt({
              endpoint: intent.endpoint,
              account: intent.account,
              key: intent.key,
              digest: intent.payload.artifact.content.sha256,
              id: `native:${intent.key}`,
              state: "created",
            }),
          }
        })
      }).pipe(
        Effect.provide(
          forAuthority({ endpoint: intent.endpoint, principal: intent.account, scope: intent.key }),
        ),
      ),
    )
    const http = makeHttpTransport({ ...httpOptions, providers: [external.provider] })
    const otherwise = {
      prepare: (request) =>
        request.facts.transport === "core.http/1" ? http.prepare(request) : opaque.prepare(request),
      send: (request) =>
        request.facts.transport === "core.http/1" ? http.send(request) : opaque.send(request),
    }
    const git = yield* makeGitCatalogHost({
      gitExecutable: input.captureGit ?? input.git,
      temporaryRoot: input.directory,
      timeoutMilliseconds: 5000,
      maximumOutputBytes: 4 * 1024 * 1024,
      readContent: content.read,
      credentials: () => Effect.succeed({ _tag: "Anonymous" }),
    })
    const nativeStore = yield* openGitJournal({
      cacheDirectory: join(input.directory, "journal-cache"),
      remote: input.journalRemote,
      principal: "external-journal",
      scope: "external-release",
      gitExecutable: input.git,
      timeoutMilliseconds: 5000,
      maximumOutputBytes: 8 * 1024 * 1024,
      credentials: () => Effect.succeed({ _tag: "Anonymous" }),
    })
    let enteredBarrier = false
    const coordinatedStore = input.barrier
      ? {
          read: nativeStore.read,
          append: Effect.fn("fixture.contendedNativeAppend")(function* (id, revision, event) {
            if (event.body._tag === "DispatchStarted" && !enteredBarrier) {
              enteredBarrier = true
              yield* io(() => writeFile(join(input.barrier, String(process.pid)), String(revision)))
              const deadline = Date.now() + 10000
              while ((yield* io(() => readdir(input.barrier))).length !== 2) {
                if (Date.now() > deadline)
                  return yield* new ReleaseError({
                    code: "fixture-barrier",
                    message: "Two runners did not reach native CAS",
                  })
                yield* Effect.sleep(10)
              }
            }
            const result = yield* nativeStore.append(id, revision, event)
            if (event.body._tag === "DispatchStarted")
              yield* io(() =>
                appendFile(
                  input.appendLog,
                  JSON.stringify({ process: process.pid, revision, result: result._tag }) + "\n",
                ),
              )
            return result
          }),
        }
      : nativeStore
    const store = input.cache ? new CachingJournalStore(coordinatedStore) : coordinatedStore
    if (input.cache)
      yield* Effect.addFinalizer(() =>
        io(() =>
          appendFile(
            input.cacheLog,
            JSON.stringify({ process: process.pid, ...store.counters }) + "\n",
          ),
        ),
      )
    const gitProvider = gitDefinition({ readContent: content.read, observeRef: git.observeRef })
    const gitIntents = plan.operations
      .filter((operation) => operation.definitionId === gitProvider.definitionId)
      .map((operation) => operation.intent)
    return {
      bundle,
      options: {
        plan,
        authorize: input.authorize,
        observe: input.observe ?? true,
        maxDispatches: input.maxDispatches ?? plan.operations.length,
      },
      host: {
        store,
        providers: [external.provider, gitProvider],
        transport: gitIntents.length ? git.transport(gitIntents, otherwise) : otherwise,
        now: Date.now,
        uniqueId: () => crypto.randomUUID(),
        machine: input.machine === "M2" ? transitionMachine : historyMachine,
      },
    }
  })
