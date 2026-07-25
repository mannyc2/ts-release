# Release Plan release-example-scoop@0.1.0

## Summary

summary: release-example-scoop@0.1.0
commit: example
fingerprint: 13ed92ffdc01e715a3a7a49df27d558fa5cc546e1d5ec4aa917718776243f3b1
evidence: .release/evidence
operations: 5
risk:
  read-only: 1
  writes-local: 3
  externally-visible: 1
  irreversible: 0
execute required: 4
irreversible approval required: 0

surfaces:
  - catalog operations=3
  - file operations=1

approval-required operations:
  - catalog:scoop:render: --execute (writes-local)
  - catalog:scoop:push:add: --execute (writes-local)
  - catalog:scoop:push:commit: --execute (writes-local)
  - catalog:scoop:push: --execute (externally-visible)

## Artifacts

- archive artifacts/release-example-scoop-0.1.0.zip [archive] produced-by=import-artifacts platform=none checksum=none
- catalog-file-scoop .release/generated/release-example-scoop.json [catalog-file] produced-by=catalog:file platform=none checksum=none

## Operations By Risk

### read-only

#### import-artifacts:archive:exists

- target: none
- risk: read-only
- approval: none
- why: Verify imported artifact archive exists.

### writes-local

#### catalog:scoop:render

- target: file
- risk: writes-local
- approval: --execute
- why: Render scoop catalog file .release/generated/release-example-scoop.json.
- write path: .release/generated/release-example-scoop.json

#### catalog:scoop:push:add

- target: catalog
- risk: writes-local
- approval: --execute
- why: Stage release-example-scoop.json for catalog.

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

#### catalog:scoop:push:commit

- target: catalog
- risk: writes-local
- approval: --execute
- why: Commit release-example-scoop.json for catalog.

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

#### catalog:scoop:push

- target: catalog
- risk: externally-visible
- approval: --execute
- why: Push scoop catalog update for release-example-scoop@0.1.0.

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
