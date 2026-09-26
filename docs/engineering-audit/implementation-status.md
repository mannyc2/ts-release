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

- **W3:** shared `attempt`/`matches` still normalize unexpected exceptions. Repair
  them by caller-visible slice while retaining privacy and Promise compatibility.
  Passing static diagnostics does not establish this semantic error policy.
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
