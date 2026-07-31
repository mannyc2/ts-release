import { describe, expect, test } from "@effect/bun-test"
import {
  stagedOutcome, transition
} from "../../src/apply/transition.js"
import { attestLedger, verifyLedgerAttestation } from "../../src/apply/trust.js"
import type { RunLedger, Stage } from "../../src/model/run.js"
import { distributedFixture } from "./distributed-fixture.js"

const advanced = (
  plan: Awaited<ReturnType<typeof distributedFixture>>["plan"],
  ledger: RunLedger,
  frontier: Stage
): RunLedger => {
  const result = transition(plan, ledger, { _tag: "AdvanceFrontier", frontier })
  if ("_tag" in result) throw result
  return result
}

describe("distributed staged execution", () => {
  test("uses one immutable scope while the frontier advances monotonically", async () => {
    const { plan, ledger: initial, pair } = await distributedFixture()
    let ledger = initial
    const scope = ledger.scope
    for (const frontier of ["process", "catalog", "validate", "publish", "announce", "verify"] as const) {
      ledger = advanced(plan, ledger, frontier)
      expect(ledger.scope).toEqual(scope)
    }
    expect(stagedOutcome("validate")).toBe("prepare")
    expect(stagedOutcome("publish")).toBe("publish")
    expect(stagedOutcome("announce")).toBe("announce")
    expect(stagedOutcome("verify")).toBe("continue")
    expect(() => advanced(plan, ledger, "build")).toThrow()
    const signed = await attestLedger(ledger, "worker", pair.privateKey)
    await expect(verifyLedgerAttestation(signed)).resolves.toBeUndefined()
  })
})
