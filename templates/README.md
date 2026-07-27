# Release templates

Templates are complete copyable configuration and workflow starting points.
Replace package, repository, artifact, and provider values before use.

Generate a canonical plan:

```sh
ts-release plan --config release.config.json --out release-plan.json
```

Review it using the `PlanId` printed by `plan`:

```sh
ts-release doctor release-plan.json --plan-id PLAN_ID
ts-release apply release-plan.json --plan-id PLAN_ID --review-only --scope all
```

Config templates:

- `npm-only`
- `npm-github`
- `bun-cli-github`
- `portable-cli`
- `multi-target-homebrew`
- `multi-target-scoop`

Each fixture carries a complete project identity and complete fields for the
package/provider surfaces it uses. Homebrew and Scoop behavior comes from
immutable product presets.

Workflow templates:

- `github-actions/plan-only.yml`
- `github-actions/plan-and-approved-execute.yml`
- `github-actions/release.yml`
- `github-actions/trusted-publishing.yml`

Execution templates apply through `validate`, expose the observed publish
challenge, then resume the same ledger through `verify` with explicit publish
confirmation. Configure a protected `release` environment and trusted
publishing before using them.

The `{{setup-bun}}`, `{{install}}`, and `{{build}}` values in the generic
workflow are application scaffolding; they are not core configuration parsers
or alternate lifecycle verbs.
