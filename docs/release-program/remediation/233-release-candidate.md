# Plan 233 — Release-candidate rewrite and certification readiness

Input-Commit: 3a5b7cef4437c5f59bc547481535ebbc83cf437f
Result-Commit: SELF
Evidence-Commit: SELF
Status: IMPLEMENTATION COMPLETE / CLEAN-X CERTIFICATION PENDING
Outcome: LOCAL GATES GREEN / CANDIDATE NOT YET CERTIFIED / ZERO LIVE MUTATION
Date: 2026-08-12

## Non-authority statement

This is the implementation handoff, not a release certificate. `SELF` means
the commit containing this ledger and implementation; it becomes candidate X
only after that commit is selected and is not accepted until the clean-clone
matrix passes. There is no evidence commit Y, clean-clone certificate, or
public mutation authority yet. Candidate certificate 221 remains invalidated
and live certificate 222 remains superseded. The prospective Plan 233
certificate is explicitly `NOT ISSUED` until every required local gate is
green from clean clones.

No npm package, GitHub tag, release, asset, branch, catalog, Action ref, PyPI
file, or marketplace was mutated. No production credential or public-provider
OIDC token was acquired; the OIDC evidence below uses only the local protocol
issuer/index. Plan 234 remains the sole kernel live-write phase and requires a
new exact operator packet after this candidate is accepted.

## Public-product disposition

The public documentation now leads with the retained user job: automate a
multi-artifact release and safely resume partial publication. Its order is:

1. local `release`;
2. one-job automatic Action release;
3. optional environment-gated prepare/publish;
4. preparation without publication;
5. read-only observation and same-bundle recovery;
6. exact-bound provider correction proposals;
7. separate capability, execution-host, artifact-target, and native-tool axes;
8. kernel-native extension translations and explicit deferred families.

The docs consistently use `prepared-release/v2`, exact verified-commit
materialization, npm/GitHub-only publication, host-owned credentials, and
proposal-only correction. PyPI prebuilt publication and Homebrew/Scoop delivery
are named as real regressions from live-published `0.0.7`, owned by separate
post-0.2.0 waves. Wrapper-wheel disposition remains an explicit future product
decision. The third-party adapter SDK is deferred rather than implied through
generic hooks.

The capability registry now contains five executable module values and the
generated page joins their declared field ownership, requirements,
certification-test counts, and dated evidence. The generated schema and
capability gates are locally green, the rendered page distinguishes declared
host/target requirements from certification, and it exposes no internal
plan-numbered test pathname. The behavioral feature-translation gate is also
locally green: 260 historical paths map to 44 exact families, and all 87
currently accepted fields join exactly once to 86 executable witnesses. Of
those witnesses, 82 change resolved intent, 61 change or refuse graph
semantics, and 57 change the release-graph digest used by preparation; 14
paired/discriminant invariants carry explicit invalid-combination refusals.
These local results still require clean-X repetition.

## Read-only public-coordinate evidence

The following public reads were made on 2026-08-12. They verify coordinates,
not provider publication correctness:

- `npm view @mannyc1/ts-release versions --json` returned published versions
  through `0.0.7`; no `0.2.0` exists.
- `npm view @mannyc1/ts-release name version dist-tags repository homepage license bin engines --json`
  returned canonical package `@mannyc1/ts-release`, latest `0.0.7`, repository
  `https://github.com/mannyc2/ts-release`, matching homepage, MIT license, and
  Bun engine `>=1.3.14`.
- `git ls-remote --tags origin refs/tags/v0.0.7 refs/tags/v0.2.0` returned
  `v0.0.7` at `af59436cff908fb52773cf18dd95d154f892b8de` and no `v0.2.0` ref.

Evidence class: `live-read-verified`, narrowly for those public coordinates.
No npm/GitHub subject equivalence, private visibility, OIDC, asset, or
post-write convergence claim follows from these reads.

## Passing worktree checks

These results are useful implementation feedback but are not clean-candidate
certification:

| Command | Current result | Evidence class |
| --- | --- | --- |
| `bun run check:readme` | PASS; 10 fenced blocks, 2 package imports, 1 built-declaration block | contract-tested |
| `bun run check:examples` | PASS; 5 examples + 5 templates all resolved, compiled, and durably prepared; exact graph/prepared subjects were 7 GitHub + 9 npm, with 12 portable target artifacts, 4 unsupported migration refusals, and exact automatic/reviewed workflow-auth pairing | contract-tested |
| `bun test test/core/workflow-shape.test.ts test/action-plan233-workflow-protocol.test.ts` | PASS; 9 tests, 138 expectations; automatic and reviewed YAML/config pairs carry exact matching workflow identity, install Bun before every Action invocation, and drive fresh, same-run, and authenticated cross-run recovery through the real Action/coordinator plus shared npm/GitHub protocol doubles | contract-tested |
| `bun test test/core/preparation-mode.test.ts` | PASS; partition/merge recognized and refused, 4 tests | contract-tested |
| `bun run check:versions` | PASS; 11 version sites, including exact Effect peers and node-shared closure pin | contract-tested |
| `bun run check:recovery-docs` | PASS; 2 installed provider profiles | contract-tested |
| `bun run check` | PASS; TypeScript no-emit check | contract-tested |
| `bun test test/core/init.test.ts` | PASS; 4 tests, including explicit auth and missing-repository refusal | contract-tested |
| Real `bun run cli init --preset bun-npm-github` in a clean temporary Git fixture | PASS; discovered `owner/plan233-init-smoke`, wrote explicit trusted auth, strict decode passed | contract-tested |
| `bun run check:agents` | PASS; typecheck, 2 byte-deterministic provider archives, 2 archive-only disposable provider-native installs, 0 root canonical owners, 3 tests / 22 expectations | contract-tested |
| `bun test test/script-bun-targets.test.ts` | PASS; 9 tests / 13 expectations; exact four-target projection and strict Windows x64/arm64 refusal | contract-tested |
| `bun run check:action-bundle` | PASS; 3 commands, 2 outputs | contract-tested |
| `bun run check:cli-bundle` | PASS; Node bundle exposes 7 commands | contract-tested |
| Final Action/workflow focus after attempt-bound cross-run integration | PASS; 30 tests, 276 expectations; one-element arrays and ordinary one-field records retain JSON structure, producer runs are authenticated before cross-run artifact access, rerun attempts cannot shadow older prepared references, and the checked-in bundle was rebuilt | contract-tested |
| `bun run check:config-schema` | PASS; generated schema matches the current authored schema | source-derived + contract-tested |
| `bun run check:capabilities` | PASS; generated capability inventory matches the current executable registry and dated evidence, and all four advertised targets real-cross-compile with matching ELF/Mach-O architecture headers | source-derived + contract-tested |
| `bun run check:feature-translation` | PASS; 260 historical paths / 44 families, all 87 accepted fields joined once to 86 executable witnesses; 82 resolved-intent effects, 61 graph effects/refusals, 57 release-graph-digest effects, and 14 paired/discriminant refusal invariants | contract-tested |
| Plan 225 least-authority/host-admission focus | PASS; anonymous npm observation and exact GitHub repository/workflow/ref/hosted-runner/direct-sink admission were exercised without a public provider; final aggregate clean-X repeat remains required | contract-tested |
| `bun run check:package-exports` | PASS after the stabilized build | contract-tested |
| `bun run check:packed-consumers` with runner-bundled Node 24.15.0 / npm 11.12.1 | PASS; offline Bun and npm installs, exact Effect beta.83 alignment, Promise API plus Node CLI operation, 1/2-artifact durable reloads, 23 Markdown files and 5 relative links audited | contract-tested |
| `bun test` after final attempt-bound Action artifact integration | PASS; 343 tests, 1 environment-gated skip, 0 failures, 1,928 expectations; the skipped installed-npm source contract passed separately with cached npm 11.18.0 (1 test / 5 expectations) | contract-tested |
| `npm 11.18.0 pack --json --ignore-scripts --dry-run` | PASS after rebuilding the public root package; 419 files, 618,108 compressed bytes, 3,126,778 unpacked bytes | source-derived |
| Scoped handoff `git diff --check` plus explicit untracked-file whitespace audit | PASS; repository-wide exact-X rerun remains required | source-derived |

The workflow output contract is no longer ornamental. Each Action invocation
has an id, and an `always()` step uploads only that step's redacted
`report-ref`. The workflow test continues to forbid generic prepared-bundle
upload/download duplication.

## Current failing or open gates

| Gate | Current disposition | Required closure |
| --- | --- | --- |
| Generated schema, capability inventory, and behavioral field-effect gate | local PASS; clean-X repeat OPEN | Repeat the generated gates and all 86 executable witnesses from both clean clones. Do not infer target execution or candidate certification from the local pass. |
| Four retained artifact targets | local real cross-compile/header PASS; clean-X repeat OPEN | Repeat Linux x64/arm64 and macOS x64/arm64 compilation/header proof from both clean clones; keep Windows x64/arm64 strict-decode refusals. |
| `bun run check:package-exports` | stabilized local PASS | Repeat declarations, built-JavaScript imports, and the external-consumer operation from clean X. |
| `bun run check:self-release-context` | expected dirty-source refusal | Re-run from clean X. Do not weaken `source.clean`. |
| `ts-release init --preset bun-npm-github` | local process green; clean X repeat pending | The preset discovers repository, emits explicit auth, strictly inspects the final object, and passed a real temporary-repository process smoke. Repeat with the built candidate CLI on clean X. |
| Package metadata/changelog | outcome, coordinates, files, and pending changelog corrected; current-worktree local PASS; clean-X repeat OPEN | The root Node engine is `^22.22.2 || ^24.15.0 || >=26.0.0`, matching the authoritative transitive dependency floor. The complete offline consumer gate passed under genuine Node 24.15.0 / npm 11.12.1. Separately repeat the Action's Linux composite command with workflow-installed Bun 1.3.14. |
| Packed package | final inventory and admitted-Node consumer matrix PASS; clean-X/normal-registry rows OPEN | The current tarball contains 419 files and is 618,108 compressed bytes / 3,126,778 unpacked bytes. Offline Bun/npm installs, exact Effect alignment, Promise API, Node CLI inspection, and 1/2-artifact bundle reloads passed under Node 24.15.0. Repeat the matrix from X. A normal-registry install remains a separate `UNVERIFIED` row. |
| Immutable Action bootstrap | `v0.2.0` does not exist | The self-release context/prepared gates now assert GitHub-before-npm order. Run them on clean X and prove the workflow/provider sequence makes the Action coordinate usable before npm exposes its README; source ordering alone is insufficient. |

The package `files` list excludes `docs/`, while `README.md`, `SPEC.md`,
`ARCHITECTURE.md`, `CHANGELOG.md`, and `LICENSE` are included. The
post-hard-cut current-worktree tarball's packaged relative links were complete,
but any later build or source change invalidates that inventory and requires a
new exact-X audit.

## Certification matrix status

### Clean source and preparation

- **OPEN:** select result commit X and use two independent new clean Linux
  clones.
- **IMPLEMENTED / NOT CLEAN-CERTIFIED:** exact-commit private materialization,
  ignored/untracked refusal, staged input mutation checks, manifest/blob
  validation, and fresh-process store reload.
- **OPEN:** independent preparation twice and record exact reproducibility or
  the precise byte differences.
- **OPEN:** run the complete prepared-store fault/concurrent-writer matrix on X.
- **LOCAL PASS:** reserved partition/merge inputs fail with typed
  `PreparationModeUnsupported`; repeat on X and prove no partial durable object.
- **LOCAL PASS / CLEAN-X REPEAT REQUIRED:** the installed source-preparation
  contributor links runtime-discovered collection contracts through the root
  API. The focused suite covers graph inspection, 0/1/3-member capture,
  deterministic member ids/order, exact GitHub selection, durable reload
  without rerunning the producer, and contract/cardinality/content refusals.

### Public surfaces

- **LOCAL PASS / CLEAN-X REPEAT REQUIRED:** the final packed tarball inventory
  and complete offline consumer matrix passed with genuine Node 24.15.0 / npm
  11.12.1. The gate proved Bun/npm installation from the exact dependency
  closure, exact Effect beta.83 alignment, Promise/CLI operation, and `[1,2]`
  artifact-array bundle reloads. Repeat the whole matrix from clean X. A
  normal-registry install remains a separate `UNVERIFIED` row.
- **OPEN:** real-process Node CLI smoke on the only claimed execution host,
  Linux, including preparation/isolated-command paths that require external Bun
  and `libseccomp.so.2`.
- **LOCAL PASS / CLEAN-X REPEAT REQUIRED:** the Action declares a Linux
  composite runtime, every advertised workflow installs Bun 1.3.14 before the
  Action, and `check:action-bundle` executes the exact Bun entrypoint command.
- **LOCAL PASS / CLEAN-X REPEAT REQUIRED:** the Promise consumer against built
  declarations and JavaScript plus the packed Bun and admitted-Node operation
  smokes passed, including exact 1/2-element artifact arrays.
- **LOCAL PASS / CLEAN-X REPEAT REQUIRED:** automatic and reviewed workflows
  parse and execute against the shared provider protocol fixtures through the
  real Action/coordinator, including the redacted report-output contract.
- **LOCAL PASS / CLEAN REPEAT REQUIRED:** the 2 generated Codex/Claude archives
  installed into disposable provider-native
  `.codex/plugins/cache/local-archive/ts-release/0.2.0` and
  `.claude/plugins/cache/local-archive/ts-release/0.2.0` layouts;
  both native manifests and skills were present, the installed Claude package
  passed strict provider validation, and the tracked-root canonical-owner count
  was zero.

### Credentials and status

- **LOCAL PASS / CLEAN-X REPEAT REQUIRED:** npm observation is anonymous-only;
  the publish grant is not registered with the read sink, and authenticated
  private/custom-registry reads are explicitly unsupported instead of silently
  reusing publication authority. Token and workload grants bind the exact
  subject, provider, canonical registry, and purpose.
- **LOCAL PASS / CLEAN-X REPEAT REQUIRED:** before reading either OIDC request
  value, the real host boundary verifies GitHub Actions, exact repository,
  workflow path/ref, hosted-runner identity, direct publish action, and the
  certified npm sink. Wrong repository/path/ref/runner/action/sink and missing
  OIDC cases fail before publisher spawn. Those authority suites passed
  locally; after the reviewed config addition, the final workflow/auth pairing
  passed 7 tests and 92 expectations without contacting a public provider.
- **LOCAL EVIDENCE / CLEAN-X AGGREGATE REQUIRED:** corrupt/invalid-origin and
  foreign-audience cases must continue to read zero mutation credentials when
  the full candidate matrix repeats.
- **LOCAL PASS / CLEAN-X REPEAT REQUIRED:** read-only,
  equivalent/conflict/inconclusive, and before-dispatch refusal paths retain
  lazy exact-purpose authority; rerun the complete matrix on X.
- **LOCAL PASS / CLEAN-X AGGREGATE REQUIRED:** scoped token/config cleanup on
  success, typed failure, defect, and interruption, plus host output/report
  redaction, passed deterministic suites. Repeat all cleanup faults together on
  X.

### Kernel provider correctness

- **LOCAL IMPLEMENTATION EVIDENCE / CANDIDATE ROW OPEN:** versioned npm/GitHub
  protocol doubles and sanitized canonical transcripts exist, the deterministic
  provider suites have passed locally, and npm least-authority/OIDC host
  admission is closed locally. Neither provider is candidate-certified until
  the full matrix repeats on clean X and the sanitized transcripts are attached
  to the issued certificate.
- **LOCAL PASS:** generated recovery-profile docs agree with two installed
  profiles.
- **UNVERIFIED:** live read-convergence timing. Protocol doubles inject lag
  deterministically; no non-mutating candidate phase can measure post-write
  visibility or repin timing defaults.
- **UNVERIFIED:** opt-in live-read replay for the allowed public read subset.

### Capability truth

- **LOCAL PASS / CLEAN REPEAT REQUIRED:** generated registry joins five
  installed modules to exact fields and dated evidence while distinguishing
  declarations from clean-candidate host/target certification.
- **LOCAL PASS / CLEAN REPEAT REQUIRED:** all 10 retained public
  examples/templates strictly decoded, resolved against deterministic observed
  facts, compiled, and passed root `inspect`/`prepare` plus durable prepared
  inspection. Exact graph and prepared subjects each totalled 7 GitHub + 9 npm;
  the three portable configurations each produced the exact four retained
  targets (12 target artifacts total).
- **LOCAL PASS / CLEAN-X REPEAT REQUIRED:** all 87 accepted fields join exactly
  once to 86 executable witnesses across 44 families; 82 witnesses change
  resolved intent, 61 change or refuse graph semantics, 57 change the durable
  release-graph basis, and 14 paired/discriminant invariants explicitly refuse
  invalid combinations. Repeat the behavioral gate from both clean clones.
- **LOCAL PASS / CLEAN-X REPEAT REQUIRED:** the canonical advertised
  target vocabulary is exactly Linux x64/arm64 and macOS x64/arm64. Windows
  x64 and arm64 are both absent and strict config decode rejects both. The
  generated page is current, and all four targets locally cross-compiled with
  matching ELF/Mach-O architecture headers. Repeat that proof from X.
  Cross-compilation is not macOS execution-host evidence, and macOS is not an
  installed execution host for this candidate.
- **LOCAL PASS / CLEAN REPEAT REQUIRED:** unsupported PyPI, Homebrew, Scoop,
  and generic catalog authored forms each fail strict decode at their exact
  field. Their migration-only directories contain no runnable config and the
  explicit migration notes are asserted by the executable gate.

## Provisional measurements

The final pre-X source measurement reports 69 product TypeScript files / 12,155
lines, 10 app files / 1,724 lines, 7 self-release gate files / 653 lines, and
77 test files / 15,216 lines / 284 declared cases. Four workflow files contain
273 lines and six jobs. README is 294 lines; changelog is 80 lines. The Action
has three inputs and two outputs. Authored and resolved schemas each contain 87
property paths. Five installed capability modules and four explicit unsupported
families are present. Retired command/review/authority vocabulary scans are
empty.

The npm 11.18.0 pre-X inventory contains 419 files, 618,108 compressed bytes,
and 3,126,778 unpacked bytes. The full offline consumer matrix passed with Node
24.15.0 / npm 11.12.1. Exact-X certification must rerun every source and
package measurement, and add prepared artifact totals, per-target compressed
and uncompressed sizes, executable sizes, and reproducibility digests. These
pre-X figures are implementation feedback, not candidate evidence.

## External and live blockers

- A local GitHub Actions runner installation supplies genuine Node 24.15.0 and
  npm 11.12.1, satisfying the exact engine floor; its offline packed-consumer
  matrix is green. Registry-backed installation remains unavailable after
  sandbox DNS failure and rejected network escalation, so that distinct
  normal-registry row is `UNVERIFIED`, not an offline-consumer failure.
- A clean Linux workflow host must install pinned Bun before every Action
  invocation and execute the composite Action entrypoint independently of the
  installed package's Node engine.
- `v0.2.0` is absent from the canonical Git remote and npm latest is `0.0.7`.
  This is expected before live release but blocks immutable-reference claims.
- No production npm/GitHub mutation credential was acquired or used, and no
  exact operator authority exists. An environment variable's mere presence is
  not credential admission or release authority; no remote read was attempted.
  Destination state remains `UNVERIFIED`.
- Live post-write convergence, response-loss recovery against real providers,
  and immutable consumer smoke require the separately authorized live phase.

## Certificate issuance rule

After every local row is green, commit product/docs/tests as X and certify only
clean clones of X. Commit one evidence-only certificate as Y with `Y^ = X`,
`Result-Commit: X`, and `Evidence-Commit: SELF`. The certificate must attach
sanitized protocol transcripts, state all non-reproduction and skipped facts,
and list every live read/write not performed as `UNVERIFIED`.

Until then, `docs/release-program/certifications/233-release-candidate.md` is a
non-authoritative placeholder and must not supersede the invalidated 221
certificate.
