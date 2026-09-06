# Review of the refactoring conversations and correction of Plans 236–239

Archived correction checkpoint. Its open-status statements describe the earlier
review, not the completed experiments linked from [the handoff](README.md).

Reviewed 2026-09-05 at ts-release
`9b14c6c14aec5c5a41b2cb0f98d6f1c63bca4d3d`.

The previous review was useful at finding code and experimental defects, but
insufficient at reconciling the user's research history. It did not justify the
definitive “no packages/” answer or the “design handoff complete” status.
Those conclusions are withdrawn. Plans 236–239 remain candidate designs;
production refactoring prerequisites are incomplete.

## What was reviewed

The review read the substantive user messages and assistant final responses
from the complete locally available transcripts of four recent tasks, plus
the relevant architecture-selection commentary. Task tooling identified the
tasks; local transcripts supplied original user messages omitted by the task
reader. Assistant status reports below are historical reports, not fresh test
results and not additional user instructions.

| Task | Relevant sequence and status |
| --- | --- |
| [Audit Plan 003 archive safety](codex://threads/01a0526e-f2c5-7503-b575-e4376c1d78d3) | August 30: user questioned whether research and the ambitious architecture had actually been implemented. The assistant first recommended stabilization, then acknowledged 19/69 closed outcomes, a shadow effect-build seam, split machine ownership and lost marginal-cost discipline. Later preservation/selection planning superseded the stabilization recommendation. |
| [Assess perfect-codebase refactor](codex://threads/01a052c8-d854-7703-b17b-117e268dad72) | August 30–31: user asked about `packages/`, requested examination of the extensive research and named PR21. The assistant corrected its initial dismissal, proposed preserve → architecture freeze → hard cut → integrate → accept → certify, and the user approved that program. The final checkpoint expressly left machine and topology unselected. |
| [Define v2 measurement contract](codex://threads/01a059f0-d73d-75a3-b041-3dbc0f6f83e8) | August 31–September 1: user continued the checkpoint with executable fixtures, externally bound receipts and a candidate-neutral runner as the next work. Final checkpoint `da9b448` reported 257 tests passing, but all five candidates, 160 measurements and six blockers remained pending/open. Apparatus verification was not architecture selection. |
| [Continue architecture program](codex://threads/01a05f55-9082-7d02-ab79-f3cea12aef3c) | September 1–2: user requested continuation and completion. The assistant initially treated M2/T3 as selected, then identified that as premature and demoted them to hypotheses. Trial work stopped on usage exhaustion before qualifying receipts or a final selection. |

Also reviewed: the exported July 22 greenfield brief; advisor Plan 005's target
laws, package trials, surface/migration definitions and freeze conditions;
the current T3 hypothesis; the PR21 scorecard, cross-repository delivery and
provider-loading research; the ownership decisions and six blockers; and the
new packet's inventory, proposed API, Apple design and sequencing.

This is a conversation/decision reconciliation, not a fresh execution of every
historical probe, a rerun of external acceptance, or a complete reread of every
file in the older research corpus. The checks from the earlier audit remain
recorded separately in [audit-evidence.md](audit-evidence.md).

## Original requests that change the assessment

In **Assess perfect-codebase refactor**, the user had already asked:

> Didn't the perfect version plan to have a monorepo workspace with packages/ ?

Then:

> Can you explore the research? Do you know what I mean by research? We did extensive research on ts-release stuff.

These occur at lines 285 and 365 of the
[August 30 transcript](/home/cjpher/.codex/sessions/2026/08/30/rollout-2026-08-30T13-08-09-01a052c8-d854-7703-b17b-117e268dad72.jsonl:285).
The assistant subsequently acknowledged that absence of a historical
`packages/*` tree did not establish the right future topology. Its August 30
18:44 response proposed three topology trials and a generated exact contract;
the user's 18:59 response was “I approve.” This is stronger evidence of intent
than assuming a root package because the repository currently has one.

The next task's user request explicitly carried forward “Did not select
`packages/*`, M1/M2, or T1–T3 prematurely” and named the candidate-neutral
runner as the next checkpoint. See
[the August 31 request](/home/cjpher/.codex/sessions/2026/08/31/rollout-2026-08-31T22-29-11-01a059f0-d73d-75a3-b041-3dbc0f6f83e8.jsonl:9).
“Hard-cut v2” in that task referred to the measurement contract. The separate
September 5 answer, “No known consumers; plan a hard cut,” resolves the
compatibility planning assumption. Neither phrase supplies comparative
architecture evidence.

The latest linked task had already corrected a premature T3 selection:

> OD10 preselects T3 before T1/T2/T3 have run

It retained the topology rationale and M2 table as hypotheses, then confirmed
the preselection was removed. See
[September 2 correction](/home/cjpher/.codex/sessions/2026/09/01/rollout-2026-09-01T23-37-18-01a05f55-9082-7d02-ab79-f3cea12aef3c.jsonl:483).
Selecting T1 by narrative after rejecting those prototypes repeats the same
error in the opposite direction.

The [original greenfield brief](codex://threads/01a052c8-d854-7703-b17b-117e268dad72)
asks for fewer concepts, strong invariants, less duplicated state, a machine a
maintainer can explain, and roughly half the source without losing the intended
product. It does not equate quality with either fewer packages or a larger
verification framework. PR21 later narrows the active product to 69 selected
outcomes; the earlier full-parity wording does not revive deferred scope.

## Where the new packet fell short

### 1. Package choice used an incomplete criterion

Plan 236 chose one package because independent publication needs were not
demonstrated. The [T3 hypothesis](../topology-contract.md)
expressly uses a shared version train. Its reasons include neutral-core
dependency boundaries, selective provider composition, external/first-party
symmetry, generated surfaces and lower change cost. Those are relevant even
without independent releases.

The alternatives remain:

| Candidate | Question to establish through actual consumers and changes |
| --- | --- |
| T1: root package plus subpaths | Can one distribution preserve neutral imports, isolated optional dependencies and open extension with less maintained configuration and state? |
| T2: kernel plus aggregate providers | Does separating the kernel remove meaningful dependency coupling while aggregation reduces package-set overhead? |
| T3: kernel plus provider packages | Does each vertical's physical boundary improve selective installation, ownership and extension enough to justify extra manifests, dependency coordinates and publication failure states? |

Use the same real machine/provider slice and compiler inputs. Measure exact
runtime/declaration/manifest graphs, clean installs, selective bundles, dynamic
CLI loading, real extension patches, version skew and partial publication.
A shared version policy does not make registry publication transactionally
atomic. Neither T1 nor T3 has won these questions. `packages/` remains a serious
candidate, not an optional later concession.

### 2. Invalid experiments were treated as permission to skip the proof

The prior audit found real defects: candidate states not derived from history,
handwritten packed code diverging from source, unintegrated marginal probes,
self-described metrics, seven failing architecture tests and a broken readiness
path. These findings invalidate those results as architecture proof.

They do not prove that independent behavioral comparison, exact packed
consumers or marginal-cost measurement are unnecessary. The correct repair may
be much smaller than the existing tool. Compare repair and replacement costs,
retain useful fixtures and make each result traceable to real behavior. Do not
select a replacement merely from the existing tool's size. Also do not retain
every old abstraction solely because it has a test.

### 3. Inventory completeness was confused with a complete target contract

The 93 current-source rows, six old public-entry inventories and 69 scope rows
are useful coverage artifacts. They do not provide the exact proposed
signatures, export conditions, dependency/peer policy, emitted declarations,
or consumer ergonomics required by the architecture freeze.

The migration inventory lacks unavoidable replacement estimates, relocation
charges, net deletion and per-row law/trace/deletion gates across the admitted
PR21/PR22/overlay evidence. A stated ≤11,485 target is not a credible full-scope
forecast. Moving that feasibility work into implementation repeats the earlier
architecture-before-evidence failure. Current HEAD is a useful audit coordinate
and descends from PR21, not PR22; it still needs a classified delta and explicit
target ancestry rather than becoming authority by recency.

### 4. New machine and Apple choices were presented too firmly

The pure history/facts/decision/interpreter separation preserves strong
research laws. It is not a tested selection simply because both older
prototypes are inadequate.

`PlanDerived`, the frozen Apple publication recipe, two immutable plans under
one journal, and the exact descendant-supersession rules are new design work.
The pre-notary/post-staple byte-identity problem is real, but this solution must
be reconciled with K02's persisted-plan contract, exact-plan authorization,
restart without mutable configuration and native acceptance semantics. Test
whether the added vocabulary reduces the total required state and workflow
cost. Do not claim a seventh event family is already researched and selected.
P10-04 also requires explicit Gatekeeper assessment before final adoption;
stapling alone does not satisfy it.

### 5. Important consumer and host seams remained underspecified

[D06-01](../../research/launch-scorecard.md:121) requires loading
a provider unknown when both core and CLI were built. A packed library example
does not fully prove that. The target needs an exact user-application module
entry/loading/resolution contract, then a packed CLI built before the external
provider that runs and resumes through that application without core/CLI edits.

The Git-ref Action default and 1 MiB event limit were selected engineering
choices, not completed OD03/OB01 and OB05 evidence. Keep them as candidates
pending the specific deployment and record-size tests. Separate Action-default
qualification from the release-readiness host's S3/WORM requirements; do not
discard the latter by changing the former's name.

If one release gathers native outputs from multiple hosts, state which host
authenticates producer provenance, detects overlapping/missing logical outputs
and creates the final immutable bundle. Historical Plan 235 supplies useful
questions, not an obligation to restore its obsolete partial schemas or generic
partition machinery. This is a conditional integration seam requiring an
explicit disposition, not newly added product scope.

### 6. The replacement authority existed only in ignored local files

All new files live in `plans/`, ignored at `.gitignore:10`. The tracked advisor
index still names Plan 005 as the architecture gate. Our new index claimed to
supersede it without producing a discoverable replacement in a fresh checkout.
Disclosure of ignored files did not solve that handoff defect. The corrected
packet now makes no such authority claim. Before an executable handoff, put the
accepted contract and entry point in one durable, tracked location; archiving
the useful local proposal is separate from selecting its design.

## What remains useful

- All 69 selected outcomes and the evidence-level distinction remain intact.
- The code counterexamples and exact current-source measurements remain valid
  within the audit's recorded scope. Passing current tests does not certify the
  proposed rewrite.
- Core-derived identities, strict immutable adoption, durable uncertainty,
  one journal, CAS-created dispatch authority, late-fact preservation and
  provider-native evidence remain the architectural foundation.
- The actual rc.108 API/source checks and file/tree adoption findings are
  useful. Opaque Apple submission cannot pretend to expose its internal ZIP
  digest before the operation begins.
- The user's hard-cut answer removes the need to design compatibility aliases
  or dual readers for unidentified consumers. It does not relax product scope,
  source economics or consumer-boundary proof.
- Keeping live publication as a separately authorized action remains correct.
  Local design proof, hosted deployment qualification and live product
  certification have different claims and must remain distinguishable.

## Finite prerequisites before an executable implementation handoff

Reuse the existing research IDs and fixtures. Do not create another general
framework or restart the product/protocol literature search wholesale.

1. **Reconcile obligations.** Carry the 226 propositions, nine ownership
   decisions, six blockers, 69 selected outcomes and existing dispositions into
   one reviewable map: retained evidence, missing experiment, superseded detail
   with reason, or later acceptance. No required behavior may disappear when
   a tool or old schema is retired. This note identifies material gaps; it does
   not claim that full row-level reconciliation is already done.
2. **Prove the machine on real state.** Repair or replace the minimal evaluator
   and use durable histories, separate processes, actual CAS and transport
   observations for the 16 shared cases. Candidate differences must represent
   real state/decision models. Resolve the Apple immutable-boundary model with
   concrete restart and authorization evidence.
3. **Compare physical layouts.** Pack the same qualifying slice as T1/T2/T3;
   include two first-party verticals, two instances, a later-built external
   provider, Node/Bun, CLI, Action and real effect-build file/tree adoption.
   Execute the nine meaningful marginal changes through the affected consumers.
   Require the same predeclared invariants, no fabricated metrics or tiny
   unimported additions. Report a tradeoff if there is no dominating candidate.
4. **Freeze the usable target.** Establish exact API/signatures/import graph,
   deployment decisions at their applicable evidence level, baseline/durable
   dispositions and replacement/relocation arithmetic. Derive a full-scope
   source forecast from the slice and remaining provider/host mechanisms. Keep
   the 50% forcing target; report concrete infeasibility instead of widening it.
5. **Produce one durable handoff.** Generate or validate one exact architecture,
   surface, migration, wave and gate contract in a tracked location. Reconcile
   the executable queue there. Revise or discard the 236–239 drafts around that
   result; a future executor must not choose unresolved architecture while
   supposedly following a completed prerequisite plan.

These are prerequisite outputs, not achieved results. Current work corrected
the record and completed this conversation review; it did not complete the
remaining architecture program.

## Changes and verification from this review

Plans 236–239 and their index now say DRAFT/research open; root topology,
machine retirement, Action default, journal bound and Apple derivation are
explicitly provisional. Supersession and research-complete claims are withdrawn.
The evidence record retains observed results while correcting the inference
that broken experiments justify bypassing comparative proof.

Only local planning/research documents changed. No production source,
dependencies, Git history, protected research checkout or remote state changed.
Packet consistency and document-link checks are the appropriate verification
for these corrections; no product test result is represented as new evidence
for the proposed design.
