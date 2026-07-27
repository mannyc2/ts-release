import { describe, expect, test } from "@effect/bun-test"
import { partition } from "../../src/apply/partition.js"
import { acceptedRunPlan } from "../rewrite/run-fixture.js"

describe("distributed exact-cover partition", () => {
  test("is deterministic and derives read-only prerequisite facts", async () => {
    const plan = await acceptedRunPlan()
    const request = [
      { workerId: "build", operationIds: ["trusted"] },
      { workerId: "publish", operationIds: ["upload", "forge"] }
    ]
    const first = partition(plan, request)
    const second = partition(plan, structuredClone(request))
    expect(first).toEqual(second)
    expect(first.map((scope) => String(scope.workerId))).toEqual(["build", "publish"])
    expect(first.every((scope) => scope.scopeHash?.length === 64)).toBe(true)
    expect(first[0]!.prerequisiteFactHashes).toHaveLength(1)
    expect(first[1]!.prerequisiteFactHashes).toHaveLength(2)
  })

  test("rejects gaps, overlap, duplicate workers, and read-only ownership", async () => {
    const plan = await acceptedRunPlan()
    const invalid = [
      [{ workerId: "one", operationIds: ["trusted"] }],
      [
        { workerId: "one", operationIds: ["trusted", "upload"] },
        { workerId: "two", operationIds: ["upload", "forge"] }
      ],
      [
        { workerId: "one", operationIds: ["trusted"] },
        { workerId: "one", operationIds: ["upload", "forge"] }
      ],
      [
        { workerId: "one", operationIds: ["source", "trusted"] },
        { workerId: "two", operationIds: ["upload", "forge"] }
      ]
    ]
    for (const requests of invalid) expect(() => partition(plan, requests)).toThrow()
  })
})
