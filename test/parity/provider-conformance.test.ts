import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { supplyChainReconciliationKey } from "../../src/apply/approval.js"
import { checkpointIds } from "../../src/apply/ledger.js"
import { makeNodeCatalog } from "../../src/drivers/remote.js"
import { CatalogPublishRequest } from "../../src/drivers/services.js"
import {
  CheckpointId, Digest, ExecutionTopologyHash, NonEmptyName, OperationHash, SnapshotId, WorkspaceRoot
} from "../../src/model/primitives.js"
import { ExecutionScope, MaterializedOutput } from "../../src/model/run.js"
import { compilePlan, Invocation } from "../../src/plan/compiler.js"

describe("provider conformance protocol", () => {
  test("binds profiles, domain-separated keys, and unavailable live transport", async () => {
    const fixtures = (await Bun.file(
      "test/fixtures/parity/configs/providers/configs.json"
    ).json()).fixtures
    const config = fixtures.find((item: any) => item.rowId === "C066").config
    const accepted = await Effect.runPromise(compilePlan(config, Invocation.make({
      workspace: WorkspaceRoot.make("/provider"), commit: NonEmptyName.make("commit"), snapshot: false
    })))
    const operation = accepted.plan.stages.publish[0]!
    expect(operation._tag).toBe("ProviderPublish")
    if (operation._tag !== "ProviderPublish") return
    expect(checkpointIds(operation)).toEqual([CheckpointId.make("put")])
    const material = MaterializedOutput.make({ outputId: operation.inputs[0]!,
      snapshotId: SnapshotId.make("snapshot"), digest: Digest.make("digest"), size: 7, inode: 1 })
    const key = supplyChainReconciliationKey(accepted.planId, "logical",
      ExecutionScope.make({ operationIds: [operation.id] }), ExecutionTopologyHash.make("topology"),
      OperationHash.make("operation"), CheckpointId.make("put"), operation.profileId,
      operation.target, [material], "provider")
    expect(key).not.toBe(supplyChainReconciliationKey(accepted.planId, "logical",
      ExecutionScope.make({ operationIds: [operation.id] }), ExecutionTopologyHash.make("topology"),
      OperationHash.make("operation"), CheckpointId.make("put"), operation.profileId,
      { ...operation.target, key: "changed" }, [material], "provider"))
    const request = CatalogPublishRequest.make({
      operation, checkpointId: CheckpointId.make("put"), clientReconciliationKey: key
    })
    const failure = await Effect.runPromise(
      makeNodeCatalog(() => Effect.die("unused")).publish(request, undefined, "secret").pipe(Effect.flip)
    )
    expect(failure.reason).toContain("No live closed-profile")
  })
})
