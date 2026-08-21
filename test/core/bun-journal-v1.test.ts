import { describe, expect, it } from "@effect/bun-test"
import * as Effect from "effect/Effect"
import * as Result from "effect/Result"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  defaultBunSqliteJournalPath,
  makeBunSqliteJournalLayer
} from "../../src/platform/bun-journal.js"
import {
  AuthorizationIdentity,
  DispatchId,
  DispatchStarted,
  EndpointIdentity,
  JournalRevisionMismatch,
  JournalStore,
  RequestFingerprint,
  TransportId
} from "../../src/release/journal.js"
import {
  OperationId,
  PlanId,
  ProviderDefinitionId
} from "../../src/release/release-plan.js"

const planId = PlanId.make("1".repeat(64))

const started = () => DispatchStarted.make({
  schemaVersion: 1,
  operationId: OperationId.make("2".repeat(64)),
  dispatchId: DispatchId.make("dispatch-fixture"),
  attempt: 1,
  providerDefinitionId: ProviderDefinitionId.make("npm.publish/v1"),
  transportId: TransportId.make("npm-cli/12.0.2"),
  endpointIdentity: EndpointIdentity.make("https://registry.example.test/"),
  requestFingerprint: RequestFingerprint.make("3".repeat(64)),
  authorizationIdentity: AuthorizationIdentity.make("fixture-account"),
  replayProtection: { scheme: "replay.none/1" },
  replayBasis: { reason: "npm publish has no automatic replay law" },
  startedAtEpochMillis: 1
})

describe("Bun SQLite JournalStore", () => {
  it.effect("persists one append-CAS winner and reopens the exact journal", () =>
    Effect.acquireUseRelease(
      Effect.sync(() => mkdtempSync(join(tmpdir(), "ts-release-journal-v1-"))),
      (directory) => Effect.gen(function*() {
        const path = defaultBunSqliteJournalPath(directory)
        expect(existsSync(join(directory, ".release"))).toBe(false)
        const race = Effect.gen(function*() {
          const store = yield* JournalStore
          return yield* Effect.all([
            store.appendIfRevision(planId, 0, started()).pipe(Effect.result),
            store.appendIfRevision(planId, 0, started()).pipe(Effect.result)
          ], { concurrency: "unbounded" })
        }).pipe(Effect.provide(makeBunSqliteJournalLayer(path)))

        const results = yield* race
        expect(existsSync(path)).toBe(true)
        expect(results.filter(Result.isSuccess)).toHaveLength(1)
        const loser = results.find(Result.isFailure)
        expect(loser !== undefined && loser.failure instanceof JournalRevisionMismatch).toBe(true)

        const journal = yield* Effect.gen(function*() {
          const store = yield* JournalStore
          return yield* store.read(planId)
        }).pipe(Effect.provide(makeBunSqliteJournalLayer(path)))
        expect(journal.revision).toBe(1)
        expect(journal.entries).toHaveLength(1)
        expect(journal.entries[0]?.event._tag).toBe("DispatchStarted")
      }),
      (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true }))
    ))
})
