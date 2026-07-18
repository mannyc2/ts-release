# Release Plan release-example-scoop@0.1.0

## Summary

summary: release-example-scoop@0.1.0
commit: example
evidence: .release/evidence
operations: 6
risk:
  read-only: 2
  writes-local: 3
  externally-visible: 1
  irreversible: 0
execute required: 4
irreversible approval required: 0

surfaces:
  - scoop operations=5

approval-required operations:
  - scoop:scoop-render-manifest: --execute (writes-local)
  - scoop:scoop-push:add: --execute (writes-local)
  - scoop:scoop-push:commit: --execute (writes-local)
  - scoop:scoop-push: --execute (externally-visible)

## Artifacts

- archive artifacts/release-example-scoop-0.1.0.zip [archive] produced-by=import-artifacts platform=none checksum=none
- scoop-manifest .release/generated/release-example-scoop.json [catalog-file] produced-by=catalog:scoop platform=none checksum=none

## Operations By Risk

### read-only

#### import-artifacts:archive:exists

- target: none
- risk: read-only
- approval: none
- why: Verify imported artifact archive exists.

#### scoop:scoop-manifest-validation

- target: scoop
- risk: read-only
- approval: none
- why: Record simulated Scoop manifest validation.
- note: Scoop manifest validation is simulated by the deterministic release plan.

### writes-local

#### scoop:scoop-render-manifest

- target: scoop
- risk: writes-local
- approval: --execute
- why: Render Scoop manifest release-example-scoop.json.
- write path: .release/generated/release-example-scoop.json

#### scoop:scoop-push:add

- target: scoop
- risk: writes-local
- approval: --execute
- why: Stage release-example-scoop.json for scoop.

Command argv:

```json
[
  "git",
  "-C",
  ".",
  "add",
  ".release/generated/release-example-scoop.json"
]
```

#### scoop:scoop-push:commit

- target: scoop
- risk: writes-local
- approval: --execute
- why: Commit release-example-scoop.json for scoop.

Command argv:

```json
[
  "git",
  "-C",
  ".",
  "commit",
  "-m",
  "Update release-example-scoop to 0.1.0"
]
```

> Approval boundary: externally visible and irreversible operations require explicit approval.

### externally-visible

#### scoop:scoop-push

- target: scoop
- risk: externally-visible
- approval: --execute
- why: Push Scoop bucket update for release-example-scoop@0.1.0.

Command argv:

```json
[
  "git",
  "-C",
  ".",
  "push"
]
```

### irreversible

- none
