# Refactoring prerequisite handoff

This packet completes the local prerequisite investigation and supplies a
reviewable implementation design. It preserves **all 69 selected outcomes** and
reconciles **all 226 recorded propositions**. Production source, dependencies and
publication were not changed. Compatibility follows the user's explicit
decision: **hard cut; no known external consumers**.

Two maintainer choices remain explicit: physical package topology and the
corrected marginal-extension measurement policy. The recorded selection rule
requires a maintainer choice when candidates have real tradeoffs. Neither has
been inferred from silence. The recommendation is **T3: a kernel package plus
seven provider packages**, with `packages/`, and admission of configuration-only
extensions plus a 45-line source-and-metadata median. All alternatives have exact
projections; the executor must not invent a winner or silently waive a gate.

## Read and execute this contract

| Authority | Exact use |
| --- | --- |
| [Design](design.json), [contract](contract.json) | Chosen/proposed decisions, immutable pins, evidence checksums and authorization boundary |
| [Layout](layout.json), [public surface](public-surface.json) | Exact manifests, exports, source destinations, dependency edges, host zones and generated delivery/config templates for T1/T2/T3 |
| [Kernel](kernel-api.d.ts), [providers](provider-api.d.ts), [hosts](host-api.d.ts), [Apple](apple-api.d.ts), [checksums](checksum-api.d.ts), [owned artifacts](adoption-api/adoption.d.ts) | Complete proposed TypeScript contracts; native refinements and evidence laws are documented alongside them |
| [Durable vocabulary](durable-vocabulary.md), [exact spellings](durable-vocabulary.json) | First-party definition IDs, codec versions, scope coordinates and root hash/format domains; external provider IDs remain open |
| [Reconciliation](reconciliation.json), [qualification](qualification.md) | Every retained proposition and original case/law/gate/blocker; exact local proof and native/deployment limits |
| [Migration](migration.json), [published history](public-history-inventory.json) | File/declaration/symbol/format disposition, including public 0.3.0 journal/AWS exports absent from this branch |
| [Execution waves](waves.md), [exact outcome assignments](waves.json) | Ten sequential implementation waves, original 69 native oracles, then Plans 009/010 acceptance and independent certification |
| [Source forecast](forecast.md), [arithmetic](forecast.json) | Full responsibility costs, all module owners, metadata/tooling lanes and source-ceiling risk |

`design.json` is the editable design authority. `project.ts` derives the layout
and public-surface projections from it and compiler-read declarations.
`contract.json` binds this packet and the actual source/evidence files. Original
research inputs are preserved; the new reconciliation records explicit later
decisions instead of rewriting history. [Task review](research-lineage.md)
explains which earlier conclusions were withdrawn and why.

## Architecture resolved by the experiments

The durable publication model is **owned Bundle → immutable Plan → one Journal
→ derived Report**. M1 has one history-derived decision owner and one interpreter.
Its complete selected prototype is **935 lines**, including canonical identities,
schemas, native evidence admission, host capture and protected Git. The 105-line
M1-specific file is not the whole system. M2 passed the same local behavior but
adds state/source without a demonstrated performance advantage. Both presently
validate complete history; no scalable-history performance claim is made.

The six journal facts/decisions remain DispatchStarted,
DispatchRejectedBeforeCommit, ReceiptAccepted, ObservationRecorded, RiskAccepted
and PlanSuperseded. Only a fresh successful CAS append authorizes this invocation
to send. Read-back is not another permit. Absence cannot fence an in-flight
mutation. Only the captured native Git conditional mechanism owns automatic
replay. HTTP and opaque uncertainty stop or observe. Explicit risk binds the
exact request, principal, prior attempts and expiry.

Providers own their native intent, requests, codecs, classifications and
coordinate laws. They import the kernel and neutral host ports, never siblings.
There is no provider-ID allowlist, universal publisher, provider hash function,
second application state machine or central release-config language. The root
owns artifacts, request identity, journal/replay authority and common HTTP/Git
mechanics. Homebrew/Scoop/OpenAI render files; application composition gives
those files to the common Git owner. Native Git plumbing replaces handwritten
tree/commit parsing, with exact object-set ownership and bounded host work still
required.

The CLI is exactly `ts-release ./release-application.mjs ./release-input.json`.
It imports an explicit file URL whose `createApplication` returns a scoped
Effect. The application imports providers and supplies layers. One Scope owns
application acquisition and execution. CLI, Action and library use the same
interpreter; runtime loading works for a provider built after core and CLI.
There is no automatic platform/provider install or package lookup from Plan data.

Bun SQLite is the local default at an explicit state path. Git is an explicitly
configured shared backend with exact credentials, native command limits and
deployment qualification. **There is no automatic Git-ref Action default.** The
S3 protocol model and published AWS donor are preserved separately. Upstream's
new npm-only scope defers Apple/AWS certification; that removes an obsolete
library-import prerequisite, not ts-release's selected Apple outcomes.

Apple now has an exact app/DMG/pkg API and one hash-bound immutable preparation
collection. Changed untouched inputs cannot reuse the old root. Each native
preparation selects its final output bytes once through the same global journal;
the one final publication Bundle includes every selected output and other
release files. It binds the full Bundle rather than one app tree. No submission
identity is guessed after pre-ID response loss. Native Apple acceptance remains
an explicit platform/credential witness, never a protocol-double result.

## What was actually verified

| Experiment | Established local result |
| --- | --- |
| Machine, storage, native Git and dependency suites | 93 tests / 534 assertions; competing writers, crash/reopen, process replacement, native errors, complete-event bounds and conditional Git; at most one publication scope and multiple preparations |
| Three layouts | Same source-built machine/npm/Warehouse slice; 60 packed Node/Bun/library/CLI/Action scenarios, six owned-Bundle cases and later-built external-provider loading |
| Extension changes | All nine meaningful changes implemented in all three layouts; actual before/after source, packed consumers and Git-Myers additions |
| Graphs/publication | Actual emitted/runtime/declaration/package graphs, selective installs/bundles, dependency skew and partial publication states |
| Host lifetime | Real file/SQLite cleanup and native HTTP cancellation with a committed peer request; fresh resume sends zero times |
| Native transport | Found Bun fetch retrying a committed PUT after response loss; one-request native HTTP replacement and native Git object reconstruction verified |
| Producer compatibility | Actual published effect-build/Apple 0.6.3 tarballs; 34 adoption checks under each Node and Bun, including a real 95.9 MB selected-product file |
| Apple | Original 16 lifecycle checks plus eight-process mixed-release proof: two preparations, two real post-staple TARs, five Bundle members, one Plan and zero restart resend |
| Checksums | 19 checks each under Bun/Node, including actual GNU sha256sum and tampered-file rejection |
| Effect compatibility | Official unpatched rc.108 strict declarations and actual producer consumers; obsolete local CLI declaration patch is unnecessary for this proposed surface |

These results establish mechanisms and bounded contracts. They do not claim all
63 proposed product modules are implemented, every native provider is accepted,
the complete original frozen tournament passed, or hosted Apple/AWS/Action
deployment is qualified. Every original obligation retains its exact status and
execution wave in qualification. The production source ceiling is unchanged.

## The two concrete maintainer choices

**Topology:** T1 has one public package and the smallest package/archive overhead.
T2 separates core from one aggregate provider package. T3 has the best selective
provider installation and explicit vertical ownership, with more manifests and
release-coordination states. Selective JS bundles were equal; package count
alone does not identify a winner. Exact dependencies permit duplicate installed
core versions under skew; they do not make publication atomic. The proposed
shared cohort requires a preflight and kernel-first sequence, retaining partial
prefixes as real failure states. [Full comparison](topology.md).

**Marginal policy:** the second endpoint needs **zero code**, which contradicts
the old requirement for nine nonzero observations. Real source-plus-metadata
medians are **43 / 43 / 44** for T1/T2/T3; nearest-rank p90/max is **77**. The
proposed correction admits real configuration-only zeroes and raises the median
ceiling from 40 to 45, retaining p90 100, maximum 200 and the full-product ceiling
11,485. Retaining the old rule means no qualifying candidate; it requires further
structural experiments, not relabeling these results as passes.

The full expected source forecast is about **11,450**, with a wide
**8,200–16,000** range and very little headroom. Including all package metadata
puts every conservative combined estimate above 11,485. No source-cap waiver is
proposed. Complete native implementations and ordinary formatting must prove the
actual reduction during the prescribed waves.

## Reproduction and tooling retirement

Use Bun and the installed pinned dependencies. The compact integrity check is:

```sh
bun tools/architecture-lab/verify.mjs
```

`--execute` additionally runs direct census/projection/declaration/test commands;
`--seal` explicitly refreshes reviewed evidence hashes. It does not issue a
readiness certificate or turn a missing external witness green. Some direct
fixtures need local socket/subprocess permission. Full packed reproduction and
the native/producer commands are in [the lab README](../../../../tools/architecture-lab/README.md).
Retained gzip evidence reconstructs exact records and verifies compressed and
expanded hashes; independent peer/process/native assertions remain available.

The former 27,046-line research source framework and its 12,388 test lines are
retired as the active selection authority. Their inputs, provenance and useful
counterexamples remain. The replacement is direct experiments, compiler/native
oracles, a deterministic projection and a small checksum/command verifier. It
does not reconstruct the broken Pending-only readiness state machine. Physical
deletion of old production/tooling belongs to the authorized future refactor,
with exact successors and preserved evidence identified in the migration waves.
The [tooling census](tooling-retirement.json) separates the smaller replacement
tooling from its actual prototypes and independent tests; no physical deletion
or achieved total-maintenance reduction is claimed during this research task.

After the maintainer choices, record them in design, regenerate/recheck, and
begin W01 from the specified clean PR21-descended line. The executor follows the
exact wave/outcome/deletion maps; live mutation and publication require their
separate concrete acceptance/deployment task and authorization.
