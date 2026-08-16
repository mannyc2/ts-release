# Journal backend and compare-and-swap research

Status: research response to R1. The `JournalStore` law is accepted; the
mandatory first-party backend set is reopened.

## Accepted storage law

Before any external send:

```text
appendIfRevision(
  journalRoot,
  expectedRevision,
  completeEvent
) -> Appended(newRevision)
   | RevisionMismatch(actualRevision)
   | AmbiguousStorageOutcome
```

Required properties:

1. at most one writer advances a revision;
2. readers never observe a partial event;
3. success is durable before return;
4. read-after-success observes the new head;
5. only `Appended` permits send; and
6. timeouts and ambiguous storage responses are reconciled before any send.

This is a genuine substitutability law and justifies a `JournalStore` service.
It does not imply a specific cloud account or backend.

## Candidate comparison

| Candidate | CAS primitive | Local UX | Fresh CI runner | Main unresolved risk |
| --- | --- | --- | --- | --- |
| filesystem generation store | install one complete generation at a unique path | simple | only with shared durable filesystem | current probe is Linux-only; crash semantics on Windows/macOS not yet established |
| SQLite | transaction plus conditional head update | strong cross-platform local candidate | only with a safely shared database file/block volume | network filesystem behavior and multi-host deployment |
| orphan/dedicated Git ref | commit whose parent is observed head; explicit expected-old push or fast-forward update | requires Git repository | uses existing GitHub repository and token | permissions, fork workflows, ref policy, sensitive/public history, push response ambiguity |
| S3 conditional object | immutable event segment plus `If-Match` head update | extra AWS setup | strong cross-host candidate for AWS users | extra account, credentials, bucket, cost, lifecycle policy |
| user-supplied store | implementation-specific | depends on application | covers existing infrastructure | conformance and support burden |
| CI artifacts only | no conditional mutable head | convenient bundle transport | uploads can both succeed | cannot choose the dispatch winner |

## Filesystem generation store

The existing probe exercises a Linux local protocol based on complete-file
prewrite and exclusive installation of the next generation. It shows that two
local processes select one winner in the tested environment.

It does not establish a portable v1 backend:

- Windows hard-link and directory durability semantics were not exercised;
- macOS crash-durability and directory synchronization were not exercised;
- Node's `fs.link` portability does not itself prove power-loss durability; and
- generic NFS/SMB/network-home behavior is explicitly outside the probe.

Official sources:

- POSIX/Linux open and exclusive-create semantics:
  https://www.man7.org/linux/man-pages/man2/open.2.html
- link semantics and NFS caveats:
  https://man7.org/linux/man-pages/man2/link.2.html
- Windows hard-link API:
  https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-createhardlinkw

Disposition: viable Linux-local candidate; not yet a blessed cross-platform
backend.

## SQLite

A transaction can acquire write ownership, conditionally update the head at the
expected revision, insert the complete event, and commit atomically.

The existing two-process probe selects one winner locally. SQLite is more
portable than a hand-built hard-link protocol and supplies useful query/index
facilities. It still should not be placed on an unsupported network filesystem.

Official sources:

- https://www.sqlite.org/lang_transaction.html
- https://www.sqlite.org/lockingv3.html
- https://www.sqlite.org/howtocorrupt.html

Disposition: strong default-local candidate; not proof of cross-machine CI
continuation by itself.

## Dedicated or orphan Git ref

A journal can be represented as an append-only commit chain on a dedicated ref:

```text
observed head H
new commit N has parent H and contains complete event/head data
push N to refs/ts-release/journals/<release>
```

CAS alternatives:

- ordinary fast-forward push, where only the first child of H can advance the
  remote ref;
- explicit `--force-with-lease=<ref>:<H>` when the representation requires a
  non-fast-forward replacement; or
- a hosting API that exposes an explicit expected-old ref condition.

Git documents that `--force-with-lease=<ref>:<expect>` updates only when the
remote ref equals the expected value and fails otherwise:

- https://git-scm.com/docs/git-push

Advantages for GitHub Actions:

- no separate S3 account or bucket;
- bundle locator and journal can remain associated with the repository;
- commit history is inspectable and naturally retained with the repository;
- the same Git conditional-update law already appears in Homebrew/Scoop
  publication research.

Costs and open questions:

- `GITHUB_TOKEN` needs contents write permission; defaults may be read-only;
- fork-origin workflows generally cannot safely receive write credentials;
- branch/ref protections and organization policy can reject updates;
- journal contents may be visible to repository readers;
- garbage collection and long-term retention need a policy;
- a lost push response still requires reading the ref before deciding;
- if two contenders construct the same target commit, Git may report the second
  push as already up to date rather than identify one writer as the winner;
  candidate commits therefore need distinct writer/dispatch identity or an API
  whose response distinguishes the successful compare-and-swap; and
- a live two-runner hosted-Git experiment has not been run.

GitHub token permission source:

- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository

Disposition: credible GitHub-CI candidate that deserves a focused local bare-
repository race, including the same-target/no-op ambiguity, and later a
scratch-repository test before backend selection.

## S3 conditional objects

AWS S3 documents conditional writes with `If-Match` and `If-None-Match`. A
journal can upload immutable event segments and conditionally replace a small
head object.

Sources:

- https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html

The existing conditional-object probe is a protocol double, not a live S3
conformance test.

Disposition: strong optional backend for deployments already using AWS; not
entailed by the 16 product outcomes and not yet justified as mandatory default
infrastructure.

## CI artifacts

GitHub Actions artifacts are useful immutable bundle transport. They are not a
journal CAS because two uploads can both succeed and neither chooses the
mutation winner.

Source:

- https://github.com/actions/upload-artifact

They must be paired with Git, S3, a database, or another conditional state
backend.

## Does v1 require backend pluggability?

The deployment surfaces are genuinely different:

```text
local developer or one-host runner
fresh GitHub Actions runner
other hosted or self-hosted CI
existing AWS/database infrastructure
```

No single implementation is currently demonstrated as the smallest acceptable
choice for all of them. Therefore the narrow `JournalStore` Layer remains
justified. That does not mean every backend ships first-party.

## Revised recommendation

Do not bless `LocalGenerationJournalStore` plus `S3ConditionalJournalStore` as
architecturally required.

Research order:

1. keep the `appendIfRevision` law;
2. run a focused Git-ref race against a local bare repository;
3. establish Windows and macOS behavior before claiming a portable filesystem
   generation store;
4. compare SQLite and the generation store for local default UX;
5. evaluate a scratch GitHub ref for GitHub Actions;
6. retain S3 as an optional first-party or user-supplied backend for AWS
   deployments; and
7. choose the shipped set from actual deployment/UX evidence, not provider
   feature count.

The current backend selection is therefore a genuine maintainer/product choice.
