import { createHash } from "node:crypto"
import { lstatSync, readFileSync, realpathSync } from "node:fs"
import { relative, resolve, sep } from "node:path"
import type { AcceptedPlan } from "../plan/accepted.js"
import type { RunLedger } from "../model/run.js"
import { TransitionError } from "../model/run.js"
import { verifyLedgerAttestation } from "./trust.js"

const fail = (reason: string): never => { throw TransitionError.make({ reason }) }
const required = <A>(value: A | undefined): A =>
  value === undefined ? fail("Transferred output has the wrong owner.") : value
export interface TransferFact {
  readonly outputId: string
  readonly path: string
  readonly size: number
  readonly digest: string
}
export const deriveTransfer = async (
  plan: AcceptedPlan, ledger: RunLedger
): Promise<ReadonlyArray<TransferFact>> => {
  await verifyLedgerAttestation(ledger)
  const owned = new Set(ledger.scope.operationIds.map(String))
  const facts = ledger.operations.filter((record) => owned.has(record.operationId)).flatMap((record) => {
    const state = record.attempts.at(-1)?.state
    if (state?._tag === "CommitUnknown" || state?._tag === "ManualReview")
      fail("Unknown or manual state cannot transfer.")
    if (state?._tag !== "Passed") return []
    return state.materializedOutputs.map((output) => {
      const declaration = required(plan.outputs.find((item) => item.output.id === output.outputId))
      if (declaration.producerId !== record.operationId) fail("Transferred output has the wrong owner.")
      return {
        outputId: output.outputId, path: declaration.output.path,
        size: output.size, digest: output.digest
      }
    })
  })
  return facts.sort((left, right) => left.path.localeCompare(right.path))
}
export const verifyTransferredFiles = async (
  plan: AcceptedPlan, ledger: RunLedger, root: string, transportedPaths: ReadonlyArray<string>
): Promise<ReadonlyArray<TransferFact>> => {
  const facts = await deriveTransfer(plan, ledger)
  const expected = facts.map((item) => item.path).sort()
  if (new Set(transportedPaths).size !== transportedPaths.length ||
    JSON.stringify([...transportedPaths].sort()) !== JSON.stringify(expected))
    fail("Transfer set is missing, extra, or duplicated.")
  const canonicalRoot = realpathSync(root)
  for (const fact of facts) {
    const path = resolve(canonicalRoot, fact.path)
    const child = relative(canonicalRoot, path)
    if (child === ".." || child.startsWith(`..${sep}`) || lstatSync(path).isSymbolicLink())
      fail("Transferred path escapes or is symlinked.")
    const bytes = readFileSync(path)
    const digest = createHash("sha256").update(bytes).digest("hex")
    if (bytes.length !== fact.size || digest !== fact.digest) fail("Transferred bytes drifted.")
  }
  return facts
}
