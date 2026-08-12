import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as HttpClient from "effect/unstable/http/HttpClient"
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner"
import type { ReleaseApiServices } from "../api/types.js"
import { ReleaseRuntime } from "../api/runtime.js"
import { makeRunCommand } from "../drivers/process.js"
import {
  AuthorizedMutationHttp,
  CertifiedPublisherSpawn,
  HttpAuthorizer,
  NpmUserConfigResource,
  makeEnvironmentCredentialPlatform
} from "./credentials.js"
import { CredentialProvider } from "../publication/authority.js"
import { SourceObserver } from "../release/context.js"
import {
  PreparedReleaseStore,
  type PreparedReleaseStoreShape
} from "../release/prepared-store.js"
import { makePublicationHttp } from "./release-runtime.js"

export type ReleaseServicesLayer = Layer.Layer<
  ReleaseApiServices,
  never,
  SourceObserver | ChildProcessSpawner | HttpClient.HttpClient
>

/**
 * Compose the API's complete service boundary once. The raw HTTP transport and
 * child-process spawner remain host inputs; only authority-checking services
 * and the direct prepared store enter the API environment.
 */
export const makeReleaseServicesLive = (
  preparedStore: PreparedReleaseStoreShape
): ReleaseServicesLayer => Layer.effectContext(Effect.gen(function*() {
  const source = yield* SourceObserver
  const run = yield* makeRunCommand
  const client = yield* HttpClient.HttpClient
  const spawner = yield* ChildProcessSpawner
  const credentials = makeEnvironmentCredentialPlatform(makePublicationHttp(client), spawner)

  return Context.make(ReleaseRuntime, { source, run }).pipe(
    Context.add(PreparedReleaseStore, preparedStore),
    Context.add(CredentialProvider, credentials.credentialProvider),
    Context.add(HttpAuthorizer, credentials.httpAuthorizer),
    Context.add(AuthorizedMutationHttp, credentials.authorizedMutationHttp),
    Context.add(NpmUserConfigResource, credentials.npmUserConfigResource),
    Context.add(CertifiedPublisherSpawn, credentials.certifiedPublisherSpawn)
  )
}))
