import { makeReleaseApi } from "@mannyc1/ts-release"
import * as Effect from "effect/Effect"
import { readFileSync, realpathSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import {
  CredentialUnavailable,
  makeCredentialProvider,
  makeCustomReleaseLayer,
  makeSourceObserver,
  sha256Digest,
  type AuthorizedMutationHttpShape,
  type CertifiedPublisherSpawnShape,
  type CredentialRequest,
  type HttpAuthorizerShape,
  type NpmUserConfigResourceShape,
  type ReleaseRuntimeShape
} from "@mannyc1/ts-release/host"
import {
  makeLocalPreparedReleaseStore,
  type PreparedReleaseStoreShape
} from "@mannyc1/ts-release/store"

const unavailable = (request: CredentialRequest): CredentialUnavailable =>
  new CredentialUnavailable({
    subject: request.subject,
    provider: request.provider,
    purpose: request.purpose,
    reason: "The external fixture exposes no mutation credential."
  })

export const exerciseCustomHost = async (input: {
  readonly workspace: string
  readonly storeDirectory: string
}) => {
  const calls = { source: 0, run: 0, commit: 0, load: 0, credential: 0, http: 0 }
  const localStore = makeLocalPreparedReleaseStore(input.storeDirectory)
  const preparedStore: PreparedReleaseStoreShape = {
    commit: (manifest, blobs) => {
      calls.commit += 1
      return localStore.commit(manifest, blobs)
    },
    load: (reference) => {
      calls.load += 1
      return localStore.load(reference)
    }
  }
  const credentialProvider = makeCredentialProvider({
    acquire: (request) => {
      calls.credential += 1
      return request.strategy.kind === "anonymous"
        ? Effect.succeed({ _tag: "AnonymousAccess", purposes: ["observe"] as const })
        : Effect.fail(unavailable(request))
    }
  })
  const httpAuthorizer: HttpAuthorizerShape = {
    execute: () => {
      calls.http += 1
      return Effect.succeed({ status: 404, headers: {}, body: "{}" })
    }
  }
  const authorizedMutationHttp: AuthorizedMutationHttpShape = {
    execute: () => Effect.die("The external fixture exposes no mutation HTTP sink.")
  }
  const npmUserConfigResource: NpmUserConfigResourceShape = {
    acquire: () => Effect.die("The external fixture exposes no npm credential resource.")
  }
  const certifiedPublisherSpawn: CertifiedPublisherSpawnShape = {
    preflightTrustedNpm: () => Effect.die("The external fixture exposes no trusted npm preflight."),
    spawn: () => Effect.die("The external fixture exposes no publisher process sink.")
  }
  const source = makeSourceObserver({
    canonicalRoot: (workspace) => Effect.try({
      try: () => realpathSync(workspace),
      catch: (cause) => cause
    }),
    read: (workspace, path) => Effect.try({
      try: () => new Uint8Array(readFileSync(join(workspace, path))),
      catch: (cause) => cause
    }),
    command: (workspace, argv) => Effect.try({
      try: () => {
        const result = spawnSync("git", [...argv], {
          cwd: workspace,
          encoding: "utf8",
          stdio: "pipe"
        })
        if (result.error !== undefined) throw result.error
        if (result.status !== 0) throw new Error(result.stderr.trim())
        return result.stdout
      },
      catch: (cause) => cause
    }),
    digest: (bytes) => Effect.sync(() => sha256Digest(bytes))
  })
  const runtime: ReleaseRuntimeShape = {
    source: {
      observe: (...args: Parameters<typeof source.observe>) => {
        calls.source += 1
        return source.observe(...args)
      }
    },
    run: (_command) => {
      calls.run += 1
      return Effect.succeed({ exitCode: 0, stdout: "", stderr: "" })
    }
  }
  const api = makeReleaseApi(makeCustomReleaseLayer({
    runtime,
    preparedStore,
    credentialProvider,
    httpAuthorizer,
    authorizedMutationHttp,
    npmUserConfigResource,
    certifiedPublisherSpawn
  }))
  try {
    const config = {
      project: {
        name: "external-library-fixture",
        version: "1.0.0",
        tag: "v1.0.0",
        repository: "owner/fixture"
      },
      artifacts: [{ id: "payload", path: "payload.txt", format: "file" }],
      preparations: [{
        id: "record-custom-runtime",
        kind: "check",
        run: ["external-recording-command"],
        inputs: ["payload"]
      }],
      publish: { github: { repository: "owner/fixture", ids: [] } }
    }
    const prepared = await api.prepare({ config, workspace: input.workspace })
    const observed = await api.observe({ prepared })
    const published = await api.publish({ prepared })
    return { calls, observed: observed.status, published: published.status }
  } finally {
    await api.dispose()
  }
}

if (import.meta.main) {
  const workspace = process.argv[2]
  const storeDirectory = process.argv[3]
  if (workspace === undefined || storeDirectory === undefined) {
    throw new Error("usage: external-library-consumer <workspace> <store-directory>")
  }
  console.log(JSON.stringify(await exerciseCustomHost({ workspace, storeDirectory })))
}
