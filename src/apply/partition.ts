import { encodeCanonicalJson, hashFramed } from "../model/canonical.js"
import { operationAuthority } from "../model/operation.js"
import {
  ExecutionScopeHash, OperationHash, OperationId, WorkerId
} from "../model/primitives.js"
import { ExecutionTopologyHash, WorkerKeyFingerprint } from "../model/primitives.js"
import {
  ExecutionScope, ExecutionTopology, TransitionError, WorkerRegistration
} from "../model/run.js"
import { operationEntries } from "../model/validate.js"
import type { AcceptedPlan } from "../plan/accepted.js"

const hash = (domain: string, value: unknown): string =>
  hashFramed(domain, [new TextEncoder().encode(encodeCanonicalJson(value))])
const fail = (reason: string): never => { throw TransitionError.make({ reason }) }
const required = <A>(value: A | undefined): A =>
  value === undefined ? fail("Topology registration is incomplete.") : value
const effectful = (plan: AcceptedPlan): ReadonlySet<string> => new Set(
  operationEntries(plan.plan).filter(({ operation }) =>
    !["LocalRead", "RemoteRead"].includes(operationAuthority(operation)))
    .map(({ operation }) => String(operation.id))
)
export interface PartitionRequest {
  readonly workerId: WorkerId | string
  readonly operationIds: ReadonlyArray<OperationId | string>
}
export const executionScopeHash = (
  planId: string, ownedOperationHashes: ReadonlyArray<string>,
  prerequisiteFactHashes: ReadonlyArray<string>
): ExecutionScopeHash => ExecutionScopeHash.make(hash("ts-release/execution-scope/v1", {
  planId, ownedOperationHashes: [...ownedOperationHashes].sort(),
  prerequisiteFactHashes: [...prerequisiteFactHashes].sort()
}))
export const workerKeyFingerprint = (bytes: Uint8Array): WorkerKeyFingerprint =>
  WorkerKeyFingerprint.make(hashFramed("ts-release/worker-key/v1", [bytes]))
export const executionTopologyHash = (topology: ExecutionTopology): ExecutionTopologyHash =>
  ExecutionTopologyHash.make(hash("ts-release/topology/v1", {
    planId: topology.planId,
    partitions: topology.partitions.map((item) => ({
      workerId: item.workerId, publicKey: item.publicKey,
      workerKeyFingerprint: item.workerKeyFingerprint, scopeHash: item.scopeHash,
      ownedOperationHashes: item.ownedOperationHashes,
      prerequisiteFactHashes: item.prerequisiteFactHashes
    }))
  }))
export const registerTopology = (
  plan: AcceptedPlan, scopes: ReadonlyArray<ExecutionScope>,
  publicKeys: Readonly<Record<string, Uint8Array>>
): ExecutionTopology => {
  const partitions = scopes.map((scope) => {
    const workerId = required(scope.workerId)
    const scopeHash = required(scope.scopeHash)
    const ownedOperationHashes = required(scope.ownedOperationHashes)
    const prerequisiteFactHashes = required(scope.prerequisiteFactHashes)
    const bytes = required(publicKeys[String(workerId)])
    return WorkerRegistration.make({
      workerId, publicKey: Buffer.from(bytes).toString("base64"),
      workerKeyFingerprint: workerKeyFingerprint(bytes), scopeHash,
      ownedOperationHashes, prerequisiteFactHashes
    })
  }).sort((left, right) => String(left.workerId).localeCompare(String(right.workerId)))
  if (new Set(partitions.map((item) => item.workerKeyFingerprint)).size !== partitions.length)
    fail("Worker keys must be unique.")
  return ExecutionTopology.make({ planId: plan.planId, partitions })
}
export const partition = (
  plan: AcceptedPlan, requests: ReadonlyArray<PartitionRequest>
): ReadonlyArray<ExecutionScope> => {
  if (requests.length === 0) fail("Partition requires workers.")
  const effects = effectful(plan)
  const owners = new Map<string, string>()
  const hashes = new Map(plan.operationHashes.map((item) => [item.operationId, item.hash]))
  for (const request of requests) {
    if (String(request.workerId).length === 0 || request.operationIds.length === 0)
      fail("Worker identity and ownership must be nonempty.")
    for (const id of request.operationIds.map(String)) {
      if (!effects.has(id)) fail(`Operation ${id} is not effectful.`)
      if (owners.has(id)) fail(`Operation ${id} has duplicate ownership.`)
      owners.set(id, String(request.workerId))
    }
  }
  if ([...effects].some((id) => !owners.has(id))) fail("Partition does not exactly cover effectful operations.")
  if (new Set(requests.map((item) => String(item.workerId))).size !== requests.length)
    fail("Worker identity is duplicated.")
  return requests.map((request) => {
    const ids = request.operationIds.map(String)
    const prerequisites = plan.dependencies
      .filter((edge) => ids.includes(edge.operationId) && !ids.includes(edge.producerId))
      .map((edge) => hashes.get(edge.producerId)!).sort()
    const owned = ids.map((id) => hashes.get(id)!).sort()
    return ExecutionScope.make({
      workerId: WorkerId.make(String(request.workerId)),
      operationIds: ids.map((id) => OperationId.make(id)),
      ownedOperationHashes: owned.map((value) => OperationHash.make(value)),
      prerequisiteFactHashes: [...new Set(prerequisites)].map((value) => OperationHash.make(value)),
      scopeHash: executionScopeHash(plan.planId, owned, prerequisites)
    })
  })
}
