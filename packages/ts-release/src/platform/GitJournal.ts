import { checkedText, nativeText as text } from "./GitProcess.js"
import * as Effect from "effect/Effect"
import type * as Scope from "effect/Scope"
import { createHash } from "node:crypto"
import { mkdirSync } from "node:fs"
import type { AppendResult, JournalStore } from "../Journal.js"
import type { JournalEvent } from "../internal/ReleaseModel.js"
import { type ReleaseError, attempt, fail } from "../internal/Error.js"
import { canonical } from "../internal/Identity.js"
import { conditionalArguments, pushWitness } from "../internal/GitAuthority.js"
import {
  admitCoordinate,
  objectFormat,
  type Credentials,
  type RefCoordinate,
} from "../internal/GitCatalog.js"
import { checked, resolveGitCredentials, openGitRuntime } from "./GitProcess.js"
import { fetchRef, remoteRef } from "./GitRemote.js"
import { EVENT_BYTES, encodeEvent, readEvent } from "./StoreCodec.js"

export interface GitJournalOptions {
  readonly cacheDirectory: string
  readonly remote: string
  readonly principal: string
  readonly scope: string
  readonly gitExecutable: string
  readonly timeoutMilliseconds: number
  readonly maximumOutputBytes: number
  /** The configured remote's object format, including when its ref is unborn. */
  readonly objectFormat?: "sha1" | "sha256"
  readonly credentials: (input: RefCoordinate) => Effect.Effect<Credentials, ReleaseError>
}
const invalid = (): never =>
  fail("git-journal", "Native Git history is not an exact bounded release journal")
export const journalRef = (journalId: string): string => {
  if (typeof journalId !== "string" || !journalId) invalid()
  return `refs/heads/ts-release-journal/${createHash("sha256").update("ts-release/git-journal/1\0").update(canonical(journalId)).digest("hex")}`
}
const identity = {
  identity: {
    GIT_AUTHOR_NAME: "ts-release journal",
    GIT_AUTHOR_EMAIL: "journal@ts-release.invalid",
    GIT_COMMITTER_NAME: "ts-release journal",
    GIT_COMMITTER_EMAIL: "journal@ts-release.invalid",
    GIT_AUTHOR_DATE: "@0 +0000",
    GIT_COMMITTER_DATE: "@0 +0000",
  },
}
export const openGitJournal = Effect.fn("ts-release.openGitJournal")(
  (input: GitJournalOptions): Effect.Effect<JournalStore, ReleaseError, Scope.Scope> =>
    Effect.gen(function* () {
      const options = yield* attempt(() => {
        const {
          remote,
          principal,
          scope,
          cacheDirectory,
          gitExecutable,
          timeoutMilliseconds,
          maximumOutputBytes,
          objectFormat: format = "sha1",
        } = input
        const coordinate = admitCoordinate({
          remote,
          principal,
          scope,
          ref: "refs/heads/ts-release-journal",
        })
        if (format !== "sha1" && format !== "sha256") invalid()
        const credentials = input.credentials.bind(input)
        mkdirSync(cacheDirectory, { recursive: true, mode: 0o700 })
        return {
          coordinate,
          format,
          credentials,
          gitExecutable,
          temporaryRoot: cacheDirectory,
          timeoutMilliseconds,
          maximumOutputBytes,
        }
      })
      const runtime = yield* openGitRuntime(options),
        limit = runtime.maximumOutputBytes
      const snapshot = Effect.fn("git.readJournalSnapshot")(function* (journalId: string) {
        const coordinate = yield* attempt(() =>
          admitCoordinate({ ...options.coordinate, ref: journalRef(journalId) }),
        )
        const env = yield* resolveGitCredentials(options.credentials, coordinate)
        const repository = yield* runtime.repository(options.format),
          run = repository.run
        const advertised = yield* remoteRef(run, coordinate, env)
        let head: string | null = null
        const events: JournalEvent[] = []
        if (advertised !== null) {
          if (objectFormat(advertised) !== options.format) return yield* attempt(invalid)
          head = yield* fetchRef(run, coordinate, env)
          const rows = (yield* checkedText(run, ["rev-list", "--reverse", "--parents", head, "--"]))
            .trim()
            .split("\n")
          let parent: string | undefined,
            total = 0
          const seen = new Set<string>()
          for (const row of rows) {
            const fields = row.split(" "),
              commit = fields[0]!
            if (
              objectFormat(commit) !== options.format ||
              fields.length !== (parent ? 2 : 1) ||
              (parent && fields[1] !== parent)
            )
              return yield* attempt(invalid)
            const tree = yield* checkedText(run, ["ls-tree", "-z", commit, "--"])
            if (
              !new RegExp(`^100644 blob [0-9a-f]{${commit.length}}\\tevent\\.json\\x00$`, "u").test(
                tree,
              )
            )
              return yield* attempt(invalid)
            const size = Number(
              (yield* checkedText(run, ["cat-file", "-s", `${commit}:event.json`])).trim(),
            )
            total += size
            if (!Number.isSafeInteger(size) || size < 0 || size > EVENT_BYTES || total > limit)
              return yield* attempt(invalid)
            const bytes = yield* checked(run, ["cat-file", "blob", `${commit}:event.json`])
            const event = yield* attempt(() => {
              if (bytes.length !== size) invalid()
              const value = readEvent(bytes)
              if (value.journalId !== journalId || seen.has(value.eventId)) invalid()
              return value
            })
            seen.add(event.eventId)
            events.push(event)
            parent = commit
          }
          if (parent !== head) return yield* attempt(invalid)
        }
        return { coordinate, env, run, head, events, revision: events.length }
      })
      const read: JournalStore["read"] = Effect.fn("git.readJournal")(function* (journalId) {
        const { revision, events } = yield* snapshot(journalId)
        return { revision, events }
      })
      const append: JournalStore["append"] = Effect.fn("git.appendJournal")(
        function* (journalId, expectedRevision, input) {
          const bytes = yield* attempt(() => {
            if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) invalid()
            return encodeEvent(input, journalId)
          })
          const event = yield* attempt(() => readEvent(bytes)),
            current = yield* snapshot(journalId)
          const existing = current.events.findIndex((known) => known.eventId === event.eventId)
          if (existing >= 0) {
            if (canonical(current.events[existing]) !== canonical(event))
              return yield* attempt(() => fail("event-id-conflict", "Event ID has different facts"))
            return { _tag: "AlreadyRecorded", revision: existing + 1 }
          }
          if (current.revision !== expectedRevision)
            return { _tag: "RevisionMismatch", revision: current.revision }
          if (
            current.events.reduce(
              (sum, known) => sum + encodeEvent(known, journalId).length,
              bytes.length,
            ) > limit
          )
            return yield* attempt(invalid)
          const { run, coordinate, env, head } = current
          const blob = (yield* checkedText(
            run,
            ["hash-object", "-t", "blob", "-w", "--stdin"],
            bytes,
          )).trim()
          const tree = (yield* checkedText(
            run,
            ["mktree"],
            Buffer.from(`100644 blob ${blob}\tevent.json\n`),
          )).trim()
          const commit = (yield* checkedText(
            run,
            ["commit-tree", tree, ...(head ? ["-p", head] : [])],
            Buffer.from("ts-release journal event\n"),
            identity,
          )).trim()
          const old = head ?? "0".repeat(options.format === "sha1" ? 40 : 64)
          return yield* Effect.gen(function* (): Effect.fn.Return<AppendResult, ReleaseError> {
            const result = yield* run(
              conditionalArguments(coordinate.remote, coordinate.ref, old, commit),
              undefined,
              env,
            )
            const witness = yield* attempt(() =>
              pushWitness(
                { exitCode: result.exitCode, stdout: text(result.stdout) },
                coordinate.ref,
                old,
                commit,
              ),
            )
            if (witness === undefined) return { _tag: "AmbiguousStorageOutcome" }
            return {
              _tag: witness.startsWith("=\t") ? "AlreadyRecorded" : "Appended",
              revision: expectedRevision + 1,
            }
          }).pipe(Effect.catch(() => Effect.succeed({ _tag: "AmbiguousStorageOutcome" as const })))
        },
      )
      return Object.freeze({ read, append })
    }),
)
