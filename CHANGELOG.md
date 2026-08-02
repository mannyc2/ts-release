# Changelog

## 0.2.0 - pending

The first release of the rewritten ts-release, and the first entry in this
changelog. The last published version was 0.0.7 (2026-06-29); everything below
is the delta from it. The public API, the CLI, the Action, the configuration
format, and the durable document formats are all new. This is an intentional
hard cut: the old verbs and document formats are not accepted. Migration is
documented in `README.md`.

Publication remains operator-dispatched. ts-release plans and materializes on
its own; nothing reaches a registry without an explicit apply.

### Breaking

- Replaced the former lifecycle API with value-only `plan` and
  canonical-bytes-only `apply`; `reviewExecution` is a pure review helper.
- Replaced the six-command CLI with exactly `init`, `doctor`, `plan`, `apply`,
  and `ship`.
- Replaced Action commands with exactly `plan`, `doctor`, and `apply`, and
  added explicit plan, review, receipt, run, status, and evidence outputs.
- Replaced `release-plan/v5` with canonical `release-plan/v6`.
- Replaced durable `release-evidence/v3` with `run-ledger/v1`; evidence is now
  a derived projection.
- `versionFrom` and `project.tagTemplate` are no longer accepted by the
  canonical config — they had no behavior there, and are authoring directives
  now (see Configuration below).
- A config without `project.commit` is refused instead of planning the
  identity `unknown`.
- Made configuration file loading app-owned and one-read. Core configuration is
  a strict JSON-compatible value with no path or encoding parser.
- Required absolute, existing, realpath-normalized workspaces.
- Removed mutable runtime swapping, runtime profile registration, old lifecycle
  aliases, fallback durable readers, and config translation DTOs.
- Moved all product code into its permanent model, config, recipe, plan,
  driver, apply, view, and API owners; removed the legacy engine and
  compatibility spine.
- Deleted the distributed-execution subsystem, its operations, and its
  profiles. Execution is single-machine; receipts are validated by hash
  self-consistency.

### Installing and running

- The published `ts-release` executable is a Node bundle, so `npx ts-release`
  works on a machine without Bun. Bun remains a supported host.
- `effect`, `@effect/platform-node`, and `@effect/platform-bun` are
  peerDependencies; npm 7+ and bun install them automatically.
- ts-release runs on Linux and macOS hosts. Windows remains a supported release
  target.

### Commands and API

- Added `ts-release ship`: plan, self-confirm, and apply in one command. The
  approval receipts it mints record the reviewer `self:one-shot`, so a one-shot
  run stays distinguishable from a reviewed one in the ledger. The staged
  commands are unchanged.
- Gave the CLI a real front door: the commands are declared with
  `effect/unstable/cli`, so `--help`, `--version`, and typed flag errors work.
  Every JSON output line is unchanged.
- Made `makeReleaseApi` publicly usable: the package exports the service tags
  and shapes (`RunStore`, `WorkspaceStore`, `CredentialStore`, `DriverCatalog`,
  `ApprovalSigner`), the permit classes an `ApprovalSigner` returns, the
  platform-generic `ReleaseServicesLive` layer, and prebuilt host layers at
  `@mannyc1/ts-release/node` and `@mannyc1/ts-release/bun`. The root
  `plan`/`reviewExecution`/`apply` convenience functions bind to the Node
  platform layer and work under both runtimes.
- Public inputs are decoded once with Schema at the API boundary: excess
  properties and malformed values are refused, and the CLI and the Action
  refuse the same input identically. Branded id constructors (`PlanId`,
  `OperationId`, review ids, `Stage`) are exported.

### Configuration

- Configuration has an authored form: `version`, `tag`, `commit`, and `name`
  may be omitted and observed instead. `plan --from-git` / `ship --from-git`
  (CLI) and `resolve: github` (Action) observe the repository's facts, and
  `resolveConfig` resolves them into the canonical value deterministically — a
  fact that contradicts the config is refused, never silently preferred.
- `schema/release-config.schema.json` is generated from that authored shape,
  and shipped configs point `$schema` at it. A freshness gate fails the build
  if the artifact stops matching the schema it is generated from.
- Catalog download URLs are derived at plan time and refuse when no repository
  is stated, instead of publishing a URL containing the literal text
  `undefined`.
- Restored the files-only archive contract: `archives[].files` decodes strictly
  as safe workspace-relative patterns, flows into the durable plan as optional
  `Pack.files`, and materializes deterministic recursive archive entries
  (sorted, deduplicated, symlink-contained, never self-including). Plans
  without file patterns keep their exact `release-plan/v6` bytes and operation
  hashes.

### Release execution

- Added immutable execution scope, run-bound execution receipts, observed
  publish review, run-bound publish receipts, monotonic staged apply,
  reconciliation, and explicit operator resolutions.
- Added `retry` to the apply input: a failed-before-commit operation can be
  retried by id without editing the ledger by hand, and a run lease left behind
  by a killed process is stolen once it is stale.
- `newRun` names the run DIRECTORY, and a resume accepts either that directory
  or the ledger file. Run identity is anchored to the plan, so a ledger from a
  different plan is refused instead of silently resumed.
- Credential values no longer reach durable data: child output is recorded as a
  bounded excerpt with declared environment values and known token shapes
  redacted, and every registry URL passes one HTTPS policy.
- Dispatch evidence distinguishes what reached the wire from what did not, so
  an unknown commitment is never recorded as a failure to dispatch.
- Fixed the release handoff: a materialize-only apply emits the publish review
  that its publish job confirms, which the staged three-job workflow needs.
- Made workspace snapshot reads portable to macOS: the containment check proves
  the realpath-resolved location is the exact opened file by device and inode
  instead of resolving the descriptor through Linux-only procfs.

### Targets and channels

- Added deterministic changelog generation, reviewed validation-time note
  transformation, and closed announcement operations for thirteen HTTP-like
  channels plus SMTP.
- Added typed package, supply-chain, provider, and announcement profiles with
  immutable contract fixtures.
- Made Homebrew, Scoop, package, and provider profiles product-owned and
  immutable.

### GitHub Action and workflows

- Added a reusable release workflow: a consumer calls
  `mannyc2/ts-release-action/.github/workflows/release.yml@v0` with a config
  and an environment, and gets the whole staged pipeline — plan ungated,
  materialize and publish behind the environment, ids threaded, plan bytes
  carried as artifacts. Protect the environment to require approvals; leave it
  unprotected for a one-shot pipeline. The reviewer recorded in the run's
  receipts is probed from the environment's actual protection rules. The three
  hand-threaded workflow templates are replaced by one that calls it.
- Fixed the Action host: the live driver layer no longer uses Bun-only APIs, so
  `Exec`, `Pack` (glob patterns and tar.gz), and command-based publish
  operations run correctly under the Action's node20 runtime. The action-bundle
  gate executes the built bundle under real Node against a fixture release
  covering those paths.

### Agent plugin

- Added the `ts-release` agent plugin: one shared `release` skill with five
  self-contained references and eight behavioral eval cases, packaged with
  native OpenAI/Codex and Claude Code manifests, repo marketplace catalogs
  (`.agents/plugins/marketplace.json`, `.claude-plugin/marketplace.json`), and
  a `check:skill-plugin` structural gate. The release ships
  `ts-release-plugin-{version}.zip` plus a checksums file as GitHub release
  assets. Public directory submission stays a manual operator action
  (`docs/skill-distribution.md`).

### Documentation and gates

- Added `docs/comparison.md` (per-axis, no headline verdict), `docs/recovery.md`,
  and `docs/release-runbook.md`, and rewrote the README to lead with outcomes.
  Every comparative or coverage sentence carries a machine-checked annotation;
  `check:docs-claims` fails on one that stops resolving, and on phrasing that
  would assert an observation of a tool this project has never executed.
- Reordered `check:core` so the cheap policy gates (`check:versions`,
  `check:import-rules`, `check:tree-shaking`) run before the build, and added
  `check:summary`, which runs every gate and prints a pass/fail table instead
  of stopping at the first failure.
- Behavior is covered by the feature suites (`test/features/`) and driver
  conformance (`test/core/`). The docs-derived GoReleaser parity ledger and the
  semantic-line apparatus were removed in `e3a3a14`; the counts they produced
  are withdrawn.

### Internal

- Internal readability refactor with identical public behavior: one authority
  predicate for remote-publish operations, shared canonical-JSON hashing, an
  `ApplyContext` for the apply orchestrator, and removal of dead driver service
  seams and `rewrite`-era names (trace spans, service keys, and the app
  `cutover` modules, now `commands`).
- tar.gz archive bytes changed once (explicit zlib level, canonicalized gzip
  header).
