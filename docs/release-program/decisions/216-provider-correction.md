# Plan 216 — Provider-specific forward correction

Input-Commit: 3d28302
Result-Commit: eec64ff
Evidence-Commit: SELF
Status: DONE
Outcome: NPM-DEPRECATION-CATALOG-STATE / GITHUB-PYPI-UNSUPPORTED
Date: 2026-08-09

## Decision

Correction is a new desired provider state, never an inverse publication and
never a cross-provider transaction. A canonical `CorrectionIntentV1` binds
one correction to the SHA-256 digest of one exact `PreparedRelease`. Its
`correctionId` is the SHA-256 digest of the canonical intent bytes with the id
field omitted. Unknown keys, noncanonical bytes, unbounded public messages,
wrong ids, and a correction whose subject is absent from the prepared bundle
are rejected before any provider adapter is called.

The internal `correctPreparedRelease` operation first verifies the complete
prepared bundle and canonical intent, then runs one provider-bound subject
through Plan 214's observe / at-most-one-mutation / reobserve algebra. A lost
response is never treated as absence or success. Credentials and transports
are runtime inputs and do not enter the correction document.

## Provider matrix

| Provider | Durable state and evidence | Mutation admitted | Ordinary publication after correction |
|---|---|---|---|
| npm package version | The configured version document exposes `dist.integrity`/`dist.shasum` and the version `deprecated` message. npm documents `npm deprecate <package>@<version> <message>` as the version-level operation. Retrieved 2026-08-09 from [npm deprecate](https://docs.npmjs.com/cli/v11/commands/npm-deprecate/) and [npm deprecation guidance](https://docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions/). | Supported through the typed `NpmDeprecationProcess`. The adapter binds registry, package, version, prepared tarball integrity, and exact nonempty message. It accepts only matching integrity plus no message as the mutation precondition, performs one deprecation operation, and reobserves the exact message. | Any nonempty existing `deprecated` message is `Conflict`; publication cannot clear or ignore it. Unpublish is deliberately absent because npm documents coordinate removal and reuse restrictions in its [unpublish policy](https://docs.npmjs.com/policies/unpublish/). |
| GitHub release | The official REST release representation exposes tag, target, title, body, draft, prerelease, and retained assets; the official release endpoints also expose metadata updates and destructive deletion. Retrieved 2026-08-09 from [GitHub release endpoints](https://docs.github.com/en/rest/releases/releases?apiVersion=latest) and [release endpoint index](https://docs.github.com/en/rest/releases). No provider-defined, durable withdrawal marker with a proven conditional update and exact reobservation contract was found. | Unsupported. A body convention is user text rather than a provider correction state; deleting a release, tag, or asset would make absence ambiguous and permit unsafe coordinate reasoning. | No GitHub correction capability is registered, so no old publication path is allowed to claim correction support or mutate a corrected release. |
| Homebrew/Scoop catalog Git | The existing Plan 215 pair remains the exact rendered target plus canonical managed-state record. The state now admits `active`, `corrected`, `withdrawn`, and `superseded`, with correction id, bounded reason, and optional replacement coordinate. Both files are written in one injected conditional repository operation against the observed revision. | Supported through `makeCatalogCorrectionSubject`. The current target bytes must equal the prepared target, the baseline state must be active at the same version, and the corrected state is canonical and retained. A different correction, newer generation, half-present pair, malformed state, or transport ambiguity blocks mutation. | Plan 215's publication adapter treats every non-`active` state as `Conflict`; it never resurrects an older active pair. |
| PyPI files | Plan 208 did not prove exact per-file yank observation and mutation for arbitrary configured indexes. A whole-project or whole-version inference from one file would violate the subject boundary. | Unsupported and absent from mutation services. The typed intent variant is retained only so the unsupported result is explicit and cannot acquire a fallback command. | No PyPI correction claim is registered. |

## Intent variants

`NpmDeprecationCorrection` contains the exact prepared publication id,
registry, package/version coordinate, tarball SRI, and public message.
`CatalogCorrection` contains the exact prepared target/state artifact ids,
repository coordinate, paths, version, status, reason, and optional
replacement information. GitHub and PyPI variants carry their provider
coordinates and desired marker/yank reason but return a typed unsupported
outcome until the proof gap is closed. Replacement coordinates are
information only; this plan never publishes a replacement.

Catalog correction retains the target file. Its state record is the durable
public marker. The correction state records the intent id and exact prepared
digest, so rerunning the old publication sees non-active state and stops.
The repository revision precondition prevents a concurrent generation from
being overwritten.

## Explicitly excluded

- package unpublish, registry deletion, release/tag/asset deletion, and any
  coordinate reuse strategy;
- generic rollback, compensating transactions, caller-provided commands, or
  a generic correction hook;
- clearing npm deprecation or restoring an old catalog state;
- arbitrary HTTP, announcement, SMTP, chat, or social undo;
- local reviewer/actor identities or a new correction progress ledger.

## Verification

- `bun test` — PASS: 223 tests, 928 expectations across 46 files.
- `bun run check:import-rules` — PASS: 163 files examined.
- `bun run check:config-schema` — PASS: schema matches `AuthoredConfig`.
- `bun run check:docs-claims` — PASS: 9 claims across 3 files.
- `bun run check:tree-shaking` — PASS: 85 files examined.
- Focused correction/publication run — PASS: 28 tests, 103 expectations.
- Canonical intent tests cover deterministic ids, byte determinism, unknown
  keys, and mismatched ids.
- npm tests cover exact deprecation, absent/conflicting targets, lost process
  response, and old-publication conflict.
- catalog tests cover conditional paired writes, retained target bytes,
  different correction/newer generation conflicts, lost response convergence,
  and old-publication conflict.
- GitHub and PyPI vertical tests prove typed unsupported outcomes.
- No live corrective mutation was run; no registry, repository, credential,
  release, tag, package, asset, workflow, or external catalog state was read
  or changed.

## Handoff

Plan 217 may consume only `correctPreparedRelease` and the two supported
provider-bound subject factories. It must expose one public lifecycle entry
for correction without reviving the old review/plan protocol. GitHub and PyPI
must remain visibly unsupported until a later plan supplies the named proof.
