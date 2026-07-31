import { describe, expect, test } from "@effect/bun-test"
import {
  executionTopologyHash, partition, registerTopology
} from "../../src/apply/partition.js"
import { acceptedRunPlan } from "../core/run-fixture.js"

describe("registered distributed topology", () => {
  test("binds sorted worker, key, scope, ownership, and prerequisites", async () => {
    const plan = await acceptedRunPlan()
    const scopes = partition(plan, [
      { workerId: "publish", operationIds: ["upload", "forge"] },
      { workerId: "build", operationIds: ["trusted"] }
    ])
    const keys = {
      build: new Uint8Array([1, 2, 3]),
      publish: new Uint8Array([4, 5, 6])
    }
    const topology = registerTopology(plan, scopes, keys)
    expect(topology.partitions.map((item) => String(item.workerId))).toEqual(["build", "publish"])
    expect(executionTopologyHash(topology)).toHaveLength(64)
    expect(executionTopologyHash(registerTopology(plan, [...scopes].reverse(), keys)))
      .toBe(executionTopologyHash(topology))
  })

  test("rejects missing and duplicate registered keys", async () => {
    const plan = await acceptedRunPlan()
    const scopes = partition(plan, [
      { workerId: "build", operationIds: ["trusted"] },
      { workerId: "publish", operationIds: ["upload", "forge"] }
    ])
    expect(() => registerTopology(plan, scopes, { build: new Uint8Array([1]) })).toThrow()
    expect(() => registerTopology(plan, scopes, {
      build: new Uint8Array([1]), publish: new Uint8Array([1])
    })).toThrow()
  })
})
