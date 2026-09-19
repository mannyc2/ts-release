# Historical plan 002 — Standing rehearsal-release gate against real endpoints

> **REJECTED / SUPERSEDED — DO NOT EXECUTE.** This proposal is coupled to
> rejected plan 001, the old shipped prepared-ref/CLI path, and a blanket
> "second publish is equivalent" claim that is not a provider replay law.
> Its underlying demand for real-provider evidence remains valid, but current
> work must be planned from scorecard K03 and D01-01 through D01-06, with each
> leaf's exact external oracle. This file does not authorize provisioning a
> destination, changing a workflow, using credentials, or performing any live
> provider mutation.

The remaining sections preserve the historical proposal for provenance. Their
imperative wording is not current executor instruction. The accompanying
`THREAT-MODEL.md` is also historical and non-authoritative.

## Plan metadata

| Field | Value |
| --- | --- |
| Status | REJECTED/SUPERSEDED — historical evidence only; do not execute |
| Priority | None; the proposed sequencing depended on rejected plan 001 |
| Effort | S–M (no `src/` changes) |
| Risk | Historical estimate only; live mutation and credentials require explicit approval |
| Planned at | branch `codex/release-candidate-0.2.2`, 2026-08-15 |
| Superseded by | `docs/refactor/research/launch-scorecard.md`, especially K03 and D01-01..D01-06 |

## Historical motivation

Every live failure in this repository's history occurred at the wire: X1–X6
(`docs/release-program/remediation/233-release-candidate.md:118-304`), the
0.2.0 wrong-MIME/missing-asset escape, and the 0.2.1 npm blob-path rejection
(`CHANGELOG.md`, 0.2.1 section). Meanwhile ~17k test lines and ~3.8k lines of
protocol doubles never caught any of them, because no gate touches a real
registry before a live release. The release itself has been the first
integration test. The proposal attempted to make wire divergence cost a red
scheduled CI run instead of an immutable botched tag. That concern survives;
the plan-001-coupled implementation and acceptance design do not.

## Historical proposed outcome — not approved

A scheduled GitHub workflow (`.github/workflows/rehearsal.yml`) that, on a
weekly cron, on manual dispatch, and as a required step of release
certification:

1. generates a throwaway fixture workspace,
2. runs the **production** release path against **real scratch destinations**,
3. runs publish a **second time** and requires all-skipped equivalence,
4. **independently** verifies the published state with raw HTTP, and
5. fails red with the full report as a workflow artifact on any divergence.

Metric: "time since last real-endpoint contact" drops from once-per-release
to at most 7 days.

## Historical design rules

1. **Same code path.** Rehearsal invokes the shipped CLI (`ts-release release`
   / `publish`) exactly as a user would. Any `src/` or CLI special-casing for
   rehearsal is a stop condition — a rehearsal of a different code path
   rehearses nothing.
2. **Independent verification.** After the product reports success, the
   workflow re-checks each destination with raw HTTP (npm registry JSON, PyPI
   Simple API, GitHub REST) and compares name/version/digests against the
   manifest. Verifying only through the product's own observation path would
   reproduce the epistemic bug this plan exists to fix (a model checking
   itself). Divergence between the product's report and the raw check is
   itself a red result, whichever is "right."
3. **Historical idempotence premise.** The proposal expected a second
   `publish` invocation against already-published state to yield only
   equivalent/skipped outcomes with zero mutations. That blanket premise is
   superseded: replay/continuation authority is provider- and operation-local,
   and scorecard D01-06 explicitly requires observation after response loss
   without treating absence as permission to resend.
4. **Never production names.** Scratch destinations only (below). The
   workflow refuses to run if the fixture config references `@mannyc1/ts-release`,
   the real repository, or a non-rehearsal package/project name.
5. **No retries added to get green.** A flaky red is evidence about the
   provider or our model of it; record it. Bounded read-retry already inside
   the product is fine; the workflow adds none.

## Historical scratch-destination examples — not provisioned or authorized

| Leg | Destination | Auth | Notes |
| --- | --- | --- | --- |
| npm | `@mannyc1/ts-release-rehearsal` | npm **trusted publishing** configured for this workflow (preferred — it dogfoods the real OIDC path), or a granular automation token scoped to the one package | Reserve the name once with a manual `0.0.0-reserved.0` publish. Each run publishes a unique version under dist-tag `rehearsal`; never `latest`. Versions accumulate; that is the point of a scratch package. |
| GitHub | scratch repo `mannyc2/ts-release-rehearsal` | Fine-grained PAT scoped to only that repo, stored in the `rehearsal` environment | Tag/release/assets per run, named by run id. Scratch repo may be pruned freely; production immutability rules do not apply there. |
| PyPI | **TestPyPI** project `ts-release-rehearsal` | TestPyPI API token in the `rehearsal` environment | TestPyPI exists for exactly this. Enable this leg when the executing branch's kernel accepts a `publish.pypi` config end-to-end. Drift note: `src/capabilities/registry.ts:307-331` installs `publish.pypi` on the planning branch even though the 0.2.2 CHANGELOG text says PyPI configs are rejected — verify which is true at execution and record it; do not force the leg on via patched code. |

The proposal expected all secrets to live in a `rehearsal` GitHub environment,
with no sharing between rehearsal and production credentials. No destination,
secret, environment, or mutation described here is approved by this archived
file.

## Historical fixture proposal

A generator script `scripts/generate-rehearsal-fixture.ts` (workflow-side
tooling, not `src/`) creates a temp directory containing:

- `package.json` named `@mannyc1/ts-release-rehearsal`, version
  `0.0.0-rehearsal.<github-run-number>` stamped by the workflow (versions must
  be unique per run and deterministic within one; do not derive from clocks);
- a trivial buildable surface: one `command` builder producing a small text
  artifact, one archive of it, and a checksum — enough to exercise build,
  archive, checksum, GitHub asset upload, and npm pack without meaningful
  build time;
- `release.config.json` targeting only the scratch destinations;
- an initialized git repository with one clean commit, because verified
  context requires a clean tracked checkout (`SPEC.md` §2) on the current
  kernel and a clean workspace after the cut.

The generator is rerun fresh each workflow run; nothing is cached between
runs.

## Historical workflow sketch

```text
job rehearse (environment: rehearsal)
  checkout + pinned bun install --frozen-lockfile
  bun run build                      # the shipped CLI bundle under test
  generate fixture (stamped version)
  ts-release release --config fixture/release.config.json   # real publish #1
  ts-release publish <same manifest/ref>                     # real publish #2 → all skipped
  independent raw-HTTP verification of npm + GitHub (+ TestPyPI when enabled)
  upload report + manifest as workflow artifacts (always, including on failure)
```

Triggers: `schedule` (weekly), `workflow_dispatch`, and invoked from the
release-certification checklist so no live release happens with a stale or red
rehearsal. Do not run on pull requests (secrets, external rate limits, noise).

The proposal assumed a transition from the prepared-ref rerun path to a
plan-001 `publish <manifest>` CLI. That transition premise is invalid: plan 001
is rejected, the current public API/CLI/Action intentionally still use the
released path, and the refactor research has not frozen the replacement public
TypeScript or CLI names.

## Rejected sequencing

The proposed "before plan 001" order no longer exists because plan 001 is
rejected. A replacement live-evidence plan must follow the accepted ten-step
implementation strategy and name the exact scorecard leaves it closes. A lower
gate such as a protocol double, local process race, or one provider's successful
publish cannot be reported as K03 or as completion of another provider leaf.

## Historical verification checklist — not current acceptance

- Dispatch the workflow twice manually: both green; second run publishes a
  new unique version; each run's second `publish` invocation reports only
  equivalent/skipped with zero mutation calls in the report.
- Tamper test (one-time, manual): after publish #1, edit one staged artifact
  byte in the workflow, rerun independent verification, confirm red.
- Confirm the workflow fails red when a scratch secret is removed (blocked
  before dispatch — A2/A3 behavior), then restore it.
- `git diff --check` clean; no `src/` or `apps/*/src` files changed.

## Historical stop conditions

- Any change to `src/` or the CLI to make rehearsal pass.
- Rehearsal config resolving to any production package, project, or repo name.
- The product's report and the independent raw-HTTP check disagree and the
  cause is not understood — that is a captured A1 specimen; report it, do not
  paper over it.
- Two consecutive scheduled reds with the same cause and no filed follow-up.

## Historical definition of done — not a current completion claim

- [ ] Scratch destinations provisioned; secrets confined to the `rehearsal` environment.
- [ ] `rehearsal.yml` + fixture generator merged; weekly schedule active.
- [ ] Two green dispatched runs recorded, including the double-publish equivalence pass.
- [ ] Tamper and missing-secret checks demonstrated once and recorded.
- [ ] Release-certification checklist requires a green rehearsal no older than 7 days.
- [ ] ~~Plan-001 re-plan references this gate as its live-behavior baseline.~~
  Invalid dependency: plan 001 is rejected.
