# Changelog

## 0.2.0 - pending

- The published `ts-release` executable is now a Node bundle, so `npx
  ts-release` works on a machine without Bun. Bun remains a supported host.
- Shipped configs no longer carry a `$schema` reference; the URL they named
  was never published.
- Added `retry` to the apply input: a failed-before-commit operation can be
  retried by id without editing the ledger by hand, and a run lease left
  behind by a killed process is stolen once it is stale.
- `newRun` now names the run DIRECTORY, and a resume accepts either that
  directory or the ledger file. Run identity is anchored to the plan, so a
  ledger from a different plan is refused instead of silently resumed.
- Credential values no longer reach durable data: child output is recorded as
  a bounded excerpt with declared environment values and known token shapes
  redacted, and every registry URL passes one HTTPS policy.
- `effect`, `@effect/platform-node`, and `@effect/platform-bun` are now
  peerDependencies; npm 7+ and bun install them automatically.
- Dispatch evidence distinguishes what reached the wire from what did not, so
  an unknown commitment is never recorded as a failure to dispatch.
- Deleted the distributed-execution subsystem, its operations, and its
  profiles. Execution is single-machine; receipts are validated by hash
  self-consistency.
- Public inputs are decoded once with Schema at the API boundary: excess
  properties and malformed values are refused, and the CLI and the Action
  refuse the same input identically. Branded id constructors (`PlanId`,
  `OperationId`, review ids, `Stage`) are exported.
- Fixed the release handoff: a materialize-only apply now emits the publish
  review its publish job confirms, which the three-job workflow needs.
- ts-release runs on Linux and macOS hosts; Windows remains a supported
  release target.

- Fixed the GitHub Action host: the live driver layer no longer uses Bun-only
  APIs, so `Exec`, `Pack` (glob patterns and tar.gz), and command-based publish
  operations run correctly under the Action's node20 runtime. The
  action-bundle gate now executes the built bundle under real Node against a
  fixture release covering those paths.
- Made `makeReleaseApi` publicly usable: the package now exports the service
  tags and shapes (`RunStore`, `WorkspaceStore`, `CredentialStore`,
  `DriverCatalog`, `ApprovalSigner`), the permit classes an `ApprovalSigner`
  returns, the platform-generic `ReleaseServicesLive` layer, and prebuilt host
  layers at `@mannyc1/ts-release/node` and `@mannyc1/ts-release/bun`. The root
  `plan`/`reviewExecution`/`apply` convenience functions now bind to the Node
  platform layer and work under both runtimes. tar.gz archive bytes changed
  once (explicit zlib level, canonicalized gzip header).
- Gave the CLI a real front door: `init`, `doctor`, `plan`, and `apply` are
  declared with `effect/unstable/cli`, so `--help`, `--version`, and typed
  flag errors work. Every JSON output line is unchanged.
- Restored the files-only archive contract: `archives[].files` now decodes
  strictly as safe workspace-relative patterns, flows into the durable plan
  as optional `Pack.files`, and materializes deterministic recursive archive
  entries (sorted, deduplicated, symlink-contained, never self-including).
  Plans without file patterns keep their exact `release-plan/v6` bytes and
  operation hashes.
- Added the `ts-release` agent plugin: one shared `release` skill with five
  self-contained references and eight behavioral eval cases, packaged with
  native OpenAI/Codex and Claude Code manifests, repo marketplace catalogs
  (`.agents/plugins/marketplace.json`, `.claude-plugin/marketplace.json`),
  and a `check:skill-plugin` structural gate. The dogfood release now ships
  `ts-release-plugin-{version}.zip` plus a checksums file as GitHub release
  assets. Public directory submission stays a manual operator action
  (docs/skill-distribution.md).

- Made workspace snapshot reads portable to macOS: the containment check now
  proves the realpath-resolved location is the exact opened file by device
  and inode instead of resolving the descriptor through Linux-only procfs.
- Internal readability refactor with identical public behavior: one authority
  predicate for remote-publish operations, shared canonical-JSON hashing, an
  `ApplyContext` for the apply orchestrator, and removal of dead driver
  service seams and `rewrite`-era names (trace spans, service keys, and the
  app `cutover` modules, now `commands`).
- Reordered `check:core` so the cheap policy gates (`check:versions`,
  `check:import-rules`, `check:tree-shaking`) run before the build, and added
  `check:summary`, which runs every gate and prints a pass/fail table instead
  of stopping at the first failure.

### Breaking: sealed plan/apply core

- Replaced the former lifecycle API with value-only `plan` and
  canonical-bytes-only `apply`; `reviewExecution` is a pure review helper.
- Replaced the six-command CLI with exactly `init`, `doctor`, `plan`, and
  `apply`.
- Replaced Action commands with exactly `plan`, `doctor`, and `apply`, and
  added explicit plan, review, receipt, run, status, and evidence outputs.
- Moved all product code into its permanent model, config, recipe, plan,
  driver, apply, view, and API owners; removed the legacy engine and
  compatibility spine.
- Replaced `release-plan/v5` with canonical `release-plan/v6`.
- Replaced durable `release-evidence/v3` with `run-ledger/v1`; evidence is now
  a derived projection.
- Added immutable execution scope, run-bound execution receipts, observed
  publish review, run-bound publish receipts, monotonic staged apply,
  reconciliation, and explicit operator resolutions.
- Made configuration file loading app-owned and one-read. Core configuration
  is a strict JSON-compatible value with no path or encoding parser.
- Required absolute existing realpath-normalized workspaces.
- Made Homebrew, Scoop, package, and provider profiles product-owned and
  immutable.
- Added deterministic changelog generation, reviewed validation-time note
  transformation, and closed announcement operations for thirteen HTTP-like
  channels plus SMTP.
- Added typed package, supply-chain, provider, distributed-execution, and
  announcement profiles with immutable contract fixtures.
- Behavior is covered by the feature suites (`test/features/`) and driver
  conformance (`test/core/`). The docs-derived GoReleaser parity ledger and
  the semantic-line apparatus were removed in `e3a3a14`; the counts they
  produced are withdrawn.
- Removed mutable runtime swapping, runtime profile registration, old
  lifecycle aliases, fallback durable readers, and config translation DTOs.

Migration is documented in `README.md`. This is an intentional hard cut; old
verbs and document formats are not accepted.
