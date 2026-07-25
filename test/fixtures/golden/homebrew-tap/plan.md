# Release Plan release-example-homebrew@0.1.0

## Summary

summary: release-example-homebrew@0.1.0
commit: example
fingerprint: 5f5407c0c13c52d0ee9529f2897c03bebf5dd67ab72c2c364698a67fb616fb82
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
  - catalog:homebrew:render: --execute (writes-local)
  - catalog:homebrew:push:add: --execute (writes-local)
  - catalog:homebrew:push:commit: --execute (writes-local)
  - catalog:homebrew:push: --execute (externally-visible)

## Artifacts

- archive artifacts/release-example-homebrew-0.1.0.tgz [archive] produced-by=import-artifacts platform=none checksum=none
- catalog-file-homebrew .release/generated/release-example-homebrew.rb [catalog-file] produced-by=catalog:file platform=none checksum=none

## Operations By Risk

### read-only

#### import-artifacts:archive:exists

- target: none
- risk: read-only
- approval: none
- why: Verify imported artifact archive exists.

### writes-local

#### catalog:homebrew:render

- target: file
- risk: writes-local
- approval: --execute
- why: Render homebrew catalog file .release/generated/release-example-homebrew.rb.
- write path: .release/generated/release-example-homebrew.rb

#### catalog:homebrew:push:add

- target: catalog
- risk: writes-local
- approval: --execute
- why: Stage release-example-homebrew.rb for catalog.

Command argv:

```json
[
  "git",
  "-C",
  ".",
  "add",
  ".release/generated/release-example-homebrew.rb"
]
```

#### catalog:homebrew:push:commit

- target: catalog
- risk: writes-local
- approval: --execute
- why: Commit release-example-homebrew.rb for catalog.

Command argv:

```json
[
  "git",
  "-C",
  ".",
  "commit",
  "-m",
  "Update release-example-homebrew to 0.1.0"
]
```

> Approval boundary: externally visible and irreversible operations require explicit approval.

### externally-visible

#### catalog:homebrew:push

- target: catalog
- risk: externally-visible
- approval: --execute
- why: Push homebrew catalog update for release-example-homebrew@0.1.0.

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
