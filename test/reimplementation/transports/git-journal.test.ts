import { expect, test } from "bun:test"
import { Effect } from "effect"
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { JournalEvent, PlanSuperseded, runRelease } from "../../../packages/ts-release/src/index.js"
import { openGitJournal, type GitJournalOptions } from "../../../packages/ts-release/src/Node.js"
import { journalRef } from "../../../packages/ts-release/src/platform/GitJournal.js"
import { canonical } from "../../../packages/ts-release/src/internal/Identity.js"
import { openGitRuntime } from "../../../packages/ts-release/src/platform/GitProcess.js"
import { makeFixture, runWithHost } from "../kernel/fixtures.js"
import { native, nativeGit, processOptions } from "./git-fixture.js"

const event = (eventId: string, journalId = "shared release", reason = "superseded") =>
  new JournalEvent({
    format: "ts-release/event/1",
    eventId,
    journalId,
    planId: "preparation-or-publication",
    body: new PlanSuperseded({ reason }),
  })
const optionsFor = (
  directory: string,
  cacheDirectory: string,
  format: "sha1" | "sha256" = "sha1",
): GitJournalOptions => ({
  ...processOptions,
  cacheDirectory,
  remote: pathToFileURL(directory).href,
  principal: "journal-writer",
  scope: "release-history",
  objectFormat: format,
  credentials: () => Effect.succeed({ _tag: "Anonymous" }),
})

for (const format of ["sha1", "sha256"] as const)
  test(`native ${format} journal owns one global order across independent caches and scopes`, async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const runtime = yield* openGitRuntime(processOptions),
            remote = yield* runtime.repository(format),
            first = yield* openGitJournal(optionsFor(remote.directory, tmpdir(), format)),
            second = yield* openGitJournal(optionsFor(remote.directory, tmpdir(), format)),
            id = "shared release",
            a = event("a"),
            b = new JournalEvent({ ...event("b"), planId: "different-preparation-plan" })
          expect(yield* first.read(id)).toEqual({ revision: 0, events: [] })
          expect(yield* first.append(id, 0, a)).toEqual({ _tag: "Appended", revision: 1 })
          expect(yield* second.read(id)).toEqual({ revision: 1, events: [a] })
          expect(yield* second.append(id, 0, b)).toEqual({ _tag: "RevisionMismatch", revision: 1 })
          expect(yield* second.append(id, 99, a)).toEqual({ _tag: "AlreadyRecorded", revision: 1 })
          expect(yield* second.append(id, 1, b)).toEqual({ _tag: "Appended", revision: 2 })
          expect(yield* first.read(id)).toEqual({ revision: 2, events: [a, b] })
          expect(yield* first.read("independent release")).toEqual({ revision: 0, events: [] })
          expect(
            yield* Effect.isFailure(first.append(id, 2, event("a", id, "changed facts"))),
          ).toBe(true)
          expect(yield* Effect.isFailure(first.append(id, -1, event("c")))).toBe(true)
          expect(yield* Effect.isFailure(first.append("wrong release", 2, event("c")))).toBe(true)
          expect(
            native(remote.directory, ["rev-list", "--count", journalRef(id)])
              .toString()
              .trim(),
          ).toBe("2")
          expect(
            JSON.parse(
              native(remote.directory, ["show", `${journalRef(id)}:event.json`]).toString(),
            ),
          ).toEqual(JSON.parse(canonical(b)))
        }),
      ),
    )
  }, 30000)

test("native journal admits an exact 1MiB event, rejects +1 and detects foreign trees, duplicate IDs and merge history", async () => {
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const runtime = yield* openGitRuntime(processOptions),
          remote = yield* runtime.repository("sha1"),
          store = yield* openGitJournal(optionsFor(remote.directory, tmpdir())),
          id = "shared release",
          ref = journalRef(id)
        const overhead = Buffer.byteLength(canonical(event("a", id, ""))),
          exact = event("a", id, "a".repeat(1048576 - overhead))
        expect(yield* store.append(id, 0, exact)).toEqual({ _tag: "Appended", revision: 1 })
        expect((yield* store.read(id)).events).toEqual([exact])
        expect(
          yield* Effect.isFailure(
            store.append(id, 1, event("b", id, "a".repeat(1048577 - overhead))),
          ),
        ).toBe(true)
        const old = native(remote.directory, ["rev-parse", ref]).toString().trim(),
          originalTree = native(remote.directory, ["rev-parse", `${ref}^{tree}`])
            .toString()
            .trim()
        const commit = (tree: string, parents: string[]) =>
          native(
            remote.directory,
            ["commit-tree", tree, ...parents.flatMap((parent) => ["-p", parent])],
            Buffer.from("Foreign\n"),
          )
            .toString()
            .trim()
        const duplicate = commit(originalTree, [old])
        native(remote.directory, ["update-ref", ref, duplicate])
        expect(yield* Effect.isFailure(store.read(id))).toBe(true)
        const other = commit(originalTree, [])
        native(remote.directory, ["update-ref", ref, commit(originalTree, [old, other])])
        expect(yield* Effect.isFailure(store.read(id))).toBe(true)
        const blob = native(
            remote.directory,
            ["hash-object", "-w", "--stdin"],
            Buffer.from(canonical(event("b"))),
          )
            .toString()
            .trim(),
          badTree = native(
            remote.directory,
            ["mktree"],
            Buffer.from(`100644 blob ${blob}\tevent.json\n100644 blob ${blob}\textra.json\n`),
          )
            .toString()
            .trim()
        native(remote.directory, ["update-ref", ref, commit(badTree, [old])])
        expect(yield* Effect.isFailure(store.read(id))).toBe(true)
        native(remote.directory, ["update-ref", ref, old])
        expect((yield* store.read(id)).events).toEqual([exact])
      }),
    ),
  )
}, 30000)

// A disposable executable schedules actual Git pushes at the process boundary.
// It never replaces the journal or fabricates Git stdout.
const wrapper = (root: string, mode: "first" | "second" | "lost") => {
  const path = join(root, `git-${mode}`),
    bun = realpathSync(Bun.which("bun")!)
  writeFileSync(
    path,
    `#!${bun}\nimport { existsSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2), root = ${JSON.stringify(root)}, mode = ${JSON.stringify(mode)};
if (args[0] === 'push' && mode !== 'lost') {
  writeFileSync(root + '/' + mode + '-ready', 'ready');
  const target = root + (mode === 'first' ? '/second-ready' : '/first-done');
  const deadline = Date.now() + 4000;
  while (!existsSync(target)) { if (Date.now() > deadline) process.exit(89); await Bun.sleep(5); }
}
const result = Bun.spawnSync([${JSON.stringify(nativeGit)}, ...args], { stdin: args[0] === 'push' ? 'ignore' : await Bun.stdin.arrayBuffer(), stdout: 'pipe', stderr: 'pipe', env: process.env });
if (args[0] === 'push') {
  writeFileSync(root + '/' + mode + '-stdout', result.stdout);
  if (mode === 'first') writeFileSync(root + '/first-done', 'done');
  if (mode === 'lost') process.exit(1);
}
process.stdout.write(result.stdout); process.stderr.write(result.stderr); process.exit(result.exitCode);
`,
    { mode: 0o700 },
  )
  return path
}

test("equal native pushes produce one Appended and one AlreadyRecorded, never two fresh CAS winners", async () => {
  const root = mkdtempSync(join(tmpdir(), "git-cas-witness-"))
  try {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const runtime = yield* openGitRuntime(processOptions),
            remote = yield* runtime.repository("sha1")
          const first = yield* openGitJournal({
              ...optionsFor(remote.directory, root),
              gitExecutable: wrapper(root, "first"),
              timeoutMilliseconds: 8000,
            }),
            second = yield* openGitJournal({
              ...optionsFor(remote.directory, root),
              gitExecutable: wrapper(root, "second"),
              timeoutMilliseconds: 8000,
            })
          const results = yield* Effect.all(
            [
              first.append("shared release", 0, event("same")),
              second.append("shared release", 0, event("same")),
            ],
            { concurrency: 2 },
          )
          expect(results).toEqual([
            { _tag: "Appended", revision: 1 },
            { _tag: "AlreadyRecorded", revision: 1 },
          ])
          expect(readFileSync(join(root, "second-stdout"), "utf8")).toMatch(/^=\t/m)
          expect((yield* first.read("shared release")).events).toEqual([event("same")])
        }),
      ),
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}, 30000)

test("lost native journal push responses allow same-live exact readback once and no write retry on restart", async () => {
  const root = mkdtempSync(join(tmpdir(), "git-lost-witness-")),
    fixture = await makeFixture()
  try {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const runtime = yield* openGitRuntime(processOptions),
            remote = yield* runtime.repository("sha1")
          const store = yield* openGitJournal({
            ...optionsFor(remote.directory, root),
            gitExecutable: wrapper(root, "lost"),
          })
          const host = { ...fixture.host, store }
          const report = yield* Effect.promise(() =>
            runWithHost(host, runRelease({ plan: fixture.plan, authorize: true })),
          )
          expect(report.operations[0]?.status).toBe("Satisfied")
          expect(fixture.sends).toHaveLength(1)
          const restart = yield* openGitJournal(optionsFor(remote.directory, root))
          const history = yield* restart.read(fixture.plan.journalId)
          expect(history.events.map((event) => event.body._tag)).toEqual([
            "DispatchStarted",
            "ReceiptAccepted",
          ])
          expect(yield* restart.append(fixture.plan.journalId, 0, history.events[0]!)).toEqual({
            _tag: "AlreadyRecorded",
            revision: 1,
          })
          yield* Effect.promise(() =>
            runWithHost(
              { ...host, store: restart },
              runRelease({ plan: fixture.plan, authorize: true }),
            ),
          )
          expect(fixture.sends).toHaveLength(1)
        }),
      ),
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}, 30000)
