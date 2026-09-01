# Release templates

Templates are complete starting points for authored configuration and GitHub
Actions. Replace package, repository, artifact, and provider values before use.

The smallest workflow path is automatic: one job invokes the Action once. On
a fresh run it selects `release`, and the Action durably commits the complete
bundle before publication. Copy
`github-actions/release.yml` with `npm-github/release.config.json`. If a host
gate is required, copy the two-job `github-actions/reviewed-release.yml` and
its paired `npm-github/reviewed-release.config.json`; its prepare job emits one
exact hosted reference and only its publish job has the protected environment
and mutation permissions. Every Action step uploads only its redacted
`report-ref` as a workflow artifact. Prepared bytes stay in the dedicated
content-addressed Action store and are not duplicated by a generic artifact
step.

Both templates expose only `workflow_dispatch` and require `candidate_sha`.
Dispatch at `refs/heads/main` and pass the exact current commit; a ref or SHA
mismatch rejects the entire job before checkout. The automatic template also
accepts optional `prepared_ref`. Leave it empty for the fresh `release` path.
To recover a prior automatic run, pass its exact `prepared:gha:` value: the
same job selects `publish`, passes no config, uses `actions: read` to load the
prior artifact, and never rebuilds. Config and prepared reference are mutually
exclusive.

The reviewed template retains the same candidate admission on both jobs. If
its publish job fails after preparation, rerun that failed job in the same
workflow run so `${{ needs.prepare.outputs.prepared-ref }}` continues to name
the original bundle. Do not create a new prepare run as recovery.

The trusted-publishing job installs the Node 22.22.2 and npm 11.11.0
publisher boundary explicitly. The reviewed prepare job has no OIDC or publish
authority; only its publish job installs that publisher toolchain.
Trusted configuration must name the invoking workflow and exact ref: the
automatic pair uses `release.yml`, while the reviewed pair uses
`reviewed-release.yml`. Keep those filenames when copying the pair, dispatch
it from `refs/heads/main`, or update the exact config fields deliberately. A
repository, workflow path/ref, hosted-runner, direct action, or certified-sink
mismatch fails before OIDC request material is read.

Runnable configuration templates cover npm, GitHub Releases, portable
binaries, typed Homebrew formulas, and typed Scoop manifests. Templates are schema-checked;
support still requires a default-layer vertical test and clean-candidate
evidence, not merely a field appearing in a template.

`npm-github` is the GitHub-hosted trusted-publishing default. `npm-only` is the
explicit token-mode migration template for non-OIDC hosts; it names a
credential reference but never contains a credential value.

All public Action templates use the exact intended monorepo coordinate
`mannyc2/ts-release/apps/ts-release-action@v0.3.0`. Do not switch it to a
floating branch. Candidate certification must stop unless the immutable tag
can exist at the exact result commit before a package README naming it is
published.
