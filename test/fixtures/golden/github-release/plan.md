# Release Plan release-example-github@0.1.0

## Summary

summary: release-example-github@0.1.0
commit: example
evidence: .release/evidence
operations: 4
risk:
  read-only: 3
  writes-local: 0
  externally-visible: 1
  irreversible: 0
execute required: 1
irreversible approval required: 0

surfaces:
  - github operations=3

approval-required operations:
  - github:github-release-create: --execute (externally-visible)

## Artifacts

- archive artifacts/release-example-github-0.1.0.tgz [archive] produced-by=import-artifacts platform=none checksum=none

## Operations By Risk

### read-only

#### import-artifacts:archive:exists

- target: none
- risk: read-only
- approval: none
- why: Verify imported artifact archive exists.

#### github:github-release-dry-run

- target: github
- risk: read-only
- approval: none
- why: Record simulated GitHub release dry-run validation.
- note: GitHub release dry-run validation is simulated by the deterministic release plan; GitHub Releases API creation is not called during validation.

#### github:github-release-verify-api

- target: github
- risk: read-only
- approval: none
- why: Verify the GitHub release through the GitHub API.
- github-api: verify release owner/repo v0.1.0
- assets: 1

### writes-local

- none

> Approval boundary: externally visible and irreversible operations require explicit approval.

### externally-visible

#### github:github-release-create

- target: github
- risk: externally-visible
- approval: --execute
- why: Create GitHub release for release-example-github@0.1.0.
- github-api: create release owner/repo v0.1.0
- assets: 1

### irreversible

- none
