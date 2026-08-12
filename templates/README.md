# Release templates

Templates are complete starting points for authored configuration and GitHub
Actions. Replace package, repository, artifact, and provider values before use.

The smallest workflow path is automatic: one job calls `release` once, and the
Action durably commits the complete bundle before publication. Copy
`github-actions/release.yml`. If a host gate is required, copy the two-job
`github-actions/reviewed-release.yml`; its prepare job emits one exact hosted
reference and only its publish job has the protected environment and mutation
permissions.

Configuration templates cover npm, GitHub Releases, portable binaries, and
catalog rendering examples. They are schema-checked; support claims come from
the [executable capability inventory](../docs/capabilities.md), not from a
field appearing in a template.
