# Plan 004 terminal reconciliation evidence

Status: read-only evidence memo; partial reconciliation only. This document
does not close Plan 005, select a production implementation coordinate, or
authorize a fetch, checkout, package change, external workflow, credential use,
infrastructure mutation, publication, tag, or release.

Observed at: 2026-09-02 UTC.

## Conclusion

The release-readiness implementation described by advisor Plan 004 now has an
immutable source head and a merged pull request:

| Role | Exact coordinate |
| --- | --- |
| PR 24 architecture baseline | `dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc` |
| Plan 004 source branch | `refs/heads/codex/v060-release-readiness` |
| Plan 004 exact branch head | `1b2ee64b2ce02cc7e816e40a3f44339d0b7fedc1` |
| Plan 004 pull request | [effect-build PR 25](https://github.com/mannyc2/effect-build/pull/25) |
| PR 25 merge commit | `3c3841c19bed45371539ab611c327850f8598eb6` |
| PR 25 merged at | `2026-09-01T03:23:51Z` |

The terminal source head and merge commit have the same generated contract and
public API bytes. Compared with the admitted PR 24 baseline, the terminal work
changes the combined contract by adding generated release-certification policy
and package-private Apple journal/submission machinery. It does **not** change
the admitted public package graph, public API projection, producer/release
ownership split, operation accounting, or Apple product topology.

This is enough to replace the obsolete claim that no implementation commit or
PR exists. It is not enough to close `OB02`, `OB03`, or `OB06`: the checked-in
advisor Plan 004 terminal table and the Plan 045 Receipt remained stale, and
the credentialed Apple, clean-host, operational journal, and cross-process
receipts still do not exist.

## Evidence method and immutable hashes

Remote refs and pull-request metadata were read without fetching into either
local effect-build research worktree. File hashes below are SHA-256 over the
raw file bytes at the named immutable Git commit.

| Coordinate | Artifact | SHA-256 |
| --- | --- | --- |
| PR 24 baseline `dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc` | `tooling/effect-build-contract.json` | `6c9422466d7e449d8d4ce7cd0fdf38cb869456993bd00bbe7eb9b685cdc11d53` |
| PR 24 baseline `dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc` | `tooling/public-api.json` | `6bbbdcb00e75cd1f104aa658f4ddfe781719016a7568c7a59006ff435f52fac3` |
| PR 25 head `1b2ee64b2ce02cc7e816e40a3f44339d0b7fedc1` | `tooling/effect-build-contract.json` | `3274c0680e3d2c031d6ccfd5aefb9d1b1235d30823e4f504571bb27cfa8d86d1` |
| PR 25 head `1b2ee64b2ce02cc7e816e40a3f44339d0b7fedc1` | `tooling/public-api.json` | `6bbbdcb00e75cd1f104aa658f4ddfe781719016a7568c7a59006ff435f52fac3` |
| PR 25 merge `3c3841c19bed45371539ab611c327850f8598eb6` | `tooling/effect-build-contract.json` | `3274c0680e3d2c031d6ccfd5aefb9d1b1235d30823e4f504571bb27cfa8d86d1` |
| PR 25 merge `3c3841c19bed45371539ab611c327850f8598eb6` | `tooling/public-api.json` | `6bbbdcb00e75cd1f104aa658f4ddfe781719016a7568c7a59006ff435f52fac3` |

The terminal implementation's supporting files are also independently
addressable:

| Artifact at PR 25 head | SHA-256 |
| --- | --- |
| `plans/045-establish-v060-release-point.md` | `fb8129e4770034074b272b4fc17b7d7ef968387fa96f67126e4f6620a6d68406` |
| `plans/046-repair-apple-native-probe-admission.md` | `ed134ecdc080ccccc724f0484ba41d9e9b5f795b8794d903686c270de333d8da` |
| `plans/047-establish-canonical-operation-journal.md` | `2a27aaf929c6ecae23b28098e03a3a38441d750f12ab3a19b63336d05dcfa4e6` |
| `packages/effect-build-apple/src/internal/NotaryJournalCodec.ts` | `6c877b90108fe97fa8ec54abe09094179791df0433cb41e5a3238fb51dad352f` |
| `packages/effect-build-apple/src/internal/NotarySubmission.ts` | `c21486720b0f43e51cbe30d401dd2d6c45ed610b7a565a8b615f102826113667` |

The local advisor inputs reviewed by this memo have these hashes:

| Local evidence | SHA-256 |
| --- | --- |
| `advisor-plans/004-establish-effect-build-release-readiness.md` | `ad84b8b021fec89fcc24aa6d285ebb0e3d39629b7aaa88f806a4f9940af16ef7` |
| `advisor-plans/005-freeze-research-complete-system-contract.md` | `f2af8b2b2a591e0e66ad18654d43a937a746b5f4dc5595e2e99cca96ab4aa965` |

## Terminal verification evidence and its limit

PR 25 records three commits ending at the exact head:

1. `5c932107421dfbf71867d4908042409f291e8e0e` — establish v0.6 release-readiness gates;
2. `79aad07397cd8f94c7e484d8625ce95f891d77f2` — make the checks portable; and
3. `1b2ee64b2ce02cc7e816e40a3f44339d0b7fedc1` — close Windows release-verification gaps.

The PR body binds the exact head to push run `33464396338` and reports 33/33
jobs passing. The observed PR check rollup is successful across Ubuntu, macOS,
and Windows verification, real Bun and Deno lanes, provider acceptance lanes,
and credential-free Apple mechanics. Plan 045 reports the pinned Bun 1.3.14
local gate as:

- generated contract tests: 13/13;
- type-test files: 16/16;
- unit tests: 160/160;
- Apple package tests: 46/46;
- architecture tests: 254/254;
- exact protected-body coordinates: 40/40;
- local native Apple acceptance: 4/4; and
- built consumer, lint, formatting, and Git diff checks passing.

These results prove the inert local and hosted implementation at the exact PR
head. They do not prove npm authority, a credentialed Apple submission,
clean-host installation, an operational journal, a release point, or
publication.

The terminal commit still contains stale handoff prose. Its Plan 045 Receipt
says the implementation is `LOCAL-UNCOMMITTED` on the PR 24 base and that no
implementation commit, push, or PR exists. The ts-release advisor Plan 004
terminal table likewise retains `PENDING` values for the task revision, status
manifests, full-index patch, untracked archive, path allowlist, final gate
totals, and terminal blockers. The later PR metadata corrects the Git state but
does not manufacture those missing signed snapshot artifacts.

## Boundary comparison

| Boundary | PR 24 admitted value | PR 25 terminal value | Classification |
| --- | --- | --- | --- |
| Contract schema/status | `effect-build/combined-contract@1`, authoritative hard cut | unchanged | preserved |
| Provider operation accounting | exact 67 | exact 67 | preserved |
| Non-operation accounting | exact 46 | exact 46 | preserved |
| Public packages | 11 | 11 | preserved |
| Public modules | 42: 11 package roots plus 31 subpaths | 42: 11 package roots plus 31 subpaths | preserved |
| Private package | reservation-only `effect-build-rolldown` | unchanged | preserved |
| Public API bytes | `6bbbdc...fac3` | `6bbbdc...fac3` | byte-identical |
| Artifact handoff | logical name, digest, immutable bytes or tree snapshot | unchanged | preserved |
| effect-build ownership | provider execution, artifact production/finalization, Apple operations | unchanged | preserved |
| ts-release ownership | release plan, durable mutation journal including Apple, continuation, publication | unchanged | preserved |
| Apple matrix | admitted product boundary | 28 coordinates: `N=2`, `P=10`, `G=6`, `A=10` | preserved and made exact |
| Apple lineage | Bun distribution lineage; Deno signed-App coverage | Bun 1.3.14 owns App/DMG/PKG; Deno 2.9.5 remains signed-App-only | preserved and made exact |
| Apple journal representation | terminal detail pending | package-private `effect-build-apple/notary-journal@1` codec | internal contract augmentation |
| Release certification | absent from the PR 24 combined contract | generated `releaseCertification` policy and receipt schemas | derived contract augmentation |

The public API hash equality is the strongest package-surface evidence: no
public package, root, subpath, or exported Apple journal module was added. The
combined contract hash changed because release certification is now generated
into the contract and because its private Apple and release-readiness policy is
more exact. Plan 005 must classify those new fields as derived certification
evidence or provider-native facts; it must not treat the changed hash as either
an unchanged contract or a new peer release history.

The private Apple implementation also makes the failure boundary concrete.
Ambiguous submission execution or an uncorrelatable provider response becomes
`SubmissionOutcomeUnknown` carrying the artifact digest and a redacted reason.
`CorrelationFailed` owns mismatched `info` or `log` submission IDs. No retry or
resubmit operation is introduced. This supports Plan 005's exact
`Inconclusive`/no-blind-resubmit branch but does not by itself prove the
downstream journal and continuation behavior.

## Current-main drift after Plan 004

The remote `main` ref observed on 2026-09-02 is
`8a6022095807bf19a2953025e94e48fd0072f31e`, the merge commit for PR 30. It
contains follow-up work from PRs 26-30 after the Plan 004 PR 25 merge. Its
generated artifacts are:

| Artifact at current main | SHA-256 |
| --- | --- |
| `tooling/effect-build-contract.json` | `9b26a9e02dd47f3137d6143bb24c5b44da2b413d78aa4a4ab00affbfc2462ed3` |
| `tooling/public-api.json` | `6bbbdcb00e75cd1f104aa658f4ddfe781719016a7568c7a59006ff435f52fac3` |

Current main still has the same 67/46 accounting, 11-package/42-module public
surface, private Rolldown disposition, release ownership boundary, 28 Apple
coordinates, and Bun/Deno product lineage. The observed contract drift includes
the immutable OIDC subject-policy activation. It does not close the external
program: Apple hosted execution remains `blocked`, external evidence
authentication remains `blocked`, and the contract still has zero admitted
external producer identities.

Therefore `8a602209...` is classified as post-Plan-004 drift, not as a silent
replacement for the exact Plan 004 source head or merge. A later consumer such
as Plan 008 must explicitly select and hash one accepted upstream coordinate
after reconciling these follow-up changes.

## Freeze-blocker disposition

### OB02 — terminal Plan 004 reconciliation

Status remains open.

Available evidence:

- exact source head `1b2ee64b...` and merge `3c3841c...`;
- exact terminal contract and unchanged public API hashes;
- exact-head hosted checks and reported local verification totals; and
- field-level evidence that the package, ownership, and Apple product boundary
  is preserved.

Still missing:

- the signed source-task revision and ownership handoff;
- the signed ordinary and ignored status manifests;
- the full-index patch and untracked-content archive hashes;
- the reviewed exact changed-path allowlist tied to those manifests;
- credentialed Apple and clean-host terminal receipts;
- an operational-journal receipt and authenticated external producer
  identities; and
- a release-readiness aggregate bound to an accepted exact source coordinate.

The commit and PR resolve the old “no immutable implementation exists” fact.
They do not satisfy `OB02`'s full required-evidence sentence.

### OB03 — operational S3 WORM and CAS deployment

Status remains open.

Plan 047 explicitly says `DESIGN COMPLETE; CROSS-REPOSITORY AND INFRASTRUCTURE
IMPLEMENTATION NOT STARTED`. It selects one provider-neutral
`CanonicalOperationJournal` in ts-release with one OIDC-scoped, versioned,
Object-Lock S3 namespace, immutable event segments, and one conditional CAS
head. It forbids Git-ref, Actions-artifact, filesystem, SQLite, user-selected,
or fallback stores.

No exact AWS account, bucket, region, role, prefix, Object Lock retention,
IAM/bucket/OIDC policy, released ts-release owner version, live two-runner CAS
race, response-loss read-back, or fresh-process replay receipt exists. Design
selection is not operational qualification.

### OB06 — terminal Apple codec and correlation

Status remains open with the effect-build-local half now evidenced.

Available evidence:

- package-private codec protocol `effect-build-apple/notary-journal@1`;
- package-private journal codec and submission implementation hashes;
- typed submission-ID correlation failures;
- ambiguous submit and uncorrelatable response mapping to
  `SubmissionOutcomeUnknown`; and
- no public API change and no retry/resubmit operation.

Still missing:

- field-by-field ingestion into the selected ts-release journal envelope;
- the exact reducer mapping from `SubmissionOutcomeUnknown` to terminal
  `Inconclusive`;
- proof that fresh-process continuation cannot issue a second submit;
- cross-process intent/receipt acknowledgment and response-loss tests; and
- the released journal owner plus credentialed Apple integration receipt.

The local contract supports the required no-blind-resubmit design. It does not
yet prove the complete cross-repository behavior.

`OB01`, `OB04`, and `OB05` are unaffected by this evidence. In particular,
the terminal contract's evidence-transport size limits are not product
authority for the journal byte limit required by `OB05`.

## Local research-worktree disposition

None of the three local research directories is the terminal Plan 004 source:

- `.effect-build-hard-cut` is a dirty npm-bootstrap worktree at
  `4ad34423d84d17c959ace0d55af8623f336a68be`, which is an ancestor of the PR
  24 baseline. Its two modified and one untracked npm-bootstrap paths are not
  Plan 004 evidence.
- `.effect-build-landing` is clean at the divergent, stale
  `ec0bceef9a3eae2c8b8853aa3f2f1b3716f6dd64` coordinate. It lacks the combined
  contract and is not the PR 25 lineage.
- `.repos/effect` is a clean, unrelated Effect research checkout at
  `bacca4141c2400effae1eabfdb36c89a459cf246`; it is not an effect-build
  release coordinate.

No reconciliation or implementation step should copy from, reset, update, or
otherwise mutate those directories.

## Safe consumption rule

Plan 005 may admit this memo as read-only evidence that the exact PR 25
implementation preserves its effect-build/package/Apple boundary. Any
machine-readable input update must retain the open blocker states, record the
new combined-contract hash rather than overwriting PR 24 history, and classify
current main separately as post-terminal drift. Final freeze and Plan 008
package integration remain stopped until their own required evidence and exact
coordinate-selection gates pass.
