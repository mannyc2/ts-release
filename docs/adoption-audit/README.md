# ts-release adopter audit — 2026-09-26

Four verified external adopters were found in the accessible repository and
local-checkout census. Each encountered multiple problems. The two September
adopters are the most relevant to the current native 0.4.x API; the June–August
adopters expose earlier compatibility and usability problems, including one
successful adoption that was subsequently removed.

The strongest improvement priorities are **registry-visibility handling,
recovery using a repaired execution host, realistic provider contract tests,
and smaller supported integration helpers**. Durable dispatch history already
proved valuable: Browserbase and Reactor recovered without sending their
already-dispatched publications again. Preserve that behavior while reducing
the investigation and custom code required to use it.

This initial adoption audit is an evidence report and improvement backlog.
The subsequent [Effect review and refactor](effect-standards-refactor.md) records
the Browserbase/Reactor architecture reviews and changes made in a separate
0.4.2 checkout. No publication, workflow rerun, remote issue/comment, consumer
edit, or credential exchange was performed.

## Repositories and findings

| Repository / detailed evidence | ts-release usage | Multiple problems found | Status at audit |
| --- | --- | --- | --- |
| [effect-agent-browserbase](effect-agent-browserbase.md) | Adopted 0.4.0 on Sep 21; isolated native library application, Git preparations/journal, ordered npm graph; now 0.4.1. | Successful OIDC exchange rejected; asynchronous publish acknowledgement rejected; CLI hid the cause. Separate consumer problems: evidence-reuse fallback, repeated validation, stale status prose. | Three engine defects fixed in adopted 0.4.1. Later three-package journals contain accepted HTTP 202 receipts. |
| [reactor-effect-client](reactor-effect-client.md) | Adopted 0.4.1 Sep 22–23; three qualified npm archives including native code, separate prepare/publish/observe runs; now 0.4.2. | Large native upload parser failure; original-host pin blocked recovery with the fix; five releases outlasted visibility polling; CI artifact rerun incompatibility; copied Effect policy blocked qualification. | Parser/host/qualification fixes adopted. Visibility friction recurred through Sep 25. Current policy decoder also poses a historical-candidate compatibility risk. |
| [effect-build](effect-build.md) | Qualified 0.2.2, then a specific prepacked multi-package Action commit; five packages released successfully Aug 15. | Clean-install peer drift; incompatible consumer Effect family; singular npm authoring; forced repacking; extensive integration code; initially unavailable expected release version. | Integration removed Aug 23. Later custom-publisher incidents are documented separately as useful design evidence, not ts-release defects. |
| [nyc-transit-kit](nyc-transit-kit.md) | June adopter; eight npm packages plus GitHub binary/manifest/archives; still pinned to 0.0.7 with a Bun workflow adapter. | Missing runtime dependency; child npm authentication plumbing; invalid Action YAML; partial npm/GitHub release; propagation false failure; draft-state mismatch; opaque error; consumer Git detection. | Consumer fixes/workarounds landed through July 5; still on the legacy API. Older log limitations are called out per finding. |

Each case study records the incident, impact, evidence, fix/workaround, current
status, and improvement implication. It distinguishes production failures,
qualification blockers, defects found in review, implementation costs, and
unexercised risks. These categories must not be added together as a single
count of ts-release bugs.

## What is already fixed, and what still needs attention

| Area | Historical correction already recorded | Remaining opportunity supported by adopters |
| --- | --- | --- |
| npm credential and response handling | 0.4.1 fixes timestamp-based OIDC rejection, accepts 2xx acknowledgements, and exposes safe failure causes. [BB-1–3](effect-agent-browserbase.md#confirmed-engine-incidents) | Keep real response variants and failure stages in regression coverage; improve bootstrap/credential-route diagnostics. |
| Large native upload | 0.4.2 fixes the large-string JSON parser. [REC-2](reactor-effect-client.md#rec-2--large-native-publication-passed-preparation-but-failed-http-request-admission) | Preflight the complete actual request-admission path before the first member publishes; retain realistic large-body cases. |
| Durable recovery | Native journals prevented duplicate dispatches in Browserbase and Reactor. | Recovery still needs usable observation, candidate retention, and a supported path for a repaired executor to admit historical candidate policy. |
| Ordered prepacked workspaces | effect-build's qualified Action and current native applications demonstrate the capability. | Make this a small, supported adoption path without forcing each consumer to design manifests, stores, confirmation handling and CI artifact admission. |
| Registry visibility | Consumers added their own settling loops. | Accepted publication still repeatedly ends in manual observation/retry work; a short fixed loop is insufficient across the observed cases. |
| Dependency alignment | Consumers isolate release tooling and pin runtime families; upstream #38 fixes a transitive pin. | Certify fresh external installs and maintain explicit library versus bundled-host compatibility. Do not couple consumer Effect upgrades to the publisher. |

## The recurring failure: acknowledgement is not public visibility

These are related observations with different ownership and failure modes:

| Consumer | Actual evidence | What it means |
| --- | --- | --- |
| nyc-transit-kit, July 5 | v0.2.0 side effects completed while verification failed; a later consumer guard rechecked remote state for up to 36 rounds. [NT-5](nyc-transit-kit.md#nt-5--npm-propagation-made-successful-side-effects-appear-to-be-a-failed-release) | The workflow needed to reconcile eventual completion after an engine failure. |
| Browserbase, Sep 22 | Two npm packages needed three dispatches because successful responses became unknown outcomes; later observations satisfied each operation. [BB-2](effect-agent-browserbase.md#bb-2--asynchronous-publish-acknowledgement-became-an-uncertain-dispatch) | This was an acknowledgement-decoding bug, fixed in 0.4.1. Its no-replay recovery worked. |
| Reactor, Sep 24–25 | Five of seven post-upgrade first-publication runs passed the Action, then failed the separate visibility report; later observation-only runs succeeded with the original candidate. [REC-1](reactor-effect-client.md#rec-1--five-releases-outlasted-the-observation-budget-after-successful-publication-acknowledgement) | Correct acknowledgement handling alone does not finish the operator's job. Reporting ran about 111–150 seconds, not merely the 25 seconds of explicit sleeps. |
| effect-build's replacement publisher, Sep 19 | v0.8.0 required 13 attempts. Sampled failures show successful writes followed by unconfirmed reads; the final attempt skipped all 12 identical published packages. [EB-A10](effect-build.md#subsequent-release-incidents-adjacent-lessons-not-ts-release-defects) | This is an adjacent custom-publisher problem. Its six-observation policy still makes operators continue a release by hand. |

The evidence establishes delayed observable state, not the particular npm
cache/replica responsible. Do not turn an absent version after a write into
permission to resend. Report accepted, pending observation, confirmed, and
conflicting state separately; let callers choose whether acknowledgement or
fresh installability is their completion criterion.

## Prioritized improvement backlog

Priorities below concern product improvements, including preserving fixes as
regressions. They do not assert that every suggested helper is absent from all
current public APIs; validate the latest surface before implementation.

| Priority / proposal | Motivation | Concrete acceptance target |
| --- | --- | --- |
| **P1 — Observation policy and useful pending results** | NT-5, BB-2, REC-1, EB-A10 | An acknowledged three-package release can remain temporarily invisible, wait under a configurable elapsed-time deadline/backoff, and continue observation on a fresh runner. Display per-member last observations and retained references. Dispatch counts remain one per member, including on timeouts/response loss. Avoid repeating immutable candidate admission unnecessarily within one wait session. |
| **P1 — Supported recovery with a repaired host** | REC-2/3 and its historical-schema review risk; EB-A4/6; TS-7/8 | Retain candidate source/bytes/provenance separately from executor version and candidate-policy version. Demonstrate an older candidate completing under a repaired compatible host with unchanged request identities; reject changed archives or incompatible policy. Preserve distinct rules for superseding before dispatch and recovery after dispatch. |
| **P1 — Realistic provider and distribution conformance** | BB-1/2/3; REC-2; NT-3; EB-1/2; TS-1–13 | Replay successful OIDC variants, HTTP 200/201/202, delayed visibility, large native requests, real draft asset transitions and Actions-token response shapes through distributed entry points. Include real pinned SDK/client boundaries where fakes previously diverged. Assert durable state and dispatch counts, not only exit codes. |
| **P1 — Whole-release zero-dispatch preflight** | REC-2; Browserbase's manual per-provider preflight; EB current whole-set conflict check | Admit all retained bytes, package identities, provenance, graph constraints and actual HTTP wire requests before the first upload. A malformed last member causes zero dispatches. Keep credential/host probes explicit and distinct from offline structural checks. |
| **P2 — Qualified release-set adoption helpers** | EB-3/4/5; both native adopters' custom models | Accept externally qualified archives with source, member identities and digest inventory; generate Bundle/Plan and dependency ordering without repacking. Allow consumer policy hooks for ABI, exports and package layout. Start with npm workspaces rather than a universal build system. |
| **P2 — Preparation persistence and GitHub handoff** | Browserbase custom immutable Git store; Reactor 90-day artifacts; EB transfer protocol | Supply bounded immutable storage/restore helpers and one opaque preparation reference. Prove fresh-runner restore, competing creators, missing/corrupt content and expired transport handling. Keep execution journals and candidate content separate but check their combined recovery readiness. |
| **P2 — Small supported workflow examples** | BB-4/5; REC-4; NT plan/execute rebuild; EB-5 | Demonstrate exact-source CI reuse with profile/attempt/artifact identity, correct fallback, full/failed-job reruns, frozen host, review of a concrete candidate, publish and observe actions. Offer both one-dispatch environment approval and separately dispatched promotion without rerunning expensive qualification. |
| **P2 — External install/runtime contract** | EB-1/2; NT-1; TS-7 | Qualify isolated library installs with explicit peers, bundled CLI/Action installs without consumer node_modules, and a consumer using another Effect family. Verify fresh resolution as well as frozen lockfiles. Keep the release runtime version distinct from the product's dependency policy. |
| **P2 — Safe structured diagnostics and release ledger** | NT-7, BB-3/6, REC-2; TS-5/9 | For pre-report failures retain typed code, stage, operation, dispatch state, provider status when safe, preparation/journal reference and a specific next action. Generate release outcome data that distinguishes acknowledgement, fresh visibility and missing retained proof. |
| **P3 — Onboarding and coordinated release metadata** | NT-2; EB-6; REC-5; stale consumer prose | Derive package policy from one reviewed source; keep actual published package/Action coordinates in a generated support manifest. Explain package-name bootstrap, workflow/environment binding and intended dist-tag changes. Do not copy product dependency literals into multiple schemas/fixtures. |

### Regression cases to retain from the actual adopters

| Fixture | Required assertion |
| --- | --- |
| Successful token response with unsuitable diagnostic timestamps | Token fields determine admission; diagnostics are safe; zero publication occurs during credential checking. |
| npm publish returns 200, 201, or 202; expected version appears minutes later | Retain exact acknowledgement status; visibility remains explicitly pending; observation eventually confirms; never resend because of temporary absence. |
| Lost response after an accepted npm write | Original journal survives a fresh runner; only exact evidence authorizes completion; absence alone does not authorize retry. |
| Three-member workspace with an 18,235,775-byte native request | Complete request admission succeeds under supported Node/Bun; malformed/mutated request fails before any member uploads. |
| Old retained candidate under repaired host and later product policy | Original request identity remains verifiable; historical schema selection is explicit; incompatible changes produce useful recovery diagnostics. |
| Full/focused CI profiles and both rerun modes | Only qualifying producer evidence is admitted; reuse miss can fall back; immutable artifact replacement/attempt policy is deliberate. |
| Fresh Effect peer resolution and isolated tooling | No hidden reliance on repository overrides; the consumer's Effect version can remain independent. |
| Draft GitHub assets become published assets | Stable API identities survive URL changes; read authority does not manufacture proof of absence. |
| Plan/review and execute on different runners | Published bytes equal the previously qualified bytes; candidate transfer does not rebuild or repack. |

## Implementation patterns worth preserving

- **Build once, release exact bytes.** effect-build's successful adoption and
  both native adopters show that ts-release can own publication while consumers
  retain their build and installed-consumer tests.
- **Durable history and observation without replay.** Browserbase's beta.104
  and Reactor's eight journals provide concrete recovery evidence, beyond
  design intentions or simulated tests.
- **Isolated release runtimes.** Separate locked tool workspaces and bundled
  Actions reduce dependency coupling. Product dependency policy still needs
  its own source of truth.
- **Explicit package dependencies and whole-set validation.** Reactor requires
  client before its two hosts; Browserbase deliberately serializes its set.
  Distinguish dependency edges from optional ordering and acknowledgement from
  visibility requirements.
- **Consumer policy remains consumer-owned.** ABI, SBOM, export-map and native
  platform requirements belong to the product. Shared storage, host identity,
  reports and workflow handoff are better candidates for reusable helpers.

Measured source sizes illustrate the integration cost: Browserbase has 981
release-host source lines including its custom store, plus a 233-line workflow; Reactor has 1,127
production tooling lines, 2,090 test/fixture lines and a 197-line workflow;
effect-build's adopted workflow/config-generator/verifier totaled 1,209 lines;
Transit has separate 345-line command and 363-line observation adapters. These
are whole-file measurements with overlapping responsibilities, not a count of
unnecessary lines or a claim that all can be deleted.

## Coverage, exclusions, and confidence

- Discovery enumerated **46 accessible `mannyc2` repositories**, scanned local
  `/mnt/models/dev` manifests/workflows/release source and docs, searched commit
  and issue history, and collapsed duplicate worktrees. The machine-readable
  [census](census.json) records the queries, returned repositories, exclusions
  and Transit run metadata.
- “Recent” here covers the adopters found in **June–September 2026**, with most
  current-engine weight placed on September. Former adopter effect-build is
  included because removal and subsequent implementation are useful feedback.
- `plato-wiki` explicitly deferred adoption; `audint-kit` lists it as future
  work. `liche` uses its own release package. `open-design-cli` has a placeholder
  workflow; inspected `bun-doctor`/`pi-agent-effect` sources show no adoption.
  Homebrew/Scoop repositories are ts-release distribution outputs, not external
  adopters. Unrelated substring matches were excluded.
- GitHub code search returned only Reactor despite separately verified matches
  in other repositories. It was **not** treated as proof that other adopters do
  not exist. The four cases are the verified set within this accessible census,
  not a guarantee about inaccessible/private or unindexed history elsewhere.
- Incident evidence includes live issues/PRs, exact commits and workflows,
  retained journal objects, and selected job logs. Each case states its run
  coverage and where logs were expired or historical receipts were not
  reproduced. Review risks are labeled; passing workflow conclusions alone
  are not treated as proof of current registry visibility.
- [Self-release corroboration](self-release-corroboration.md) adds thirteen
  upstream incident entries and fix links. These overlap some consumer causes
  and are not thirteen additional independent consumer failures.
- Current ts-release GitHub main is `fa50ce368c50e9a28a2e57f667d454374e7b209c`.
  The audit workspace is an older source revision with pre-existing staged
  work; that work was preserved. This initial audit changed no runtime code;
  test results cited in its case studies are historical evidence. The subsequent
  refactor report separately records newly run tests against its isolated checkout.
