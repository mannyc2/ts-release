# Release templates

Templates are complete copyable configuration and workflow starting points.
Replace package, repository, artifact, and provider values before use.

The release engine observes a clean checkout and resolves authored
configuration before preparation. Contradictory source facts are refused
rather than guessed.

Release in one command:

```sh
ts-release release --config release.config.json
```

Config templates:

- `npm-only`
- `npm-github`
- `bun-cli-github`
- `portable-cli`
- `multi-target-homebrew`
- `multi-target-scoop`

Each fixture carries a complete project identity and complete fields for the
package/provider surfaces it uses.

Workflow templates:

- `github-actions/release.yml` — the automatic release workflow.

Hosts may add environment protection when review is desired; the release
engine does not transport review state or a host ledger.

The `{{setup-bun}}`, `{{install}}`, and `{{build}}` values in a generic
workflow are application scaffolding, not lifecycle verbs.
