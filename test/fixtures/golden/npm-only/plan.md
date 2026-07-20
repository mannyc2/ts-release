# Release Plan release-example-npm-only@0.1.0

## Summary

summary: release-example-npm-only@0.1.0
commit: example
evidence: .release/evidence
operations: 5
risk:
  read-only: 4
  writes-local: 0
  externally-visible: 0
  irreversible: 1
execute required: 1
irreversible approval required: 1

surfaces:
  - npm operations=5

approval-required operations:
  - npm:npm-publish: --execute + --approve-publish (irreversible)

## Artifacts

- npm-package . [package] produced-by=build:npm-pack platform=none checksum=none

## Operations By Risk

### read-only

#### npm:npm-trusted-publishing-auth

- target: npm
- risk: read-only
- approval: none
- why: Record npm trusted publishing authentication mode.
- note: NPM trusted publishing authenticates during npm publish with CI OIDC; npm whoami does not validate this mode. This target expects provider github-actions, workflow release.yml, GitHub Actions permission id-token: write, and package release-example-npm-only to already exist on the registry.

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
  "release-example-npm-only",
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
- why: Verify release-example-npm-only@0.1.0 exists on npm.

Command argv:

```json
[
  "npm",
  "view",
  "release-example-npm-only@0.1.0",
  "version",
  "--registry",
  "https://registry.npmjs.org"
]
```

### writes-local

- none

> Approval boundary: externally visible and irreversible operations require explicit approval.

### externally-visible

- none

### irreversible

#### npm:npm-publish

- target: npm
- risk: irreversible
- approval: --execute + --approve-publish
- why: Publish release-example-npm-only@0.1.0 to npm.

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
