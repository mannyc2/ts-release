import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Scope from "effect/Scope"
import {
  chmodSync,
  closeSync,
  constants,
  fstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { isAbsolute, join } from "node:path"
import {
  NpmClient,
  NpmDispatchRejectedBeforeStart,
  NpmDispatchResultUnavailable,
  npmCliVersion,
  npmPublishArgv,
  type NpmAuthorizationIdentity,
  type NpmClientDispatchError,
  type NpmClientShape,
  type NpmCliProcessExit,
  type NpmObservationFailed,
  type NpmObservationRequest,
  type NpmRegistryResponse,
  type PreparedNpmDispatch,
  type PreparedNpmPublishRequest
} from "../publication/npm-native.js"
import {
  formatNpmSha1Shasum,
  formatNpmSha512Sri,
  sha1Digest,
  sha512Digest
} from "../model/digest.js"

const closedNpmEnvironment = (directory: string): Readonly<Record<string, string>> =>
  Object.freeze({
    CI: "true",
    HOME: directory,
    NO_UPDATE_NOTIFIER: "1",
    TEMP: join(directory, "tmp"),
    TMP: join(directory, "tmp"),
    TMPDIR: join(directory, "tmp"),
    USERPROFILE: directory,
    npm_config_audit: "false",
    npm_config_cache: join(directory, "cache"),
    npm_config_fund: "false",
    npm_config_globalconfig: join(directory, "globalconfig"),
    npm_config_update_notifier: "false"
  })

export interface NpmVersionProbeInvocation {
  readonly kind: "npm-version-probe"
  readonly executable: "npm"
  readonly argv: readonly ["npm", "--version"]
  readonly cwd: string
  readonly environment: Readonly<Record<string, string>>
  readonly inheritEnvironment: false
  readonly stdin: "ignore"
  readonly stdout: "capture"
  readonly stderr: "capture"
  readonly terminal: false
  readonly retry: "none"
}

export interface NpmPublishInvocation {
  readonly kind: "npm-publish"
  readonly executable: "npm"
  readonly argv: readonly [string, ...Array<string>]
  readonly cwd: string
  readonly environment: Readonly<Record<string, string>>
  readonly inheritEnvironment: false
  readonly stdin: "ignore"
  readonly stdout: "capture"
  readonly stderr: "capture"
  readonly terminal: false
  readonly retry: "none"
  /** Nonsecret authority identity; the credential value remains in userconfig. */
  readonly authorizationIdentity: NpmAuthorizationIdentity
  readonly request: PreparedNpmPublishRequest
}

export interface NpmRegistryObservationInvocation {
  readonly kind: "npm-registry-observation"
  readonly request: NpmObservationRequest
  readonly retry: "none"
}

/**
 * Operation-local host/protocol boundary. The effect-build provider operation
 * supplies these three closed calls; ts-release owns admission and history.
 * Tests can supply a protocol double without touching a registry.
 */
export interface NpmNativeOperationBoundary {
  readonly probeVersion: (
    invocation: NpmVersionProbeInvocation
  ) => Effect.Effect<NpmCliProcessExit, NpmDispatchRejectedBeforeStart>
  readonly publish: (
    invocation: NpmPublishInvocation
  ) => Effect.Effect<NpmCliProcessExit, NpmClientDispatchError>
  readonly observe: (
    invocation: NpmRegistryObservationInvocation
  ) => Effect.Effect<NpmRegistryResponse, NpmObservationFailed>
}

export interface NpmClientOperationOptions {
  /** Explicit parent for operation-scoped files; no ambient temp selection. */
  readonly temporaryRoot: string
  /** Explicit credential file prepared by the operation-local authority layer. */
  readonly userConfigPath: string
  /** Must equal the nonsecret authorization identity committed by the Intent. */
  readonly authorizationIdentity: NpmAuthorizationIdentity
  readonly boundary: NpmNativeOperationBoundary
}

interface ScopedNpmTransport {
  readonly directory: string
  readonly tarballPath: string
  readonly userConfigPath: string
  readonly environment: Readonly<Record<string, string>>
}

const beforeDispatch = (reason: string): NpmDispatchRejectedBeforeStart =>
  new NpmDispatchRejectedBeforeStart({
    schemaVersion: "npm-dispatch-error/v1",
    commitment: "before-dispatch",
    reason
  })

const acquireTransport = (
  temporaryRoot: string,
  bytes: Uint8Array,
  userConfigBytes: Uint8Array
): Effect.Effect<ScopedNpmTransport, NpmDispatchRejectedBeforeStart, Scope.Scope> => {
  const acquired = Effect.try({
    try: () => {
      mkdirSync(temporaryRoot, { recursive: true, mode: 0o700 })
      const directory = mkdtempSync(join(temporaryRoot, "ts-release-npm-native-"))
      try {
        chmodSync(directory, 0o700)
        mkdirSync(join(directory, "cache"), { mode: 0o700 })
        mkdirSync(join(directory, "tmp"), { mode: 0o700 })
        writeFileSync(join(directory, "globalconfig"), "", { flag: "wx", mode: 0o400 })
        const tarballPath = join(directory, "package.tgz")
        const userConfigPath = join(directory, "userconfig")
        writeFileSync(tarballPath, bytes, { flag: "wx", mode: 0o400 })
        writeFileSync(userConfigPath, userConfigBytes, { flag: "wx", mode: 0o400 })
        return {
          directory,
          tarballPath,
          userConfigPath,
          environment: closedNpmEnvironment(directory)
        }
      } catch (cause) {
        rmSync(directory, { recursive: true, force: true })
        throw cause
      }
    },
    catch: () => beforeDispatch("Unable to materialize the immutable npm tarball in a private scoped directory.")
  })
  return Effect.acquireRelease(
    acquired,
    ({ directory }) => Effect.sync(() => rmSync(directory, { recursive: true, force: true }))
  )
}

const snapshotUserConfig = (path: string): Uint8Array => {
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const metadata = fstatSync(descriptor)
    if (!metadata.isFile()) throw new Error("npm userconfig is not a regular file")
    if ((metadata.mode & 0o077) !== 0) throw new Error("npm userconfig permissions expose credential material")
    return new Uint8Array(readFileSync(descriptor))
  } finally {
    closeSync(descriptor)
  }
}

const immutableObservation = (
  request: NpmObservationRequest
): NpmRegistryObservationInvocation => Object.freeze({
  kind: "npm-registry-observation",
  request: Object.freeze({
    method: request.method,
    url: request.url,
    headers: Object.freeze({ ...request.headers })
  }),
  retry: "none"
})

/**
 * Constructs one NpmClient Layer for one provider operation. The returned
 * prepared dispatch owns a private `.tgz` path for exactly its surrounding
 * Scope and is consumable once; it exposes no automatic retry path.
 */
export const makeNpmClientLayerForOperation = (
  options: NpmClientOperationOptions
): Layer.Layer<NpmClient> => {
  const temporaryRoot = options.temporaryRoot
  const userConfigPath = options.userConfigPath
  const authorizationIdentity = options.authorizationIdentity
  const probeVersion = options.boundary.probeVersion
  const publish = options.boundary.publish
  const observe = options.boundary.observe

  const prepareDispatch: NpmClientShape["prepareDispatch"] = Effect.fn(
    "NativeNpmClient.prepareDispatch"
  )(function*(request, tarballBytes) {
    if (!isAbsolute(temporaryRoot) || !isAbsolute(userConfigPath)) {
      return yield* beforeDispatch("npm temporaryRoot and userConfigPath must be explicit absolute paths.")
    }
    if (request.intent.authorization.identity !== authorizationIdentity) {
      return yield* beforeDispatch("The npm operation Layer does not match the Intent authorization identity.")
    }
    if (tarballBytes.byteLength !== request.tarball.byteLength ||
        formatNpmSha1Shasum(sha1Digest(tarballBytes)) !== request.tarball.shasum ||
        formatNpmSha512Sri(sha512Digest(tarballBytes)) !== request.tarball.integrity) {
      return yield* beforeDispatch("The npm operation Layer received bytes outside the prepared request commitment.")
    }
    const userConfigBytes = yield* Effect.try({
      try: () => snapshotUserConfig(userConfigPath),
      catch: () => beforeDispatch("The explicit npm userconfig is unavailable before dispatch.")
    })

    const bytes = Uint8Array.from(tarballBytes)
    const transport = yield* acquireTransport(temporaryRoot, bytes, userConfigBytes)
    const processPolicy = {
      cwd: transport.directory,
      environment: transport.environment,
      inheritEnvironment: false,
      stdin: "ignore",
      stdout: "capture",
      stderr: "capture",
      terminal: false,
      retry: "none"
    } as const
    const versionInvocation: NpmVersionProbeInvocation = Object.freeze({
      kind: "npm-version-probe",
      executable: "npm",
      argv: Object.freeze(["npm", "--version"] as const),
      ...processPolicy
    })
    const version = yield* probeVersion(versionInvocation)
    if (version.exitCode !== 0 || version.stderr.trim().length > 0 ||
        version.stdout.trim() !== npmCliVersion) {
      return yield* beforeDispatch(`The npm CLI preflight requires exact version ${npmCliVersion}.`)
    }

    const invocation: NpmPublishInvocation = Object.freeze({
      kind: "npm-publish",
      executable: "npm",
      argv: npmPublishArgv(request.intent, transport.tarballPath, transport.userConfigPath),
      ...processPolicy,
      authorizationIdentity,
      request
    })
    let consumed = false
    const run = Effect.gen(function*() {
      if (consumed) {
        return yield* new NpmDispatchResultUnavailable({
          schemaVersion: "npm-dispatch-error/v1",
          commitment: "possible-dispatch",
          reason: "The operation-scoped npm dispatch capability was already consumed."
        })
      }
      consumed = true
      return yield* publish(invocation)
    })
    return Object.freeze({ request, run } satisfies PreparedNpmDispatch)
  })

  const client: NpmClientShape = Object.freeze({
    prepareDispatch,
    observe: Effect.fn("NativeNpmClient.observe")((request) =>
      observe(immutableObservation(request)))
  })
  return Layer.succeed(NpmClient)(client)
}
