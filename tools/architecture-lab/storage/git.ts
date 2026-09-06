import { execFileSync } from "node:child_process"
import { mkdirSync } from "node:fs"
import { type AppendResult, type JournalStore, type Snapshot, type JournalEvent } from "../machine/src/contracts.js"
import { EVENT_BYTES, attempt, body, encoder, fail, readEvent } from "./protocol.js"

const gitEnvironment = {
  ...process.env, GIT_AUTHOR_NAME: "Architecture research", GIT_AUTHOR_EMAIL: "research@example.invalid",
  GIT_COMMITTER_NAME: "Architecture research", GIT_COMMITTER_EMAIL: "research@example.invalid",
  GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0"
}
export class GitJournal implements JournalStore {
  constructor(readonly directory: string, readonly remote: string, readonly limit = EVENT_BYTES) {
    mkdirSync(directory, { recursive: true })
    this.git(["init", "--bare", "--quiet", "."])
  }
  git(args: ReadonlyArray<string>, input?: string | Uint8Array, maxBuffer = 16 * 1024 * 1024): string {
    return execFileSync("git", [...args], {
      cwd: this.directory, env: gitEnvironment, encoding: "utf8", maxBuffer,
      ...(input === undefined ? {} : { input }), stdio: ["pipe", "pipe", "pipe"]
    }).trimEnd()
  }
  ref(journalId: string) {
    // Names are encoded; no unchecked option/ref syntax reaches git.
    return `refs/heads/ts-release-journal/${Buffer.from(journalId).toString("hex")}`
  }
  head(journalId: string): string {
    return this.git(["ls-remote", "--refs", this.remote, this.ref(journalId)]).split(/\s/)[0] ?? ""
  }
  snapshot(journalId: string): Snapshot & { readonly head: string } {
    const head = this.head(journalId)
    if (!head) return { head: "", revision: 0, events: [] }
    this.git(["fetch", "--quiet", "--no-tags", this.remote, head])
    const commits = this.git(["rev-list", "--reverse", "--first-parent", head]).split("\n")
    const events = commits.map((commit) => {
      const size = Number(this.git(["cat-file", "-s", `${commit}:event.json`]))
      if (!Number.isSafeInteger(size) || size > this.limit) fail("event-too-large", "Reject oversized Git blob before reading")
      const event = readEvent(encoder.encode(this.git(["show", `${commit}:event.json`], undefined, this.limit)), this.limit)
      if (event.journalId !== journalId) fail("journal-mismatch", "Stored Git event belongs to another journal")
      return event
    })
    return { head, revision: events.length, events }
  }
  read = (journalId: string) => attempt("GitJournal.read", (): Snapshot => {
    const { revision, events } = this.snapshot(journalId)
    return { revision, events }
  })
  append = (journalId: string, expectedRevision: number, event: JournalEvent) => attempt("GitJournal.append", (): AppendResult => {
    const encoded = body(event, journalId, this.limit)
    const snapshot = this.snapshot(journalId)
    const index = snapshot.events.findIndex((known) => known.eventId === event.eventId)
    if (index !== -1) {
      if (body(snapshot.events[index]!, journalId, this.limit) !== encoded) fail("event-id-conflict", "Event ID has different facts")
      return { _tag: "AlreadyRecorded", revision: index + 1 }
    }
    if (snapshot.revision !== expectedRevision) return { _tag: "RevisionMismatch", revision: snapshot.revision }
    const blob = this.git(["hash-object", "-w", "--stdin"], encoded)
    const tree = this.git(["mktree"], `100644 blob ${blob}\tevent.json\n`)
    const commit = this.git(["commit-tree", tree, ...(snapshot.head ? ["-p", snapshot.head] : [])], `${event.eventId}\n`)
    try {
      const output = this.git(["push", "--porcelain", `--force-with-lease=${this.ref(journalId)}:${snapshot.head}`, this.remote,
        `${commit}:${this.ref(journalId)}`])
      // Git reports an identical target as '=' even with a stale expectation.
      // It is not a new CAS win and can never become a dispatch permission.
      if (output.split("\n").some((line) => line.startsWith("=\t"))) return { _tag: "AlreadyRecorded", revision: expectedRevision + 1 }
      if (this.head(journalId) !== commit) return { _tag: "AmbiguousStorageOutcome" }
      return { _tag: "Appended", revision: expectedRevision + 1 }
    } catch {
      // A failed or missing response cannot distinguish rejection from commit.
      // The interpreter must read history; this method grants no new winner.
      return { _tag: "AmbiguousStorageOutcome" }
    }
  })
}
