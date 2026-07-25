# Release Plan release-example-pypi@0.1.0

## Summary

summary: release-example-pypi@0.1.0
commit: example
fingerprint: b27fe15bb73b2d81af28d6232c8b8558aee27cd2b2f160db68f35ebda366227f
evidence: .release/evidence
operations: 3
risk:
  read-only: 2
  writes-local: 0
  externally-visible: 0
  irreversible: 1
execute required: 1
irreversible approval required: 1

surfaces:
  - pypi operations=2

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
