# First implementation milestone

This is the implementation record for `codex/engineering-standards`, based on
published 0.4.2 main, `fa50ce368c50e9a28a2e57f667d454374e7b209c`. The adjacent audits
and inventories are dated research snapshots. They do not describe every line
of the current implementation or establish completion of all 36 requirements.
The older `ec25cbe` checkpoint was reviewed change by change rather than merged.

## Implemented scope

- **W0:** completed the [checkpoint disposition](w0-checkpoint-review.md), including
  Promise compatibility, test necessity and remaining native lifecycle work.
- **W1:** tracked AGENTS/CONTRIBUTING, a qualified patched compiler, type-aware
  lint, blocking diagnostics and unused suppressions, formatting, strict compiler
  flags, and CI static checks before native fixture setup. Direct build scripts
  also reject an unpatched compiler before changing outputs.
- **W2 enforcement:** explicit compiler environments, all production package
  exports, dependency directions including type imports, case-correct targets,
  runtime cycles, and two narrowly owned computed loads. Portable Git declarations
  no longer depend on the native host's interface owner. The import inventory
  covers 95 source files, 663 edges and 15 public entries.
- **Selected W3/W4 changes:** schema decoding at known native/provider/tooling
  boundaries; checked indexes and owned callback contracts; an additive scoped
  `runApplicationEffect` preserving factory E/R; credential interruption and
  mixed-cause redaction; exact GitHub tag-type admission; OpenAI skill discovery
  without an undefined name for a root-level `SKILL.md`.
- **Selected W5 integration:** the existing static and portable runtime commands
  compose without rerunning the entire static profile in CI. Existing native,
  packed and installed workflow checks remain the delivery authorities.

Runtime Effect/platform packages remain aligned on `4.0.0-rc.115`. Qualified
development tools are TypeScript `7.0.2`, `@effect/tsgo` `0.45.0`, Oxlint `1.82.0`
and `oxlint-tsgolint` `7.0.2001`. The `typescript-api` alias at `6.0.3` supplies only
the JavaScript AST parser removed from TypeScript 7; it does not own diagnostics.
The narrow `TextDecoderOptions` declaration compatibility is explained in
[CONTRIBUTING](../../CONTRIBUTING.md#compiler-and-import-closures).

The Promise/module application runner retains its 0.4.2 factory-throw behavior;
the new Effect entrypoint is lazy and preserves synchronous factory defects.
Bundle, Plan, request, journal and publication authorization remain the existing
authorities. Generated Action/starter files are regenerated from their owners.
No new package version or publication is part of this milestone.

## Evidence and interpretation

Final qualification uses Linux x64, Bun `1.3.14`, Node `22.22.2`, and the existing
pinned native Python/Homebrew/Scoop/PowerShell fixtures. Native listeners and
process pipes require execution outside this environment's restricted sandbox;
the initial restricted Git failures reproduced its stdin `EPERM` limitation and
passed unchanged with that capability available.

| Check                                                        | Result and claim                                                                                                                                                                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clean frozen install; install with lifecycle scripts omitted | Normal installation patches the exact compiler; the stock compiler is rejected by the guard.                                                                                                                           |
| Compiler/linter negative controls                            | Warning-only and error-only Effect findings, unused Effect directives, unsafe typed values and unused lint disables independently fail.                                                                                |
| Import negative controls                                     | Baseline accepted four forbidden patterns; the new gate rejects computed loads, upward type imports, runtime cycles and private provider subpaths. Declaration-level erased type cycles remain valid.                  |
| All 11 compiler projects                                     | Zero diagnostics, including portable and Node core closures.                                                                                                                                                           |
| `bun run check`                                              | Passed: formatting, build, strict lint, root/closure types, import graph and public entries.                                                                                                                           |
| Provenance runtime and `bun run test`                        | Native Sigstore trust-root verification passed on Node; 351 tests passed, 0 failed, 3,737 assertions across 57 files.                                                                                                  |
| `bun run check:packed-kernel`                                | Passed under Bun/npm installs, including strict installed declarations and factory E/R inference.                                                                                                                      |
| `bun run check:packed-catalog`                               | Initial run caught a NodeJS type leak in MCP's emitted `render` return type. Explicit standard typed-array annotation fixed it; final static checks, all four MCP tests and this seven-package installed check passed. |
| `bun run check:packed-action`                                | Passed under Bun/npm installs on Node 22.22.2, with real installed resolution, fresh-runner equivalence and no extra send.                                                                                             |
| `bun run check:installed-workflow`                           | Passed: CLI and Action ordinary/interrupted runs, installed observation, continuation and completed-release recognition.                                                                                               |

The aggregate runtime command stopped at the original MCP declaration failure.
After the annotation-only correction, verification resumed at the affected
packed provider stage and continued through the remaining stages. The unchanged
351-test suite and packed core were not unnecessarily repeated; this record
does not claim one uninterrupted successful aggregate invocation.

The concrete GitHub malformed-tag regression and credential interruption
regression were observed failing before their fixes and passing afterward.
Application proof covers the specific lazy factory-throw seam and preservation
of the legacy Promise behavior. Installed declaration consumers check exact
factory error/service inference; the packed runtime check uses an already
satisfied journal to prove the new public export works without another send.
The OpenAI skill-name correction has a direct before/after probe, without adding
another committed test case. Existing fixture cleanups add no proof by themselves.

With `verbatimModuleSyntax`, `import { type T }` and `export { type T }` emit empty
runtime imports. Only declaration-level `import type` / `export type` erase those
edges. Both TypeScript 6 and the qualified TypeScript 7 confirmed this. The older
inventory's runtime-cycle method excluded inline all-type imports, so its empty
cycle list alone was incomplete evidence; the current checker corrects that.

## Remaining work

- **W3:** provider `makeDataBoundary.attempt`/`admit`/`matches` still normalize
  unexpected exceptions. Core `attempt` is repaired in the subsequent increment
  below. Continue by caller-visible slice while retaining privacy and Promise
  compatibility; static diagnostics alone do not establish the semantic policy.
- **W4:** the ContentStore acquisition/write interruption repair is completed in
  the subsequent increment below. The checkpoint's broad instrumentation matrix
  was deliberately not copied. Other capability-inventory decisions and native
  adapter/platform comparisons still require their own qualification.
- **W2/W5:** finish the whole-suite retention/ownership review and remaining
  public declaration/example completeness work. Static import analysis does not
  prove arbitrary external initialization pure. Untyped installed JS fixtures
  retain the documented unsafe-any exceptions; this is not blanket TS exclusion.
- **W6:** registry observation deadlines, repaired-executor recovery, full request
  preflight and smaller adoption recipes remain separate product increments in
  the [incident mapping](incident-to-plan.md) and [plan](refactor-plan.md).
- **W7:** complete requirement-by-requirement migration qualification. This Linux
  run does not certify macOS, Windows, every supported Node engine, live OIDC/
  Sigstore publication, or the privileged hosted distribution profile.

Research markdown and inventories are review artifacts in the repository. Package
file allowlists exclude them from published archives. Unrelated repository names
from the discovery census are omitted; the count and relevant findings remain.

## Subsequent content lifecycle increment

Branch `codex/content-store-lifecycle` starts at the completed local milestone
`32fe7cdb4335d0ec269859772ced519367a292b7`. It closes the specific ContentStore
item above: two native settlement races failed on that baseline and pass with
per-operation joining, bracketed handles and guarded temporary cleanup. Existing
Bundle/adoption checks, packed core consumers and installed CLI/Action recovery
also pass. See [the increment record](content-store-lifecycle.md) for exact proof
selection, source hashes and limits. Other W3–W7 work remains as listed above;
this increment does not establish completion of the entire standards migration.

## Provider validation and starter closure

Branch `codex/provider-validation-defects` continues from content lifecycle
commit `07eff4faba15483d5d80879c493c3233733344c5`. A separate starter fix closes
a reproduced missing-module failure in the documented input command. Its
workspace schemas are bundled from their existing source; package dependencies
resolve from the adopter's installation. The actual generated command passed
in an isolated installed consumer without publication authorization; see
[starter dependency closure](starter-dependency-closure.md).

Complete-plan provider validation now preserves unexpected thrown values as
defects, local domain-error identity, foreign tagged domain-error fields and
safe schema refusals. The change is confined to the captured synchronous
callback on an admitted Plan. The [slice record](provider-validation-defects.md)
includes failing evidence, a corrected Cause-inspection assertion, subsequent
baseline control and final checks. It does not change the global admission
helpers or the documented credential/legacy Promise projections.

Final static checks, nine dependency tests, 45 existing GitHub/application/CLI
tests and packed Bun/npm core qualification passed. The separate
[closure review](standards-closure-review.md) identifies justified native
exceptions and concrete remaining test/lifecycle/profile work; milestone one
and these increments are still not completion of all 36 requirements.

## Verification ownership and clock increment

Branch `codex/verification-ownership` starts at
`e0bedee2433e7d2dccee94131c8f51824ac97902`. Four cross-owner tests now use public
core APIs or native fixture setup, and the shared Git fixture uses the public
Bundle entry. All existing cases remain; one duplicate private-verifier assertion
was removed from four GitHub DAG rows because the retained public rerun validates
that history. See [the ownership decisions](test-ownership.md).

The existing npm authentication retry and timeout scenarios now use TestClock
and own their root fibers through Bun's finish hook. A temporary runner-timeout
probe established joined cleanup and caught an abandoned-Promise rejection;
the retained pattern awaits an Exit and still rethrows active-test failures.
No new test case or harness was added. See [clock evidence](logical-clock-tests.md).

The affected selections passed: 44 cross-owner tests, 20 shared-fixture tests
(with the nested-build self-release case subsequently requalified alone), and
six authentication tests. Full static checks passed. Runtime source and package
artifacts are unchanged. [Maintained check profiles](../../scripts/README.md)
now name their actual stages and limitations instead of calling the portable
profile the full local suite. Other lifecycle/error-policy and whole-suite
retention decisions remain subject to the closure review; this is a bounded W5
increment, not a full migration-completion claim.

The [core error-policy prerequisite inventory](core-error-policy-prerequisites.md)
now identifies each native/parser owner that needs local failure translation
before narrowing shared `attempt`. It also records credential privacy and
post-dispatch ambiguity contracts that a global replacement must preserve.

## Strict core error classification

Branch `codex/core-error-policy` starts at
`f82f4a19656fdd2f0c7629f0715895365182b3e9`. Shared core admission now preserves
programming defects, known release-error fields across package constructors and
safe schema refusals. Native JSON/UTF-8, file/SQLite, HTTP header and OIDC owners
classify expected native rejection locally. Plan's separate strict validator
classifier is deduplicated. A receipt-classifier defect after dispatch leaves
unresolved history without authorizing ordinary resend; malformed receipt data
still records the existing durable undecodable evidence.

Returned-credential getters previously leaked private text through typed errors;
the reproduced leak is now projected safely. Non-string headers are rejected
before coercion (`undefined` changes from `invalid-data` to `http-headers`).
Using a SQLite journal after its owning scope closes is a defect, reflected in
the existing installed consumer's closure assertion. Full native compatibility
decisions, failing evidence and limits are in the
[implementation record](core-error-policy-implementation.md).

Final static checks passed, followed by 358 behavior tests (3,769 assertions),
packed core under both installers, seven-package catalog/native consumers,
packed Action, and installed CLI/Action ordinary/interrupted workflows. The
aggregate initially stopped on the old closed-store typed-failure expectation;
after correcting that existing assertion, packed core and all remaining stages
passed. No uninterrupted aggregate pass is claimed. Runtime source stayed frozen
through qualification and Effect/platform remain rc.115.

Provider/application-local broad helpers, self-release and Sigstore lifetime
joining, HTTP/SQLite cleanup classification, complete test-retention review and
final W7 closure remain open. R32–R34 product improvements remain separate work.
These local commits have not been pushed to the new implementation branch; the
earlier checkpoint approval does not satisfy the automatic review's direct
approval requirement for that destination.
