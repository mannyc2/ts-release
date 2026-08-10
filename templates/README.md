# Release templates

Templates are complete starting points for authored configuration and GitHub
Actions. Replace package, repository, artifact, and provider values before use.

The smallest workflow path is automatic: one job prepares and uploads the
complete bundle; a second job downloads, verifies, and publishes it. Copy
`github-actions/release.yml`. If a host gate is required, copy
`github-actions/reviewed-release.yml`; it changes only the publication job's
environment policy.

Configuration templates cover npm, GitHub Releases, portable binaries, and
catalog rendering examples. They are schema-checked; support claims come from
the [executable capability inventory](../docs/capabilities.md), not from a
field appearing in a template.
