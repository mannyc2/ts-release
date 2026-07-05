# Release Plan release-example-homebrew@0.1.0

## Summary

summary: release-example-homebrew@0.1.0
commit: example
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
  - homebrew operations=5

approval-required operations:
  - homebrew:homebrew-render-formula: --execute (writes-local)
  - homebrew:homebrew-push:add: --execute (writes-local)
  - homebrew:homebrew-push:commit: --execute (writes-local)
  - homebrew:homebrew-push: --execute (externally-visible)

## Artifacts

- - archive artifacts/release-example-homebrew-0.1.0.tgz [tarball] size=0 checksum=none
- - homebrew-formula .release/generated/release-example-homebrew.rb [file] size=0 checksum=none

## Operations By Risk

### read-only

#### homebrew:brew-audit

- target: homebrew
- risk: read-only
- approval: none
- why: Record simulated Homebrew formula validation.
- note: Homebrew formula validation is simulated by the deterministic release plan.

### writes-local

#### homebrew:homebrew-render-formula

- target: homebrew
- risk: writes-local
- approval: --execute
- why: Render Homebrew formula release-example-homebrew.rb.
- write path: .release/generated/release-example-homebrew.rb

#### homebrew:homebrew-push:add

- target: homebrew
- risk: writes-local
- approval: --execute
- why: Stage release-example-homebrew.rb for homebrew.

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

#### homebrew:homebrew-push:commit

- target: homebrew
- risk: writes-local
- approval: --execute
- why: Commit release-example-homebrew.rb for homebrew.

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

#### homebrew:homebrew-push

- target: homebrew
- risk: externally-visible
- approval: --execute
- why: Push Homebrew tap update for release-example-homebrew@0.1.0.

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
