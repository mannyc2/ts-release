# Research evidence and limits

Archived earlier audit results; see [the handoff](README.md) for subsequent
experiments and their narrower or stronger claims.

**Review correction:** the checks and counterexamples below remain useful,
but they do not establish architecture selection or prerequisite completion.
The [conversation reconciliation](research-lineage.md) withdraws the earlier
root-package, supersession and implementation-readiness conclusions. Plans
236–239 are drafts. No production test result below is a result for that design.

Date: 2026-09-05. Repository: `/mnt/models/dev/ts-release`.
Inspected HEAD: `9b14c6c14aec5c5a41b2cb0f98d6f1c63bca4d3d`, branch
`codex/architecture-program`. Linked task: **Continue architecture program**,
`01a05f55-9082-7d02-ab79-f3cea12aef3c`; its latest execution failed after usage
exhaustion during trial work. Its opening checkpoint `da9b448` is older than
current HEAD and is not this session's verification result.

Only plan/research artifacts under `plans/` were written. The existing
`.gitignore:10` ignores that directory, so these local handoff files do not
appear in ordinary Git diffs/status and were not staged or committed. Product files,
dependencies, `.repos/effect`, `.effect-build-hard-cut/` and
`.effect-build-landing/` were preserved. No publish/deploy operation ran.
User decision: **No known consumers; plan a hard cut.**

## Checks actually run

| Command / inspection | Observed result | What it establishes |
| --- | --- | --- |
| `bun run check` | exit 0 | Current root TypeScript source graph compiles |
| `bun run --cwd tools/architecture-program check` | exit 0 | Tool source graph compiles |
| `bun run check:versions` | exit 0, 19 sites | Current version checker passes |
| `bun run check:architecture-inputs` | exit 0: 12 anchors, 226 propositions, 219 traceability anchors, 9 ownership decisions, 6 blockers, 5 baselines, 5 pending candidates, 16 cases, 9 probes | Frozen inputs are internally valid, not complete |
| `bun run --cwd tools/architecture-program test` | exit 1: 296 pass, 7 fail, 303 tests; 31 passing files/one failing file | Current architecture suite is red |
| `bun run tools/architecture-program/src/check-program.ts` | exit 1: Schema validation failure at `freeze-readiness.ts:179` | Public checker does not reach its blocked report |
| Targeted five-file product suite (command below) | 51 pass, zero fail, 364 assertions | Current provider/coordinator characterization baseline only |
| Both machine candidate test files (independent agent) | 6 pass, 97 assertions | Candidate tests pass despite the counterexamples below |
| Direct M1/M2 counterexamples (root repeated) | Superseded→authorized→started folds to InFlight; Idle+Dispatch transitions to InFlight | Candidate models do not establish dispatch/supersession laws |
| Source AST export inventory via installed TypeScript | Six public entries, 108 runtime export entries, 151 declaration entries | Per-entry source inventory; duplicated names across entries are counted; not emitted-pack certification |

```sh
bun test test/publication/release-coordinator.test.ts test/publication/recovery-coordinator.test.ts test/publication/provider-sdk.test.ts test/protocol/npm/npm-provider-protocol.test.ts test/protocol/pypi/pypi-provider-protocol.test.ts
```

Runtime observations: Bun `1.3.14`, Node `v22.22.0`. The latter is below the
current manifest's admitted 22.22.2 minimum. No clean Node consumer or hosted
Action proof is claimed. Root `bun.lock` SHA-256 was
`faa938b0749fab11056df4a44dfbe497f149437207683cec591fbdab90c98297`.
CI still expects the obsolete PR21 hash `5640ae3d…` at
`.github/workflows/ci.yml:39`; hosted CI was not rerun here.

Architecture test failures are all in
`tools/architecture-program/test/trial-topology-gate.test.ts`: candidate
acceptance; undeclared import edge; version drift; dynamic packed gates; packed
byte guard; evaluator acceptance; CLI gate evidence. The observed common static
rejections include package manifest/set, generated surface/path, Action export
and CLI bin. The version-mutation case also throws NonCanonicalDocumentError.
This task did not patch these architecture tests or mark them accepted.

## Vetted findings and causal diagnosis

| Finding | Evidence | Cause → consequence → resolution | Effort / risk / confidence |
| --- | --- | --- | --- |
| F01: Prototype outcomes do not derive from durable history | M1 `src/machine.ts:80,148,214`; M2 `src/interpreter.ts:34,111`; `src/transition-table.ts:52` | Scripted action/state peers → false fresh-runner proof → one history fold and real separate-process tests | L / HIGH / HIGH |
| F02: Freeze completion is not representable | tool `schema/baseline.ts:310,333,341`; `schema/ownership-decisions.ts:676`; `freeze-readiness.ts:179,185` | Pending-only canon and fixed blockers → no reachable ready state, invalid OB IDs at entry → finite research packet and separate implementation acceptance | M–L / MED / HIGH |
| F03: Packed and source tests use different code | T3 `apps/consumers.ts:22`, `apps/dist/index.mjs:11`, `packages/kernel/dist/index.mjs:1`; tool `trial-topology-gate.ts:918` | Handwritten parallel dist plus noEmit “build” → delivery cannot prove machine behavior → build exact source then pack it | M / MED / HIGH |
| F04: Marginal probes are unintegrated snippets | T3 `trial-adapter.ts:8,23,25`; tool `trial-probe-evaluator.ts:67` | Patch/metadata treated as capability → unjustified low change costs → before-fails/after-passes real consumer behavior | M per probe / LOW / HIGH |
| F05: Labels/formatting masquerade as semantic metrics | tool `trial-objective-evaluator.ts:149,221,231`; T3 kernel dense source | Candidate-authored arrays/owner labels → hashes certify labels, not state-space reduction → explicit invariant proof and real integrated patch measurement | M / LOW / HIGH |
| F06: Provider composition remains closed | `src/publication/provider.ts:63,67`; `src/release/prepared.ts:177`; `src/publication/coordinator.ts:85,154` | Durable closed union + mandatory observer/profile → external extension needs core schema edits → versioned open intent envelope and ordinary provider composition | L / HIGH / HIGH |
| F07: Terminal claim precedes credentials | `src/publication/coordinator.ts:445,459`; `src/publication/claim.ts:30` | Separate irreversible claim authority → credential denial can consume an unsent coordinate → preflight then DispatchStarted CAS, no claim peer | L / HIGH / HIGH |
| F08: Adoption descriptor is not ownership transfer | PR24 Artifact.ts:327; Author/File.ts:125; Author/Tree.ts:503 | Mutable borrowed access treated as final content → lost modes/digests/lifetime guarantees → verified scoped read then owned copy/hash | M / MED / HIGH |
| F09: Apple changes final bytes after external work | research `artifact-storage.md:119`; PR24 Staple.ts:173,226 | One pre/post bundle would be mutable or need future identity → two immutable plans, frozen recipe and one conditional PlanDerived link | L / HIGH / HIGH problem; new design awaits tests |

F04 effort M per meaningful probe, risk LOW, confidence HIGH. It is a test
validity issue rather than a production runtime defect.
F07 is an availability cost of the deliberately conservative legacy claim
design, not evidence that the current code blindly duplicates publication.

The seven tested failures and the counterexamples invalidate current proof
claims. They do not decide whether repairing the evaluator or replacing it
with a smaller one is the better route. A correct hash binding answers which
bytes ran; it does not prove that those bytes implement the named guarantee.

## Measurements

Tracked `.ts/.tsx/.js/.mjs/.cjs`; raw newline records plus final unterminated
line. No formatter/minifier was run. Comments/blanks remain charged.

| Lane | Files | Physical lines |
| --- | ---: | ---: |
| Product `src` | 78 | 16,161 |
| Product `apps/*/src` | 15 | 2,091 |
| Current product sum | 93 | 18,252 |
| Architecture tool source | 55 | 27,046 |
| Architecture tool tests | 32 | 12,388 |
| Prototype code including its tracked runtime files | 74 | 3,910 |
| Root tests | 90 | 17,599 |
| Root scripts | 37 | 5,849 |
| Research probe code under docs | 24 | 2,500 |

Tool source alone is 1.48 times the measured current product source. This is
not a reason to remove a safety check; it is a reason to question the cost of a
general-purpose selection apparatus whose proof subjects are simplified.

Topology product-source lanes independently counted from manifests:

| Candidate | Lines | Bytes |
| --- | ---: | ---: |
| T1 | 270 | 20,052 |
| T2 | 131 | 19,077 |
| T3 | 126 | 19,582 |

T3 appears 53.3% smaller than T1 in raw lines but only 2.3% smaller in bytes.
Dense single-line functions invalidate the intended readability/compression
comparison. These numbers do not establish package selection.

Preserved overlay `2ef7a9a61fe40608d053569cbcd71e40fca5c181` has 22,560
root +356 Action code lines +55 generated product-input lines =22,971.
Its fold/decision/application comparison slice is 2,114. Those exact historical
numbers come from checked baseline input, not the changed current tree.
Historical Plan184's smaller product had different scope and counting policy.
No achieved rewrite reduction is claimed; replacement source does not exist.

## Draft behavioral coverage for the 16 research cases

The plan assignments below preserve future coverage, not prerequisite closure.
Qualifying research slices must exercise the architectural cases before
selection; hosted/native certification remains a separately scoped gate.

| Existing case | Required actual evidence | Owning plan |
| --- | --- | --- |
| C01 success | Actual request/receipt through interpreter; native acceptance retained | 237 |
| C02 pre-commit rejection | Proved no-commit event; no inference from generic error | 237 |
| C03 loss then satisfaction | Fresh process reads journal and exact provider observation | 237 |
| C04 loss then absence | No second send, even with delayed original mutation | 237 |
| C05 protected Git replay | Real conditional ref update with frozen old/new/request facts | 237/238 |
| C06 accepted risk | Exact decision budget consumed once under competing runners | 237 |
| C07 race | Separate processes, shared store, transport-call count | 237/239 |
| C08 correspondence mismatch | Reject changed endpoint/path/query/body/principal before send | 237 |
| C09 supersession/late facts | No later dispatch win; earlier winner and late receipts remain accounted for | 237 |
| C10 ambiguous append | Exact writer read-back; AlreadyRecorded grants no new permit | 237 |
| C11 invalid provider graph | Full duplicate/missing/cycle rejection before any effect | 237 |
| C12 external/two instances | Independently packed provider after core build, fresh application process | 237 |
| C13 Apple pre-ID loss | Native opaque operation stays inconclusive without exact correlation | 238/239 |
| C14 file/tree adoption | Real upstream verified values, owned copy, modes/links/digests and mutation rejection | 238 |
| C15 host ownership | Provider Layer cannot replace captured host resources in actual wiring | 237/239 |
| C16 bounds | Full encoded envelope limit-1/limit/limit+1, same writer/reader function | 237 |

Additional discriminating gates: hidden HTTP retry/redirect prevention;
credential denial before attempt; accepted receipt followed by tag drift;
real read-only operation without observation support; Apple frozen-recipe
restart without source config; one PlanDerived winner; ancestor supersession;
actual source-to-pack equivalence; complete declaration surface; native host
and consumer tests. These test missing invariants, not implementation shape.

## Primary source refresh and immutable upstream facts

The following official pages were read on 2026-09-05 to confirm the narrow
external laws underlying the redesign:

- Explicit Git `--force-with-lease=<ref>:<expect>` checks the specified old
  value; an empty expected value requires absence. This supports choosing a
  conditional transport, but deployment permissions and response loss still
  need acceptance. [Git push manual](https://git-scm.com/docs/git-push).
- npm rejects a previously used package name/version. Inference: response
  loss must not be treated as an instruction to republish blindly.
  [npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish/).
- Warehouse uploads one distribution file at a time using multipart POST.
  This supports per-file operation/partial-progress modeling. It does not
  establish every compatible index's replay law.
  [PyPI Upload API](https://docs.pypi.org/api/upload/).
- GitHub ref update exposes desired `sha` and `force`; it has no generic
  expected-old argument. Inference: do not label an arbitrary REST PATCH as
  the required general CAS primitive.
  [GitHub reference API](https://docs.github.com/en/rest/git/refs).

Local Git object inspection reproduced PR24 contract/public API hashes without
changing a checkout. Useful exact sources:
[Artifact](https://github.com/mannyc2/effect-build/blob/dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc/packages/effect-build/src/Artifact.ts),
[File verified access](https://github.com/mannyc2/effect-build/blob/dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc/packages/effect-build/src/Author/File.ts),
[Tree verified access](https://github.com/mannyc2/effect-build/blob/dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc/packages/effect-build/src/Author/Tree.ts),
[Apple Notary](https://github.com/mannyc2/effect-build/blob/dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc/packages/effect-build-apple/src/Notary.ts),
[Apple Staple](https://github.com/mannyc2/effect-build/blob/dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc/packages/effect-build-apple/src/Staple.ts).

The sibling checkout's working HEAD `fef8e10304b65b12ae71da0b35722c38edc37d80`
is stale and predates PR24; available immutable Git objects, not its current
files, supplied the contract. PR25's source/merge and test totals are attributed
to the checked terminal reconciliation memo. A live GitHub shell read failed
DNS and source-task retrieval timed out; no fresh upstream-main, registry
availability, credentialed Apple or cloud deployment claim is made.

## Alternatives considered and rejected

- Repair all tournament machinery before implementation: would still leave
  scripted semantics and copied source/dist universes; useful fixtures migrate
  to the real slice instead.
- Choose M1 or M2 from passing candidate tests: refuted by direct counterexamples;
  fold and total legal rules are complementary.
- Split every provider into its own published package now: logical ownership
  pays for itself; independent version coordinates currently lack demonstrated
  consumer/lifecycle value. Reopen only with measured concrete need.
- Drop 69-outcome scope to hit a source target: not authorized by this task.
- Force S3/WORM deployment before core work: not implied by JournalStore's law;
  upstream release infrastructure remains separately owned.
- Downgrade to beta.83 based on old research: current rc.108 source and versions
  pass. Installed official APIs are the contract; old skill examples are not.
- Treat current report/profile architecture as merely a file-layout issue:
  the extra authorities and closed durable union are the causal problem.
- Universal workflow/recipe engine for Apple: one explicit immutable Apple
  derivation is sufficient; additional transformations need their own concrete
  evidence before generalization.

## Research completion limits

This audit covers architecture, durable/recovery laws, evidence validity,
source/public inventory, producer handoff and execution sequencing. It is not
a full security review of every driver, a dependency vulnerability audit, a
fresh re-audit of every one of the 69 external protocols, a clean install/build
certification, or a live release. Existing selected protocol research is
retained with exact row citations; refresh protocol pins when implementing
their native boundary. No hypothetical credential risk was invented to delay
the authorized work.

Independent agents reviewed machine semantics, topology/evidence and producer
contracts, then reviewed the written contract. Their concrete corrections
were incorporated: distinct AlreadyRecorded, explicit transient decision input,
authorization linearization, retry/redirect limits, exact fingerprint scope,
frozen Apple recipe/registration, provider-native Accepted evidence, opaque
submitApp semantics, precise record/hash bounds, and exact candidate-only
type/build/pack gates before the simultaneous 239 public/host cutover. The new design remains
a design; its implementation tests are explicitly assigned, not reported as run.
