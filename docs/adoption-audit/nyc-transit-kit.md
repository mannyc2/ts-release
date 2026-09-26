# nyc-transit-kit adoption audit

Audited 2026-09-26. Current GitHub `main` and the local checkout both resolve to
`9fbc3c11c66d6e4e9ec47f52a4ea936e99e375cd` (2026-07-05). The adoption history
starts on June 17. This is a historical consumer of the 0.0.x interface, not
evidence that the same implementation defects remain in 0.4.2.

## Integration

The repository releases eight npm packages at one version, a Linux CLI binary,
its manifest, and eight tarballs on GitHub. It currently pins
`@mannyc1/ts-release@0.0.7` as a root development dependency. Its 345-line Bun
adapter exposes the published `workflows` facade, provides Bun layers at the
boundary, parses arguments, handles no-Git planning, and writes evidence.
Publishable packages do not depend on the release tool.

The workflow runs on main pushes and manual dispatch. A plan job observes
remote state, builds/checks the candidate, validates, and records a plan. A
separate `release` environment job builds again and invokes the explicitly
approved release operation with npm trusted publishing. This is a consumer's
configured approval boundary; the presence of the environment name alone does
not prove required reviewers are configured.

Sources: [manifest](https://github.com/mannyc2/nyc-transit-kit/blob/9fbc3c11c66d6e4e9ec47f52a4ea936e99e375cd/package.json),
[configuration](https://github.com/mannyc2/nyc-transit-kit/blob/9fbc3c11c66d6e4e9ec47f52a4ea936e99e375cd/release.config.json),
[adapter](https://github.com/mannyc2/nyc-transit-kit/blob/9fbc3c11c66d6e4e9ec47f52a4ea936e99e375cd/scripts/run-ts-release.ts),
[workflow](https://github.com/mannyc2/nyc-transit-kit/blob/9fbc3c11c66d6e4e9ec47f52a4ea936e99e375cd/.github/workflows/release.yml).

## Problems and resolutions

### NT-1 — Missing runtime dependency broke release preparation

**Confirmed integration failure, June 20; corrected in the consumer.** The
0.0.3 integration omitted a root `@effect/platform-bun` dependency.
[Run 27882743536](https://github.com/mannyc2/nyc-transit-kit/actions/runs/27882743536)
failed at `Run bun run check:release-local`. The immediately following
[fix](https://github.com/mannyc2/nyc-transit-kit/commit/58f9ad696bf523a371baff7ecf4d7e1529270280)
adds the dependency and updates the architectural rule allowing root tooling
to import it. [Run 27882801828](https://github.com/mannyc2/nyc-transit-kit/actions/runs/27882801828)
then passed. The original log now returns HTTP 410; the exact exception is not
recoverable from that log, so this attribution rests on the corrective diff
and step-level run history.

**Improvement:** certify the installed library/CLI/Action in an empty consumer
workspace, and give an explicit dependency/runtime diagnostic before planning.
Do not infer install completeness from tests in ts-release's own monorepo.

### NT-2 — npm authentication configuration was not honored during validation

**Confirmed integration friction, June 20; corrected in the consumer.** Merely
passing `NPM_TOKEN`/`NODE_AUTH_TOKEN` did not make the configured child npm
commands use the intended authentication. The first
[repair](https://github.com/mannyc2/nyc-transit-kit/commit/2a49e1e8371ffa1acba8bf5376d06795194af94f)
appended an `NPM_TOKEN` interpolation to the setup-node user config; the
authenticated validation still failed in
[run 27882929221](https://github.com/mannyc2/nyc-transit-kit/actions/runs/27882929221).
The next [repair](https://github.com/mannyc2/nyc-transit-kit/commit/273c96bd7e3250ec9fa0099aa1e69b8aea88c973)
wrote a temporary project `.npmrc`, and
[run 27882978486](https://github.com/mannyc2/nyc-transit-kit/actions/runs/27882978486)
passed. Historical logs are expired; do not assign a more specific subprocess
environment bug than these changes establish.

The [bootstrap runbook](https://github.com/mannyc2/nyc-transit-kit/blob/9fbc3c11c66d6e4e9ec47f52a4ea936e99e375cd/docs/release.md#npm-publish-auth)
also records the separate scope-creation prerequisite (`E404 Scope not found`)
and distinguishes bootstrap credentials from later trusted-publisher setup.
The [scope documentation commit](https://github.com/mannyc2/nyc-transit-kit/commit/f271c5a397e973aa3bd3ba60fb562e34820a3b64)
is evidence of an onboarding requirement, not a separately proven failed
workflow. Current configuration uses trusted publishing.

**Improvement:** preflight the actual configured credential route and effective
npm configuration, identify scope/package bootstrap requirements, and explain
which step failed without exposing credentials. A generic authentication check
that does not exercise the selected route is insufficient.

### NT-3 — Invalid Action YAML prevented the job from starting

**Confirmed upstream distribution defect, June 22; fixed by an immutable pin.**
The consumer switched to the Action at `260a7c4...`; its first
[release run](https://github.com/mannyc2/nyc-transit-kit/actions/runs/27977420410)
failed at `Set up job`. The consumer immediately
[pinned `aa452f3...`](https://github.com/mannyc2/nyc-transit-kit/commit/6d95668ee60e944e26938d89f872ad41bb0f25d5),
whose upstream [diff](https://github.com/mannyc2/ts-release/commit/aa452f38ca07d1fa6d439f2bbe89d9852806ee42)
quotes an Action input description containing `: `. The next
[run](https://github.com/mannyc2/nyc-transit-kit/actions/runs/27977510114) succeeded.
The failure log is expired, so the syntax attribution is supported by the
paired upstream/consumer diffs and the setup failure, rather than a preserved
parser message.

**Improvement:** validate the distributed `action.yml` and execute that exact
immutable subpath coordinate in a consuming repository before recommending it.

### NT-4 — Published npm packages plus an absent GitHub release required manual recovery

**Confirmed partial-release incident, June 29; documented workaround.**
[PR #2](https://github.com/mannyc2/nyc-transit-kit/pull/2) explicitly records
the observed v0.1.1 partial state. The retained job log for
[run 28381744285](https://github.com/mannyc2/nyc-transit-kit/actions/runs/28381744285/job/84085876539)
reports all eight packages published and `github=missing`, then exits from the
consumer's remote-state guard before execution. That proves the incomplete
remote result and blocked recovery, but does not establish why the original
GitHub publication was absent.

The [runbook](https://github.com/mannyc2/nyc-transit-kit/blob/9fbc3c11c66d6e4e9ec47f52a4ea936e99e375cd/docs/release.md#partial-release-recovery)
instructs the operator to avoid republishing npm, rebuild from the recorded
commit, and create only the missing GitHub release. Rebuilding is this legacy
integration's workaround; it is weaker than retaining the original bytes.

**Improvement:** provide selective recovery of the remaining destination from
the original retained artifacts, with per-operation state and a concrete next
command. Preserve the later native engine's durable-recovery design and make
the migration path from this older integration explicit.

### NT-5 — npm propagation made successful side effects appear to be a failed release

**Confirmed release verification problem, July 5; consumer workaround remains.**
[PR #7](https://github.com/mannyc2/nyc-transit-kit/pull/7) states that v0.2.0
published its packages and created assets, but failed while one npm version was
still propagating. [Run 28750356624](https://github.com/mannyc2/nyc-transit-kit/actions/runs/28750356624/job/85248287606)
passed planning and failed `Run approved release`. The log only exposes an
empty `OperationFailedError` and a stack; the propagation explanation comes
from the incident PR, not that exception. A later run observed all npm members
published.

The [fix](https://github.com/mannyc2/nyc-transit-kit/commit/3b5fd30ebb7d743cf2ecb566950051cf8d6ec54b)
adds a 363-line remote-state script, up to 36 observations separated by five
seconds, and a `--require-complete` check after a failed engine invocation.
This permits the workflow to recognize eventual completion without another
publication attempt. The latest
[run 28753111552](https://github.com/mannyc2/nyc-transit-kit/actions/runs/28753111552)
is successful; that is evidence of successful workflow observation, not proof
that this run performed new writes.

**Improvement:** distinguish accepted writes, pending visibility, confirmed
visibility, and actual conflicts. Supply a reusable read-only wait operation
with a bounded deadline and useful pending output. Consumer shell recovery
should not have to reinterpret an opaque failure as eventual success.

### NT-6 — Draft visibility and the completion predicate disagreed

**Confirmed integration-state mismatch, July 5; corrected in the consumer.**
The next [run 28750477383](https://github.com/mannyc2/nyc-transit-kit/actions/runs/28750477383/job/85248526975)
again reported all eight npm packages published but `github=missing`.
[PR #7](https://github.com/mannyc2/nyc-transit-kit/pull/7) identifies the
GitHub draft as the cause of that observation. The old guard treated any
successful `gh release view` as complete without interpreting `isDraft`, and
a view that could not see the draft as missing. The fix adds explicit
`draft`/`missing`/`published` states and configures publication after the
workflow's environment approval, removing the intermediate draft from the
intended final state.

**Improvement:** provide state predicates that distinguish draft from published
and explain when the caller's read authority cannot establish absence. Keep
environment approval, release staging, and public completion separately
represented.

### NT-7 — The engine error omitted the actionable operation failure

**Directly observed diagnostic limitation, July 5.** The failing execution log
prints `OperationFailedError:` followed by stack frames without the operation,
provider status, or recovery decision. The maintainer's PR and a second
remote-state investigation supplied the missing explanation. This is separate
from the underlying propagation incident.

**Improvement:** make safe error code, operation/package identity, stage,
HTTP status, retained evidence reference, and next action available in the CLI
and Action. Browserbase later independently encountered the same general
diagnostic problem; its 0.4.1 fix is documented in that case study.

### NT-8 — Consumer Git detection treated checkout metadata as a regular file

**Confirmed consumer code defect, June 17; fixed before later releases.**
[Commit c7139a0](https://github.com/mannyc2/nyc-transit-kit/commit/c7139a0bcf2855bd79dcb1b4975ac7dc4c11c1d2)
replaces `Bun.file(.../.git).exists()` with a stat accepting either a directory
or a file in both the checker and wrapper. The affected code selected
no-checkout behavior and validated release commit identity. This was authored
in the consumer; it is not evidence of a ts-release engine bug. The audit did
not recover a workflow exception directly attributable to it.

**Improvement:** expose reusable repository-fact discovery and documented
offline plan semantics, tested against ordinary checkouts, worktrees, and
exported source directories, so every adopter need not implement this logic.

## Implementation lessons beyond incidents

| Consumer implementation | Improvement opportunity |
| --- | --- |
| Root-only pinned release dependency and explicit Bun layers | Keep application runtime choices out of published product dependencies; ship a tested isolated-tooling example. |
| 345-line command adapter, 363-line remote-state checker, 281-line config checker | Offer composable command/report/observation helpers. These counts are whole source files, not a claim that every line is removable. |
| Separate plan/execute jobs both rebuild artifacts | Make exact-byte handoff the default integration and measure whether consumers actually use it. The current workflow has no proof that both builds produce identical bytes. |
| Eight npm packages, GitHub archives, binary, and manifest | Make multi-package and multi-destination release a first-class acceptance fixture, with dependencies and partial completion. |
| Config, version metadata, manifests, staging scripts, and documentation synchronized manually | Derive common identity and artifact inventories once; validate authored overrides rather than replicate them across files. |
| Consumer deliberately stops on partial state | Preserve the refusal to blindly republish, while returning a useful observe/resume procedure. |

## Evidence coverage and limits

The audit read the full available repository issue/PR listing (seven entries),
all 54 Actions run summaries, relevant historical diffs, the current release
configuration/adapter/runbook/workflows, and retained logs for the June 29 and
July 5 failures. June 17–22 log downloads returned HTTP 410; their run/job
metadata and corrective commits remain available. No publication, rerun,
rebuild, credential exchange, or consumer modification was performed.

This consumer still uses 0.0.7. A contemporary recommendation must be qualified
against the 0.4.x public API; the legacy wrapper/configuration is not an
up-to-date starter.
