# Hosts, loading, storage and resource ownership

The CLI and Action load an ordinary, explicitly selected application. That
application imports its provider packages, constructs their native handlers,
opens its stores, and supplies one Host. The core captures that Host before
preparation and does not resolve a replacement store or transport from a
provider's Layer. [The signatures](host-api.d.ts) and
[kernel signatures](kernel-api.d.ts) define the boundary.

## Application and CLI contract

The proposed command is exactly:

```sh
ts-release ./release-application.mjs ./release-input.json
```

The first argument is a trusted executable ESM file. Resolve it relative to
the invoking working directory, convert the absolute path with `pathToFileURL`,
and import it. It must export
`createApplication(input): Effect<Application, ReleaseError, Scope>`.
Its imports resolve from its own location and installed dependencies. The CLI
does not install modules, read a package name from a Plan, evaluate JSON as
code, or need to know the provider when the CLI was built. Reject missing
exports and non-Effect return values before executing a release.

Read the second argument as JSON and pass the unknown value to the application;
the application's Schema owns that input, rather than a central release-config
schema. Acquire the application and run the release in **one Scope**. Provide
the returned Host with a Layer at this boundary. Emit one JSON ReleaseReport
on stdout; diagnostics and failures go to stderr. An uncaught error is a
nonzero exit. Node and Bun call the same interpreter. Scope closure must run
on success, typed failure and interruption, including SQLite, file handles,
temporary native workspaces and in-flight HTTP sockets.

`RunOptions.authorize` is an explicit application input. A saved Plan is data
and never creates approval. The core hashes the Plan, its durable journal
binding and every native intent; preparation cannot substitute a new request
after a recorded dispatch. Report, observation, risk acceptance and supersession
are the separate Effect functions in the public API, without another durable
workflow representation. A library caller composes those Effects directly.

The Action accepts the same application path and parsed input and invokes
`runAction`. It returns the report plus `planId` and decimal `journalRevision`
outputs. Its distribution bundles the host launcher and core; the application
and its provider imports remain runtime inputs. The local packed fixture proves
this loading mechanism, including a provider built after both core and CLI.
It does not prove a deployed GitHub Action's permissions, artifact routing,
fork behavior or all production distribution formats. Those are W10/Plan 009
acceptance, not more architecture choices.

## HTTP and native operations

The owned HTTP transport sends **one native request per dispatch permit**.
The real retry regression first performs a GET on a reusable connection, then
has the peer commit a PUT and close without a response: Bun 1.3.14's `fetch`
sent two PUTs; admitted Node 22.22.2 sent one. The replacement uses
`node:http`/`node:https` with `agent:false`, no mutating retry loop and no
automatic redirect. Interruption destroys the socket; this does not establish
non-commit at the peer. A fresh runner retains durable uncertainty and observes
instead of resending. See the retained topology receipts and
`tools/architecture-lab/topology/fetch-retry.mjs`.

Provider-owned HTTP decoders preserve native response/error values. The host
captures the installed decoder catalog and selects exactly one matching
endpoint/method/principal/scope handler before credentials or dispatch; zero
or multiple matches reject. No status-code-only universal success rule is a
product contract. Credential resolution returns ephemeral headers, rejects
collisions with recorded public headers, and verifies the exact destination
and public authority binding. Authorization/Cookie/token bytes never enter
RequestFacts, Plan, Journal or Report. Npm/PyPI/MCP exchange and provenance
rules remain in their verticals; common origin checking, secret injection,
bounded reads and actual network calls belong to the host.

The Git host imports and verifies owned canonical native object sets in a fresh
private repository, then executes the core's exact force-with-lease argument
array. Its captured authority table permits multiple explicitly bound
principal/scope pairs without an untrusted wrapper acquiring the private
protected-transport witness. A request's Git body is empty; its immutable Intent
binds the object-set Content, remote/ref/old/new tuple and managed files. Native
object IDs, contents and commit topology are checked before the one push.
Acknowledgment loss does not erase the old/new condition. The separate
Git catalog fixture destroys authoring repositories and proves reconstruction,
two authorities and a multi-file commit on fresh processes. The object encoding
is the retained `core-git-object-set/v1`, not a new generic artifact format.

`openGitJournal` also requires explicit principal/scope, Git executable, timeout,
output bound and an exact remote/ref credential callback. It shares the bounded
native process/environment primitive with the Git host, without inheriting
ambient credential helpers. The callback reacquires credentials on each runner;
the journal does not persist them.

## Journal contract and operating profiles

Every backend implements `append(journalId, expectedRevision, event)` against
one physical append-only history. The revision counts **all** scopes, including
Apple preparation and final publication. Reads validate the complete history;
projecting one scope never changes the revision used for CAS. Only a new
`Appended` result grants this invocation a dispatch permit. Identical event
read-back returns `AlreadyRecorded`; uncertainty remains a distinct result.
No index, downloaded CI artifact, process result or reconstructed report is a
second authority.

The proposed first product profile is **1,048,576 UTF-8 bytes per complete
canonical JournalEvent**. Apply it before writes and before decoding reads on
every backend. Schema version tags, native payloads and envelope fields all
count. SQLite and Git were exercised at exactly 1 MiB and one byte over, with
fresh readers; the S3 protocol fixture exercises the same boundary. A fixture
limit remains injectable only in tests. Native accepted test events reached
968 bytes, which is a sample, not proof of the largest legitimate future event.

This capacity is an explicit design policy, not a recovered historical law.
Bundle bytes, object sets and final Apple bundles are owned content objects;
events refer to their verified identities. Never truncate or replace required
native evidence to fit the bound. If a remote result exceeds the admitted
capacity after dispatch, keep the existing DispatchStarted as uncertainty,
surface the capacity error, and stop. A future capacity increase requires
reader/writer/backend qualification together. Unbounded histories are not
claimed: the prototypes validate complete histories on each read, and the S3
model's 4,096-event count is a research capacity, not a new product journal
format. Production must use bounded streaming reads or an explicit deployment
capacity error; it must never truncate a history or silently start a new one.

| Backend | Selected role | Established evidence | Remaining qualification |
| --- | --- | --- | --- |
| Bun SQLite | Local CLI default at an explicit state path | WAL/FULL transaction, two independent writers, crash rollback, full-event bounds, reopen | Filesystem durability on each shipped host; no cross-host claim |
| Git ref | Explicitly configured shared backend candidate | Real bare remote, conditional updates, two processes, duplicate/no-op distinction, rejected policy, lost acknowledgment | Actual repository permissions, ref rules, confidentiality, retention and recovery |
| S3 | Optional shared backend; retained future Apple deployment option | Independent versioned HTTP protocol fixture, conditional head, pinned object versions, races, acknowledgment loss, bounds | SigV4, IAM/bucket policy, real consistency/errors, versioning, retention, restore and access isolation |
| CI artifacts | Transport for immutable bundles and public evidence | Selected content transfer role | They never substitute for a CAS journal |
| Filesystem generations | Deferred backend | Historical donor only | No portable default is inferred |

SQLite's transaction locking and Git's exact expected-ref comparison are the
native mechanisms being used. A successful up-to-date Git push is not a new
append winner. [SQLite transactions](https://www.sqlite.org/lang_transaction.html),
[Git force-with-lease](https://git-scm.com/docs/git-push).

## S3 design and hosted boundary

The concrete model writes a unique immutable Segment containing the complete
event, revision, journal namespace and previous `{key, versionId, sha256}`.
Upload it with `If-None-Match: *` and a SHA256 checksum. Its returned non-null
version ID and exact byte digest become the new tip. Commit a small Head by
`If-Match` on the previous opaque ETag, or `If-None-Match: *` for an absent
initial head. Orphan segments are not history. Read a head, then follow only
the exact version-addressed, hash-verified chain. Validate contiguous revisions,
namespace, event identity, termination and full bytes before returning it.

A 412 is a lost conditional update: read and compare, never return a new
permit. A 409, 404, timeout or lost acknowledgment is not a license to issue
another PUT. An absent head with a delete marker is unavailable history, not
a fresh release. Real S3 conditional-write behavior and conflict distinctions
are specified by [AWS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html).

Object Lock protects individual versions; it does not prevent new versions or
delete markers. The model demonstrates that counterexample. Deployment must
deny deletion/rollback of the authoritative head and require conditional head
writes, in addition to the selected immutable-segment retention policy.
Governance bypass permission cannot count as compliance retention. Versioning,
the exact IAM principals, bucket policy, region, retention duration, lifecycle
and administrative trust boundary must be recorded in a real deployment
receipt. [Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html),
[enforcing conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes-enforce.html).

There is **no automatic Git-ref Action default** in this handoff. GitHub token
permissions and fork behavior vary by repository/workflow policy, and local
Git cannot qualify them. W10 requires explicit shared-store configuration;
Plan 009 qualifies that deployed configuration. A missing shared store fails
before publication. [GitHub token permissions](https://docs.github.com/en/actions/concepts/security/github_token).

The newer upstream npm-only scope explicitly deferred Apple/AWS certification;
it therefore no longer makes a live S3 deployment a prerequisite for importing
effect-build. This changes the old Plan 004 coupling, not ts-release's selected
Apple product outcomes. See [the immutable upstream reconciliation](upstream.md)
and [all retained qualification obligations](qualification.md).
