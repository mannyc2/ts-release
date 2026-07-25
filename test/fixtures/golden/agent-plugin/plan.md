# Release Plan release-example-agent-plugin@0.1.0

## Summary

summary: release-example-agent-plugin@0.1.0
commit: example
fingerprint: 5d403749998a79742e0159e6f7ef8a0e20e109aa37d62e235fceac41538a3103
evidence: .release/evidence
operations: 11
risk:
  read-only: 2
  writes-local: 6
  externally-visible: 3
  irreversible: 0
execute required: 9
irreversible approval required: 0

surfaces:
  - catalog operations=5
  - file operations=1
  - github operations=3

approval-required operations:
  - archive:plugin: --execute (writes-local)
  - checksum:write: --execute (writes-local)
  - catalog:claude-marketplace:render: --execute (writes-local)
  - github:github-release-create: --execute (externally-visible)
  - catalog:claude-marketplace:checkout: --execute (writes-local)
  - catalog:claude-marketplace:push:add: --execute (writes-local)
  - catalog:claude-marketplace:push:commit: --execute (writes-local)
  - catalog:claude-marketplace:push: --execute (externally-visible)
  - catalog:claude-marketplace:pull-request: --execute (externally-visible)

## Artifacts

- plugin .release/artifacts/release-example-agent-plugin_0.1.0.zip [archive] produced-by=archive platform=none checksum=none
- checksum .release/artifacts/release-example-agent-plugin_0.1.0_checksums.txt [checksum-file] produced-by=checksum platform=none checksum=none
- catalog-file-claude-marketplace marketplace-checkout/.claude-plugin/marketplace.json [catalog-file] produced-by=catalog:file platform=none checksum=none

## Operations By Risk

### read-only

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
- github-api: verify release owner/agent-plugin v0.1.0
- assets: 2

### writes-local

#### archive:plugin

- target: none
- risk: writes-local
- approval: --execute
- why: Create zip archive release-example-agent-plugin_0.1.0.zip.

#### checksum:write

- target: none
- risk: writes-local
- approval: --execute
- why: Write sha256 checksum file release-example-agent-plugin_0.1.0_checksums.txt.
- write path: .release/artifacts/release-example-agent-plugin_0.1.0_checksums.txt

#### catalog:claude-marketplace:render

- target: file
- risk: writes-local
- approval: --execute
- why: Render claude-marketplace catalog file marketplace-checkout/.claude-plugin/marketplace.json.
- write path: marketplace-checkout/.claude-plugin/marketplace.json

#### catalog:claude-marketplace:checkout

- target: catalog
- risk: writes-local
- approval: --execute
- why: Create ts-release/release-example-agent-plugin-0.1.0.

Command argv:

```json
[
  "git",
  "-C",
  "marketplace-checkout",
  "checkout",
  "-B",
  "ts-release/release-example-agent-plugin-0.1.0"
]
```

#### catalog:claude-marketplace:push:add

- target: catalog
- risk: writes-local
- approval: --execute
- why: Stage marketplace.json for catalog.

Command argv:

```json
[
  "git",
  "-C",
  "marketplace-checkout",
  "add",
  ".claude-plugin/marketplace.json"
]
```

#### catalog:claude-marketplace:push:commit

- target: catalog
- risk: writes-local
- approval: --execute
- why: Commit marketplace.json for catalog.

Command argv:

```json
[
  "git",
  "-C",
  "marketplace-checkout",
  "commit",
  "-m",
  "Update release-example-agent-plugin to 0.1.0"
]
```

> Approval boundary: externally visible and irreversible operations require explicit approval.

### externally-visible

#### github:github-release-create

- target: github
- risk: externally-visible
- approval: --execute
- why: Create GitHub release for release-example-agent-plugin@0.1.0.
- github-api: create release owner/agent-plugin v0.1.0
- assets: 2

#### catalog:claude-marketplace:push

- target: catalog
- risk: externally-visible
- approval: --execute
- why: Push claude-marketplace catalog update for release-example-agent-plugin@0.1.0.

Command argv:

```json
[
  "git",
  "-C",
  "marketplace-checkout",
  "push",
  "-u",
  "origin",
  "ts-release/release-example-agent-plugin-0.1.0"
]
```

#### catalog:claude-marketplace:pull-request

- target: catalog
- risk: externally-visible
- approval: --execute
- why: Open claude-marketplace catalog pull request.

Command argv:

```json
[
  "gh",
  "pr",
  "create",
  "--repo",
  "owner/claude-marketplace",
  "--title",
  "Update release-example-agent-plugin to 0.1.0",
  "--body",
  "Push claude-marketplace catalog update for release-example-agent-plugin@0.1.0.",
  "--head",
  "ts-release/release-example-agent-plugin-0.1.0"
]
```

### irreversible

- none
