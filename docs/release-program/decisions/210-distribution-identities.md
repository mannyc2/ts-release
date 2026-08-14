# Plan 210 — distribution identities decision

Input-Commit: 3f25356
Result-Commit: 9b1ae11
Evidence-Commit: SELF
Status: DONE
Outcome: PASS
Date: 2026-08-09

> **Superseded runtime detail (2026-08-12):** The monorepo-subpath identity
> remains current, but the Node 20 runtime statement below is historical. The
> current Action declares a native Node 24 launcher boundary and runs its
> checked-in release entrypoint with workflow-installed, pinned Bun. Hosted
> artifact upload/download returns to a checked-in native Node 24 bridge.

## Decision A — npm package identity

### KEEP-MANNYC1

The canonical package remains `@mannyc1/ts-release`. The live package metadata
reports:

- name: `@mannyc1/ts-release`;
- published latest: `0.0.7`;
- repository: `https://github.com/mannyc2/ts-release.git`;
- visible maintainer: `mannyc1 <c20carroll@gmail.com>`.

The repository's configured origin is `mannyc2/ts-release`, which explains the
intentional owner/scope difference. The read-only query for
`@mannyc2/ts-release` returned registry 404. That absence is not treated as
scope authority; there is no maintainer evidence authorizing a move to the
unoccupied scope. The current package identity therefore remains byte-stable,
with no alias and no dual publication.

## Decision B — Action distribution

### MONOREPO-SUBPATH

The canonical Action remains the built metadata and bundle under
`apps/ts-release-action`. Consumers use:

`mannyc2/ts-release/apps/ts-release-action@__TS_RELEASE_ACTION_REF__`

where Plan 221 binds the placeholder to the certified immutable candidate
tag. The monorepo reusable workflow is referenced as
`mannyc2/ts-release/.github/workflows/release.yml@__TS_RELEASE_ACTION_REF__`.
This is direct Action consumption, not a Marketplace listing.

The read-only check of `https://api.github.com/repos/mannyc2/ts-release-action`
returned 404, so no missing standalone repository is claimed by the product.
The local action has a root `action.yml` at its monorepo subpath, a Node 20
runtime, and a built `dist/index.js`; no external tag, repository, or listing
was created by this plan.

GitHub's [official Marketplace requirements](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace)
say automatic listing requires a public repository with one root action
metadata file; metadata in a subfolder is not automatically listed. No
Marketplace requirement was established for this product, so creating a
second root repository would be a separate distribution program, not a
correctness fix.

## Applied hard cut

Commit `9b1ae11` updates only the interim public references that claimed the
missing standalone Action already existed:

- README examples use the monorepo reusable workflow or the monorepo Action
  subpath with `__TS_RELEASE_ACTION_REF__`;
- both GitHub Action templates use the same placeholder;
- the internal workflow example and release runbook no longer claim a floating
  `v0` mirror reference;
- the workflow-shape contract test asserts the new canonical reference.

Mirror staging code remains untouched for Plan 219's coordinated deletion.
Package names, imports, workspace links, provenance, generated declarations,
bundles, and lockfile remain unchanged because KEEP-MANNYC1 was selected.

## Verification

- npm package and candidate-scope queries — PASS as read-only evidence.
- GitHub standalone Action repository check — 404, recorded as absence only.
- Local `apps/ts-release-action/action.yml` and built bundle — PASS.
- `bun run check:versions` — PASS (11 sites).
- `bun run check:docs-claims` — PASS (10 claims across 3 files).
- `bun run check:readme` — PASS.
- `bun run check:package-exports` — PASS.
- `bun run check` — PASS.
- `bun test` — 183 passing, 0 failing, 937 expectations.
- `git diff --check` — PASS.
- No package, repository, tag, Action, Marketplace, or other external mutation
  occurred.

## Handoff

Plans 212 and 217–222 must import the package as `@mannyc1/ts-release` while
preserving the GitHub owner `mannyc2/ts-release`. Plan 219 removes mirror
machinery. Plan 221 replaces `__TS_RELEASE_ACTION_REF__` with the exact
candidate tag, and Plan 222 verifies the same immutable subpath reference.
