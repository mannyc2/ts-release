import { describe, expect, test } from "bun:test"
import * as Schema from "effect/Schema"
import { supplyChainReconciliationKey } from "../../src/apply/approval.js"
import { checkpointIds } from "../../src/apply/transition.js"
import { Operation, PublishCredential, SupplyChainPublish } from "../../src/model/operation.js"
import {
  CheckpointId, CredentialName, Digest, ExecutionTopologyHash, OperationHash, OperationId,
  OutputId, ProfileId, SnapshotId
} from "../../src/model/primitives.js"
import { ExecutionScope, MaterializedOutput } from "../../src/model/run.js"

const operation = SupplyChainPublish.make({
  id: OperationId.make("publish"), inputs: [OutputId.make("input")], outputs: [],
  variant: "RegistryImage", profileId: ProfileId.make("supply.registry-image.v1"),
  target: { repository: "fixture/image", tag: "1.0.0" },
  credential: PublishCredential.make({ name: CredentialName.make("OCI_REGISTRY") }),
  contractFixtureId: "contract.supply.registry-image.v1"
})
const material = MaterializedOutput.make({
  outputId: OutputId.make("input"), snapshotId: SnapshotId.make("snapshot"),
  digest: Digest.make("reviewed-digest"), size: 10, inode: 1
})

describe("closed supply-chain publication", () => {
  test("rejects arbitrary transport fields and owns exact nested checkpoints", () => {
    expect(Schema.decodeUnknownSync(Operation)(operation)._tag).toBe("SupplyChainPublish")
    expect(() => Schema.decodeUnknownSync(Operation, { onExcessProperty: "error" })({
      ...operation, endpoint: "https://injected.invalid"
    })).toThrow()
    expect(checkpointIds(operation).map(String)).toEqual(["blobs", "manifest"])
  })

  test("domain-separated reconciliation identity binds target and material", () => {
    const scope = ExecutionScope.make({ operationIds: [operation.id] })
    const args = ["plan", "logical", scope, ExecutionTopologyHash.make("topology"),
      OperationHash.make("operation"), CheckpointId.make("blobs"), operation.profileId] as const
    const key = supplyChainReconciliationKey(...args, operation.target, [material])
    expect(supplyChainReconciliationKey(...args, operation.target, [material])).toBe(key)
    expect(supplyChainReconciliationKey(...args,
      { ...operation.target, tag: "latest" }, [material])).not.toBe(key)
    expect(supplyChainReconciliationKey(...args, operation.target,
      [{ ...material, digest: Digest.make("different") }])).not.toBe(key)
  })
})
