import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import {
  closeSync, constants, existsSync, fsyncSync, mkdirSync, openSync,
  readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync
} from "node:fs"
import { dirname, join } from "node:path"
import { randomUUID } from "node:crypto"
import { encodeCanonicalJson, parseStrictJson } from "../model/canonical.js"
import { RunLedger, RunStoreError } from "../model/run.js"
import type { LogicalRunId, OperationHash, PlanId } from "../model/primitives.js"

// Only the arms that are independent of the loaded file belong here: scope
// and topology live inside the ledger and are validated against the plan by
// validateLedger, so comparing them to themselves proves nothing.
export type ExpectedLedger = {
  readonly planId: PlanId, readonly operationHashes: ReadonlyArray<OperationHash> }
export type Durability = "file-rename-directory-sync" | "file-rename"
export type RunStoreShape = {
  readonly path: (directory: string, logicalRunId: LogicalRunId) => string,
  readonly load: (path: string, expected: ExpectedLedger) => Effect.Effect<RunLedger, RunStoreError>,
  readonly create: (path: string, ledger: RunLedger) => Effect.Effect<Durability, RunStoreError>,
  readonly save: (path: string, expectedRevision: number, ledger: RunLedger) => Effect.Effect<Durability, RunStoreError>
}
export class RunStore extends Context.Service<RunStore, RunStoreShape>()("RunStore") {}

const error = (reason: string): RunStoreError => RunStoreError.make({ reason })
const exclusiveFlags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW
export const ledgerPath = (directory: string, logicalRunId: LogicalRunId): string =>
  join(directory, `${logicalRunId}.run-ledger.json`)
export const encodeLedger = (ledger: RunLedger): string => encodeCanonicalJson(Schema.encodeSync(RunLedger)(ledger))
export const decodeLedger = (bytes: string): RunLedger => {
  const ledger = Schema.decodeUnknownSync(RunLedger, { onExcessProperty: "error" })(parseStrictJson(bytes))
  if (encodeLedger(ledger) !== bytes) throw error("Ledger is not canonical.")
  return ledger
}
const assertExpected = (ledger: RunLedger, expected: ExpectedLedger): void => {
  if (ledger.planId !== expected.planId ||
    JSON.stringify(ledger.operationHashes) !== JSON.stringify(expected.operationHashes)
  ) throw error("Ledger is foreign to the requested plan.")
}
export const readLedgerFile = (path: string): RunLedger => {
  try {
    const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    try {
      return decodeLedger(readFileSync(descriptor, "utf8"))
    } finally {
      closeSync(descriptor)
    }
  } catch (cause) {
    if (cause instanceof RunStoreError) throw cause
    throw error(`Ledger read refused: ${String(cause)}`)
  }
}
// Resume accepts the runs directory because later pipeline jobs cannot
// statically know the derived ledger file name.
export const resolveLedgerPath = (path: string): string => {
  let directory = false
  try {
    directory = statSync(path).isDirectory()
  } catch {
    return path
  }
  if (!directory) return path
  const ledgers = readdirSync(path).filter((name) => name.endsWith(".run-ledger.json"))
  if (ledgers.length !== 1) {
    throw error(`Runs directory ${path} holds ${ledgers.length} run ledgers; name the ledger file to resume.`)
  }
  return join(path, ledgers[0]!)
}
// Leases outlive their process only via SIGKILL/OOM; the revision CAS in
// save remains the integrity backstop if a paused holder wakes up.
const staleLeaseMilliseconds = 3_600_000
const acquire = (path: string): number => {
  const lock = `${path}.lease`
  const open = (): number => {
    const descriptor = openSync(lock, exclusiveFlags, 0o600)
    writeFileSync(descriptor, `${process.pid}\n`)
    fsyncSync(descriptor)
    return descriptor
  }
  try {
    return open()
  } catch (cause) {
    const code = typeof cause === "object" && cause !== null && "code" in cause
      ? String(cause.code) : ""
    if (code !== "EEXIST") throw error(`Exclusive run lease refused: ${String(cause)}`)
    try {
      const age = Date.now() - statSync(lock).mtimeMs
      if (age > staleLeaseMilliseconds) {
        unlinkSync(lock)
        return open()
      }
      const holder = readFileSync(lock, "utf8").trim()
      throw error(`Exclusive run lease refused: held by pid ${holder} for ${
        Math.round(age / 1000)}s (${lock}). Delete the file if that process is dead.`)
    } catch (secondary) {
      if (secondary instanceof RunStoreError) throw secondary
      throw error(`Exclusive run lease refused: ${String(cause)}`)
    }
  }
}
const syncDirectory = (directory: string): Durability => {
  let descriptor: number | undefined
  try {
    descriptor = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY)
    fsyncSync(descriptor)
    return "file-rename-directory-sync"
  } catch (cause) {
    const code = typeof cause === "object" && cause !== null && "code" in cause
      ? String(cause.code) : ""
    if (!["EINVAL", "ENOTSUP", "EISDIR"].includes(code)) throw cause
    return "file-rename"
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }
}
const atomicWrite = (path: string, ledger: RunLedger): Durability => {
  const directory = dirname(path)
  const temporary = join(directory, `.${randomUUID()}.run-ledger.tmp`)
  let descriptor: number | undefined
  try {
    descriptor = openSync(temporary, exclusiveFlags, 0o600)
    writeFileSync(descriptor, encodeLedger(ledger))
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = undefined
    renameSync(temporary, path)
    return syncDirectory(directory)
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
    if (existsSync(temporary)) unlinkSync(temporary)
  }
}
const withLease = <A>(path: string, body: () => A): A => {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const descriptor = acquire(path)
  let bodyFailed = false
  try {
    return body()
  } catch (cause) {
    bodyFailed = true
    throw cause
  } finally {
    // The body's error always wins: release problems surface only on an
    // otherwise-successful run, and a stolen stale lease (ENOENT) is silent.
    let releaseError: unknown
    try {
      closeSync(descriptor)
    } catch (cause) {
      releaseError = cause
    }
    try {
      unlinkSync(`${path}.lease`)
    } catch (cause) {
      const code = typeof cause === "object" && cause !== null && "code" in cause
        ? String(cause.code) : ""
      if (code !== "ENOENT" && releaseError === undefined) releaseError = cause
    }
    if (!bodyFailed && releaseError !== undefined) {
      throw error(`Run lease release failed: ${String(releaseError)}`)
    }
  }
}
const attempt = <A>(body: () => A) => Effect.try(
  { try: body, catch: (cause) => cause instanceof RunStoreError ? cause : error(String(cause)) })
export const makeFileRunStore = (): RunStoreShape => ({
  path: ledgerPath,
  load: Effect.fn("RunStore.load")((path, expected) => attempt(() => {
    const ledger = readLedgerFile(path)
    assertExpected(ledger, expected)
    return ledger
  })),
  create: Effect.fn("RunStore.create")((path, ledger) =>
    attempt(() => withLease(path, () => {
      if (existsSync(path)) throw error(`Logical run already exists at ${path}. Resume it, or pass a reason to derive a new logical run.`)
      if (ledger.revision !== 0) throw error("New ledger must begin at revision zero.")
      return atomicWrite(path, ledger)
    }))),
  save: Effect.fn("RunStore.save")((path, expectedRevision, ledger) =>
    attempt(() => withLease(path, () => {
      const durable = readLedgerFile(path)
      if (durable.revision !== expectedRevision || ledger.revision !== expectedRevision + 1)
        throw error("Ledger revision compare-and-swap failed.")
      if (durable.planId !== ledger.planId ||
        durable.logicalRunId !== ledger.logicalRunId) throw error("Ledger identity changed.")
      return atomicWrite(path, ledger)
    })))
})
export const FileRunStoreLayer: Layer.Layer<RunStore> = Layer.succeed(RunStore)({ ...makeFileRunStore() })
