# Release Plan @scope/portable-example@0.1.0

## Summary

summary: @scope/portable-example@0.1.0
commit: abc123
evidence: .release/evidence/0.1.0
operations: 24
risk:
  read-only: 13
  writes-local: 6
  externally-visible: 3
  irreversible: 2
execute required: 11
irreversible approval required: 2

surfaces:
  - github operations=3
  - homebrew operations=5
  - npm operations=6
  - pypi operations=5
  - scoop operations=5

approval-required operations:
  - homebrew:homebrew-render-formula: --execute (writes-local)
  - scoop:scoop-render-manifest: --execute (writes-local)
  - npm:npm-publish: --execute + --approve-publish (irreversible)
  - pypi:twine-upload: --execute + --approve-publish (irreversible)
  - github:github-release-create: --execute (externally-visible)
  - homebrew:homebrew-push:add: --execute (writes-local)
  - homebrew:homebrew-push:commit: --execute (writes-local)
  - homebrew:homebrew-push: --execute (externally-visible)
  - scoop:scoop-push:add: --execute (writes-local)
  - scoop:scoop-push:commit: --execute (writes-local)
  - scoop:scoop-push: --execute (externally-visible)

## Artifacts

- - cli-linux-x64 artifacts/portable-example-0.1.0-linux-x64 [executable] size=0 checksum=none
- - cli-linux-arm64 artifacts/portable-example-0.1.0-linux-arm64 [executable] size=0 checksum=none
- - cli-darwin-x64 artifacts/portable-example-0.1.0-darwin-x64 [executable] size=0 checksum=none
- - cli-darwin-arm64 artifacts/portable-example-0.1.0-darwin-arm64 [executable] size=0 checksum=none
- - cli-windows-x64 artifacts/portable-example-0.1.0-windows-x64.exe [executable] size=0 checksum=none
- - npm-package . [directory] size=0 checksum=none
- - pypi-wheel-linux-x64 artifacts/portable_example-0.1.0-py3-none-manylinux2014_x86_64.whl [file] size=0 checksum=none
- - pypi-wheel-linux-arm64 artifacts/portable_example-0.1.0-py3-none-manylinux2014_aarch64.whl [file] size=0 checksum=none
- - pypi-wheel-darwin-x64 artifacts/portable_example-0.1.0-py3-none-macosx_10_15_x86_64.whl [file] size=0 checksum=none
- - pypi-wheel-darwin-arm64 artifacts/portable_example-0.1.0-py3-none-macosx_11_0_arm64.whl [file] size=0 checksum=none
- - pypi-wheel-windows-x64 artifacts/portable_example-0.1.0-py3-none-win_amd64.whl [file] size=0 checksum=none
- - homebrew-formula .release/generated/portable-example.rb [file] size=0 checksum=none
- - scoop-manifest .release/generated/portable-example.json [file] size=0 checksum=none

## Operations By Risk

### read-only

#### npm:npm-version

- target: npm
- risk: read-only
- approval: none
- why: Check npm CLI availability.

Command argv:

```json
[
  "npm",
  "--version"
]
```

#### npm:npm-trusted-publishing-auth

- target: npm
- risk: read-only
- approval: none
- why: Record npm trusted publishing authentication mode.
- note: NPM trusted publishing authenticates during npm publish with CI OIDC; npm whoami does not validate this mode. This target expects provider github-actions, workflow release.yml, GitHub Actions permission id-token: write, and package @scope/portable-example to already exist on the registry.

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
  "@scope/portable-example",
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
- why: Verify @scope/portable-example@0.1.0 exists on npm.

Command argv:

```json
[
  "npm",
  "view",
  "@scope/portable-example@0.1.0",
  "version",
  "--registry",
  "https://registry.npmjs.org"
]
```

#### pypi:python-version

- target: pypi
- risk: read-only
- approval: none
- why: Check Python CLI availability.

Command argv:

```json
[
  "python",
  "--version"
]
```

#### pypi:twine-version

- target: pypi
- risk: read-only
- approval: none
- why: Check Twine CLI availability.

Command argv:

```json
[
  "python",
  "-m",
  "twine",
  "--version"
]
```

#### pypi:twine-trusted-publishing-auth

- target: pypi
- risk: read-only
- approval: none
- why: Record PyPI trusted publishing authentication mode.
- note: PyPI trusted publishing authenticates during twine upload with CI OIDC; twine check does not validate this mode. This target expects provider github-actions, workflow release.yml, GitHub Actions permission id-token: write, and a trusted publisher configured on PyPI.

#### pypi:twine-check

- target: pypi
- risk: read-only
- approval: none
- why: Validate Python distribution metadata with twine check.

Command argv:

```json
[
  "python",
  "-m",
  "twine",
  "check",
  "artifacts/portable_example-0.1.0-py3-none-manylinux2014_x86_64.whl",
  "artifacts/portable_example-0.1.0-py3-none-manylinux2014_aarch64.whl",
  "artifacts/portable_example-0.1.0-py3-none-macosx_10_15_x86_64.whl",
  "artifacts/portable_example-0.1.0-py3-none-macosx_11_0_arm64.whl",
  "artifacts/portable_example-0.1.0-py3-none-win_amd64.whl"
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
- github-api: verify release owner/portable-example v0.1.0
- assets: 5

#### homebrew:brew-audit

- target: homebrew
- risk: read-only
- approval: none
- why: Record simulated Homebrew formula validation.
- note: Homebrew formula validation is simulated by the deterministic release plan.

#### scoop:scoop-manifest-validation

- target: scoop
- risk: read-only
- approval: none
- why: Record simulated Scoop manifest validation.
- note: Scoop manifest validation is simulated by the deterministic release plan.

### writes-local

#### homebrew:homebrew-render-formula

- target: homebrew
- risk: writes-local
- approval: --execute
- why: Render Homebrew formula portable-example.rb.
- write path: .release/generated/portable-example.rb

#### scoop:scoop-render-manifest

- target: scoop
- risk: writes-local
- approval: --execute
- why: Render Scoop manifest portable-example.json.
- write path: .release/generated/portable-example.json

#### homebrew:homebrew-push:add

- target: homebrew
- risk: writes-local
- approval: --execute
- why: Stage portable-example.rb for homebrew.

Command argv:

```json
[
  "git",
  "-C",
  ".",
  "add",
  ".release/generated/portable-example.rb"
]
```

#### homebrew:homebrew-push:commit

- target: homebrew
- risk: writes-local
- approval: --execute
- why: Commit portable-example.rb for homebrew.

Command argv:

```json
[
  "git",
  "-C",
  ".",
  "commit",
  "-m",
  "Update portable-example to 0.1.0"
]
```

#### scoop:scoop-push:add

- target: scoop
- risk: writes-local
- approval: --execute
- why: Stage portable-example.json for scoop.

Command argv:

```json
[
  "git",
  "-C",
  ".",
  "add",
  ".release/generated/portable-example.json"
]
```

#### scoop:scoop-push:commit

- target: scoop
- risk: writes-local
- approval: --execute
- why: Commit portable-example.json for scoop.

Command argv:

```json
[
  "git",
  "-C",
  ".",
  "commit",
  "-m",
  "Update portable-example to 0.1.0"
]
```

> Approval boundary: externally visible and irreversible operations require explicit approval.

### externally-visible

#### github:github-release-create

- target: github
- risk: externally-visible
- approval: --execute
- why: Create GitHub release for @scope/portable-example@0.1.0.
- github-api: create release owner/portable-example v0.1.0
- assets: 5

#### homebrew:homebrew-push

- target: homebrew
- risk: externally-visible
- approval: --execute
- why: Push Homebrew tap update for @scope/portable-example@0.1.0.

Command argv:

```json
[
  "git",
  "-C",
  ".",
  "push"
]
```

#### scoop:scoop-push

- target: scoop
- risk: externally-visible
- approval: --execute
- why: Push Scoop bucket update for @scope/portable-example@0.1.0.

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
- why: Publish @scope/portable-example@0.1.0 to npm.

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

#### pypi:twine-upload

- target: pypi
- risk: irreversible
- approval: --execute + --approve-publish
- why: Publish @scope/portable-example@0.1.0 to PyPI-compatible registry.

Command argv:

```json
[
  "python",
  "-m",
  "twine",
  "upload",
  "--non-interactive",
  "--repository-url",
  "https://upload.pypi.org/legacy/",
  "artifacts/portable_example-0.1.0-py3-none-manylinux2014_x86_64.whl",
  "artifacts/portable_example-0.1.0-py3-none-manylinux2014_aarch64.whl",
  "artifacts/portable_example-0.1.0-py3-none-macosx_10_15_x86_64.whl",
  "artifacts/portable_example-0.1.0-py3-none-macosx_11_0_arm64.whl",
  "artifacts/portable_example-0.1.0-py3-none-win_amd64.whl"
]
```
