# Release examples

Examples are schema-checked authored configurations. They show jobs that map
to native ts-release primitives; they do not publish during repository checks.

Start with the automatic path:

```sh
ts-release init
ts-release release --config release.config.json
```

Runnable fixtures cover npm, GitHub Releases, portable binaries,
archive/checksum preparation, and typed Homebrew/Scoop catalog Git delivery.
Catalog fixtures prepare locally during checks and never mutate a provider.
The PyPI directory remains a migration note until it carries an independently
runnable prebuilt-distribution fixture.
An example passing strict decode is necessary but not sufficient support
evidence; the same capability must execute through the root API and default
runtime in release-candidate certification.

Trusted npm examples bind local host admission to the exact repository,
workflow filename, and `workflowRef` they author. For the reviewed two-job
workflow, start from the paired
`templates/npm-github/reviewed-release.config.json`; the host refuses a foreign
workflow/ref before reading OIDC request material.
