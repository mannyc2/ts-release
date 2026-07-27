import * as Schema from "effect/Schema"
import { encodeCanonicalJson } from "../model/canonical.js"
import {
  AttemptRecord, AttemptState, ExecutionTopology, ImportedFact,
  OperationRunRecord, RunLedger, TransitionError
} from "../model/run.js"
import type { AcceptedPlan } from "../plan/accepted.js"
import {
  attestLedger, importWorkerKey, materialBindingHash,
  verifyAuthorization, verifyLedgerAttestation
} from "./trust.js"

const fail = (reason: string): never => { throw TransitionError.make({ reason }) }
const required = <A>(value: A | undefined, reason: string): A =>
  value === undefined ? fail(reason) : value
const encoded = (value: unknown): string => encodeCanonicalJson(value)
const sameIdentity = (target: RunLedger, donor: RunLedger): boolean =>
  target.planId === donor.planId && target.logicalRunId === donor.logicalRunId &&
  target.executionTopologyHash === donor.executionTopologyHash &&
  encoded(target.operationHashes) === encoded(donor.operationHashes) &&
  encoded(target.topology === undefined ? null : Schema.encodeSync(ExecutionTopology)(target.topology))
    === encoded(donor.topology === undefined ? null : Schema.encodeSync(ExecutionTopology)(donor.topology))
const terminal = (tag: string): boolean => ["Passed", "FailedBeforeCommit"].includes(tag)
export const mergeLedgers = async (
  plan: AcceptedPlan, target: RunLedger, donors: ReadonlyArray<RunLedger>,
  coordinatorWorkerId: string, coordinatorKey: CryptoKey
): Promise<RunLedger> => {
  await verifyLedgerAttestation(target)
  await Promise.all(donors.map(verifyLedgerAttestation))
  let operations = [...target.operations]
  for (const donor of donors) {
    if (!sameIdentity(target, donor)) fail("Merged ledger identity is foreign.")
    const registration = required(donor.topology?.partitions.find((item) =>
      item.workerId === donor.attestation?.workerId && item.scopeHash === donor.scope.scopeHash),
    "Merged ledger scope is unregistered.")
    const publicKey = await importWorkerKey(registration.publicKey)
    for (const source of donor.operations.filter((item) =>
      donor.scope.operationIds.includes(item.operationId))) {
      const attempt = source.attempts.at(-1)!
      if (attempt.state._tag === "Pending") continue
      if (!terminal(attempt.state._tag)) fail("Nonterminal or assumed state cannot merge.")
      const authorization = required(
        attempt.authorizationReceipt, "Merged attempt authorization is foreign.")
      if (authorization.planId !== donor.planId ||
        authorization.logicalRunId !== donor.logicalRunId ||
        authorization.scopeHash !== registration.scopeHash ||
        authorization.topologyHash !== donor.executionTopologyHash ||
        authorization.operationHash !== source.operationHash ||
        authorization.attemptId !== attempt.attemptId) fail("Merged attempt authorization is foreign.")
      await verifyAuthorization(authorization, publicKey)
      if (attempt.state._tag === "Passed" && attempt.state.materializedOutputs.some((output) => {
        const path = plan.outputs.find((item) => item.output.id === output.outputId)?.output.path
        return path === undefined || !authorization.materialBindingHashes.includes(
          materialBindingHash(output.outputId, path, output.size, output.digest))
      })) fail("Merged content identity is unauthorized.")
      const index = operations.findIndex((item) => item.operationId === source.operationId)
      const prior = operations[index]!
      const priorState = prior.attempts.at(-1)!.state
      if (priorState._tag !== "Pending" &&
        encoded(Schema.encodeSync(AttemptState)(priorState)) !==
        encoded(Schema.encodeSync(AttemptState)(attempt.state)))
        fail("Merged terminal facts conflict.")
      const local = prior.attempts.at(-1)!
      operations[index] = OperationRunRecord.make({
        operationId: prior.operationId, operationHash: prior.operationHash,
        attempts: [...prior.attempts.slice(0, -1), AttemptRecord.make({
          attemptId: local.attemptId, executionReceipt: local.executionReceipt,
          authorizationReceipt: authorization, state: attempt.state,
          importedFrom: ImportedFact.make({
            workerId: registration.workerId, revision: donor.revision,
            attestationDigest: donor.attestation!.digest
          })
        })]
      })
    }
  }
  return attestLedger(RunLedger.make({
    ...target, revision: target.revision + 1, operations
  }), coordinatorWorkerId, coordinatorKey)
}
