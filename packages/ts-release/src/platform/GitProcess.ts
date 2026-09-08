import * as Effect from "effect/Effect"
import * as Cause from "effect/Cause"
import type * as Scope from "effect/Scope"
import { command, type ProcessResult } from "./Process.js"
import { accessSync, constants, mkdtempSync, realpathSync, rmSync, lstatSync } from "node:fs"
import { dirname, isAbsolute, join, delimiter } from "node:path"
import { ReleaseError, attempt, failure, reject } from "../internal/Error.js"
import { admitCoordinate, type Credentials, type RefCoordinate } from "../internal/GitCatalog.js"
import * as Redacted from "effect/Redacted"

export interface GitProcessOptions {
  readonly gitExecutable: string
  readonly temporaryRoot: string
  readonly timeoutMilliseconds: number
  readonly maximumOutputBytes: number
}
export type GitResult = ProcessResult
export interface GitEnvironment {
  readonly identity?: Readonly<Record<string, string>>
  readonly credentialConfig?: Readonly<Record<string, string>>
}
export type GitCommand = (
  args: readonly string[],
  input?: Uint8Array,
  environment?: GitEnvironment,
) => Effect.Effect<GitResult, ReleaseError>
export type GitRepository = Readonly<{ run: GitCommand; directory: string }>
export interface GitRuntime {
  readonly maximumOutputBytes: number
  readonly repository: (format: "sha1" | "sha256") => Effect.Effect<GitRepository, ReleaseError>
}
const error = () => failure("git-process", "Native Git command did not return complete bounded output")
const config = (values: Readonly<Record<string, string>>) =>
  Object.fromEntries([
    ["GIT_CONFIG_COUNT", String(Object.keys(values).length)],
    ...Object.entries(values).flatMap(([key, value], index) => [
      [`GIT_CONFIG_KEY_${index}`, key],
      [`GIT_CONFIG_VALUE_${index}`, value],
    ]),
  ])
export const credentialEnvironment = (
  input: RefCoordinate,
  credentials: Credentials,
): GitEnvironment => {
  const coordinate = admitCoordinate(input),
    url = new URL(coordinate.remote)
  let header: string | undefined
  if (credentials._tag === "Bearer") {
    const value = Redacted.value(credentials.token)
    if (!value || value.length > 65536 || /[^\x21-\x7e]/u.test(value)) throw error()
    header = `Authorization: Bearer ${value}`
  } else if (credentials._tag === "Basic") {
    const password = Redacted.value(credentials.password),
      username = credentials.username
    if (
      !username ||
      !password ||
      username.length + password.length > 65536 ||
      /[:\u0000\r\n]/u.test(username) ||
      /[\u0000\r\n]/u.test(password)
    )
      throw error()
    header = `Authorization: Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`
  } else if (credentials._tag !== "Anonymous") throw error()
  if (header && url.protocol !== "https:") throw error()
  return Object.freeze({
    credentialConfig: Object.freeze(
      header ? { [`http.${coordinate.remote}.extraHeader`]: header } : {},
    ),
  })
}
export const resolveGitCredentials = Effect.fn("git.resolveCredentials")(function* (
  resolve: (input: RefCoordinate) => Effect.Effect<Credentials, ReleaseError>,
  input: RefCoordinate,
) {
  const coordinate = yield* attempt(() => admitCoordinate(input))
  return yield* Effect.suspend(() => resolve(coordinate)).pipe(
    Effect.flatMap((value) => attempt(() => credentialEnvironment(coordinate, value))),
    Effect.catchCause((cause) =>
      Cause.hasInterrupts(cause)
        ? Effect.interrupt
        : Effect.fail(failure("git-credentials", "Git credentials could not be acquired")),
    ),
  )
})
export const openGitRuntime = Effect.fn("git.openRuntime")(
  (input: GitProcessOptions): Effect.Effect<GitRuntime, ReleaseError, Scope.Scope> =>
    Effect.gen(function* () {
      const options = yield* attempt(() => {
        const selected = {
          gitExecutable: input.gitExecutable,
          temporaryRoot: input.temporaryRoot,
          timeoutMilliseconds: input.timeoutMilliseconds,
          maximumOutputBytes: input.maximumOutputBytes,
        }
        if (
          !isAbsolute(selected.gitExecutable) ||
          !isAbsolute(selected.temporaryRoot) ||
          ![selected.timeoutMilliseconds, selected.maximumOutputBytes].every(
            (n) => Number.isSafeInteger(n) && n > 0 && n <= 2_147_483_647,
          )
        )
          throw error()
        const executable = realpathSync(selected.gitExecutable),
          root = realpathSync(selected.temporaryRoot)
        if (!lstatSync(executable).isFile() || !lstatSync(root).isDirectory()) throw error()
        accessSync(executable, constants.X_OK)
        return { ...selected, gitExecutable: executable, temporaryRoot: root }
      })
      const root = yield* Effect.acquireRelease(
        attempt(() => mkdtempSync(join(options.temporaryRoot, "ts-release-git-"))),
        (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true })),
      )
      const base = Object.freeze({
        PATH: [dirname(options.gitExecutable), "/usr/bin", "/bin"].join(delimiter),
        // Child-only credential/config homes. An omitted HOME lets libcurl fall
        // back to the account's passwd entry and read an ambient .netrc.
        HOME: root,
        USERPROFILE: root,
        XDG_CONFIG_HOME: root,
        NETRC: process.platform === "win32" ? "NUL" : "/dev/null",
        GIT_ALLOW_PROTOCOL: "file:https",
        GIT_ATTR_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_TERMINAL_PROMPT: "0",
        GIT_NO_REPLACE_OBJECTS: "1",
        LANG: "C",
        LC_ALL: "C",
      })
      return Object.freeze({
        maximumOutputBytes: options.maximumOutputBytes,
        repository: Effect.fn("git.openRepository")(function* (format: "sha1" | "sha256") {
          if (format !== "sha1" && format !== "sha256") return yield* Effect.fail(error())
          const directory = yield* attempt(() => mkdtempSync(join(root, "repository-"))),
            execute = command(options.gitExecutable, directory, options, error)
          const run: GitCommand = (args, bytes, environment) =>
            execute(args, bytes, {
              ...base,
              ...environment?.identity,
              ...config({
                "core.hooksPath": join(root, "no-hooks"),
                "gc.auto": "0",
                "maintenance.auto": "false",
                "transfer.fsckObjects": "true",
                "credential.helper": "",
                "http.followRedirects": "false",
                "http.emptyAuth": "false",
                "http.maxRetries": "0",
                "http.sslVerify": "true",
                "http.proxy": "",
                ...environment?.credentialConfig,
              }),
            })
          yield* checked(run, [
            "init",
            "--bare",
            "--quiet",
            "--template=",
            `--object-format=${format}`,
            ".",
          ])
          return Object.freeze({ directory, run })
        }),
      })
    }),
)
export const checked = Effect.fn("git.checkedCommand")(function* (
  run: GitCommand,
  args: readonly string[],
  bytes?: Uint8Array,
  environment?: GitEnvironment,
) {
  const result = yield* run(args, bytes, environment)
  if (result.exitCode !== 0)
    return yield* reject("git-command", "Native Git rejected the prepared operation")
  return result.stdout
})
export const nativeText = (bytes: Uint8Array): string =>
  new TextDecoder("utf-8", { fatal: true }).decode(bytes)
export const checkedText = Effect.fn("git.checkedText")(function* (
  run: GitCommand,
  args: readonly string[],
  bytes?: Uint8Array,
  environment?: GitEnvironment,
) {
  const result = yield* checked(run, args, bytes, environment)
  return yield* attempt(() => nativeText(result))
})
