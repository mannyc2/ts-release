# Current hard-cut implementation contract

The active objective is the complete refactor and verified published release in
[GOAL.md](../../execution/GOAL.md). The user authorized implementation and release
on 2026-09-06. Historical research-only restrictions describe earlier tasks.
**All 69 selected outcomes and 226 propositions remain required.** W01 kernel/application,
W02 npm, W03 PyPI and W04 native transport cutovers have local evidence:
194 tests/1,761 assertions, fresh three-package Bun/npm installs and 32 Node/Bun
consumer checks, native compatible servers and independent recovery review.
All 55 assigned legacy files are retired. The cumulative 6,200 planning tripwire fails with 7,891
replacement lines; an exact-source variance permits continued implementation.
Native hosted duties, Bun Sigstore and full release certification remain open.
See [W04](../../execution/W04.md) for current evidence and limits. Nothing is published.

[design.json](design.json) is the editable architecture authority. The approved
layout is **T3c: seven public packages**: ts-release, npm, pypi, github, catalog,
openai and mcp. Catalog exposes separate Homebrew/Scoop subpaths. OpenAI owns its
own dependencies. The kernel owns the shared CLI bin; action, self-release and
ts-release-agents have explicit application ownership. `project.ts` derives
[layout.json](layout.json) and [public-surface.json](public-surface.json) from the
design and compiler-read declarations. Other layouts are historical comparisons.

The architecture is owned **Bundle → immutable Plan → one Journal → derived
Report**. M1 is the default evaluator; external evaluators receive immutable
inputs and explicit scope context. The executor independently validates history,
append legality and dispatch authority. A fresh conditional append authorizes
this invocation's send. Read-back alone grants no permission. Native uncertainty,
protected Git replay, bounded credential-free errors and safe restart remain
core laws. Multiple preparations and concurrent runners share global journal
revision authority; independent releases can use independent journals.

Preparation output selection is terminal. Later Pending/Absent observations
remain history without allowing a new submission. Satisfied receipt and observed
selection are distinct codec channels; conflicting selections reject. Caches are
derived views and cannot mint dispatch permission. No provider allowlist, plugin
discovery framework or configuration language is introduced.

Use the exact [kernel](kernel-api.d.ts), [HTTP](http-api.d.ts),
[provider](provider-api.d.ts), [host](host-api.d.ts), [Apple](apple-api.d.ts) and
[owned-artifact](adoption-api/adoption.d.ts) contracts. The kernel entry resolves the actual production compiler output in
[production-api](production-api/emission.json); its former research declaration
is retained in `research-api/kernel-api.d.ts`. npm, PyPI, shared verified artifact reads and neutral HTTP contracts now
also resolve actual production declarations, as do Git and Node/Bun hosts. Remaining provider and
adoption declarations retain their reviewed proposal owners until implemented.

The [waves](waves.json) prescribe W01–W10 and preserve every original native
oracle. [migration.json](migration.json) and [public history](public-history.md)
retain exact hard-cut dispositions. [qualification.json](qualification.json)
distinguishes current witnesses from retained historical experiments. The
[launch ledger](../../evidence/launch-evidence.json) has **69 open outcomes**;
its closure check deliberately fails until real production evidence is admitted.
Plans 009/010, hosted/native acceptance and independent candidate review remain
required. Prerequisite review is not release certification.

Fresh prerequisite evidence:

- Corrected kernel/store/Git/dependency/composition witnesses: **168 tests,
  993 assertions**; an independent reviewer found no remaining material safety
  issue in these prerequisite changes.
- A separate original-source slice with only HTTP-helper relocation reproduces
  **37/37/37 TypeScript medians**, p90 73. Metadata medians are 0, p90 19;
  real zero-code observations are retained. The target remains **40**.
  [Marginal proof](marginal-proof.json) binds the retained source archive and
  records the limit: this is not the P3 kernel or full seven-package product.
- Fresh Apple composition uses eight processes, two preparations, five Bundle
  artifacts and two actual native TAR files; one publication, zero resume sends.
  It hashes the executed machine sources directly. Apple services are protocol
  doubles; credentialed app/DMG/pkg acceptance remains open.
- Official unpatched Effect rc.108 and published effect-build/Apple 0.6.3 pass
  strict declarations and 34 real adoption checks under each Node and Bun.
  Current production honors aligned beta.107 with the exact owned Sentinel
  declaration augmentation and fresh Bun/npm strict consumer negative controls.
  Exact dependency compatibility records are retained under `../../execution/`.

The amended prerequisite kernel is **1,024 physical / 1,145 printer lines**;
external M2/cache witnesses are separate test/tooling costs. The conservative
mixed actual/future full-product forecast is **12,862**, already 1,377 above the unchanged **11,485**
ceiling against **22,971**. [forecast.json](forecast.json) records full component
costs and per-wave tripwires. Normal formatting and actual production counts
must establish the reduction; no scope cut, density trick or waiver is permitted.

Run `bun run check:architecture-program` for retained evidence integrity,
projection, ancestry and source accounting. W04 exceeds its 6,200-line
planning tripwire with 7,891 replacement lines; the complete-product ceiling is
unchanged. `bun tools/architecture-lab/verify.mjs
--execute --seal` executes direct checks and refreshes reviewed bindings; it is
not a readiness certificate. Native/socket fixtures require local socket access.
`bun run check:launch-evidence` validates the open ledger;
`bun run check:launch-closure` remains red. Full packed production/Action and
actual effect-build integration commands remain explicit wave prerequisites.

Accepted refinement and prior audit evidence are archived under
`docs/refactor/research/{composable-handoff,handoff-audit}-2026-09-06/`. They are
provenance, not competing active plans. Keep useful research evidence until
successor production checks work; research/tooling deletion does not count as
product-source reduction.
