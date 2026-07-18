# Release Plan release-example-pypi@0.1.0

## Summary

summary: release-example-pypi@0.1.0
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
  - pypi operations=4

approval-required operations:
  - pypi:twine-upload: --execute + --approve-publish (irreversible)

## Artifacts

- wheel artifacts/release_example_pypi-0.1.0-py3-none-any.whl [file] produced-by=import-artifacts platform=none checksum=none

## Operations By Risk

### read-only

#### import-artifacts:wheel:exists

- target: none
- risk: read-only
- approval: none
- why: Verify imported artifact wheel exists.

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
  "artifacts/release_example_pypi-0.1.0-py3-none-any.whl"
]
```

### writes-local

- none

> Approval boundary: externally visible and irreversible operations require explicit approval.

### externally-visible

- none

### irreversible

#### pypi:twine-upload

- target: pypi
- risk: irreversible
- approval: --execute + --approve-publish
- why: Publish release-example-pypi@0.1.0 to PyPI-compatible registry.

Command argv:

```json
[
  "python",
  "-m",
  "twine",
  "upload",
  "--non-interactive",
  "--repository-url",
  "https://test.pypi.org/legacy/",
  "artifacts/release_example_pypi-0.1.0-py3-none-any.whl"
]
```
