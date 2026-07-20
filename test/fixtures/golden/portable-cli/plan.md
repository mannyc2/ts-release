# Release Plan @scope/portable-example@0.1.0

## Summary

summary: @scope/portable-example@0.1.0
commit: abc123
evidence: .release/evidence/0.1.0
operations: 32
risk:
  read-only: 11
  writes-local: 16
  externally-visible: 3
  irreversible: 2
execute required: 21
irreversible approval required: 2

surfaces:
  - catalog operations=6
  - file operations=2
  - github operations=3
  - npm operations=6
  - pypi operations=5

approval-required operations:
  - build:bun:cli-linux-x64: --execute (writes-local)
  - build:bun:cli-linux-arm64: --execute (writes-local)
  - build:bun:cli-darwin-x64: --execute (writes-local)
  - build:bun:cli-darwin-arm64: --execute (writes-local)
  - build:bun:cli-windows-x64: --execute (writes-local)
  - build:pypi-wheel:pypi-wheel-linux-x64: --execute (writes-local)
  - build:pypi-wheel:pypi-wheel-linux-arm64: --execute (writes-local)
  - build:pypi-wheel:pypi-wheel-darwin-x64: --execute (writes-local)
  - build:pypi-wheel:pypi-wheel-darwin-arm64: --execute (writes-local)
  - build:pypi-wheel:pypi-wheel-windows-x64: --execute (writes-local)
  - catalog:homebrew:render: --execute (writes-local)
  - catalog:scoop:render: --execute (writes-local)
  - npm:npm-publish: --execute + --approve-publish (irreversible)
  - pypi:twine-upload: --execute + --approve-publish (irreversible)
  - github:github-release-create: --execute (externally-visible)
  - catalog:homebrew:push:add: --execute (writes-local)
  - catalog:homebrew:push:commit: --execute (writes-local)
  - catalog:homebrew:push: --execute (externally-visible)
  - catalog:scoop:push:add: --execute (writes-local)
  - catalog:scoop:push:commit: --execute (writes-local)
  - catalog:scoop:push: --execute (externally-visible)

## Artifacts

- cli-linux-x64 artifacts/portable-example-0.1.0-linux-x64 [executable] produced-by=build:bun platform=linux-x64-glibc checksum=none
- cli-linux-arm64 artifacts/portable-example-0.1.0-linux-arm64 [executable] produced-by=build:bun platform=linux-arm64-glibc checksum=none
- cli-darwin-x64 artifacts/portable-example-0.1.0-darwin-x64 [executable] produced-by=build:bun platform=darwin-x64 checksum=none
- cli-darwin-arm64 artifacts/portable-example-0.1.0-darwin-arm64 [executable] produced-by=build:bun platform=darwin-arm64 checksum=none
- cli-windows-x64 artifacts/portable-example-0.1.0-windows-x64.exe [executable] produced-by=build:bun platform=windows-x64 checksum=none
- npm-package . [package] produced-by=build:npm-pack platform=none checksum=none
- pypi-wheel-linux-x64 artifacts/portable_example-0.1.0-py3-none-manylinux2014_x86_64.whl [wheel] produced-by=build:pypi-wheel platform=none checksum=none
- pypi-wheel-linux-arm64 artifacts/portable_example-0.1.0-py3-none-manylinux2014_aarch64.whl [wheel] produced-by=build:pypi-wheel platform=none checksum=none
- pypi-wheel-darwin-x64 artifacts/portable_example-0.1.0-py3-none-macosx_10_15_x86_64.whl [wheel] produced-by=build:pypi-wheel platform=none checksum=none
- pypi-wheel-darwin-arm64 artifacts/portable_example-0.1.0-py3-none-macosx_11_0_arm64.whl [wheel] produced-by=build:pypi-wheel platform=none checksum=none
- pypi-wheel-windows-x64 artifacts/portable_example-0.1.0-py3-none-win_amd64.whl [wheel] produced-by=build:pypi-wheel platform=none checksum=none
- catalog-file-homebrew .release/generated/portable-example.rb [catalog-file] produced-by=catalog:file platform=none checksum=none
- catalog-file-scoop .release/generated/portable-example.json [catalog-file] produced-by=catalog:file platform=none checksum=none

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

### writes-local

#### build:bun:cli-linux-x64

- target: none
- risk: writes-local
- approval: --execute
- why: Compile scope-portable-example for linux-x64 with Bun.

#### build:bun:cli-linux-arm64

- target: none
- risk: writes-local
- approval: --execute
- why: Compile scope-portable-example for linux-arm64 with Bun.

#### build:bun:cli-darwin-x64

- target: none
- risk: writes-local
- approval: --execute
- why: Compile scope-portable-example for darwin-x64 with Bun.

#### build:bun:cli-darwin-arm64

- target: none
- risk: writes-local
- approval: --execute
- why: Compile scope-portable-example for darwin-arm64 with Bun.

#### build:bun:cli-windows-x64

- target: none
- risk: writes-local
- approval: --execute
- why: Compile scope-portable-example for windows-x64 with Bun.

#### build:pypi-wheel:pypi-wheel-linux-x64

- target: none
- risk: writes-local
- approval: --execute
- why: Assemble PyPI wheel pypi-wheel-linux-x64.

#### build:pypi-wheel:pypi-wheel-linux-arm64

- target: none
- risk: writes-local
- approval: --execute
- why: Assemble PyPI wheel pypi-wheel-linux-arm64.

#### build:pypi-wheel:pypi-wheel-darwin-x64

- target: none
- risk: writes-local
- approval: --execute
- why: Assemble PyPI wheel pypi-wheel-darwin-x64.

#### build:pypi-wheel:pypi-wheel-darwin-arm64

- target: none
- risk: writes-local
- approval: --execute
- why: Assemble PyPI wheel pypi-wheel-darwin-arm64.

#### build:pypi-wheel:pypi-wheel-windows-x64

- target: none
- risk: writes-local
- approval: --execute
- why: Assemble PyPI wheel pypi-wheel-windows-x64.

#### catalog:homebrew:render

- target: file
- risk: writes-local
- approval: --execute
- why: Render homebrew catalog file .release/generated/portable-example.rb.
- write path: .release/generated/portable-example.rb

#### catalog:scoop:render

- target: file
- risk: writes-local
- approval: --execute
- why: Render scoop catalog file .release/generated/portable-example.json.
- write path: .release/generated/portable-example.json

#### catalog:homebrew:push:add

- target: catalog
- risk: writes-local
- approval: --execute
- why: Stage portable-example.rb for catalog.

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

#### catalog:homebrew:push:commit

- target: catalog
- risk: writes-local
- approval: --execute
- why: Commit portable-example.rb for catalog.

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

#### catalog:scoop:push:add

- target: catalog
- risk: writes-local
- approval: --execute
- why: Stage portable-example.json for catalog.

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

#### catalog:scoop:push:commit

- target: catalog
- risk: writes-local
- approval: --execute
- why: Commit portable-example.json for catalog.

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

#### catalog:homebrew:push

- target: catalog
- risk: externally-visible
- approval: --execute
- why: Push homebrew catalog update for @scope/portable-example@0.1.0.

Command argv:

```json
[
  "git",
  "-C",
  ".",
  "push"
]
```

#### catalog:scoop:push

- target: catalog
- risk: externally-visible
- approval: --execute
- why: Push scoop catalog update for @scope/portable-example@0.1.0.

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
