import { expect, test } from "bun:test"
import { Effect, Layer, Schema } from "effect"
import { File, finalize, encodeBundle } from "../../../packages/ts-release/src/Bundle.js"
import { Content } from "../../../packages/ts-release/src/internal/ArtifactModel.js"
import {
  FinalizedReport,
  reportFinalizedRelease,
} from "../../../packages/ts-release/src/internal/FinalizedReport.js"
import { sha256 } from "../../../packages/ts-release/src/internal/Identity.js"
import {
  Host,
  createOperation,
  createPlan,
  runRelease,
} from "../../../packages/ts-release/src/index.js"
import { MemoryJournal, providerFor } from "./fixtures.js"

test("acceptance.K01 local projection resolves multi-provider facts to one Bundle/Plan/Journal", async () => {
  const bytes = new TextEncoder().encode("report fixture bytes")
  const content = new Content({
    bytes: String(bytes.byteLength),
    sha256: await Effect.runPromise(sha256(bytes)),
  })
  const file = Schema.decodeUnknownSync(File)({
    _tag: "OwnedFile",
    logicalName: "fixture.txt",
    content,
    deliveryMode: 0o644,
    executable: null,
    provenance: { _tag: "IntrinsicProvenance", producer: "report-fixture/source-bytes" },
  })
  const bundle = await Effect.runPromise(finalize([file]))
  const providers = [
    providerFor(undefined, "fixture/one"),
    providerFor(() => ({ status: "Absent", evidence: { visible: false } }), "fixture/two"),
  ]
  const operations = await Promise.all(
    providers.map((provider, index) =>
      Effect.runPromise(
        createOperation(provider, {
          coordinate: `package-${index}`,
          endpoint: "https://fixture.invalid",
          content: new TextDecoder().decode(bytes),
        }),
      ),
    ),
  )
  const plan = await Effect.runPromise(
    createPlan(await Effect.runPromise(sha256(encodeBundle(bundle))), operations),
  )
  const store = new MemoryJournal()
  const host = {
    store,
    providers,
    now: () => 1,
    uniqueId: () => crypto.randomUUID(),
    transport: {
      send: (request: import("../../../packages/ts-release/src/index.js").PreparedRequest) =>
        Effect.succeed({
          _tag: "Accepted" as const,
          receipt: {
            status: 201,
            endpoint: request.facts.endpoint,
            bodyDigest: request.facts.bodyDigest,
          },
        }),
    },
  }
  const run = <A, E>(effect: Effect.Effect<A, E, Host>) =>
    Effect.runPromise(effect.pipe(Effect.provide(Layer.succeed(Host, host))))
  const falseHost = {
    ...host,
    machine: () => ({
      append: (): never => {
        throw new Error("Unused evaluator append")
      },
      next: () => ({ _tag: "Finish" as const, status: "Satisfied" as const }),
      report: () => ({
        planId: plan.planId,
        revision: 0,
        superseded: true,
        operations: [
          {
            operationId: "nonexistent",
            status: "Satisfied" as const,
            dispatches: 99,
            receipts: 99,
            observations: 99,
          },
        ],
      }),
    }),
  }
  const independentlyDerived = await Effect.runPromise(
    reportFinalizedRelease(bundle, plan).pipe(Effect.provide(Layer.succeed(Host, falseHost))),
  )
  expect(independentlyDerived.superseded).toBe(false)
  expect(independentlyDerived.operations.map((operation) => operation.status)).toEqual([
    "Unattempted",
    "Unattempted",
  ])
  expect(independentlyDerived.operations.every((operation) => operation.receipts === 0)).toBe(true)
  expect(independentlyDerived.plan.operations.map((operation) => operation.operationId)).toEqual(
    independentlyDerived.operations.map((operation) => operation.operationId),
  )
  await run(runRelease({ plan, authorize: true }))
  const report = await run(reportFinalizedRelease(bundle, plan))
  const encoded = Schema.encodeSync(FinalizedReport)(report)
  expect(
    Schema.decodeUnknownSync(FinalizedReport, { onExcessProperty: "error" })(
      JSON.parse(JSON.stringify(encoded)),
    ),
  ).toEqual(report)
  expect(report.bundle).toEqual(bundle)
  expect(report.plan).toEqual(plan)
  expect(report.journal).toEqual({
    journalId: plan.journalId,
    ...(await Effect.runPromise(store.read(plan.journalId))),
  })
  expect(report.operations.map((operation) => operation.status)).toEqual(["Satisfied", "Satisfied"])
  for (const operation of report.operations) {
    const canonical = report.plan.operations.find(
      (item) => item.operationId === operation.operationId,
    )!
    expect(providers.map((provider) => provider.definitionId)).toContain(canonical.definitionId)
    expect(operation.receipts).toBe(1)
  }
  expect(
    report.journal.events.filter((event) => event.body._tag === "ObservationRecorded"),
  ).toHaveLength(1)
  expect(Object.isFrozen(report.journal.events)).toBe(true)
  const other = await Effect.runPromise(finalize([]))
  await expect(run(reportFinalizedRelease(other, plan))).rejects.toThrow("differs")
})
