# Release examples

Examples are schema-checked authored configurations. They show jobs that map
to native ts-release primitives; they do not publish during repository checks.

Start with the automatic path:

```sh
ts-release init
ts-release release --config release.config.json
```

Runnable fixtures cover npm, GitHub Releases, portable binaries, and
archive/checksum preparation. PyPI, catalog Git, Homebrew, and Scoop are not
accepted publication families in the current schema. Their directories contain
migration notes only, never release configs that imply a no-op is supported.
An example passing strict decode is necessary but not sufficient support
evidence; the same capability must execute through the root API and default
runtime in release-candidate certification.

Trusted npm examples bind local host admission to the exact repository,
workflow filename, and `workflowRef` they author. For the reviewed two-job
workflow, start from the paired
`templates/npm-github/reviewed-release.config.json`; the host refuses a foreign
workflow/ref before reading OIDC request material.
