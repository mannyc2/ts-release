# Journal backend and compare-and-swap research

Status: decision-grade response to research question R1. This note selects the
minimum storage law and v1 backend set. It does not implement the production
journal API.

## Required law

The provider and replay model needs one storage operation before any external
send:

```text
appendIfRevision(
  journalRoot,
  expectedRevision,
  completeEvent
) -> Appended(newRevision) | RevisionMismatch(actualRevision)
```

The law is:

1. at most one writer can advance one journal revision;
2. the complete event becomes visible atomically, never as a partial record;
3. a successful append is durable before it returns;
4. a read after success observes the new head;
5. a runner may send only after receiving `Appended`; and
6. stale, busy, precondition-failed, and ambiguous storage outcomes never count
   as success.

This is a genuine substitutability law. A `JournalStore` Layer is justified if
more than one backend is needed. It is not a provider registry or a release
mode.

## Candidate comparison

| Candidate | Exact CAS primitive | Two-machine continuation | Result |
| --- | --- | --- | --- |
| local filesystem generation store | prewrite and sync a complete candidate, then atomically hard-link it to the unique next-generation path; existing destination loses | only when both runners have the same supported durable filesystem; generic network filesystems are excluded | bless for local use |
| SQLite | `BEGIN IMMEDIATE`; conditional `UPDATE ... WHERE revision = expected`; insert event; commit | only through a safe local/block volume; SQLite explicitly warns against network filesystems | valid local alternative, not needed in v1 |
| conditional object store | upload immutable event segment, then replace the small head object with `If-Match` on the observed ETag | yes, through the shared bucket/prefix | bless AWS S3 for CI/cross-machine use |
| CI artifacts plus external state | artifact upload is immutable storage; the external state's conditional write is the actual CAS | yes only because of the external state | not a journal backend by itself |

## 1. Local filesystem

### Primitive

`open(path, O_CREAT | O_EXCL)` creates a path only when it does not already
exist and fails with `EEXIST` otherwise. That is enough for exclusive creation,
but directly opening the authoritative event path exposes a crash window in
which the path exists before the event is complete.

The stronger local protocol is:

1. write the complete event to a unique candidate file on the same filesystem;
2. synchronize the candidate;
3. call `link(candidate, events/<next-revision>.json)`;
4. treat success as the CAS winner and `EEXIST` as revision mismatch;
5. synchronize the events directory before reporting `Appended`; and
6. remove the candidate name.

`link` creates the new directory entry atomically and does not overwrite an
existing destination. The resulting generation path names an already-complete
inode.

### Filesystem boundary

This backend is supported only on a documented local filesystem with working
link, synchronization, and crash-recovery semantics. Linux documents that
`O_EXCL` locking on NFS depends on NFSv3 or later and sufficiently new kernels;
without that support it races. Linux also warns that an NFS server can perform
a hard-link operation and fail before returning the result, requiring a later
`stat` check.

Therefore the v1 local backend does not claim generic NFS, SMB, network home
directories, or CI artifact mounts. A user can supply another `JournalStore`
Layer only after establishing the same law.

### Fresh runner, retention, and takeover

A fresh local runner receives the journal directory as its resume locator. The
plan stored under that root binds the immutable bundle identity. Co-location is
the default layout; no second root manifest is introduced.

Retention is user-managed. Cleanup is permitted only after terminal state and
the configured recovery horizon. A lease is not required for safety: the CAS
selects one dispatch start, and any later continuation remains governed by the
recorded replay protection. A lease may improve diagnostics or operator
coordination but cannot turn observed absence into a fence.

Sources:

- https://www.man7.org/linux/man-pages/man2/open.2.html
- https://man7.org/linux/man-pages/man2/link.2.html
- https://www.man7.org/linux/man-pages/man3/fsync.3p.html

## 2. SQLite

### Primitive

The transaction is:

```sql
BEGIN IMMEDIATE;
UPDATE journal_head
SET revision = :next
WHERE revision = :expected;

-- only when exactly one row changed
INSERT INTO journal_events(revision, event_bytes)
VALUES (:next, :event_bytes);
COMMIT;
```

SQLite supports one writer at a time. `BEGIN IMMEDIATE` either acquires the
write transaction or returns `SQLITE_BUSY`; once it succeeds, SQLite documents
that operations through the following commit will not later fail with
`SQLITE_BUSY`. The conditional update distinguishes the winner from a writer
that begins after the head has advanced.

### Boundary and disposition

SQLite provides atomic local transactions and a convenient query/index layer,
but it does not widen the deployment surface beyond the local filesystem
backend. SQLite explicitly warns that POSIX advisory locking is buggy or
missing on many NFS implementations and recommends not placing the database on
a network filesystem.

SQLite is therefore a valid later or user-supplied local `JournalStore`, but it
is not a second required v1 implementation. Shipping both it and the generation
store would duplicate the same local deployment outcome.

Sources:

- https://www.sqlite.org/lang_transaction.html
- https://www.sqlite.org/rescode.html
- https://www.sqlite.org/lockingv3.html

## 3. Conditional object store

### Primitive

For AWS S3:

1. upload the complete event under an immutable, unique segment key;
2. read the current head object and its ETag;
3. `PutObject` the new head with `If-Match: <observed-etag>`;
4. treat `200` as the only successful append;
5. treat `412` as revision mismatch; and
6. treat `409`, `404`, timeout, or response loss as ambiguous until a fresh read
   establishes which head is current.

S3 documents `If-Match` as an ETag precondition and fails a mismatched write
with `412`. Its conditional-write documentation states that when several
conditional writes target the same object, the first write to finish succeeds
and later writes fail. S3 also documents strong read-after-write consistency
for object PUT/DELETE, strong HEAD metadata reads, and atomic updates to one
key.

The immutable segment may become an unreachable orphan when its head CAS
loses. That is safe and can be garbage-collected after the retention horizon.
The authoritative journal is the chain reachable from the head.

### Fresh runner, retention, and takeover

A CI runner receives the S3 bucket/prefix as its journal resume locator and
loads new credentials. The plan reached from the journal binds the immutable
bundle locator and digest. Bundle objects may share the prefix, but physical
co-location is not a correctness requirement and no synchronized peer root is
added.

Bucket lifecycle policy must retain the journal, plan, and bundle for at least
the configured recovery horizon. Deleting or expiring the head concurrently
with an active release is outside the backend law and surfaces as an ambiguous
storage failure, never as append success.

Sources:

- https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/

## 4. CI artifacts plus external state

GitHub Actions artifact upload v4 and later produces immutable artifacts.
Immutable upload is useful for bundle transport, but it does not expose a
conditional mutable head over the ordered journal. Two runners can upload two
different artifacts successfully; neither upload decides which runner may send.

Artifact retention is also bounded: GitHub documents a default of 90 days, a
1-90 day range for public repositories, and a 1-400 day range for private
repositories. Release correctness cannot silently depend on the repository's
default artifact retention.

Therefore:

```text
CI artifact + external conditional state
  = artifact transport + the external JournalStore
```

It is not a fourth journal backend. For the initial GitHub Actions deployment,
artifacts may carry the immutable bundle while the S3 head and event segments
carry the journal.

Sources:

- https://github.com/actions/upload-artifact
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository

## Executable race evidence

`probes/journal-backends/probe.mjs` launches two separate processes against all
four mechanisms.

Observed result:

```text
filesystem:                 winners=1 losers=1 finalRevision=2
SQLite:                     winners=1 losers=1 finalRevision=2
conditional object double: winners=1 losers=1 finalRevision=2
CI artifacts uploaded:     2
external-state winners:    1
```

The filesystem and SQLite results are real local races. The object-store result
is a protocol double that exercises the proposed client algorithm; the cited
S3 documentation is the authority for live service semantics.

## Decision

The 16-family vNext scope genuinely requires two deployment surfaces:

1. local/offline or one-host operation; and
2. fresh CI runners on different machines.

One blessed backend does not cover both without either imposing cloud storage
on local use or falsely treating ephemeral/artifact storage as a shared CAS.
Therefore v1 has one narrow `JournalStore` law with two first-party Layers:

```text
LocalGenerationJournalStore
S3ConditionalJournalStore
```

SQLite remains documented and probed but is not required in v1. GitHub Actions
artifacts remain an immutable bundle transport, not journal authority.

This adds no release mode, provider capability, provider registry, or peer
state representation. Application configuration supplies exactly one
`JournalStore` Layer for a run, and every implementation must satisfy the same
append-if-revision law.
