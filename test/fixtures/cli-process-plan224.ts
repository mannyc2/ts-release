import * as BunServices from "@effect/platform-bun/BunServices"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Command from "effect/unstable/cli/Command"
import {
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync
} from "node:fs"
import { dirname } from "node:path"
import { makeCli } from "../../apps/release-ts/src/cli/command.js"
import { makeReleaseApi } from "../../src/api/api.js"
import { ReleaseRuntime } from "../../src/api/runtime.js"
import { DriverError } from "../../src/drivers/errors.js"
import type { RunCommand } from "../../src/drivers/process.js"
import type { CredentialRequest } from "../../src/model/authority.js"
import { sha256Digest } from "../../src/model/digest.js"
import {
  CredentialProvider,
  CredentialUnavailable,
  makeCredentialProvider,
  type CredentialGrant
} from "../../src/publication/authority.js"
import {
  HttpAuthorizer,
  type HttpObservationRequest,
  type HttpResponse
} from "../../src/publication/http.js"
import {
  makeSourceObserver,
  type SourceObserverRuntime
} from "../../src/release/context.js"
import {
  PreparedReleaseStore,
  makeLocalPreparedReleaseStore
} from "../../src/release/prepared-store.js"
import { unavailableMutationServicesLayer } from "./mutation-services.js"

interface SafeCredentialRequest {
  readonly subject: string
  readonly provider: string
  readonly audience: string
  readonly purpose: string
  readonly strategy:
    | { readonly kind: "anonymous" }
    | { readonly kind: "token", readonly credential: string }
    | {
      readonly kind: "trusted-publishing"
      readonly identityProvider: string
      readonly runnerClass: string
      readonly workflow: string
    }
}

interface ProcessTrace {
  readonly credentialRequests: Array<SafeCredentialRequest>
  readonly consumedCredentialRefs: Array<string>
  readonly mutationRequests: Array<SafeCredentialRequest>
  readonly httpExchanges: Array<{
    readonly subject: string
    readonly method: "GET"
    readonly url: string
    readonly grant: CredentialGrant["_tag"]
    readonly credentialRef?: string
  }>
  readonly sourceCommands: Array<ReadonlyArray<string>>
  readonly preparationCommands: Array<{
    readonly argv: ReadonlyArray<string>
    readonly environmentNames: ReadonlyArray<string>
  }>
  failure?: {
    readonly tag: string
    readonly status?: string
    readonly message: string
  }
}

const [workspace, tracePath, ...argv] = process.argv.slice(2)
if (workspace === undefined || tracePath === undefined || argv.length === 0) {
  throw new Error("usage: cli-process-plan224 <workspace> <trace-path> <command...>")
}

const trace: ProcessTrace = {
  credentialRequests: [],
  consumedCredentialRefs: [],
  mutationRequests: [],
  httpExchanges: [],
  sourceCommands: [],
  preparationCommands: []
}

const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes)

const spawn = (
  command: ReadonlyArray<string>,
  cwd: string
): { readonly exitCode: number, readonly stdout: string, readonly stderr: string } => {
  const result = Bun.spawnSync([...command], {
    cwd,
    env: { PATH: process.env.PATH ?? "" },
    stdout: "pipe",
    stderr: "pipe",
    timeout: 20_000
  })
  if (result.exitedDueToTimeout === true || result.exitedDueToMaxBuffer === true) {
    throw new Error(`Command ${command[0] ?? "unknown"} did not complete within the fixture budget.`)
  }
  return {
    exitCode: result.exitCode,
    stdout: text(result.stdout),
    stderr: text(result.stderr)
  }
}

const sourceRuntime: SourceObserverRuntime = {
  canonicalRoot: (root) => Effect.try({
    try: () => realpathSync(root),
    catch: (cause) => cause
  }),
  read: (root, path) => Effect.try({
    try: () => new Uint8Array(readFileSync(`${root}/${path}`)),
    catch: (cause) => cause
  }),
  command: (root, command) => Effect.try({
    try: () => {
      trace.sourceCommands.push(["git", ...command])
      const result = spawn(["git", ...command], root)
      if (result.exitCode !== 0) {
        throw new Error(result.stderr.trim() || `git ${command[0] ?? "command"} exited ${result.exitCode}.`)
      }
      return result.stdout
    },
    catch: (cause) => cause
  }),
  digest: (bytes) => Effect.succeed(sha256Digest(bytes))
}

const run: RunCommand = (command) => Effect.try({
  try: () => {
    trace.preparationCommands.push({
      argv: [...command.argv],
      environmentNames: [...command.environmentNames]
    })
    const result = spawn(command.argv, command.cwd)
    return result
  },
  catch: (cause) => new DriverError({
    reason: cause instanceof Error ? cause.message : String(cause),
    commitment: "before-commit"
  })
})

const safeRequest = (request: CredentialRequest): SafeCredentialRequest => ({
  subject: request.subject.toString(),
  provider: request.provider.toString(),
  audience: request.audience.toString(),
  purpose: request.purpose,
  strategy: request.strategy.kind === "anonymous"
    ? { kind: "anonymous" }
    : request.strategy.kind === "token"
    ? {
      kind: "token",
      credential: request.strategy.credential.toString()
    }
    : {
      kind: "trusted-publishing",
      identityProvider: request.strategy.identityProvider.toString(),
      runnerClass: request.strategy.runnerClass,
      workflow: request.strategy.workflow
    }
})

const credentials = makeCredentialProvider({
  acquire: Effect.fn("Plan224ProcessCredential.acquire")(function*(request) {
    const safe = safeRequest(request)
    trace.credentialRequests.push(safe)
    if (request.purpose !== "observe") {
      trace.mutationRequests.push(safe)
      return yield* new CredentialUnavailable({
        subject: request.subject,
        provider: request.provider,
        purpose: request.purpose,
        reason: "The Plan 224 process fixture refuses every mutation capability."
      })
    }
    switch (request.strategy.kind) {
      case "anonymous":
        return { _tag: "AnonymousAccess", purposes: ["observe"] } as const
      case "token": {
        const credential = request.strategy.credential.toString()
        if (process.env[credential] !== `sentinel:${credential}`) {
          return yield* new CredentialUnavailable({
            subject: request.subject,
            provider: request.provider,
            purpose: request.purpose,
            reason: `The exact fixture credential ${credential} is unavailable.`
          })
        }
        trace.consumedCredentialRefs.push(credential)
        return {
          _tag: "ScopedSecret",
          purposes: ["observe"] as const,
          ref: request.strategy.credential
        } as const
      }
      case "trusted-publishing":
        return yield* new CredentialUnavailable({
          subject: request.subject,
          provider: request.provider,
          purpose: request.purpose,
          reason: "Trusted publishing must remain lazy until a mutation decision."
        })
    }
  })
})

const response = (status: number, body: unknown): HttpResponse => ({
  status,
  headers: {},
  body: typeof body === "string" ? body : JSON.stringify(body)
})

const http = {
  execute: Effect.fn("Plan224ProcessHttp.execute")(function*(
    request: HttpObservationRequest,
    grant: Exclude<CredentialGrant, { readonly _tag: "WorkloadIdentity" }>
  ) {
    trace.httpExchanges.push({
      subject: request.subject.toString(),
      method: request.method,
      url: request.url,
      grant: grant._tag,
      ...(grant._tag === "ScopedSecret"
        ? { credentialRef: grant.ref.toString() }
        : {})
    })
    if (grant._tag === "AnonymousAccess") return response(404, {})
    if (request.subject.toString().startsWith("npm:")) {
      return response(200, {
        dist: { integrity: "sha512-fixture-conflict", shasum: "fixture-conflict" }
      })
    }
    return response(200, {
      tag_name: "different-tag",
      name: "different-title",
      body: "",
      draft: false,
      prerelease: false,
      assets: []
    })
  })
}

const makeApi = (storeDirectory: string) => makeReleaseApi(Layer.mergeAll(
  Layer.succeed(ReleaseRuntime, {
    source: makeSourceObserver(sourceRuntime),
    run
  }),
  Layer.succeed(PreparedReleaseStore, makeLocalPreparedReleaseStore(storeDirectory)),
  Layer.succeed(CredentialProvider, credentials),
  Layer.succeed(HttpAuthorizer, http),
  unavailableMutationServicesLayer
))

const cli = makeCli(makeApi, workspace, {
  read: (path) => readFileSync(path, "utf8"),
  write: (path, value) => {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, value)
  },
  log: console.log
})

try {
  await Effect.runPromise(Command.runWith(cli, { version: "0.0.0-plan224" })(argv).pipe(
    Effect.provide(BunServices.layer)
  ))
} catch (cause) {
  const failure = typeof cause === "object" && cause !== null
    ? cause as { readonly _tag?: unknown, readonly status?: unknown, readonly message?: unknown }
    : undefined
  trace.failure = {
    tag: typeof failure?._tag === "string" ? failure._tag : "UnknownFailure",
    ...(typeof failure?.status === "string" ? { status: failure.status } : {}),
    message: typeof failure?.message === "string" ? failure.message : String(cause)
  }
  console.error(`plan224 fixture failure: ${trace.failure.tag}`)
  process.exitCode = 1
} finally {
  mkdirSync(dirname(tracePath), { recursive: true })
  writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`)
}
