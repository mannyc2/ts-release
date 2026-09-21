import { expect, test } from "bun:test"
import { Effect } from "effect"
import { createPlan, reportRelease, runRelease, supersedePlan } from "./kernel.js"
import { evaluatorNames, makeFixture, runWithHost } from "./fixtures.js"

for (const candidate of evaluatorNames) {
  test(`${candidate}: a never-dispatched superseded plan remains in successor history`, async () => {
    const f = await makeFixture(undefined, candidate)
    const next = await Effect.runPromise(
      createPlan("corrected-bundle", [f.operation], f.plan.journalId),
    )
    const host = {
      ...f.host,
      journal: {
        journalId: f.plan.journalId,
        scopes: [{ _tag: "PublicationScope" as const, plan: next }],
        supersededPlans: [{ plan: f.plan, providers: f.host.providers }],
      },
    }
    await expect(runWithHost(host, runRelease({ plan: next, authorize: true }))).rejects.toThrow(
      "superseded without any dispatch",
    )
    expect(f.sends).toHaveLength(0)
    await runWithHost(
      f.host,
      supersedePlan({
        plan: f.plan,
        authorize: true,
        reason: "Credential compatibility correction before publication",
      }),
    )
    const report = await runWithHost(host, runRelease({ plan: next, authorize: true }))
    expect(report.operations[0]?.status).toBe("Satisfied")
    expect(report.revision).toBe(3)
    expect(f.sends).toHaveLength(1)
    expect(await runWithHost(host, runRelease({ plan: next, authorize: true }))).toEqual(report)
    expect(f.sends).toHaveLength(1)
    const history = await Effect.runPromise(f.store.read(next.journalId))
    expect(history.events.map((event) => [event.planId, event.body._tag])).toEqual([
      [f.plan.planId, "PlanSuperseded"],
      [next.planId, "DispatchStarted"],
      [next.planId, "ReceiptAccepted"],
    ])
    await expect(runWithHost(f.host, reportRelease({ plan: next }))).rejects.toThrow(
      "unknown scope",
    )
    await expect(runWithHost(host, runRelease({ plan: f.plan, authorize: true }))).rejects.toThrow(
      "not admitted",
    )
  })

  test(`${candidate}: supersession cannot hide any prior dispatch`, async () => {
    const f = await makeFixture(undefined, candidate)
    await runWithHost(f.host, runRelease({ plan: f.plan, authorize: true }))
    await runWithHost(
      f.host,
      supersedePlan({
        plan: f.plan,
        authorize: true,
        reason: "Not permission to replace published bytes",
      }),
    )
    const next = await Effect.runPromise(
      createPlan("different-bundle", [f.operation], f.plan.journalId),
    )
    const host = {
      ...f.host,
      journal: {
        journalId: f.plan.journalId,
        scopes: [{ _tag: "PublicationScope" as const, plan: next }],
        supersededPlans: [{ plan: f.plan, providers: f.host.providers }],
      },
    }
    const before = await Effect.runPromise(f.store.read(next.journalId))
    await expect(runWithHost(host, runRelease({ plan: next, authorize: true }))).rejects.toThrow(
      "superseded without any dispatch",
    )
    expect(await Effect.runPromise(f.store.read(next.journalId))).toEqual(before)
    expect(f.sends).toHaveLength(1)
  })
}
