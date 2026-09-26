# ts-release engineering audit and revised plan

> Historical engineering research snapshot, captured on 2026-09-26 before the current implementation milestone. Baseline findings, counts and proposed work describe that captured state; they are not current completion claims. See [current implementation status](implementation-status.md) for the bounded milestone, actual verification and remaining work. These are task research documents, excluded from published packages.

The previous review was too narrow. Three useful lifecycle/composition fixes and
a passing behavioral suite did not establish adoption of the other repositories'
engineering standards. Their requirements live in a connected system of
CONTRIBUTING/AGENTS guidance, inherited/local skills, compiler/lint configuration,
architecture rules, package boundaries and source-bound acceptance. That system
is the subject of this audit.

## Read the result

1. [Requirements](requirements.md): 36 proposed ts-release requirements, with
   peer provenance and explicit adoption/exception decisions.
2. [ts-release gap audit](ts-release-gap-audit.md): concrete findings, capability
   ownership, type boundaries, existing strengths and limits of the earlier patch.
3. [Refactor plan](refactor-plan.md): W0–W7, ownership, files, dependencies,
   compatibility constraints and observable exit criteria.
4. [Incident-to-plan mapping](incident-to-plan.md): every direct adopter finding,
   upstream corroboration and adjacent custom-publisher lesson mapped to current
   disposition and appropriate proof. Fixed historical bugs are not counted as
   newly open work.
5. Source requirements: [Browserbase](browserbase-standards.md) and
   [Reactor](reactor-standards.md), with machine-readable source ledgers beside
   them. [ts-release inventory](ts-release-inventory.json) records source hashes,
   AST candidates, imports and capability decisions.

All 36 Browserbase and 50 Reactor clauses map explicitly to the 36 synthesized
requirements. A separate integration review strengthened the plan's import-purity,
per-project rule, packaged-example, cleanup-failure and shared-build obligations.

## Principal corrections to the earlier approach

| Earlier assumption or omission | Evidence from this audit | Consequence for the plan |
| --- | --- | --- |
| Adding Effect.fn, scopes and one composable runner amounts to adopting standards. | Both peers enforce diagnostic/lint/compiler and dependency rules beyond those changes. | Establish and enforce a contributor contract before calling the migration complete; W1/W2. |
| Existing notes already provide the standards entrypoint. | No ts-release CONTRIBUTING exists. The prior local AGENTS file is ignored by `.gitignore:11` and absent from tracked source. | Ship a deliberate tracked agent/contributor guide; do not rely on local ignored instructions. |
| A strict TypeScript pass is enough for Effect code quality. | No Effect diagnostic or type-aware lint gate exists in the audited ts-release baseline; peer rules are blocking and tool patch state matters. | Qualify tools and actual rule execution, classify/fix diagnostics, retain narrow exceptions; W1. |
| Existing import checks prove the intended architecture. | The checker globally ignores computed imports, does not enforce internal policy direction or reject runtime cycles, and tests are outside its source graph. | Extend the existing checker and per-host compiler closures; do not create a parallel architecture framework. |
| The new runner solves failure-versus-defect handling. | Shared `attempt` still maps an unexpected TypeError to ReleaseError; shared `matches` turns it into false. Both were reproduced directly. | Audit and repair shared decoder/error boundaries by vertical slice, retaining privacy exceptions; W3. |
| Schema-backed durable values mean external parsing is consistently schema-first. | Known remote object handling still includes manual shape discovery; assertion and unknown boundaries need owners. | Decode structured data where meaning is owned; preserve necessary canonical/lexical parsing and mutable input capture. |
| More tests establish better adoption. | Both peer guidance chains prioritize test necessity, real workflow evidence and failure-first isolation. Prior additions include fs module interception and wall-clock sleeps needing review. | Review each proof obligation before retaining/adding machinery. Existing expensive failure protection is not deleted mechanically; W0/W2/W5. |
| Published peer main is the only relevant normative source. | Reactor's local AGENTS, architecture/testing skills and modified CONTRIBUTING carry additional current instructions and differ from main. | Record local hashes/snapshots separately from commit permalinks and distinguish proposed policy from actual implementation. |
| Native adapters should all be retained or all be replaced by platform services. | Peers prefer existing capabilities but preserve real native/framework boundaries. ts-release has exact-wire/no-replay/process and Action-instance constraints. | Evaluate each capability and required behavior. Keep justified exceptions; no blanket wrapper or runtime replacement. |
| The incident backlog should become a larger regression matrix. | Historical failures overlap, several fixes already shipped, and current public APIs already support part of the proposed adoption path. | Map each finding to an existing owner and strongest proof; product increments target surviving friction, not duplicated features. |

## Scope and reproducibility

Remote main was rechecked during the research pass on 2026-09-26:

| Repository | Published main read | Additional local authority |
| --- | --- | --- |
| ts-release | `fa50ce368c50e9a28a2e57f667d454374e7b209c`, 0.4.2 | Prior three-component patch in `.effect-pattern-refactor`; original architecture-program index preserved. |
| effect-agent-browserbase | `7e93054494ee491dbf2a1f66a083d99da846fd3e` | Clean local `1f9efc74135434f4f54a390c11f88a4ec9a42bcf`; source ledger distinguishes changed implementation from unchanged normative docs. Pinned upstream guidance is part of its instruction chain. |
| reactor-effect-client | `f821a9084cf51e9aac591388db0788cb90501bf0` | Local `b7e7448ae40af80b80258e1b638bf0277bdd1c65` plus uncommitted/untracked instructions/config. Local installed Effect rc.115 differs from main's rc.117 policy. |

The ts-release inventory enumerates all **95 production TypeScript files** in
the seven package source trees and Action/self-release applications, totaling
12,959 newline-counted lines at the captured state. It finds **41 service-like
declarations**, **58 non-const assertions**, **114 non-null assertions**, three
custom type predicates and two computed imports. No explicit `any` keyword was found. The historical static relative-import
graph reported no cycle, but excluded inline type-only specifier edges that
remain runtime imports; see the method correction in the JSON inventory.
These are review candidates and scope measurements, not a bug count or a proof
that all dynamic behavior is safe. The JSON describes its method and limits;
the gap report supplies semantic findings and keep decisions.

Generated `dist`, inactive historical/research/prototype material and vendored
code are not active production inputs. Tooling, CI and tests were reviewed as
separate policy domains. The census of 46 repositories and the historical
release logs are carried forward from the [adopter audit](../adoption-audit/README.md),
not represented as newly fetched or rerun here.

## Direct checks and evidence limits

- Read the installed ts-release rc.115 `effect/AGENTS.md` in full and relevant
  layer, error and runtime examples. The peer reports record their complete
  instruction chains and configuration/implementation cross-checks.
- Ran a small source probe of `attempt(() => { throw new TypeError(...) })`:
  the Exit contained a typed failure and no defect. `makeDataBoundary(...).matches`
  returned false for the same kind of unexpected exception. This confirms a
  semantic mismatch with the proposed error policy; it does not assert an
  observed failed customer release.
- Browserbase's existing lint-policy checks passed (6/6) under its pinned Node;
  Reactor's patched compiler identity and existing architecture check were
  verified. These establish those specific mechanisms, not full peer acceptance.
- The earlier ts-release 356-test/build/packed acceptance is historical evidence
  for the retained patch. It is **not** a new pass under the proposed strict
  diagnostics, host closures or test-value policy. No new product test suite,
  dependency installation/upgrade or production implementation was added here.
- At the research snapshot, the TypeScript/tsgo/Oxlint migration had not been qualified on ts-release. Later toolchain qualification is recorded in [current implementation status](implementation-status.md).
  [Upstream tsgo](https://github.com/Effect-TS/tsgo#supported-package-versions)
  documents version-specific support and several diagnostic integration modes;
  the plan deliberately requires one tested tuple and one diagnostic authority.
- Original staged architecture work remains untouched. The 12 previously
  modified tracked files in the isolated checkout matched the pre-research
  patch byte for byte after the checkpoint operation.
- Final document checks resolved 173 local links, parsed all three JSON ledgers,
  verified all 95 production-file hashes, and checked all 41 capability mappings
  and 619 unique boundary occurrence identities. The 86 peer clauses are covered
  by the requirement matrix. These are audit-integrity checks, not runtime tests.

The reports explicitly distinguish normative requirements, enforced checks,
implementation departures, reproduced behavior, candidate hotspots and unrun
acceptance. Current source review is not a substitute for future migration
qualification or a public release.

## Research-stage recommendation

At the end of the research pass, the recommendation was to start W0/W1: review the earlier patch against these requirements, establish
tracked contributor/agent guidance and qualify the stricter toolchain on the
current runtime. Then enforce package/runtime boundaries before broader code
cleanup. The most consequential behavior work is the shared error/data boundary,
followed by ownership/runtime consistency—not mechanical conversion of all
functions or a wholesale rewrite of the journal.

Observation policy and repaired-executor recovery remain the leading adopter
product improvements. They have their own W6 acceptance criteria and must not be
claimed complete by a standards migration.

## Remote checkpoint

The user separately approved uploading the earlier incomplete checkpoint:
[`ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f`](https://github.com/mannyc2/ts-release/commit/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f)
on `codex/effect-patterns-refactor`. Its exact remote SHA was verified. It contains
the previous refactor/reports and the initial requirements draft, with an explicit
`CHECKPOINT.md`; it is not an approved standards implementation. Later research
documents were then local. This directory now preserves that research alongside the later implementation milestone; [current implementation status](implementation-status.md) owns its qualification and remaining work.

## Current decisions and remaining implementation

The [requirement status ledger](requirements-status.md) maps R01–R36 to current
evidence and specific remaining owners. Use it with the implementation record;
the historical gap inventory above is not a current completion report.

- [Provider error-policy prerequisites](provider-error-policy-prerequisites.md)
  inventories native/parser and successful-fallback owners before tightening the
  shared provider helpers, with existing codes and proof gaps.
- [Native lifetime prerequisites](native-lifetime-prerequisites.md) traces the
  actual application file and Sigstore/TUF work that interruption currently
  detaches, and defines bounded repairs and necessary proof without claiming a
  reproduced leak.
- [Core/host test retention](test-retention-core.md) and
  [provider/artifact test retention](test-retention-providers.md) review all 58
  current test-file bodies, identify actual stronger proof, and state unread
  supporting-fixture and host limits. They support selective consolidation,
  not removal based on test counts.

Registry visibility, repaired-executor recovery and whole-release request
preflight remain the leading adopter product increments. Their motivating
incidents and acceptance criteria remain in [the incident mapping](incident-to-plan.md).
