# Decision 236 — ts-release embedded-binary PyPI wheels

Status: IMPLEMENTED LOCALLY / LIVE PUBLICATION GATED
Date: 2026-08-14

## Decision

Publish the `ts-release` Python project as four platform-specific wheels, each
containing exactly one native `ts-release` executable and a small Python
console-script launcher:

| Build target | Wheel compatibility tag |
| --- | --- |
| `linux-x64` | `py3-none-manylinux_2_17_x86_64` |
| `linux-arm64` | `py3-none-manylinux_2_17_aarch64` |
| `darwin-x64` | `py3-none-macosx_13_0_x86_64` |
| `darwin-arm64` | `py3-none-macosx_13_0_arm64` |

The wheels use distribution name `ts-release`, import package `ts_release`,
console script `ts-release`, and `Requires-Python: >=3.9`. Wheel bytes and ZIP
metadata are deterministic. The build rejects an executable whose header does
not match the requested target, a Linux executable requiring glibc newer than
2.17, or a Mach-O executable requiring macOS newer than 13.0.

## Publication topology

The manual `pypi-release.yml` workflow accepts an exact `candidate_sha` equal
to the current `main` tip. Its read-only build job creates and transfers the
four verified wheels using repository-configured GitHub Actions artifact
retention. Its separate `pypi` environment job grants only `id-token: write`,
downloads that artifact, and invokes
`pypa/gh-action-pypi-publish@release/v1`. The publisher job checks out no code
and runs no arbitrary shell command.

The trusted-publisher relationship is external host state. It must name owner
`mannyc2`, repository `ts-release`, workflow `pypi-release.yml`, branch `main`,
and environment `pypi`. The release engine records that authority but does not
implement PyPI's OIDC exchange.

## Boundary

This is a repository-specific product decision, not a general Python project
builder or an invitation for arbitrary wrapper generation. Linux remains the
only certified execution host for ts-release operations. The two macOS rows
certify cross-compiled artifact targets and wheel compatibility metadata; they
do not claim a successful macOS release-operation matrix.

No live upload, trusted-publisher change, project mutation, yanking, deletion,
or correction is authorized by this decision record.
