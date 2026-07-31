import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import {
  closeSync, constants, existsSync, fsyncSync, mkdirSync, openSync,
  readFileSync, renameSync, unlinkSync, writeFileSync
} from "node:fs"
import { dirname, join } from "node:path"
import { randomUUID } from "node:crypto"
import { encodeCanonicalJson, parseStrictJson } from "../model/canonical.js"
import { RunLedger, RunStoreError, type ExecutionScope } from "../model/run.js"
import type { ExecutionTopologyHash, LogicalRunId, OperationHash, PlanId } from "../model/primitives.js"

export type ExpectedLedger = {
  readonly planId: PlanId, readonly operationHashes: ReadonlyArray<OperationHash>,
  readonly scope: ExecutionScope, readonly topologyHash: ExecutionTopologyHash }
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
    ledger.executionTopologyHash !== expected.topologyHash ||
    JSON.stringify(ledger.operationHashes) !== JSON.stringify(expected.operationHashes) ||
    JSON.stringify(ledger.scope.operationIds) !== JSON.stringify(expected.scope.operationIds)
  ) throw error("Ledger is foreign to the requested plan, scope, or topology.")
}
const read = (path: string): RunLedger => {
  try {
    return decodeLedger(readFileSync(path, "utf8"))
  } catch (cause) {
    if (cause instanceof RunStoreError) throw cause
    throw error(`Ledger read refused: ${String(cause)}`)
  }
}
const acquire = (path: string): number => {
  const lock = `${path}.lease`
  try {
    const descriptor = openSync(lock, exclusiveFlags, 0o600)
    writeFileSync(descriptor, `${process.pid}\n`)
    fsyncSync(descriptor)
    return descriptor
  } catch (cause) {
    throw error(`Exclusive run lease refused: ${String(cause)}`)
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
  try {
    return body()
  } finally {
    closeSync(descriptor)
    unlinkSync(`${path}.lease`)
  }
}
const attempt = <A>(body: () => A) => Effect.try(
  { try: body, catch: (cause) => cause instanceof RunStoreError ? cause : error(String(cause)) })
export const makeFileRunStore = (): RunStoreShape => ({
  path: ledgerPath,
  load: Effect.fn("RunStore.load")((path, expected) => attempt(() => {
    const ledger = read(path)
    assertExpected(ledger, expected)
    return ledger
  })),
  create: Effect.fn("RunStore.create")((path, ledger) =>
    attempt(() => withLease(path, () => {
      if (existsSync(path)) throw error("Logical run already exists.")
      if (ledger.revision !== 0) throw error("New ledger must begin at revision zero.")
      return atomicWrite(path, ledger)
    }))),
  save: Effect.fn("RunStore.save")((path, expectedRevision, ledger) =>
    attempt(() => withLease(path, () => {
      const durable = read(path)
      if (durable.revision !== expectedRevision || ledger.revision !== expectedRevision + 1)
        throw error("Ledger revision compare-and-swap failed.")
      if (durable.planId !== ledger.planId ||
        durable.logicalRunId !== ledger.logicalRunId) throw error("Ledger identity changed.")
      return atomicWrite(path, ledger)
    })))
})
export const FileRunStoreLayer: Layer.Layer<RunStore> = Layer.succeed(RunStore)({ ...makeFileRunStore() })
