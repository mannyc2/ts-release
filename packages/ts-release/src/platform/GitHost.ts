import * as Effect from "effect/Effect"
import type * as Scope from "effect/Scope"
import type { Transport } from "../Provider.js"
import { type ReadContent, readVerifiedContent } from "../internal/Content.js"
import { type ReleaseError, attempt } from "../internal/Error.js"
import { canonical, decodeOwned } from "../internal/Identity.js"
import {
  authorityKey,
  conditionalArguments,
  makeCoreGitTransport,
  type CoreGitOptions,
} from "../internal/GitAuthority.js"
import {
  CommitInput,
  admitCoordinate,
  invalid,
  objectFormat,
  ownIntent,
  type Credentials,
  type Intent,
  type ObjectBuilder,
  type ObserveRef,
  type RefCoordinate,
} from "../internal/GitCatalog.js"
import {
  checked,
  resolveGitCredentials,
  nativeText as text,
  openGitRuntime,
  type GitProcessOptions,
} from "./GitProcess.js"
import {
  construct,
  exportObjects,
  importObjects,
  verifyGraph,
  verifyManagedCommit,
} from "./GitObjects.js"
import { fetchRef, remoteRef } from "./GitRemote.js"

export interface GitCatalogHost {
  readonly objects: ObjectBuilder
  readonly captureBase: (
    input: RefCoordinate & { readonly expectedOld: string },
  ) => Effect.Effect<Uint8Array, ReleaseError>
  readonly observeRef: ObserveRef
  readonly transport: (intents: readonly [Intent, ...Intent[]], otherwise?: Transport) => Transport
}
export interface GitCatalogHostOptions extends GitProcessOptions {
  readonly readContent: ReadContent
  readonly credentials: (input: RefCoordinate) => Effect.Effect<Credentials, ReleaseError>
}
export const makeGitCatalogHost = Effect.fn("ts-release.makeGitCatalogHost")(
  (options: GitCatalogHostOptions): Effect.Effect<GitCatalogHost, ReleaseError, Scope.Scope> =>
    Effect.gen(function* () {
      const read = options.readContent.bind(options),
        credentials = options.credentials.bind(options)
      const runtime = yield* openGitRuntime(options),
        limit = runtime.maximumOutputBytes
      const environment = Effect.fn("git.credentials")(function* (input: RefCoordinate) {
        return yield* resolveGitCredentials(credentials, input)
      })
      const observeRef: ObserveRef = Effect.fn("git.observeNativeRef")(function* (input) {
        const coordinate = yield* attempt(() => admitCoordinate(input)),
          env = yield* environment(coordinate)
        const repository = yield* runtime.repository("sha1")
        return { oid: yield* remoteRef(repository.run, coordinate, env) }
      })
      const objects: ObjectBuilder = Object.freeze({
        construct: Effect.fn("git.buildOwnedObjects")(function* (input, source) {
          const value = yield* attempt(() => decodeOwned(CommitInput, input)),
            read = source.bind(undefined)
          const { remote, ref, principal, scope } = value
          yield* attempt(() => admitCoordinate({ remote, ref, principal, scope }))
          return yield* construct(
            (yield* runtime.repository(objectFormat(value.expectedOld))).run,
            read,
            value,
            limit,
          )
        }),
      })
      const captureBase = Effect.fn("git.captureBase")(function* (
        input: RefCoordinate & { readonly expectedOld: string },
      ) {
        const { remote, ref, principal, scope, expectedOld } = input
        const coordinate = yield* attempt(() => admitCoordinate({ remote, ref, principal, scope })),
          format = yield* attempt(() => objectFormat(expectedOld))
        const env = yield* environment(coordinate),
          repository = yield* runtime.repository(format)
        if ((yield* fetchRef(repository.run, coordinate, env)) !== expectedOld)
          return yield* attempt(invalid)
        yield* checked(repository.run, [
          "fsck",
          "--strict",
          "--no-dangling",
          "--no-reflogs",
          expectedOld,
        ])
        return yield* exportObjects(repository.run, expectedOld, limit)
      })
      const transport: GitCatalogHost["transport"] = (inputs, otherwise) => {
        const groups = new Map<string, Map<string, Intent>>()
        for (const input of inputs) {
          const intent = ownIntent(input),
            key = authorityKey(intent.principal, intent.scope)
          const group = groups.get(key) ?? new Map<string, Intent>()
          const args = canonical(
            conditionalArguments(intent.remote, intent.ref, intent.expectedOld, intent.desiredNew),
          )
          if (group.has(args) && canonical(group.get(args)) !== canonical(intent)) invalid()
          group.set(args, intent)
          groups.set(key, group)
        }
        const bindings = [...groups.values()].map((group): CoreGitOptions => {
          const { principal, scope } = group.values().next().value!
          const prepare: NonNullable<CoreGitOptions["prepare"]> = Effect.fn(
            "git.prepareNativePush",
          )(function* (args) {
            const encoded = yield* attempt(() => canonical(args)),
              intent = group.get(encoded)
            if (!intent) return yield* attempt(invalid)
            const repository = yield* runtime.repository(intent.objectFormat),
              run = repository.run
            const ids = yield* importObjects(
              run,
              yield* readVerifiedContent(read, intent.objectSet, limit),
              intent.objectFormat,
              limit,
            )
            yield* verifyGraph(run, intent.desiredNew, ids)
            yield* verifyManagedCommit(
              run,
              read,
              intent.expectedOld,
              intent.desiredNew,
              intent.files,
              limit,
            )
            const { remote, ref, principal, scope } = intent
            const env = yield* environment({ remote, ref, principal, scope })
            return Effect.fn("git.pushOnce")(function* (actual) {
              if (canonical(actual) !== encoded) return yield* attempt(invalid)
              const result = yield* run(actual, undefined, env)
              return {
                exitCode: result.exitCode,
                stdout: yield* attempt(() => text(result.stdout)),
              }
            })
          })
          return {
            principal,
            scope,
            prepare,
            execute: Effect.fn(function* (args) {
              return yield* (yield* prepare(args))(args)
            }),
          }
        })
        if (!bindings.length) invalid()
        return makeCoreGitTransport(bindings as [CoreGitOptions, ...CoreGitOptions[]], otherwise)
      }
      return Object.freeze({ objects, captureBase, observeRef, transport })
    }),
)
