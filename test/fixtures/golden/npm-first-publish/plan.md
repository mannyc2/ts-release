# Release Plan @scope/release-example-first@0.1.0

## Summary

summary: @scope/release-example-first@0.1.0
commit: example
fingerprint: ed4ec2505d24c5c754a64d886290b5cecd3f619a712a78f1ed83179d4461fd30
evidence: .release/evidence
operations: 4
risk:
  read-only: 3
  writes-local: 0
  externally-visible: 0
  irreversible: 1
execute required: 1
irreversible approval required: 1

surfaces:
  - npm operations=4

approval-required operations:
  - npm:npm-publish: --execute + --approve-publish (irreversible)

## Artifacts

- npm-package . [package] produced-by=build:npm-pack platform=none checksum=none

## Operations By Risk

### read-only

#### npm:npm-whoami

- target: npm
- risk: read-only
- approval: none
- why: Validate npm CLI authentication.

Command argv:

```json
[
  "npm",
  "whoami",
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
- why: Verify @scope/release-example-first@0.1.0 exists on npm.

Command argv:

```json
[
  "npm",
  "view",
  "@scope/release-example-first@0.1.0",
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
- why: Publish @scope/release-example-first@0.1.0 to npm.

Command argv:

```json
[
  "npm",
  "publish",
  ".",
  "--registry",
  "https://registry.npmjs.org",
  "--access",
  "public"
]
```
