import { describe, expect, test } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import { checkpointIds } from "../../src/apply/ledger.js"
import { operationAuthority } from "../../src/model/operation.js"
import { NonEmptyName, WorkspaceRoot } from "../../src/model/primitives.js"
import { compilePlan, Invocation } from "../../src/plan/compiler.js"

describe("announcement execution contract", () => {
  test("C087 is an index and the fourteen channels are distinct publish operations", async () => {
    const source = await Bun.file(
      "test/fixtures/parity/configs/changelog-announce/configs.json"
    ).json()
    const index = source.fixtures.find((item: any) => item.rowId === "C087")
    const channels = source.fixtures.filter((item: any) =>
      /^C(?:08[8-9]|09[0-9]|10[0-1])$/.test(item.rowId))
    expect(channels).toHaveLength(14)

    const indexPlan = await Effect.runPromise(compilePlan(index.config, Invocation.make({
      workspace: WorkspaceRoot.make("/announcement-index"),
      commit: NonEmptyName.make("commit"),
      snapshot: false
    })))
    expect(indexPlan.plan.stages.announce).toHaveLength(0)

    const combined = structuredClone(index.config)
    combined.publish.announce = channels.map((item: any) => item.config.publish.announce[0])
    const accepted = await Effect.runPromise(compilePlan(combined, Invocation.make({
      workspace: WorkspaceRoot.make("/announcement-execution"),
      commit: NonEmptyName.make("commit"),
      snapshot: false
    })))
    const operations = accepted.plan.stages.announce
    expect(operations).toHaveLength(14)
    expect(operations.filter((operation) => operation._tag === "AnnouncementPublish")).toHaveLength(13)
    expect(operations.filter((operation) => operation._tag === "SmtpPublish")).toHaveLength(1)
    for (const operation of operations) {
      expect(operationAuthority(operation)).toBe("RemotePublish")
      expect(operation.inputs.map(String)).toEqual(["release-notes"])
      expect(checkpointIds(operation).map(String)).toEqual(["message"])
    }
  })
})
