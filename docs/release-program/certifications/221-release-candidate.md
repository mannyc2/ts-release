# Plan 221 — Refactored release candidate certification

> **INVALIDATED 2026-08-12 by Plan 223.** The conclusion below is retained as
> historical evidence, but it is not release authority. Deterministic
> public-boundary reproductions found an unreachable CLI credential path,
> false-green Action status, malformed GitHub asset upload, dropped npm
> trusted-publishing intent, unsafe credential/process handling, unreachable
> claimed capabilities, and preparation inputs not fully bound to verified
> source bytes. No live mutation occurred. The successor program and current
> handoffs are indexed in `docs/release-program/README.md`.

Input-Commit: 142cfd0
Result-Commit: ca7ce846d4bbec1c97b62172ed3ab9673e25bc46
Evidence-Commit: SELF
Status: INVALIDATED
Outcome: FALSE-GREEN-CANDIDATE / DO-NOT-RELEASE
Date: 2026-08-09

## Candidate boundary

Plan 221 certifies only commit `ca7ce846d4bbec1c97b62172ed3ab9673e25bc46`.
The clean candidate has source tree `370b18c4b875e412753aea8bcafe56fd70a2899b`,
clean source state, package-manifest digest
`sha256:4dde1ad340c9e11e926ef5d9bb0167e1423ed660c27da1bee192d9a898b5b8cd`,
and Bun 1.3.14.

The certified prepared bundle is:

- schema: `prepared-release/v1`;
- manifest SHA-256:
  `1c089822d0e9f36f5d9b49b2cdbc5e5e59f6644b1fb2eb5beee50ad202ca1d44`;
- clean-clone locator:
  `/tmp/ts-release-candidate-X5/.release/ts-release/prepared/1c089822d0e9f36f5d9b49b2cdbc5e5e59f6644b1fb2eb5beee50ad202ca1d44`;
- complete manifest: 30 artifacts, 2 publication intents, every blob verified
  by exact size and SHA-256;
- npm tarball:
  `.release/ts-release/npm/npm:npm-release/mannyc1-ts-release-0.2.0.tgz`,
  355460 bytes,
  `537f75b16976b12138ab75a0da2abeb08700874c9955016abd6c9dacf31c0097`;
- native CLI targets: Linux x64/arm64 and macOS x64/arm64;
- agent archives: Claude and Codex, both generated through the public
  preparation path;
- archive/checksum outputs and all generated agent files are included in the
  same manifest; no second preparation or rebuild is an authorized release
  recovery path.

The final CLI boundary was exercised from this exact candidate. `prepare`
returned the locator above, and `inspect --prepared <locator> --json` returned
the same source commit, clean state, manifest digest, 30 artifacts, and the
two publication intents. The repeated same-worktree preparation reproduced
the manifest identity; this report does not promote that observation to an
independent-workspace reproducibility claim.

## Intended coordinates and decisions consumed

- npm: `@mannyc1/ts-release@0.2.0`, registry
  `https://registry.npmjs.org`;
- GitHub: `mannyc2/ts-release`, immutable tag `v0.2.0`, target commit X;
- Action: `mannyc2/ts-release/apps/ts-release-action@v0.2.0`;
- Plan 210: `MONOREPO-SUBPATH` Action distribution;
- Plan 211: `TARGET-ONLY`, Linux and macOS execution hosts, with no native
  Windows ts-release executable;
- Plan 209: nFPM profiles retired;
- Plan 208: discovery-first recovery retained;
- Plan 216: provider-specific forward correction retained for the supported
  npm and catalog cases, with unsupported GitHub correction and arbitrary
  PyPI file yank explicit;
- no PyPI, Homebrew, Scoop, Marketplace, announcement, mirror, or mutable
  channel publication intent is present in the prepared bundle.

Every public and packaged Action reference is the exact immutable candidate
reference above. The contiguous `__TS_RELEASE_ACTION_REF__` placeholder scan
is empty across `README.md`, `docs`, `templates`, `examples`, and `apps`,
excluding only this tracked release-program evidence corpus.

## Clean-clone verification

The candidate was checked out in a fresh detached worktree at X. The source
tree remained clean after all checks; generated `.release` and `dist` output
remained ignored. The locked dependency install completed with 94 packages.

| Command or gate | Result | Evidence class |
|---|---|---|
| `bun run check:release-candidate` | PASS; self-release context, prepare, readiness, artifacts, correction, and portable gates all ready | contract-tested / source-derived |
| self-release prepare | PASS; 30 artifacts, 2 publication intents, exact manifest | contract-tested |
| self-release readiness | PASS structurally; npm and GitHub credentials unavailable, so both remain `UNVERIFIED` | source-derived / UNVERIFIED |
| self-release artifacts | PASS; npm tarball, native Linux binary, Action bundle, and 2 agent archives | contract-tested |
| self-release correction | PASS; npm, catalog, GitHub, and PyPI correction contracts | contract-tested |
| `bun test` | 98 pass, 0 fail, 338 expectations, 32 files | contract-tested |
| `check:versions` | 9 sites checked | contract-tested |
| `check:capabilities` | 11 executable entries joined to evidence | source-derived / contract-tested |
| `check:import-rules` | 126 files examined | contract-tested |
| `check:tree-shaking` | 64 files examined | contract-tested |
| CLI bundle, schema, examples, README, package exports | PASS | contract-tested |
| agents, app, and Action surfaces | PASS; Action exposes 4 commands and 3 outputs | contract-tested |
| `bun docs/release-program/check-feature-translation.ts` | PASS; 151 parity cases, 44 current cases, 260 schema paths, 44 complete groups | source-derived / contract-tested |
| CLI `prepare` then `inspect --prepared ... --json` | PASS on exact prepared path and digest | contract-tested |
| `bun pm pack` and isolated tarball install | PASS; package installs with `ts-release` binary | contract-tested |

The packed npm tarball contains no `docs/release-program/**`; its packaged
README contains the exact immutable Action reference and no placeholder. No
registry, GitHub, tag, branch, catalog, marketplace, or Action remote was
mutated or read by this plan. `NPM_TOKEN`, `GITHUB_TOKEN`, and `GH_TOKEN` were
unavailable, so live destination state is `UNVERIFIED`, not absent or live.

## Product and deletion measurements

The candidate exposes the six lifecycle commands `init`, `inspect`, `prepare`,
`publish`, `release`, and `correct`; the public API retains those lifecycle
operations plus disposal. Action metadata has four exact inputs and three
outputs. The repository has exactly two workflows: `ci.yml` and `release.yml`.

Measured in the clean candidate:

- `src/`, `apps/release-ts/src/`, and `apps/ts-release-action/src/`: 4,082
  TypeScript lines, compared with the 6,920-line baseline;
- the same product areas plus `apps/release-ts/scripts`: 4,380 lines,
  compared with the 7,175-line baseline;
- workflows: 172 lines total, compared with six workflows and 736 lines;
- README: 128 lines;
- Action metadata: 29 lines;
- workflow-topology test: 48 lines.

The reduction is accompanied by executable reachability and vertical gates,
not an acceptance-size target: the capability registry contains 11 entries,
the portable aggregate owns the core gate, and the candidate tests the
prepared-byte boundary, destination observation, provider corrections, Action
commands, agent archives, and native target execution path.

## Plan 222 handoff and STOP boundary

This candidate is ready for Plan 222 but is not live-certified. The next
operator packet must name, as one bounded approval, all of the following:

1. X above, this certification commit Y, and proof that `Y^ == X` and X..Y
   changes only this certification file;
2. the canonical remote release branch and proof that X is its ancestor, or a
   separately authorized exact non-force integration that preserves X;
3. the prepared schema, manifest digest, locator, complete blob verification,
   npm integrity, GitHub tag target, asset names/digests, and Action coordinate;
4. credential sources by name (`NPM_TOKEN` and `GITHUB_TOKEN` or `GH_TOKEN`),
   never credential values;
5. the exact sole mutation command:
   `bun run cli publish --prepared <the-certified-bundle-locator>`;
6. the authorized mutation order, lost-response rerun using this same bundle,
   independent npm/GitHub/package/CLI checks, and the immutable Action-tag
   consumer smoke; and
7. the explicit STOP outcomes for conflict, inconclusive observation,
   incorrect tag target, occupied non-equivalent content, or missing bundle.

Until that packet is explicitly approved, Plan 222 must not acquire mutation
credentials or publish. The candidate remains `CLEAN-CANDIDATE-CERTIFIED /
LIVE-UNVERIFIED`; no evidence class is upgraded by protocol doubles or local
relative-Action execution.

## Evidence classes

- `source-derived`: retained registry, host/platform, configuration, command,
  workflow, and product-documentation facts;
- `contract-tested`: clean-clone tests, prepared-release integrity, package and
  artifact smoke tests, correction tests, Action/agent checks, and parity;
- `external-docs-derived`: the GoReleaser comparison inherited from Plan 220;
- `live-read-verified`: none;
- `live-write-dogfooded`: none.

The implementing candidate is X. This file is the sole intended change in
the evidence commit Y; resolve `Evidence-Commit: SELF` from Git after the
commit and verify `Y^ == X`.
