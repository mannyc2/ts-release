# Plan 222 — Live release certification

Input-Commit: 9c80e2ff5c814d77f583de9898fe493c558f8c88
Result-Commit: 9c80e2ff5c814d77f583de9898fe493c558f8c88
Published-Candidate-Commit: ca7ce846d4bbec1c97b62172ed3ab9673e25bc46
Certification-Evidence-Commit: 9c80e2ff5c814d77f583de9898fe493c558f8c88
Evidence-Commit: SELF
Status: BLOCKED
Outcome: NOT-AUTHORIZED / MUTATION-CREDENTIALS-UNAVAILABLE
Date: 2026-08-09

## Exact stop reason

Plan 222 is blocked on one external event required by its authority packet:
the operator must explicitly approve a bounded packet naming the exact
candidate, Plan 221 evidence commit, canonical remote release branch and
ancestry proof, prepared bundle, public coordinates, mutation command,
credential sources, mutation order, recovery command, and STOP conditions.
That packet has not been supplied or approved. The readiness gate also
reported `NPM_TOKEN` and `GITHUB_TOKEN`/`GH_TOKEN` unavailable. No mutation
credential was acquired and no public destination was contacted.

This is an external authorization and credential boundary, not an unresolved
implementation or candidate-verification failure. The program explicitly
forbids treating a generic “release latest” instruction, local object
existence, a protocol double, or a missing credential as permission to publish.

## Frozen candidate and bundle

Plan 221 proved:

- candidate X:
  `ca7ce846d4bbec1c97b62172ed3ab9673e25bc46`;
- certification Y:
  `9c80e2ff5c814d77f583de9898fe493c558f8c88`;
- `Y^ == X`: verified;
- X..Y: only
  `docs/release-program/certifications/221-release-candidate.md`;
- prepared schema: `prepared-release/v1`;
- manifest SHA-256:
  `1c089822d0e9f36f5d9b49b2cdbc5e5e59f6644b1fb2eb5beee50ad202ca1d44`;
- prepared locator:
  `/tmp/ts-release-candidate-X5/.release/ts-release/prepared/1c089822d0e9f36f5d9b49b2cdbc5e5e59f6644b1fb2eb5beee50ad202ca1d44`;
- complete bundle: 30 exact verified artifacts;
- npm coordinate: `@mannyc1/ts-release@0.2.0`;
- GitHub coordinate: `mannyc2/ts-release#v0.2.0`, with tag target X;
- Action coordinate: `mannyc2/ts-release/apps/ts-release-action@v0.2.0`;
- platform outcome: Linux/macOS x64 and arm64 targets only;
- publication effects: npm and GitHub only.

No tag, branch, release, package, asset, Action channel, catalog, or
marketplace was mutated. No live-read or live-write evidence exists.

## Required unblock packet

The next execution may continue only after the operator supplies and approves
one packet that identifies:

1. X, Y, the `Y^ == X` and X..Y proofs, and the clean-tree evidence;
2. the canonical remote/release branch and proof X is its ancestor, or an
   separately authorized exact non-force integration preserving X;
3. the prepared bundle locator, schema, manifest digest, complete blob
   verification, npm tarball integrity, GitHub tag target, and asset digests;
4. credential sources by name, specifically `NPM_TOKEN` and
   `GITHUB_TOKEN` or `GH_TOKEN`, never their values;
5. the exact sole mutation command:
   `bun run cli publish --prepared /tmp/ts-release-candidate-X5/.release/ts-release/prepared/1c089822d0e9f36f5d9b49b2cdbc5e5e59f6644b1fb2eb5beee50ad202ca1d44`;
6. the authorized npm/GitHub mutation order, same-bundle response-loss
   recovery, independent package/CLI verification, and remote immutable Action
   consumer smoke; and
7. explicit STOP authority for conflict, inconclusive observation, wrong tag
   target, occupied non-equivalent content, missing bundle, or any candidate
   drift.

The packet must authorize only the configured npm and GitHub subjects. It must
not add PyPI, Homebrew, Scoop, Marketplace, announcements, mutable channel
tags, corrections, deletion, recreation, force-push, or a source-changing
integration. A changed candidate, version, manifest digest, asset set,
coordinate, or command returns to Plan 221.

## Evidence state

- `source-derived`: candidate coordinates and release topology from X/Y;
- `contract-tested`: Plan 221 clean-clone and prepared-bundle verification;
- `external-docs-derived`: retained Plan 220 comparison evidence;
- `live-read-verified`: none;
- `live-write-dogfooded`: none;
- destination state: `UNVERIFIED` because the required credentials and
  operator packet are absent.

This blocked report is evidence-only. There is no W post-release commit and
no public release to verify. This file is the sole change in the next commit Z;
resolve `Evidence-Commit: SELF` from Git and verify `Z^ == Y`.
