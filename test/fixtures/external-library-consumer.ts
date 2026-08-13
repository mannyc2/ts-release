import { makeReleaseApi } from "@mannyc1/ts-release"
import * as Effect from "effect/Effect"
import { readFileSync, realpathSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import {
  CredentialUnavailable,
  SafeRelativePath,
  StagingEntry,
  StagingSnapshot,
  makeCredentialProvider,
  makeCustomReleaseLayer,
  makeSourceObserver,
  sha256Digest,
  type CredentialRequest,
  type HttpAuthorizerShape,
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
  const authorizedMutationHttp = {
    execute: () => Effect.die("The external fixture exposes no mutation HTTP sink.")
  }
  const npmUserConfigResource = {
    acquire: () => Effect.die("The external fixture exposes no npm credential resource.")
  }
  const certifiedPublisherSpawn = {
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
    digest: (bytes) => Effect.sync(() => sha256Digest(bytes)),
    materialize: (workspace, verified, destination) => Effect.try({
      try: () => {
        const archive = spawnSync("git", ["archive", "--format=tar", verified.commit], {
          cwd: workspace, encoding: null, stdio: "pipe"
        })
        if (archive.status !== 0) throw new Error(Buffer.from(archive.stderr).toString("utf8"))
        const extracted = spawnSync("tar", ["-xf", "-", "-C", destination], {
          input: archive.stdout, encoding: null, stdio: ["pipe", "pipe", "pipe"]
        })
        if (extracted.status !== 0) throw new Error(Buffer.from(extracted.stderr).toString("utf8"))
        const listed = spawnSync("git", ["ls-tree", "-r", "--name-only", verified.commit], {
          cwd: workspace, encoding: "utf8", stdio: "pipe"
        })
        if (listed.status !== 0) throw new Error(listed.stderr.trim())
        const entries = listed.stdout.trim().split("\n").filter((path) => path.length > 0)
          .sort().map((path) => {
            const bytes = new Uint8Array(readFileSync(join(destination, path)))
            return StagingEntry.make({
              path: SafeRelativePath.make(path),
              kind: "file",
              mode: 0o644,
              size: bytes.length,
              digest: sha256Digest(bytes)
            })
          })
        return StagingSnapshot.make({
          entries,
          digest: sha256Digest(new TextEncoder().encode(JSON.stringify(entries)))
        })
      }, catch: (cause) => cause
    })
  })
  const runtime: ReleaseRuntimeShape = {
    source: {
      observe: (...args: Parameters<typeof source.observe>) => {
        calls.source += 1
        return source.observe(...args)
      },
      materialize: (...args: Parameters<typeof source.materialize>) => source.materialize(...args)
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
