# Executable machine research handoff

Recommend M1's history/facts/decision representation for implementation. Both
real candidates pass the same observable laws; M2 adds a second materialized
representation without eliminating journal validation or improving a measured
outcome. This is a recommendation from the executable research below, not a
claim that the earlier scripted tournament selected M1 or that production has
been implemented. Physical package selection and full obligation reconciliation
remain separate evidence in this handoff directory.

The authorized work changes research code only. Production `src`, published
packages, external publication services, and `.repos/effect` were not changed.

## What was actually built

`tools/architecture-lab/machine/src/m1-history.ts` stores one immutable event
history and derives attempt, receipt, observation, and consumed-risk facts by
queries. Its `next` function authorizes a proposed dispatch from those facts.
`m2-transition.ts` independently folds into Active/Superseded disposition and
NeverStarted/Attempted state, with nonempty Open/Accepted/NonCommit attempts,
latest observation, observation count, and consumed risk decisions. M2 discards
historical receipt bodies in its materialized state. The shared loaded snapshot
still retains them for native validation and provider dependency context.

These are genuinely different representations. They share durable schemas,
canonical identity, provider boundary validation, host interfaces, and the
interpreter. Neither candidate delegates its transitions to the other. The
observable tests assert external send counts, actual remote bytes/refs, durable
event associations, and reconstructed reports; they do not generate expected
actions by calling a candidate's transition function.

| Candidate-specific source | Physical lines | Printer-normalized lines | UTF-8 bytes | AST nodes |
| --- | ---: | ---: | ---: | ---: |
| M1 history/facts/decision | 105 | 119 | 7,926 | 1,516 |
| M2 materialized transition | 154 | 187 | 9,547 | 1,678 |

The complete experimental kernel, containing **both** candidates, is 1,089
physical lines / 1,230 printer-normalized lines / 66,422 bytes across eight
source files. This includes identity/native evidence validation, conditional
Git, shared journal context, and interpreter code. These are source diagnostics,
not the accepted semantic-source/v3 score. Printer output is a readability
cross-check; no formatting-only compression was used to meet a budget. Tests,
extension consumers, generators, storage, Apple adoption and topology adapters
are separately maintained source and must remain counted in their own lanes.
There is no claimed performance win: both prototypes reload and validate whole
history on each read, and neither caches an independently authoritative state.

`tools/architecture-lab/machine/source-metrics.json` binds exact file hashes,
tree hashes and extension patches. The final kernel tree digest is
`25f02ed605cb054888f5aad37f55f26732d0ad57fad595eafa1483502bebd435` under
the explicitly recorded sorted path/file-hash algorithm.

## Minimal implementation contract derived from the experiment

`kernel-api.d.ts` is compiler-derived from the validated prototype declarations
and independently typechecked. It is a proposal, not a fabricated declaration
of nonexistent production code. It retains actual `Schema.Class`, tagged-class
and tagged-error constructor types. The proposal renames the error to
`ReleaseError` and domains to `ts-release/*`; it removes `Candidate`, the fault
checkpoint, internal model constructors, and experimental migration exports.
Additional branded identifier types have not been implemented or claimed.

The durable provider descriptor is exactly definition ID, intent version and
service-free intent codec (`ProviderDescriptor`). Operation/plan construction
and loading need that descriptor. Execution uses `ProviderDefinition`, adding
prepare, native receipt codec/correspondence/classification, optional observation
codec/classifier, and optional native failure boundaries. Missing execution
contracts reject before provider effects. There is no central provider union,
provider-authored operation ID, serialized callback, or result selector grammar.

Operation identity hashes the definition ID, intent version and canonical
intent. Plan identity hashes its format, bundle ID, complete sorted operation
DAG and **journal ID**. Dependency edges are sorted and unique; duplicate
operations, dangling edges, cycles, unknown definitions, unknown codec versions,
noncanonical input and hash mismatches reject before execution. The default
journal root is a distinct domain-separated hash of concrete plan inputs;
an explicitly chosen Apple root is included in both scope identities. Changing
host journal configuration cannot move a saved plan into an empty journal.

The machine's internal command algebra is `PrepareDispatch`, `AppendDispatch`
with a lawful basis, `RequestRiskAcceptance`, or `Finish`. Observation scheduling
is explicit invocation policy in the interpreter: optional, at most once per
operation per invocation, with a dispatch budget. It is not an additional
durable operation state. Public run/report/observe functions are Effect-native
and receive the captured `Host` service at the application boundary.

`ProviderContext` is a copied, frozen projection of validated native receipts
and observations for the operation itself and **only its declared dependencies**.
This lets a GitHub upload resolve the release ID returned by a declared create
operation after restart. It does not persist arbitrary result selectors or let
a provider read a private peer journal. The root-owned integration fixture
`tools/architecture-lab/integration` proves actual local HTTP ID 41 dependency
binding across OS processes and rejection after remote ID drift to 99. This is
architectural evidence for the GitHub shape, not GitHub service acceptance.

## Journal, authority and recovery laws

The six families remain `DispatchStarted`, `DispatchRejectedBeforeCommit`,
`ReceiptAccepted`, `ObservationRecorded`, `RiskAccepted`, and `PlanSuperseded`.
No `PlanDerived` family was added. One physical journal holds all admitted
preparation and publication scopes. Every event has journal ID, immutable scope
plan ID and unique event ID. Store revision is the global prefix length, not a
filtered publication revision; envelopes do not duplicate assigned revisions or
add an unexplained second envelope hash. Atomic full canonical bytes and unique
event-ID equality are the store protocol.

The Apple preparation scope is a transient one-operation machine view rebuilt
from one concrete durable `ApplePreparation` input. It is not a second persisted
publication Plan, DAG, future recipe or second ledger. The host catalog admits
that view and one final publication Plan. All scopes and the complete global
history are validated on read; unknown scopes, foreign journal roots and global
duplicate IDs reject. A selected-scope report contains its operations and the
**global** revision. Apple's full-context report must include both scope reports
and native preparation facts; `reportRelease` alone is not a full-context report.

Only this invocation's successful conditional append of its complete
`DispatchStarted` creates a private unsent permit. The actual host transport
consumes it once. `AlreadyRecorded` and CAS loss grant no permit. An ambiguous
append can continue only when the same live unsent call stack reads back its
exact event. A new process loading that event never reconstructs a permit.
The append is the authorization linearization point; a winner's delayed send
can outlive a subsequent supersession, and its factual result remains valid.

| Boundary | Durable result and next invocation |
| --- | --- |
| Credentials/artifact/prepare fails before append | No attempt or event. Explicit retry remains possible. |
| Process dies after append, before send | Started fact remains uncertain. Absence cannot authorize resend. |
| Request commits, response or process is lost | Started fact remains uncertain; exact native observation may satisfy it. |
| Native acceptance is queued/delayed | Receipt is `Pending`, not completed; native completion observation satisfies it. |
| A declared native proof establishes terminal noncommit | Dispatch-linked versioned proof allows a new attempt. An arbitrary transport claim cannot. |
| Native request error or caught core error | Dispatch-linked `ObservationRecorded` error remains Inconclusive; native payload or exact core code/message survives reload. |
| Supersession during an authorized send | Preserve late receipt/observation/error facts. Reject new dispatch and new risk decisions. |
| Native receipt exceeds event byte ceiling | Append fails visibly; started fact remains uncertain and a restart does not resend. |

Risk acceptance is explicitly host-authorized, bound to operation, exact request
fingerprint, complete prior dispatch-ID set, approving principal and expiry, and
consumed by the CAS for one further attempt. Changed request principal, endpoint,
scope or bytes cannot spend an old approval. Credentials themselves stay in the
host transport closure; credential rotation within the same principal does not
change artifact or request identity.

Structural replay is owned by the captured core Git transport, proven by a
private constructor witness. Provider-supplied `GitCas` data alone is rejected
before an append/send. The core owns one exact native push argument sequence
with `--force-with-lease=ref:expectedOld`, endpoint and desired object ID. It has
no shell fallback or hidden retry. Actual local bare Git tests prove same-update
no-op confirmation and rejection of a competing ref update. Generic HTTP and
opaque sends have no structural replay guarantee. The constructor also accepts
a nonempty captured authority table with unique principal/scope pairs; proof and
send resolve the same privately copied binding. A non-Git fallback cannot claim
that witness. Real catalog fixtures reconstruct owned native Git object sets
after deleting build repositories, route two authorities, retain one multi-file
commit per target and reject changed object bytes before any push.

Native receipt status is recomputed from its versioned codec and request
correspondence. Native observation classification is recomputed from its codec
and preceding decoded receipts for that operation. Native errors use the same
observation event family with strict DispatchError kind, matching dispatch ID
and Inconclusive status; ordinary observations cannot claim a dispatch ID.
Provider error payloads require their own codec/version/correspondence. The
core error codec stores only the exact typed core code/message, and is not a
compatibility fallback for an unavailable native codec. Noncommit proof has its
own declared native boundary. An unknown native schema preserves uncertainty
and fails explicitly; it never becomes noncommit or a successful result.

## Canonical profile and limits

Canonical encoding emits JSON directly, sorting object keys by JavaScript
lexical UTF-16 order, including numeric-looking keys. It accepts already-NFC
strings, exact safe integers excluding negative zero, booleans, null, dense
arrays, plain records and Schema class values. It rejects normalization,
unpaired surrogates, unsafe/fractional numbers, undefined, duplicate/noncanonical
JSON keys, Date/Map/Set and sparse arrays. Hash framing is decimal UTF-8 byte
length + colon + domain bytes + decimal payload length + colon + canonical
payload bytes, followed by SHA-256. Portable WebCrypto supplies the digest;
there are no Node/Bun imports in the machine source. Tests use independent
Node crypto golden calculations and lexical numeric-key vectors.

Request facts contain body SHA-256, decimal byte length, endpoint, method,
nonsecret immutable headers, principal, scope and replay facts. Authentication,
cookie and common API-token header names are rejected before journaling.
Providers/hosts must keep secrets out of other metadata and typed error messages;
this is an authored contract, not a sandbox for malicious provider code. Native
opaque bytes that are not canonical strings must be encoded losslessly by the
provider's declared codec, rather than silently normalized.

`event-sizes.json` measures complete canonical envelopes from 178 actual fixture
append attempts: maximum appended 968 bytes; deliberately rejected oversized
receipt 4,446 bytes at a 2,048-byte fixture ceiling. Per-family maxima are
included. P04/P09 HTTP extension fixtures append envelopes no larger than 791
bytes. These fixture maxima do not bound all production provider payloads.
The storage research independently tests exact and plus-one-byte limits on read
and write. Artifact payload bytes belong in release-owned content, not inline
production Plan or journal values; small inline test intents are finite fixtures.

## Coverage and extension evidence

The final local machine suite passes **61 tests / 364 assertions**, including
actual SQLite crash/reopen continuation, real OS process replacement after
deleting the original workspace, local HTTP mutation counts, actual conditional
Git behavior, native error persistence and malformed evidence rejection. Strict
TypeScript checks pass with installed aligned Effect rc.108 and Bun 1.3.14.

The sixteen retained cases are not replaced by that count. Local tests cover
machine laws for C01–C11 and C15, plus bounded failure/error adversaries. C02 is
explicitly split: preflight failure has zero history; **post-start** proven
noncommit has a linked durable rejection. The earlier C02 fixture conflated
those boundaries. The core C12 instance test is narrower than a packed external
provider proof, and the core C13 opaque port is narrower than native Apple
acceptance-before-ID loss. Packed C12 belongs to topology; native C13 and
finalized file/tree C14 to Apple/adoption; exact bound-symmetry C16 to storage.
C08's generic tests reject proposed request drift before dispatch. Observation
endpoint correctness additionally requires the provider's native protocol
implementation and classifier; no generic observation transport sandbox is
claimed. The root obligation matrix records those independent owners.

`extensions/variants.mjs` emits real before/after source sets from the final
kernel. Both sets compile against the same consumer, then execute against an
actual loopback HTTP server for both machines. Baselines are explicitly
counterfactual pre-extension implementations, not alleged historical releases.
`extension-results.json` records twelve local before/after outcomes; topology
adds freshly packed Node/Bun execution for each physical layout.

* P04 adds genuinely delayed remote commitment: a native 202 acceptance remains
  Pending, then exact native completion satisfies it without another send.
  The before source incorrectly reports completion immediately and fails that
  independent assertion. The core patch changes authority interpretation,
  completion state and continuation behavior: five files, +12/-6 physical lines
  across both candidates. It adds receipt status and native classification
  without adding an event family or a provider replay-proof hook.
* P09 changes a closed supersession history to preserve late native facts under
  event format 2. The whole reviewed one-shot importer is counted. It requires
  explicit source-hash approval, validates old closed-history input, preserves
  event/dispatch identities and all fact bodies, and creates no permit. The
  new normal reader rejects old format 1; there is no dual-reader branch.
  Live recovery and explicit migration each fail before and pass after for both
  machines. Six files change, +47/-5 lines including the full 42-line importer.
  The importer is a research single-scope fixture, not a proposed shipped
  migration for all legacy production formats.

## Executor boundary

Implement one selected M1 core, remove runtime candidate selection and fault
hooks, and keep experiments as research evidence. Preserve the constructor,
native evidence, global journal, dispatch authority and dependency-context laws
above. The production declaration proposal is an explicit naming/domain change,
not a claim of binary compatibility. The user authorized a hard cut and there
are no known external consumers; no legacy runtime reader is required.

The prototypes do not implement all 69 selected provider outcomes, credentialed
service acceptance, terminal effect-build release readiness, or production
performance. Those outcomes retain their mapped implementation acceptance
tests and upstream gates. Small local source cost and passing shared machine
laws justify the core representation; they do not replace that full scope or
turn an unavailable upstream release gate green.

The final journal admission amendment permits at most one PublicationScope in
one release journal and any number of independently admitted concrete
PreparationScopes. Two publication plans reject before store reads, appends,
provider preparation or sends. Both candidates also prove two preparations plus
one publication consume exact global expected revisions 0 through 5, with all
three reports observing revision 6. This adds three interpreter lines and no
format or public signature. P09 retains late facts on the same superseded plan;
it does not prove publication of a replacement Plan in that journal.
