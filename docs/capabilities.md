# Executable capabilities

This page is generated from the actual module values composed by the compiler
and runtime, plus the dated records in [`capability-evidence.json`](capability-evidence.json).
A filename, schema field, test reference, or prose row cannot install support.

Evidence classes remain distinct. Contract-tested support is not a claim that
a live provider mutation has been dogfooded.

| Capability | State | Executable composition | Owned fields | Boundary | Certification | Declared execution hosts | Declared artifact targets | Native tools | Credentials | Evidence | Observed |
| --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| `release.identity` | installed | resolve | 9 | root-api | 2 executable tests | linux | — | git | — | contract-tested | 2026-08-12 |
| `prepare.source` | installed | contribute:source | 38 | root-api | 3 executable tests | linux | linux-x64, linux-arm64, darwin-x64, darwin-arm64 | bun, libseccomp.so.2, declared-command | — | contract-tested | 2026-08-12 |
| `prepare.package` | installed | contribute:package | 7 | root-api | 2 executable tests | linux | — | — | — | contract-tested | 2026-08-12 |
| `publish.npm` | installed | contribute + subjects:PreparedNpmPublication | 15 | provider-protocol | 2 executable tests | linux | — | npm | token, trusted-publishing | contract-tested | 2026-08-12 |
| `publish.github` | installed | contribute + subjects:PreparedGitHubPublication | 17 | provider-protocol | 3 executable tests | linux | — | — | token | contract-tested | 2026-08-12 |

Native Windows execution is not installed. The source-preparation module
declares only the listed artifact targets and the Linux execution host.
Release support requires separate public-entrypoint host smoke and target
file-format/architecture gates; declarations alone are not certification.
Linux preparation requires an external Bun executable and `libseccomp.so.2`.
The standalone CLI still uses those native tools for network-denied commands
and is not a self-contained preparation sandbox.
