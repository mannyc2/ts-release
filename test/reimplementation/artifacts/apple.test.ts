import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, mkdir, readdir, rm } from "node:fs/promises"
import { join } from "node:path"
import { Effect, Schema } from "effect"
import * as BunServices from "@effect/platform-bun/BunServices"
import {
  Host,
  ReleaseError,
  createPlan,
  type HostShape,
  type Plan,
  type PreparedRequest,
} from "../../../packages/ts-release/src/index.js"
import { openSqliteJournal } from "../../../packages/ts-release/src/Bun.js"
import {
  encodeBundle,
  finalize,
  loadBundle,
  type Content,
} from "../../../packages/ts-release/src/Bundle.js"
import {
  ApplePreparation,
  ApplePreparations,
  ReadyToPlan,
  createApplePreparations,
  loadApplePreparations,
  preparationProvider,
  preparationScopes,
  submitPrepared,
  finishPrepared,
  runPreparation,
  validateApplePublication,
  reportAppleContext,
} from "../../../packages/ts-release/src/Apple.js"
import { appleDoubles, makeSources, run } from "./apple-fixtures.js"
import { classifyEvidence } from "../../../packages/ts-release/src/apple/Provider.js"

const fixture = async (
  body: (root: string, sources: Awaited<ReturnType<typeof makeSources>>) => Promise<void>,
) => {
  const root = await mkdtemp("/tmp/ts-release-apple-")
  try {
    await mkdir(join(root, "work"))
    await body(root, await makeSources(root))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}
const boundaryError = () =>
  new ReleaseError({ code: "fixture-apple", message: "Apple protocol fixture failed" })

test("Apple recovery accepts a different lookup tool while preserving submission and source binding", () =>
  fixture(async (root, { owner, collection }) => {
    const input = collection.preparations[1]!
    const original = appleDoubles()
    const submitted = await run(
      submitPrepared(input, owner, join(root, "work")).pipe(Effect.provide(original.layer)),
    )
    // Real Notary.info records the current runner's tool, not the submitter's.
    const lookupProducer = {
      name: "xcrun",
      version: "71.0.0",
      path: "/different-runner/bin/xcrun",
      sha256: "f".repeat(64),
    }
    const resumed = appleDoubles(lookupProducer)
    const pending = await run(
      finishPrepared(input, submitted, "operation", owner, join(root, "work")).pipe(
        Effect.provide(resumed.layer),
      ),
    )
    if ("_tag" in pending) throw new Error("Expected a pending notarization")
    expect(pending.producedBy).toEqual(lookupProducer)
    expect(classifyEvidence(input, "operation", pending, [submitted])).toBe("Pending")
    for (const changed of [
      { ...pending, submissionId: randomUUID() },
      { ...pending, artifact: { ...pending.artifact, sha256: "e".repeat(64) } },
    ])
      expect(() => classifyEvidence(input, "operation", changed, [submitted])).toThrow(
        "no matching recorded submission",
      )
    resumed.status({ _tag: "Accepted", providerStatus: "Accepted" })
    const ready = await run(
      finishPrepared(input, submitted, "operation", owner, join(root, "work")).pipe(
        Effect.provide(resumed.layer),
      ),
    )
    expect(ready).toBeInstanceOf(ReadyToPlan)
    if (!(ready instanceof ReadyToPlan)) throw new Error("Expected completed preparation")
    expect(ready.assessed.ticket.producedBy).toEqual(lookupProducer)
    expect(classifyEvidence(input, "operation", ready, [submitted])).toBe("Satisfied")
    expect(original.calls.submit).toBe(1)
    expect(resumed.calls).toEqual({ submit: 0, info: 2, staple: 1, assess: 1 })
  }))

test(
  "Apple collection identity owns six exact native inputs and rejects changed roots or caller identities",
  () =>
    fixture(async (_root, { inputs, collection }) => {
      expect(collection.preparations).toHaveLength(6)
      expect(new Set(collection.preparations.map((input) => input.journalId))).toEqual(
        new Set([collection.journalId]),
      )
      expect(await run(loadApplePreparations(JSON.parse(JSON.stringify(collection))))).toEqual(
        collection,
      )
      expect(Object.isFrozen(collection.preparations[0]!.source)).toBe(true)
      const reordered = await run(
        createApplePreparations([inputs[5]!, ...inputs.slice(0, 5).reverse()]),
      )
      expect(reordered.journalId).not.toBe(collection.journalId)
      for (const value of [
        { ...collection, journalId: "foreign" },
        {
          ...collection,
          preparations: collection.preparations.map((input, index) =>
            index === 0 ? { ...input, principal: "changed" } : input,
          ),
        },
        { ...collection, preparations: collection.preparations.slice(1) },
        { ...collection, unknown: "no" },
      ])
        await expect(run(loadApplePreparations(value))).rejects.toBeInstanceOf(ReleaseError)
      for (const value of [
        [],
        [inputs[0], inputs[0]],
        [{ ...inputs[0], journalId: "authored" }],
        [inputs[0], { ...inputs[1], artifactName: inputs[0]!.artifactName.toUpperCase() }],
      ])
        await expect(run(createApplePreparations(value as never))).rejects.toBeInstanceOf(
          ReleaseError,
        )
    }),
  30_000,
)

test("readonly nested app directories are removed after submit and final adoption without losing the submission ID", async () => {
  const root = await mkdtemp("/tmp/ts-release-apple-readonly-")
  try {
    await mkdir(join(root, "work"))
    const { owner, collection } = await makeSources(root, true)
    const input = collection.preparations[0]!
    if (input._tag !== "AppPreparation") throw new Error("Expected app fixture")
    expect(input.source.entries.find((entry) => entry.path === "Contents")).toMatchObject({
      mode: 0o555,
    })
    const doubles = appleDoubles()
    const submitted = await run(
      submitPrepared(input, owner, join(root, "work")).pipe(Effect.provide(doubles.layer)),
    )
    expect(submitted.submissionId).toMatch(/^[0-9a-f-]{36}$/u)
    expect(await readdir(join(root, "work"))).toEqual([])
    doubles.status({ _tag: "Accepted", providerStatus: "Accepted" })
    const ready = await run(
      finishPrepared(input, submitted, "prepared-op", owner, join(root, "work")).pipe(
        Effect.provide(doubles.layer),
      ),
    )
    expect(ready).toBeInstanceOf(ReadyToPlan)
    expect(await readdir(join(root, "work"))).toEqual([])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)

test(
  "six Apple preparations restore owned sources, persist submission IDs, reopen one SQLite journal and select assessed output Bundles",
  () =>
    fixture(async (root, { owner, collection }) => {
      const scopes = await run(preparationScopes(collection))
      for (const name of await readdir(root))
        if (name.startsWith("source-")) await rm(join(root, name), { recursive: true })
      const ready: ReadyToPlan[] = [],
        counters: ReturnType<typeof appleDoubles>["calls"][] = []
      let prepared = 0
      const stage = async (
        accepted: boolean,
        publication?: { plan: Plan; finalBundleContent: Content },
      ) => {
        const doubles = appleDoubles()
        if (accepted) doubles.status({ _tag: "Accepted", providerStatus: "Accepted" })
        counters.push(doubles.calls)
        return await run(
          Effect.scoped(
            Effect.gen(function* () {
              const store = yield* openSqliteJournal(join(root, "journal.sqlite"))
              const send = (request: PreparedRequest) => {
                const input = Schema.decodeUnknownSync(ApplePreparation)(
                  JSON.parse(new TextDecoder().decode(request.body)),
                )
                return submitPrepared(input, owner, join(root, "work")).pipe(
                  Effect.provide(doubles.layer),
                  Effect.provide(BunServices.layer),
                  Effect.map((receipt) => ({ _tag: "Accepted" as const, receipt })),
                  Effect.mapError(boundaryError),
                )
              }
              const host: HostShape = {
                store,
                providers: [preparationProvider],
                now: Date.now,
                uniqueId: randomUUID,
                journal: {
                  journalId: collection.journalId,
                  scopes: [
                    ...scopes,
                    ...(publication
                      ? [{ _tag: "PublicationScope" as const, plan: publication.plan }]
                      : []),
                  ],
                },
                transport: {
                  send,
                  prepare: () =>
                    Effect.sync(() => {
                      prepared++
                      return send
                    }),
                },
              }
              for (const [index, scope] of scopes.entries()) {
                yield* runPreparation(
                  collection,
                  scope.plan.operations[0]!.operationId,
                  { authorize: true },
                  (submission, id) =>
                    finishPrepared(
                      collection.preparations[index]!,
                      submission,
                      id,
                      owner,
                      join(root, "work"),
                    ).pipe(
                      Effect.provide(doubles.layer),
                      Effect.provide(BunServices.layer),
                      Effect.tap((evidence) =>
                        Effect.sync(() => {
                          if (evidence instanceof ReadyToPlan) ready.push(evidence)
                        }),
                      ),
                      Effect.mapError(boundaryError),
                    ),
                ).pipe(Effect.provideService(Host, host))
              }
              if (publication)
                yield* validateApplePublication(
                  collection,
                  publication.plan,
                  publication.finalBundleContent,
                  owner,
                ).pipe(Effect.provideService(Host, host))
              return yield* reportAppleContext(collection, owner, publication).pipe(
                Effect.provideService(Host, host),
              )
            }),
          ),
        )
      }
      const pending = await stage(false)
      expect(ready).toHaveLength(0)
      expect(
        pending.preparations.every((report) => report.operations[0]!.status === "Pending"),
      ).toBe(true)
      const completed = await stage(true)
      expect(ready).toHaveLength(6)
      expect(
        completed.preparations.every((report) => report.operations[0]!.status === "Satisfied"),
      ).toBe(true)
      const outputs = await Promise.all(
        ready.map((item) =>
          run(
            owner
              .read(item.outputsBundleContent)
              .pipe(Effect.flatMap((bytes) => loadBundle(owner, bytes))),
          ),
        ),
      )
      const bundle = await run(finalize(outputs.flatMap((output) => output.artifacts)))
      const finalBundleContent = await run(owner.putOwned(encodeBundle(bundle)))
      const plan = await run(createPlan(finalBundleContent.sha256, [], collection.journalId))
      const reported = await stage(true, { plan, finalBundleContent })
      expect(reported.publication?.planId).toBe(plan.planId)
      expect(reported.preparations.every((report) => report.revision === reported.revision)).toBe(
        true,
      )
      expect(
        reported.nativeFacts.filter((event) => event.body._tag === "DispatchStarted"),
      ).toHaveLength(6)
      expect(
        reported.nativeFacts.filter((event) => event.body._tag === "ReceiptAccepted"),
      ).toHaveLength(6)
      expect(counters).toEqual([
        { submit: 6, info: 6, staple: 0, assess: 0 },
        { submit: 0, info: 6, staple: 6, assess: 6 },
        { submit: 0, info: 0, staple: 0, assess: 0 },
      ])
      expect(prepared).toBe(6)
      expect(await readdir(join(root, "work"))).toEqual([])
      for (const item of ready)
        expect(item.assessed.sha256).toBe(item.finalArtifact.identity.sha256)
    }),
  30_000,
)
