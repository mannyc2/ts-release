# Journal backend race probe

This disposable probe exercises the single journal law needed before any
provider send:

```text
appendIfRevision(expectedRevision, event)
  -> exactly one Appended
  -> every concurrent stale writer receives RevisionMismatch
```

`probe.mjs` launches two separate Node processes for each candidate:

- local filesystem generation files installed by an atomic hard link;
- SQLite `BEGIN IMMEDIATE` plus a conditional head update;
- a conditional object-store protocol double using `If-Match`;
- two immutable CI-style artifact uploads plus the same external conditional
  head.

The protocol double is not live S3 conformance evidence. The official S3
conditional-write and consistency documentation supplies the service law ; the
probe only discriminates whether the proposed client algorithm has a
one-winner race shape.

Run with Node 22 or newer:

```text
NODE_NO_WARNINGS=1 node probe.mjs
```
