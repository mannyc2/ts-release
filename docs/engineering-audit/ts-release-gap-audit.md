# ts-release engineering gap audit

> Historical engineering research snapshot, captured on 2026-09-26 before the current implementation milestone. Baseline findings, counts and proposed work describe that captured state; they are not current completion claims. See [current implementation status](implementation-status.md) for the bounded milestone, actual verification and remaining work. These are task research documents, excluded from published packages.

The earlier patch does not establish adoption of the peers' engineering standards. It changes three implementations and their public re-exports; it leaves compiler policy, linting, architectural enforcement, test ownership, validation profiles, most boundary decoding, and the error model unchanged. Several of those are explicit requirements in the peers' CONTRIBUTING and AGENTS files, not optional stylistic preferences inferred from code.

This audit preserves the existing patch and identifies the work needed before a broader refactor. It distinguishes a demonstrated semantic mismatch, a missing enforcement rule, an implementation candidate requiring a decision, and a deliberate exception worth keeping. Counts below are an inventory, not a defect count.

## Audited inputs and limits

- Production baseline: `fa50ce368c50e9a28a2e57f667d454374e7b209c`, published 0.4.2, in `/mnt/models/dev/ts-release/.effect-pattern-refactor`.
- Initial working copy: branch `codex/effect-patterns-refactor`, twelve modified tracked files and the prior untracked audit, standards and test files. The initial status and production-file hashes are preserved in [ts-release-inventory.json](./ts-release-inventory.json). Five production files differ: `Node.ts`, `Bun.ts`, `platform/Application.ts`, `platform/ContentStore.ts`, `platform/HttpTransport.ts`.
- During this audit another authorized task checkpointed that existing work as `ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f`. The parent task verified the twelve previously modified tracked files retained identical bytes. The inventory's original dirty status remains evidence of the input actually inspected, not a claim about the later checkout status.
- Browserbase local HEAD: `1f9efc74135434f4f54a390c11f88a4ec9a42bcf`, clean when inspected. Read its complete root AGENTS/CONTRIBUTING, strict lint policy and owned compiler configuration.
- Reactor local HEAD: `b7e7448ae40af80b80258e1b638bf0277bdd1c65`. Its CONTRIBUTING and formatter config were modified; AGENTS and `.agents/` were untracked. Its local guidance is relevant user working-copy policy, but is **not represented as committed at that SHA**. Read AGENTS, CONTRIBUTING, Effect-development architecture audit, testing selection policy, compiler diagnostics and lint configuration. The inventory records hashes of these exact files.
- Read the complete installed `effect@4.0.0-rc.115/AGENTS.md`. Its version owns API names. Peer prerelease/toolchain pins are evidence of their practices, not instructions to transplant rc.117 or TypeScript 7 without compatibility qualification.

The mechanical scan covers all 95 production TypeScript source files under the seven public packages, Action launcher and self-release application: 12,959 lines. Tooling, package manifests, root/compiler/build configurations, CI, packed-consumer checks and selected test seams were also inspected. Generated `dist`, research/prototypes, vendored code and `.repos/effect` are outside this production inventory. This is not a claim to have semantically proved every function or individually adjudicated every historical test.

No production implementation changed in this audit. No behavioral suite, native qualification or strict peer linter was newly run by this subaudit. Previous green runs remain previous-run evidence. The parent task separately executed the two small error-channel probes described under G04. Static source/capability inventory and relative runtime-import cycle analysis were executed here.

## Requirements actually supplied by the peers

| Requirement | Normative source | Consequence for ts-release |
| --- | --- | --- |
| Audit every service, capability, dependency path, runtime authority and unsafe boundary before architecture changes; report explicit keep decisions | [service-and-boundary-audit.md:11 (local snapshot)](reactor-sources.json#L438) | A few examples of Effect.fn and scoped cleanup cannot establish repository alignment. |
| Preserve typed errors and defects as distinct outcomes; decode known remote shapes using Schema after bounded admission | [CONTRIBUTING.md:53 (local snapshot)](reactor-sources.json#L80) | Review shared catch/parse helpers and provider decoding before mechanically converting functions. |
| Enforce Effect diagnostics and strict, type-aware lint; exceptions are narrow and explained | [Browserbase CONTRIBUTING](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/CONTRIBUTING.md#L62), [CONTRIBUTING.md:86 (local snapshot)](reactor-sources.json#L80) | Adopt an executable rule set, not only prose. The peers place Effect diagnostics in different tools; choose one reporting owner. |
| Reject unsafe narrowing/non-null assertions and hidden runtime escapes in owned library code | [Browserbase lint policy](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/lint/.oxlintrc.json#L55) | Triage assertions by meaning; retain documented adapter exceptions where needed. |
| Own tests by package, use public cross-package contracts, qualify installed packages | [Browserbase AGENTS](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/AGENTS.md#L18), [CONTRIBUTING](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/CONTRIBUTING.md#L68) | Root `test/reimplementation` and arbitrary private source imports do not match this layout. Preserve strong installed-consumer checks. |
| Default to no new tests; add a necessary regression for an observed uncovered failure, before its fix; prefer existing workflow evidence | [selection.md:3 (local snapshot)](reactor-sources.json#L522) | A new API or more cases is not itself test justification. Audit the prior patch's new automation separately from whether it passes. |
| Use bounded native ownership, deterministic synchronization, and truthfully scoped validation | [CONTRIBUTING.md:63 (local snapshot)](reactor-sources.json#L80), [Browserbase CONTRIBUTING](https://github.com/mannyc2/effect-agent-browserbase/blob/7e93054494ee491dbf2a1f66a083d99da846fd3e/CONTRIBUTING.md#L86) | Preserve native checks; distinguish virtual-time logic from real OS shutdown and publish qualification. |

These are desired adoption targets, not a claim that every peer implementation satisfies its own policy. The separate peer audits identify implementation exceptions.

## Production topology

| Owner | Source files / lines | Responsibility and audit emphasis |
| --- | --- | --- |
| `packages/ts-release` | 48 / 6,334 | Plan/Bundle/Journal identities; pure decision machine; runtime Host; HTTP/Git/SQLite/content adapters; Apple and effect-build integration. Main cross-cutting error, type and host-boundary changes belong here. |
| `packages/npm` | 8 / 1,544 | Metadata/publication/authentication/provenance; native Sigstore trust and scoped local authentication. Prior patch did not audit or change these implementations. |
| `packages/github` | 10 / 1,394 | Dependency graph, exact request facts, observations and receipt correspondence. Repeated union assertions and decode/narrow ownership need review. |
| `packages/pypi` | 11 / 1,172 | Archive/metadata/requirement parsing, publication and credentials. Separate essential wire grammars from known response-object shape checks. |
| `packages/mcp` | 4 / 694 | Schema-backed manifest, authorization, request and observation protocol. Shares the broad data-boundary error behavior. |
| `packages/openai` | 4 / 514 | Package/marketplace/submission data. Keep mostly pure modeling and packaging operations; do not add services for symmetry. |
| `packages/catalog` | 5 / 177 | Homebrew/Scoop data and rendering. Pure rendering is appropriate; shared catch-all rendering boundary needs error classification. |
| `apps/self-release` | 4 / 1,005 | Real application composition, prepared candidate identity and retention. Remaining detached Promise workflows matter here even after ContentStore changes. |
| `apps/action` | 1 / 125 | Dependency-minimal installed-core launcher. Framework boundary with explicit runtime/error exceptions. |

The largest module is 402 lines. Length alone does not establish excess complexity. The important complexity is the number of authorities a module owns and how often decoded facts must be rediscovered. Avoid an arbitrary file-size reduction project.

## Capability and ownership inventory

The JSON contains 41 mechanically discovered service/capability-like declarations. Each explicitly maps to one of C01–C14 below through `capabilityId`; C13 disposes of data-only false positives. Each full JSON row records **owner, contract, construction, production selection, consumers, boundary, tests and verdict**, following the Reactor audit. This is a declaration inventory plus manual concrete-factory review, not proof that syntax discovery can identify every possible abstraction.

| ID | Authority / dependency trace | Verdict |
| --- | --- | --- |
| C01 | Application → `Host` → captured journal/transport/provider table/time/ID → kernel interpretation | Keep the release authority aggregate. Review time/ID projection separately; do not split into one service per field. |
| C02 | Application → scoped `openGitJournal` or `openSqliteJournal` → `JournalStore` → Host | Keep port and real adapters. Decode SQLite rows at their native boundary; retain ambiguous storage outcomes as data. |
| C03 | Application → provider definitions with artifact/read/attestation capabilities → kernel's versioned contract registry | Keep provider-owned codecs and correspondence. Narrow provider-local types instead of spreading casts; decide callback E/R closure policy. |
| C04 | Application/Git host → scoped Git runtime and native Process → conditional transport → one authorized kernel send | Keep exact conditional-push authority, process-group shutdown, output bounds and no implicit retries. |
| C05 | Application → credential resolver/HTTP read/OIDC source → transport/provider observation | Keep secret isolation and wire semantics. Schema-decode known envelopes at the owning adapter. |
| C06 | Application → `ContentOwner` → verified artifact access → provider request bytes | Keep a meaningful content-ownership port. Complete interruption analysis beyond the one patched adapter. |
| C07 | Application Layer → `Apple.Apple`/`Apple.Env` → `AppleTools` → preparation/native workflow | Keep actual captured Layer requirements and generic delivery callback R. Static-layer syntax is not a requirement. |
| C08 | CLI/Action → trusted module or Effect factory → scoped Application → Host interpretation | Keep composable Effect entry candidate and outer Promise bridge. Make compatibility decisions explicit. |
| C09 | Application → scoped npm token/challenge state → credential resolver and `onRejected` completion | Keep auth continuation after durable noncommit and secret wiping. A completion is not a send permit. |
| C10 | Application → real Sigstore verifier/attester + OIDC source → npm provenance admission | Keep cryptographic trust in native library. Retain decoded types and remove unjustified adapter casts. |
| C11 | Application → Git catalog host → object builder/ref observer → core conditional publication | Keep shared concrete Git owner; no additional pass-through service required. |
| C12 | Admitted Plan/history → `Machine` / `HistoryMachine` → next decision/report | Keep deterministic value computation. No ambient Context service is needed for pure decisions. |
| C13 | Headers and MCP Manifest | Values, not capabilities. Keep as explicit data. |
| C14 | GitHub Action environment → application's installed core → bounded report/exit output | Keep the dependency-minimal framework boundary and deliberate dynamic import exception. |

The implementation already has useful Effect architecture: 155 direct `Effect.fn` AST calls; schema-backed durable classes; real `Host` and `AppleTools` services; captured production Layer dependencies; scoped Git/SQLite/Apple resources; Config/Redacted for secrets; declared package imports; exact tarball checks; and installed recovery scenarios. Adding more services or named functions is not the main improvement opportunity.

## Findings and target changes

### G01 — P1: standards are not enforced or durably established

**Observed.** [package.json:16](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/package.json#L16) declares stock TypeScript 6.0.3 and Prettier, with no Effect language-service/tsgo or strict lint dependency. [scripts/check.ts:4](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/scripts/check.ts#L4) builds, typechecks, checks imports and loads exports; it does not run lint or check formatting. There is no root CONTRIBUTING. The earlier local AGENTS file is ignored by `.gitignore:11` and was not tracked at initial inspection, so merely writing it did not deliver repository guidance.

**Target.** First establish a tracked CONTRIBUTING/AGENTS relationship and one owned policy configuration. Select an Effect-compatible compiler/diagnostic/linter combination through coordinated pin review. Enforce warnings, unused suppressions and justified narrow adapter exceptions. Keep Bun as the package manager and runner; Vite+ is Browserbase workspace machinery, not a necessary ts-release dependency.

**Proof and scope.** The required normal check must actually invoke the rule owner and fail on a real current finding. Record the selected diagnostic engine/version, raw exit and final source identity. Do not claim strict-lint compliance because stock `tsc` passed. Decide policy before mass fixes or code-style churn.

### G02 — P1: one ambient compiler environment hides host boundaries

**Observed.** [tsconfig.json:4](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/tsconfig.json#L4) supplies DOM/DOM.Iterable and [line 17](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/tsconfig.json#L17) supplies `bun-types` to every production package, application, script and test. Package build configs inherit it. Strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes and skipLibCheck:false are already enabled and should stay. Additional peer flags such as noImplicitOverride, noFallthroughCasesInSwitch and noEmitOnError are absent. Compiler ambient visibility does not prove an actual forbidden import, but it makes accidental host assumptions typecheck.

**Target.** Declare intended host closure for each public entry/package, then split production and tooling/test configs accordingly. Core portable entries must compile without Bun/Node globals; Node/Bun adapters and intentionally native provider packages get their correct hosts. Evaluate erasable syntax and the stricter control-flow flags with actual current errors. Do not make npm/Sigstore or native archive implementations browser-portable merely to match another repository.

**Proof.** Build from these configurations and compile installed declarations in the existing isolated consumers with skipLibCheck:false. Preserve package-engine qualification and the explicitly native provenance boundary.

### G03 — P1: architectural checking is narrower than the desired contracts

**Observed.** [check-import-rules.ts:35](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/scripts/check-import-rules.ts#L35) prevents package-relative escapes and undeclared dependencies. [Lines 94 onward](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/scripts/check-import-rules.ts#L94) check core public-entry runtime closure. It does not enforce internal layer directions, detect runtime cycles, or validate every sibling provider export map. [Line 84](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/scripts/check-import-rules.ts#L84) skips all nonliteral loads, even though only two trusted entry boundaries currently need them. The checker treats inline all-type named imports as runtime edges. That behavior is correct under `verbatimModuleSyntax`: TypeScript 6 and 7 emit an empty runtime import for `import { type T } from "module"`. The original audit incorrectly treated it as a checker gap.

**Target.** Write a small explicit package/entry and dependency-direction policy; extend the existing AST checker instead of inventing another graph framework. Restrict computed loads to the reviewed application loader and Action installed-core resolver. Erase only declaration-level `import type`/`export type` edges from the runtime graph; retain inline type-only specifier declarations as runtime edges because they still emit a module import. Define allowed native provider roots separately from the portable kernel.

**Evidence limit.** The historical graph reported no cycle in the 95 files, but its method incorrectly excluded inline type-only specifier declarations. Its empty-cycle result is therefore **not complete runtime-cycle proof**. The inventory preserves that method and records this correction; current graph qualification belongs to the implementation gate. Missing cycle enforcement was a prevention gap, not a demonstrated initialization defect. Case checking must be portable across the CI hosts; do not infer it from a Linux file-exists check alone.

### G04 — P1: shared admission helpers turn defects into expected failure

**Observed and directly reproduced.** [internal/Error.ts:14](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/packages/ts-release/src/internal/Error.ts#L14) catches every thrown value, retaining only an `instanceof ReleaseError` and otherwise emitting `invalid-data`. [Http.ts:17](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/packages/ts-release/src/Http.ts#L17) repeats this policy; its `matches` helper at line 30 returns false for every exception. The parent task ran direct source probes: `attempt(() => { throw new TypeError(...) })` exits with `hasFails=true`, `hasDies=false`, an ordinary ReleaseError; a TypeError in `makeDataBoundary(...).matches(...)` returns false. These are confirmed semantics, not newly discovered real-world incidents.

**Impact.** A programming error in a validator or provider callback can be diagnosed as invalid customer data or nonownership. The same helper reaches npm, GitHub, PyPI and MCP. The previous Application change preserves factory construction defects, but leaves these shared paths with a different policy. Additional broad boundaries exist in [apps/self-release/Model.ts:108](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/apps/self-release/src/Model.ts#L108) and [catalog/Shared.ts:53](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/packages/catalog/src/Shared.ts#L53).

**Target.** Separate known Schema/parser/operational rejection from unexpected exceptions at the owner, with a stable tagged guard where cross-instance errors are supported. Keep defects in the defect channel. Decide whether public error `code: string` remains compatibility API or evolves into a more structured reason algebra; do not blindly reproduce Reactor's full hierarchy.

**Exceptions.** Credential boundaries deliberately redact typed failures and defects to prevent secret disclosure; interruption must remain interruption. Ambiguous post-dispatch/storage outcomes deliberately become domain evidence. These exceptions must remain explicit. Never convert a lost response into retry authority while correcting error classification.

**Proof.** Reuse the smallest existing provider/application workflow evidence and direct error-channel probes. A passing suite does not establish this distinction unless it observes failure versus defect. No blanket new test matrix is justified.

### G05 — P1: known external objects are still manually shaped and cast

**Observed.** [GithubOidc.ts:12](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/packages/ts-release/src/platform/GithubOidc.ts#L12) defines an `object` helper; JWT/JWKS/claim objects at lines 55–108 and the token response at 211–215 are narrowed through property tests and casts. [pypi/Auth.ts:66](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/packages/pypi/src/Auth.ts#L66) does the same for a known token reply. [npm/Auth.ts:147](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/packages/npm/src/Auth.ts#L147) combines a native Sigstore decoder with manual raw-envelope walking and later casts the retained unknown bundle to the SDK type at line 271. [SqliteJournal.ts:24](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/packages/ts-release/src/platform/SqliteJournal.ts#L24) asserts native SQL result shapes at six sites. The current checks do not enforce the peers' unsafe-narrowing policy.

**Target.** Decode known JSON/row envelopes once into schemas or appropriate native typed results at their boundary; carry concrete types through internal code. Keep exact encoding and cross-field policy in the owner. For Sigstore, preserve the distinction between raw canonical bytes and the library's cryptographically verified representation; eliminating both representations would remove meaningful evidence.

**Keep.** [NativeJson.ts:36](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/packages/ts-release/src/internal/NativeJson.ts#L36) rejects duplicate keys, unsafe integers and ambiguous strings before JSON.parse. [Identity.ts:14](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/packages/ts-release/src/internal/Identity.ts#L14) rejects accessors, symbols, hidden properties and cycles before durable identity. These are security/identity grammars, not redundant record predicates. Git porcelain, tar/archive/metadata grammars, canonical base64 and npmrc text parsing also own native rules a Schema object decoder does not replace. Document these exceptions rather than deleting them to satisfy a regex count.

**Proof.** Existing native OIDC, trust, archive, SQL and installed-consumer checks must continue to validate real boundaries and exact bytes. No cryptographic or publication assurance follows merely from adding schemas.

### G06 — P1: unsafe-type triage remains repository-wide

**Inventory.** The 95 files contain 58 non-const assertions, 114 non-null assertions, three custom type predicates, zero explicit `any` type keywords, two computed loads and two described ts-expect-error directives. The JSON records each occurrence and owning module. Additional inventory records 141 `unknown` type nodes and 163 structural-narrowing AST sites; these include legitimate opaque inputs and are not all violations.

**Representative decisions.** [GitHub Graph.ts:35](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/packages/github/src/Graph.ts#L35) erases descriptor/intent correlation into `Schema.Codec<Intent, unknown>`; callers such as `Evidence.ts:57,78,105` and `Wire.ts:31` reassert specific facts. Prefer typed discriminated projections returned by the owning decoder. [GitAuthority.ts:170](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/packages/ts-release/src/internal/GitAuthority.ts#L170) asserts a returned Effect function as `Transport["send"]`; make the intended contract checked at definition. Bounded array/index traversals and guaranteed map membership should be narrowed explicitly or receive a narrowly justified exception, not automatically labeled exploitable bugs.

**Keep.** Opaque provider receipts at the heterogeneous versioned kernel boundary are intentional: [ReleaseModel.ts:61](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/packages/ts-release/src/internal/ReleaseModel.ts#L61) uses unknown while the provider's installed codec owns meaning. Node's dynamic application module and the Action's installed-core import are framework boundaries; their assertions cannot be generalized into permission for casts elsewhere. The two Undici internal import suppressions document an exact-version adapter and need native/package qualification, not deletion without replacement.

**Data refinement.** Timestamp schemas at [ReleaseModel.ts:53](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/packages/ts-release/src/internal/ReleaseModel.ts#L53), 87 and 96 are `Schema.Number`, while `Decision.ts:146,186,211` checks nonnegative safe integers. Centralizing that existing invariant in a reusable schema may simplify ownership. It is not evidence that invalid times currently bypass journal admission. Review durable-format compatibility before changing decoding.

### G07 — P1: the native interruption audit stopped too early

**Observed.** The ContentStore patch addresses a real ownership pattern, but [apps/self-release/Model.ts:113](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/apps/self-release/src/Model.ts#L113) still wraps an entire async open/stat/read/close workflow in tryPromise without an AbortSignal or Effect-owned resource scope. [npm/Auth.ts:269](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/packages/npm/src/Auth.ts#L269) runs native Sigstore verification through a non-cancellable Promise with cache paths. These require explicit lifetime classification; the audit has not reproduced a leaked file or post-cancel mutation in either path.

**Target.** For every async adapter, record whether interruption aborts the native operation, joins it, or only detaches the caller; list which resources/native mutations can outlive the fiber. Scope resource acquisition and join settlement when necessary. Keep masks as small as the native ownership contract allows. The new [ContentStore.ts:16](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/packages/ts-release/src/platform/ContentStore.ts#L16) masks each native Promise; this can wait indefinitely for a hung filesystem operation, so it must not be described as a bounded cancellation guarantee.

**Keep/native exceptions.** Process/HTTP callbacks already own real child/socket shutdown and output limits. [Process.ts:59](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/packages/ts-release/src/platform/Process.ts#L59) and [HttpTransport.ts:140](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/packages/ts-release/src/platform/HttpTransport.ts#L140) use native watchdog timers. Decide whether these belong in the adapter or an Effect deadline after checking exact total-IO/process-group semantics; a mechanical HttpClient/ChildProcess replacement could weaken duplicate-header/wire-byte/uncertain-dispatch guarantees. Effect time belongs in logical retry/poll orchestration, as npm authentication already demonstrates.

**Proof.** Reuse real pending-TLS, subprocess, Git and installed-workflow checks for native claims. An isolated race check is justified only where the real workflow cannot reliably force the specific observed failure.

### G08 — P2: composability decisions remain inconsistent

**Observed.** Pending `runApplicationEffect` preserves factory E/R, but `Application.onRejected` remains fixed to `ReleaseError`/no services ([Application.ts:21](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/packages/ts-release/src/platform/Application.ts#L21)); provider preparation, transport, HTTP read, content owner and credential ports similarly capture complete implementations with closed requirements. This is an observable design tradeoff, not proof each needs generics or a Context service. Apple `DeriveDeliveryFiles<R>` already preserves caller R and `appleToolsLayer` explicitly captures required platform services.

**Target.** Decide and document which public extension points are composable callbacks and which represent fully constructed capabilities. Preserve E/R at the former; make construction requirements visible at the latter. Move concrete provision only when the current module does not own the choice. Keep `Host` provision inside Application because that is the application's subsystem composition edge.

**Additional idioms.** Review zero-argument operations and gen-only helper wrappers at nearby changes using version-matched diagnostics. Do not replace parameterized callback APIs or pure helpers merely to improve Effect.fn counts. The repository already uses named Effect.fn widely.

### G09 — P1: test architecture and the prior additions do not meet the peers' stated policy

**Observed.** `scripts/test.ts` runs Bun's root `test/reimplementation` tree. Package tests are not colocated; source/internal imports are common. Some native consumers run under Node and Bun, but this does not establish that every portable source suite executes under both. The shared [fixtures.ts:199](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/test/reimplementation/kernel/fixtures.ts#L199) runs Effects without the peer test-timeout signal contract. These are standards gaps, not claims the existing suite is useless.

**Prior patch review.** The new [content-store-lifecycle.mjs:13](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/test/reimplementation/kernel/content-store-lifecycle.mjs#L13) instruments native file handles; on Bun it also module-mocks `node:fs/promises` at line 59. It uses barriers to hold native operations, then 20ms wall-clock sleeps at lines 118 and 139 to infer unsettled/settled behavior. Those sleeps and implementation-count assertions deserve reconsideration under deterministic, failure-first selection rules. The outer subprocess timeout is a real-process watchdog and has a different purpose. An unforceable acquisition/close race can justify isolation; it does not justify every case in the fixture automatically.

The new HTTP cases exercise a useful secret/interruption boundary through the real transport preparation path, but the read/run × six-cause combinations require an explicit minimal-regression justification. The application addition includes valuable compile-time E/R assertions; those should be distinguished from runtime cases that repeat generic Effect behavior. No cited offending commit or demonstrated red-before-fix record accompanies these new files. Do not invent a historical test-first claim.

**Target.** Apply the testing skill to existing and proposed cases. Name the costly failure, strongest existing proof, remaining uncovered seam and why automation is necessary. Relocate retained owner tests in focused changes; keep cross-package tests on deliberate public exports. Preserve real Git/SQLite/native TLS and installed package/recovery evidence. Do not create a public testing package solely to accommodate relocation, and do not delete crash/replay protection merely because it uses a local fake.

### G10 — P2: observability policy is mostly names, without ownership criteria

**Observed.** Production has extensive named Effect.fn use, including very low-level hashing/admission operations; there is no explicit span data/lifetime policy comparable to Reactor's [CONTRIBUTING.md:86 (local snapshot)](reactor-sources.json#L80). The new guide's general preference for named operations does not determine when tracing begins/ends, whether a detached native operation outlives a span, or which fields are safe.

**Target.** Define trace boundaries around caller-cancellable application/provider operations and owned dispatch lifetime. Keep pure computation pure; select fnUntraced where a span adds no operational meaning. Bind safe plan/operation/dispatch identities and outcomes when useful; never raw credentials, request bodies, provider text or unbounded inputs. No telemetry backend or new runtime dependency is needed merely to write this policy.

**Proof.** Inspect one existing real release/observe/recovery flow with a test observer or current tracing facilities before adding infrastructure. Do not count span names as observability coverage.

### G11 — P1: validation evidence needs named scope and final-input identity

**Observed.** ts-release already has valuable strict installed declarations, actual tarballs, Action distribution checks and interrupted recovery against native local peers. However, [scripts/README.md:1](https://github.com/mannyc2/ts-release/blob/ec25cbe0d29e72e0fe545bc33a3c3badc4a6c25f/scripts/README.md#L1) describes a list of commands rather than the peers' explicit final verification profiles. CI uses a pinned Bun/Node combination while the previous local run used Bun 1.4.2 and Node 22.22.2; both engine compatibility and pinned reproduction must be reported accurately. A pass count cannot stand in for standards adoption, fresh final-source qualification or public publication.

**Target.** Define proportionate final gates for policy/docs, portable library, native adapters, public package/API, and release-delivery changes using existing commands. Record exact source/dirty identity, toolchain, command exits, required/native prerequisites and unexecuted checks. Use one fresh final relevant gate after inputs stop changing. Preserve read-only ordinary CI and separately authorized publication. Browserbase's upstream bootstrap and acceptance machinery need not be copied wholesale.

## Coverage of the earlier patch

| Earlier change | Useful contribution | Requirement still open |
| --- | --- | --- |
| `runApplicationEffect`, Node/Bun export and packed fixture | Preserves factory E/R, scope and outer runtime ownership | G04, G08: repository-wide error policy, all extension-point contracts and documented compatibility. G01–G03 remain untouched. |
| ContentStore scoped operations | Prevents the prior detached native workflow from owning handles after interruption completion | G07: other native workflows, exact native guarantees and hung-operation limit. G09: test necessity/order/determinism. |
| HTTP credential Cause handling | Preserves interruption while redacting failures and defects | G04: narrow credential exception versus ordinary parser bugs across all providers. |
| Standards prose and local AGENTS | Describes selected patterns | G01: ignored AGENTS/no CONTRIBUTING; no enforced lint/diagnostics; missing explicit exceptions/ownership and full validation policy. |
| Prior 356 passing tests and packed checks | Evidence for behaviors those runs exercised | Does not prove missing static rules, full-repository alignment, test value or failure-first ordering. |

## Refactor planning inputs and order

1. **Agree on the tracked standards and exceptions.** Select diagnostic/linter ownership, toolchain compatibility, host closures, public callback policy and testing selection rules. Explicitly exempt native wire grammars and the Action's installed-core boundary. Completion means one reviewable requirement-to-check mapping, not source churn.
2. **Make enforcement executable.** Introduce focused compiler/host configs and strict diagnostics/lint; extend the existing architecture checker. Triage actual output with the occurrence inventory. A blanket suppression list or softened gate is not completion.
3. **Correct shared error and decoding ownership.** Start with Error/Http boundary helpers and known JSON/SQL inputs, then provider-specific typed projections. Keep durable byte encodings, provider versions, journal semantics and secret redaction stable unless an explicit compatibility decision says otherwise.
4. **Complete lifecycle/composition review.** Classify remaining Promise workflows, zero-argument APIs and callback E/R at actual authority boundaries. Reassess and integrate the earlier three fixes under the new policy rather than restarting them blindly.
5. **Align test ownership and final gates.** Retain high-value recovery/native/installed proof, reduce duplicate or implementation-mirroring cases, and add automation only where the observed failure warrants it. Run final relevant gates once on settled inputs; report unavailable native platforms plainly.

These steps depend on each other. Do not combine a compiler/toolchain migration, wholesale error-algebra break, test relocation and protocol refactor into one opaque change. The priority is maintainable, enforceable ownership and truthful evidence—not maximizing new services, schemas, tests or files.

## Explicit keep decisions

- Keep Bundle/Plan/Journal as the durable authority and provider codecs as owners of opaque receipt meaning; never infer retry permission from interruption or missing observations.
- Keep pure decision/identity/rendering computations as values/functions. A named Context service is not a quality target for deterministic data work.
- Keep concrete native HTTP/Git/crypto/archive adapters wherever their protocol or ownership guarantees exceed a generic built-in's demonstrated contract.
- Keep scoped application construction, captured capability identities and the Action's reuse of the application's installed core. Splitting the native authority registry by bundling a second core is an established integration hazard.
- Keep Config/Redacted and native credentials outside durable/model-facing values. Preserve the credential redaction exception while distinguishing ordinary defects elsewhere.
- Keep real tarball consumers, strict declaration checking, native protocol/cleanup proof and interrupted durable recovery. Package/source tests and native evidence answer different questions.
- Keep version alignment and Bun workflow. Borrow the peers' coordinated upgrade discipline; do not borrow their entire upstream framework or compiler stack without a compatibility decision.
