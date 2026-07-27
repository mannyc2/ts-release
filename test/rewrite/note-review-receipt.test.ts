import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import {
  executionReviewId,
  publishReviewId
} from "../../src/apply/approval.js"
import { operationAuthority } from "../../src/model/operation.js"
import {
  Digest,
  ExecutionTopologyHash,
  NonEmptyName,
  OperationId,
  OutputId,
  SnapshotId,
  WorkspaceRoot
} from "../../src/model/primitives.js"
import { ExecutionScope, MaterializedOutput } from "../../src/model/run.js"
import { compilePlan, Invocation } from "../../src/plan/compiler.js"

const material = (digest: string) => MaterializedOutput.make({
  outputId: OutputId.make("final-notes"),
  snapshotId: SnapshotId.make(digest),
  digest: Digest.make(digest),
  size: 128,
  inode: 1
})

describe("reviewed note receipt binding", () => {
  test("the transform has read authority and review identity binds exact final-note bytes", async () => {
    const fixtures = await Bun.file(
      "test/fixtures/parity/configs/changelog-announce/configs.json"
    ).json()
    const config = fixtures.fixtures.find((item: any) => item.rowId === "P007").config
    const accepted = await Effect.runPromise(compilePlan(config, Invocation.make({
      workspace: WorkspaceRoot.make("/reviewed-notes"),
      commit: NonEmptyName.make("commit"),
      snapshot: false
    })))
    const transform = accepted.plan.stages.validate[0]!
    expect(transform._tag).toBe("ReviewedNoteTransform")
    expect(operationAuthority(transform)).toBe("RemoteRead")

    const scope = ExecutionScope.make({
      operationIds: accepted.operationHashes.map(({ operationId }) => OperationId.make(operationId))
    })
    const topology = ExecutionTopologyHash.make("single-machine/v1")
    const executionReview = executionReviewId(accepted, scope, topology)
    const first = publishReviewId(accepted, executionReview, scope, [material("a".repeat(64))])
    const changed = publishReviewId(accepted, executionReview, scope, [material("b".repeat(64))])
    expect(changed).not.toBe(first)
  })
})
