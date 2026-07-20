# Release Plan release-example-multi-target@0.1.0

## Summary

summary: release-example-multi-target@0.1.0
commit: example
evidence: .release/evidence
operations: 13
risk:
  read-only: 7
  writes-local: 3
  externally-visible: 2
  irreversible: 1
execute required: 6
irreversible approval required: 1

surfaces:
  - catalog operations=3
  - file operations=1
  - github operations=3
  - npm operations=5

approval-required operations:
  - catalog:homebrew:render: --execute (writes-local)
  - npm:npm-publish: --execute + --approve-publish (irreversible)
  - github:github-release-create: --execute (externally-visible)
  - catalog:homebrew:push:add: --execute (writes-local)
  - catalog:homebrew:push:commit: --execute (writes-local)
  - catalog:homebrew:push: --execute (externally-visible)

## Artifacts

- npm-package . [package] produced-by=build:npm-pack platform=none checksum=none
- archive artifacts/release-example-multi-target-0.1.0.tgz [archive] produced-by=import-artifacts platform=none checksum=none
- catalog-file-homebrew .release/generated/release-example-multi-target.rb [catalog-file] produced-by=catalog:file platform=none checksum=none

## Operations By Risk

### read-only

#### import-artifacts:archive:exists

- target: none
- risk: read-only
- approval: none
- why: Verify imported artifact archive exists.

#### npm:npm-trusted-publishing-auth

- target: npm
- risk: read-only
- approval: none
- why: Record npm trusted publishing authentication mode.
- note: NPM trusted publishing authenticates during npm publish with CI OIDC; npm whoami does not validate this mode. This target expects provider github-actions, workflow release.yml, GitHub Actions permission id-token: write, and package release-example-multi-target to already exist on the registry.

#### npm:npm-package-exists

- target: npm
- risk: read-only
- approval: none
- why: Verify npm package exists before trusted publishing.

Command argv:

```json
[
  "npm",
  "view",
  "release-example-multi-target",
  "name",
  "--registry",
  "https://registry.npmjs.org"
]
```

#### npm:npm-pack-dry-run

- target: npm
- risk: read-only
- approval: none
- why: Validate npm package contents with npm pack dry-run.

Command argv:

```json
[
  "npm",
  "pack",
  "--dry-run",
  "--json",
  "."
]
```

#### npm:npm-version-verify

- target: npm
- risk: read-only
- approval: none
- why: Verify release-example-multi-target@0.1.0 exists on npm.

Command argv:

```json
[
  "npm",
  "view",
  "release-example-multi-target@0.1.0",
  "version",
  "--registry",
  "https://registry.npmjs.org"
]
```

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
- github-api: verify release owner/release-example-multi-target v0.1.0
- assets: 1

### writes-local

#### catalog:homebrew:render

- target: file
- risk: writes-local
- approval: --execute
- why: Render homebrew catalog file .release/generated/release-example-multi-target.rb.
- write path: .release/generated/release-example-multi-target.rb

#### catalog:homebrew:push:add

- target: catalog
- risk: writes-local
- approval: --execute
- why: Stage release-example-multi-target.rb for catalog.

Command argv:

```json
[
  "git",
  "-C",
  ".",
  "add",
  ".release/generated/release-example-multi-target.rb"
]
```

#### catalog:homebrew:push:commit

- target: catalog
- risk: writes-local
- approval: --execute
- why: Commit release-example-multi-target.rb for catalog.

Command argv:

```json
[
  "git",
  "-C",
  ".",
  "commit",
  "-m",
  "Update release-example-multi-target to 0.1.0"
]
```

> Approval boundary: externally visible and irreversible operations require explicit approval.

### externally-visible

#### github:github-release-create

- target: github
- risk: externally-visible
- approval: --execute
- why: Create GitHub release for release-example-multi-target@0.1.0.
- github-api: create release owner/release-example-multi-target v0.1.0
- assets: 1

#### catalog:homebrew:push

- target: catalog
- risk: externally-visible
- approval: --execute
- why: Push homebrew catalog update for release-example-multi-target@0.1.0.

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

#### npm:npm-publish

- target: npm
- risk: irreversible
- approval: --execute + --approve-publish
- why: Publish release-example-multi-target@0.1.0 to npm.

Command argv:

```json
[
  "npm",
  "publish",
  ".",
  "--registry",
  "https://registry.npmjs.org",
  "--access",
  "public",
  "--provenance"
]
```
