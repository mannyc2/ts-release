import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { Effect, Schema } from "effect"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Artifact from "effect-build/Artifact"
import * as Notary from "effect-build-apple/Notary"
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
  type Artifact as OwnedArtifact,
} from "../../../packages/ts-release/src/Bundle.js"
import {
  ApplePreparation,
  ReadyToPlan,
  createApplePreparations,
  preparationProvider,
  preparationScopes,
  submitPrepared,
  finishPrepared,
  runPreparation,
  validateApplePublication,
  reportAppleContext,
} from "../../../packages/ts-release/src/Apple.js"
import { appleDoubles, makeSources, run } from "./apple-fixtures.js"
import { MemoryJournal } from "../kernel/fixtures.js"

const error = () =>
  new ReleaseError({ code: "apple-fixture", message: "Apple protocol fixture failed" })
test("Apple captures dispatch capabilities before asynchronous input admission", async () => {
  const root = await mkdtemp("/tmp/ts-release-apple-capture-")
  try {
    const { inputs } = await makeSources(root)
    const collection = await run(createApplePreparations([inputs[1]!]))
    const scopes = await run(preparationScopes(collection))
    const calls = { original: 0, replacement: 0 }
    const host = {
      store: new MemoryJournal(),
      transport: {
        send: () =>
          Effect.sync(() => {
            calls.original++
            return { _tag: "Unknown" as const, reason: "Original protocol transport" }
          }),
      },
      providers: [preparationProvider],
      now: Date.now,
      uniqueId: randomUUID,
      journal: { journalId: collection.journalId, scopes },
    }
    const running = run(
      runPreparation(
        collection,
        scopes[0]!.plan.operations[0]!.operationId,
        { authorize: true },
        () => Effect.fail(error()),
      ).pipe(Effect.provideService(Host, host)),
    )
    host.transport.send = () =>
      Effect.sync(() => {
        calls.replacement++
        return { _tag: "Unknown" as const, reason: "Replacement protocol transport" }
      })
    await running
    expect(calls).toEqual({ original: 1, replacement: 0 })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)
test("a lost Apple submit response stays Inconclusive across SQLite reopen without guessing or resubmitting", async () => {
  const root = await mkdtemp("/tmp/ts-release-apple-response-")
  try {
    await mkdir(join(root, "work"))
    const { owner, inputs } = await makeSources(root)
    const collection = await run(createApplePreparations([inputs[1]!]))
    const input = collection.preparations[0]!,
      scopes = await run(preparationScopes(collection))
    const id = scopes[0]!.plan.operations[0]!.operationId
    const doubles = appleDoubles()
    let completions = 0,
      acquired = 0
    for (let restart = 0; restart < 2; restart++) {
      const report = await run(
        Effect.scoped(
          Effect.gen(function* () {
            const store = yield* openSqliteJournal(join(root, "journal.sqlite"))
            const send = () =>
              submitPrepared(input, owner, join(root, "work")).pipe(
                Effect.provide(doubles.layer),
                Effect.provide(BunServices.layer),
                Effect.map((receipt) => ({
                  _tag: "Unknown" as const,
                  reason: "Protocol fixture discarded the submit response",
                  nativeError: Schema.encodeSync(Notary.SubmissionOutcomeUnknown)(
                    new Notary.SubmissionOutcomeUnknown({
                      artifactDigest: receipt.artifactDigest.value,
                      reason: "Response lost before receipt persistence",
                    }),
                  ),
                })),
                Effect.mapError(error),
              )
            const host: HostShape = {
              store,
              transport: {
                send,
                prepare: () =>
                  Effect.sync(() => {
                    acquired++
                    return send
                  }),
              },
              providers: [preparationProvider],
              now: Date.now,
              uniqueId: randomUUID,
              journal: { journalId: collection.journalId, scopes },
            }
            yield* runPreparation(collection, id, { authorize: true }, () => {
              completions++
              return Effect.fail(error())
            }).pipe(Effect.provideService(Host, host))
            return yield* reportAppleContext(collection, owner).pipe(
              Effect.provideService(Host, host),
            )
          }),
        ),
      )
      expect(report.preparations[0]!.operations[0]!.status).toBe("Inconclusive")
      expect(
        report.nativeFacts.filter((event) => event.body._tag === "DispatchStarted"),
      ).toHaveLength(1)
      expect(
        report.nativeFacts.filter((event) => event.body._tag === "ReceiptAccepted"),
      ).toHaveLength(0)
    }
    expect(doubles.calls.submit).toBe(1)
    expect(completions).toBe(0)
    // Request preparation can recur; it never supplies dispatch permission.
    expect(acquired).toBe(2)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)

test("publication requires every selected Apple output and accepts additional exact non-Apple files", async () => {
  const root = await mkdtemp("/tmp/ts-release-apple-outputs-")
  try {
    await mkdir(join(root, "work"))
    const { owner, inputs } = await makeSources(root)
    const collection = await run(createApplePreparations([inputs[0]!, inputs[1]!]))
    const scopes = await run(preparationScopes(collection)),
      doubles = appleDoubles(),
      store = new MemoryJournal()
    doubles.status(new Notary.Accepted({ providerStatus: "Accepted" }))
    const send = (request: PreparedRequest) =>
      submitPrepared(
        Schema.decodeUnknownSync(ApplePreparation)(
          JSON.parse(new TextDecoder().decode(request.body)),
        ),
        owner,
        join(root, "work"),
      ).pipe(
        Effect.provide(doubles.layer),
        Effect.provide(BunServices.layer),
        Effect.map((receipt) => ({ _tag: "Accepted" as const, receipt })),
        Effect.mapError(error),
      )
    const host: HostShape = {
      store,
      transport: { send },
      providers: [preparationProvider],
      now: Date.now,
      uniqueId: randomUUID,
      journal: { journalId: collection.journalId, scopes },
    }
    const ready: ReadyToPlan[] = []
    for (const [index, scope] of scopes.entries())
      await run(
        runPreparation(
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
              Effect.tap((value) =>
                Effect.sync(() => {
                  if (value instanceof ReadyToPlan) ready.push(value)
                }),
              ),
              Effect.mapError(error),
            ),
        ).pipe(Effect.provideService(Host, host)),
      )
    const outputs = (
      await Promise.all(
        ready.map((item) =>
          run(
            owner
              .read(item.outputsBundleContent)
              .pipe(Effect.flatMap((bytes) => loadBundle(owner, bytes))),
          ),
        ),
      )
    ).flatMap((bundle) => bundle.artifacts)
    const extra = await run(
      finalize([{ ...outputs[1]!, logicalName: Artifact.portableRelativePath("other-file.txt") }]),
    )
    const publication = async (artifacts: readonly OwnedArtifact[]) => {
      const bundle = await run(finalize(artifacts)),
        content = await run(owner.putOwned(encodeBundle(bundle))),
        plan = await run(createPlan(content.sha256, [], collection.journalId))
      const withPlan = (selected: Plan): HostShape => ({
        ...host,
        journal: {
          journalId: collection.journalId,
          scopes: [...scopes, { _tag: "PublicationScope", plan: selected }],
        },
      })
      return { plan, content, host: withPlan(plan), withPlan }
    }
    const full = await publication([...outputs, ...extra.artifacts])
    expect(
      await run(
        validateApplePublication(collection, full.plan, full.content, owner).pipe(
          Effect.provideService(Host, full.host),
        ),
      ),
    ).toHaveLength(2)
    for (const artifacts of [outputs.slice(1), [outputs[0]!, ...extra.artifacts]]) {
      const incomplete = await publication(artifacts)
      await expect(
        run(
          validateApplePublication(collection, incomplete.plan, incomplete.content, owner).pipe(
            Effect.provideService(Host, incomplete.host),
          ),
        ),
      ).rejects.toMatchObject({ code: "prepared-output-binding" })
    }
    const foreign = await run(createPlan(full.content.sha256, [], "other-journal"))
    await expect(
      run(
        validateApplePublication(collection, foreign, full.content, owner).pipe(
          Effect.provideService(Host, full.withPlan(foreign)),
        ),
      ),
    ).rejects.toMatchObject({ code: "final-bundle-binding" })
    await expect(
      run(
        validateApplePublication(
          collection,
          full.plan,
          { ...full.content, bytes: "0" },
          owner,
        ).pipe(Effect.provideService(Host, full.host)),
      ),
    ).rejects.toThrow()
    const missingScope: HostShape = {
      ...full.host,
      journal: {
        journalId: collection.journalId,
        scopes: [{ _tag: "PublicationScope", plan: full.plan }],
      },
    }
    await expect(
      run(
        validateApplePublication(collection, full.plan, full.content, owner).pipe(
          Effect.provideService(Host, missingScope),
        ),
      ),
    ).rejects.toMatchObject({ code: "preparation-set" })
    expect(doubles.calls).toEqual({ submit: 2, info: 0, staple: 2, assess: 2 })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)
