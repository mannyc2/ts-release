# Proposed ts-release engineering requirements

This is a requirements proposal grounded in the peer repositories, not a claim
that ts-release currently conforms. The source audits distinguish written rules,
their actual enforcement, local-only instructions, and implementation exceptions:
[Browserbase](browserbase-standards.md), [Reactor](reactor-standards.md), and the
[ts-release gap audit](ts-release-gap-audit.md). Requirement IDs below are used by
the [implementation plan](refactor-plan.md).

The primary reference is each peer's CONTRIBUTING/AGENTS chain and the installed
Effect guide, not a count of occurrences of `Effect.fn`. Reactor's local
architecture and testing skills are material requirements even though those files
are not on its published main. Their provenance is retained in its source ledger.

## Authority and scope

| ID | Proposed requirement | Evidence and adoption decision |
| --- | --- | --- |
| R01 | Identify source revision, dirty patch, runtime, dependencies and applicable instructions before making architectural claims. | BB-S01; Reactor AGENTS and CONTRIBUTING development/validation sections. Use 0.4.2 main plus the separately identified earlier patch. Historical architecture-program files do not govern current production. |
| R02 | Read the installed Effect guide fully, then the declarations/source for the APIs actually used. | Both AGENTS files; installed rc.115 `effect/AGENTS.md`. Keep runtime packages aligned. A compiler/linter upgrade is a separately qualified development-tool change, not permission to upgrade Effect. |
| R03 | Simplify the existing owner before adding a service, registry, facade, schema or workflow. | BB-S03 and Reactor architecture classification/deletion test. Require a concrete responsibility and explain the mechanism removed or requirement exposed. No line-count or service-count target. |
| R04 | Document public behavior and contributor contracts in maintained docs; keep investigation, temporary reports and raw proof out of the shipped product. | BB-S04; Reactor PR/evidence guidance. These requested audit/plan files are task deliverables, not proposed package contents or permanent CI inputs. The eventual maintained result is a concise CONTRIBUTING guide, agent entry guide and user-facing API/recovery docs. |

## Effect architecture, data and behavior

| ID | Proposed requirement | Evidence and adoption decision |
| --- | --- | --- |
| R05 | Inventory every service-like capability and trace its construction, consumers, implementation selection and disposal to a composition root. | Reactor architecture skill; BB-S08/09. Include callback bags and closures, not only `Context.Service` declarations. Classify each as built-in capability, domain authority, adapter, explicit value, framework seam or removable pass-through. |
| R06 | Capture service dependencies at construction; provide concrete layers only at application, subsystem or test boundaries that own the choice. Preserve caller E/R. | Both service/layer guidance; BB-S05/08/09. Keep explicit request values and existing narrow ports when they expose the dependency honestly. Do not convert every callback to a service or add forwarding accessors. |
| R07 | Prefer existing Effect capabilities for time, randomness, configuration, filesystem, HTTP and processes. Prove any native exception. | BB-S10; Reactor CONTRIBUTING diagnostics and local CLI guidance. Evaluate each native adapter against exact-byte, no-replay, process-tree and fsync requirements. A library name or style preference is insufficient evidence either to retain or replace it. |
| R08 | Decode structured untrusted data once at its owning boundary using Schema; use schema-derived variants for the same semantic model. | Installed Effect guide; BB-S06; Reactor CONTRIBUTING error/known-reply policy. Preserve bounded lexical/canonical parsing where JSON alone cannot enforce duplicate-key, numeric or byte-identity rules. External re-entry and mutable input capture are genuine new boundaries. |
| R09 | Assign every `unknown`, type assertion, non-null assertion and predicate a boundary owner and justification; remove unjustified narrowing. | BB-S07; Reactor architecture type-boundary audit. Counts identify review sites, not bugs. Retain unavoidable external-library assertions only at a narrow documented adapter. `as unknown as` is not remediation. |
| R10 | Expected failures remain concrete typed failures; programming defects remain defects. Privacy projection is explicit and separate. | Reactor CONTRIBUTING error policy; installed Effect error guidance. Replace blanket exception normalization incrementally, retaining existing safe public diagnostics and documented credential redaction. Do not attach secret native causes to public errors to satisfy a cause-retention rule. |
| R11 | Use `Effect.fn`/`fnUntraced` for reusable workflows and Effect values for suitable zero-argument operations; traces follow operation ownership. | Installed Effect guide; Reactor CONTRIBUTING diagnostics/tracing; Browserbase named operations. Do not trace per-chunk or hot-loop work automatically. Public signature changes require caller/migration review. Preserve lazy acquisition and documented eager byte snapshots. |
| R12 | Resource ownership precedes use; interruption joins child work and cleanup; mask only the necessary transition or already-issued native call. | Both lifecycle guidance. Audit files, subprocesses, response streams, callbacks and runtime bridges, not just ContentStore. Record cleanup failure separately from remote mutation evidence. A stuck non-cancellable native call is an explicit limitation. |
| R13 | Use Effect monotonic time for elapsed budgets, wall-clock instants for durable timestamps, and schedules for observation recurrence where appropriate. | Reactor CONTRIBUTING scheduling; installed Effect clock/schedule guide. Observation retries never create publication retry authority. Native network/process behavior still needs native acceptance. |
| R14 | Bound bytes, time, queue/callback work and retained mutable state at the actual owner. | Both lifecycle/transport policies. Preserve current payload capacities, exact wire admission and owned-buffer semantics. Do not widen a bound simply to make a case pass. |
| R15 | Durable Bundle, Plan, journal, request and receipt identities have one authority. Mutation outcome, cleanup and visibility remain distinct facts. | Both outcome policies and ts-release `docs/design-decisions.md`. Schema cleanup must not silently change encoded bytes, hashes, schema versions, no-replay decisions or historical candidate admission. |
| R16 | Keep importable command/workflow definitions inert; runtime execution and process signals belong to explicit host entrypoints. | Installed Effect runMain guidance; Reactor CLI skill; BB-S05/runtime restrictions. Evaluate replacing custom process orchestration, with the existing CLI/Action exit, JSON-output and signal contracts as acceptance constraints. Any retained Promise API is an explicit compatibility adapter. |

## Enforced code quality and distribution

| ID | Proposed requirement | Evidence and adoption decision |
| --- | --- | --- |
| R17 | Effect diagnostics must actually run and fail the required gate; verify the patched toolchain rather than accepting stock tsc success. | Browserbase lint-policy machinery; Reactor CONTRIBUTING:86. Use one diagnostic authority, with correctness rules and applicable suggestions blocking. Qualify the supported TypeScript/tsgo/Oxlint tuple before pinning it. |
| R18 | Enforce type-aware unsafe-operation, dropped-Promise, exhaustiveness and suppression rules, plus canonical formatting. | Browserbase `lint/.oxlintrc.json`; Reactor `.oxlintrc.json`. Establish explicit policies for libraries, native adapters, apps, tools and tests. No blanket disable or mass auto-fix that changes error/lifecycle behavior. An exception must be narrow, reasoned and still necessary. |
| R19 | Compile each runtime closure with only its allowed ambient types and strict options. | Browserbase owned projects; Reactor client Node-only and browser/native configs. Root-wide DOM plus Bun types are not proof of portability. Keep strict installed declaration checking even if a peer uses a looser workspace check. |
| R20 | Enforce declared dependency direction, public subpaths, source resolution, runtime cycles and computed-load policy using syntax-aware checks. | Both architecture systems, particularly Reactor CONTRIBUTING:55. Retain the current checker and extend its missing responsibilities. Allowlist the trusted application-module loader and actual optional-native loaders individually; do not globally permit dynamic imports. Type-only edges still obey ownership rules. |
| R21 | Published entrypoints and declaration exports are deliberate and match source; installed consumers use only declared dependencies. | BB-S19/26; Reactor pack checks. Reuse existing packed acceptance, strengthen exported-name parity and per-package closure where missing. Do not restore retired generated API-projection machinery merely because it existed historically. |
| R22 | Library, bundled host and release-tool dependency contracts are distinct and tested from clean resolution. | Both isolated release applications; adoption EB-1/2 and TS-7. Keep Bun as package/script/test authority. npm remains an external installer under test. No copying upstream Vite+, Playwright or native-media machinery into ts-release. |
| R23 | Dependency additions belong to the importing package, with compatible licensing/notices and packed closure evidence. | Reactor dependencies/notices section; coordinated Browserbase pins. Reuse the existing platform before introducing a wrapper dependency. Toolchain upgrades and runtime upgrades have separate evidence. |

## Verification policy

| ID | Proposed requirement | Evidence and adoption decision |
| --- | --- | --- |
| R24 | Choose proof from an observed failure or requested outcome; default to existing checks and real workflow evidence. New automation needs a demonstrated proof gap and maintenance justification. | Both inherited/local testing-selection policies. Applies to new assertions, matrix cells, fixtures and temporary harnesses too. Test count and passing assertions are not completion metrics. |
| R25 | Where isolation is necessary, identify the failures and demonstrate meaningful failing coverage before the implementation. Never claim retrospective test-first evidence. | Browserbase inherited testing guidance; Reactor testing skill. Retain necessary existing crash/authorization/race protection without inventing historical provenance. |
| R26 | Tests belong to their owner and cross package boundaries through supported public entries. Real adapters are used when their persistence, serialization or lifecycle is the subject. | BB-S23/24; Reactor package layout/testing rules. Review the root test tree by responsibility. Do not create public testing exports simply to relocate private wiring tests. |
| R27 | Doubles replace a deliberate external edge and faithfully satisfy their claimed contract. Prefer the real pinned SDK/client for library-boundary claims. | Both testing guides and adopter incidents TS-1/3/9/10–13, EB-A1/5/6. A fake provider's invented response is not provider compatibility evidence. Partial fixtures stay local. |
| R28 | Time-dependent Effect behavior uses TestClock/barriers; test cancellation reaches fibers; finalizers can complete after the test signal aborts. | Reactor committed main CONTRIBUTING and harness; both testing guides. Replace wall-clock stabilization sleeps where Effect owns the timing. Keep actual process/network time only for the native contract being exercised. |
| R29 | Qualify final artifacts through installed public entrypoints on claimed runtimes; source tests cannot substitute for distribution proof. | BB-S26; Reactor pack/runtime gate. Retain ts-release's existing packed kernel/provider/Action and installed-workflow checks. Test declared Node/Bun contracts deliberately; do not claim every engine-admitted version was exercised. |
| R30 | Validation profiles have explicit stage inventories, prerequisites, source identity, raw exits and reproducible evidence. Final claims identify the exact profile. | Browserbase acceptance profiles; Reactor verify/evidence. Reuse receipts and scripts; add only missing identity/stage fields. Dirty local proof may use a retained patch/hash; release qualification must use an immutable candidate. |
| R31 | CI and local validation share commands; inexpensive gates precede expensive native work; failed evidence is retained and caches cannot impersonate external side effects. | Browserbase CI/acceptance policy; Reactor final verify profiles. Measure existing cost before introducing a new cache or classifier. No skipped required stage may turn into a green full result. |

## Adopter-facing requirements

| ID | Proposed requirement | Evidence and adoption decision |
| --- | --- | --- |
| R32 | Observe acknowledged publications through a bounded, resumable policy with useful pending results; never resend on temporary absence. | REC-1, NT-5, BB-2 and adjacent EB-A10. Separate acknowledgement from installability. This is a product increment, not an Effect-style rename. |
| R33 | Admit historical retained candidates under a repaired compatible executor without rebuilding bytes or changing request identities. | REC-2/3 and historical-policy risk; TS-7; adjacent EB-A4/6. Separate product policy, candidate format and executor identity. Reject incompatibility explicitly, preserving the original journal. |
| R34 | Whole-release structural/request preflight, qualified archive adoption and handoff reduce consumer duplication without owning product-specific ABI/export policy. | REC-2/4/5, BB-4/5, EB-3/4/5. Extend existing adoption/preparation paths first. A remote preflight may need credential access but cannot grant publication authority. |
| R35 | Safe diagnostics expose stage, operation, dispatch state and next action; credential/provider data remains bounded and redacted. | BB-3, NT-7, TS-5/9 and both peer error policies. Preserve current CLI safe output while improving typed internal distinctions. |
| R36 | Release execution remains separately authorized and operates on the reviewed candidate; acceptance and preparation do not publish. | User instructions; both release guides; ts-release durable decisions. Preserve current approval and no-replay laws in every phase. Ordinary CI remains read-only toward public destinations. |

## Interpretation rules

- These requirements synthesize shared principles; peer-specific exceptions are
  retained in the source reports. Reactor and Browserbase are not identical or
  perfectly compliant with their own rules.
- Browserbase's resource library, native driver, test code and release tools
  have different lint policies. Reactor's local instructions, local source and
  published main are different snapshots. Do not flatten either distinction.
- There is no blanket requirement to make every function a service, every
  number a new Schema, every observed difference a test, or every native call an
  Effect platform call. The inventory must justify each decision.
- The earlier three-component refactor addresses portions of R06/R12/R16 and
  credential cancellation. It does not establish R01–R36 compliance.
