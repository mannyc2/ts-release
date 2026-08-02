# Release templates

Templates are complete copyable configuration and workflow starting points.
Replace package, repository, artifact, and provider values before use.

These configs state no `commit`, `version`, or `tag` where the repository can
answer for itself; `--from-git` observes the HEAD commit, the release-shaped tag
at HEAD, and the package manifest's version. Write the fields back by hand if
you would rather state them — the resolver refuses when the two disagree, and
never picks a side.

Release in one command:

```sh
ts-release ship --config release.config.json --from-git
```

Or generate a canonical plan for the staged flow:

```sh
ts-release plan --config release.config.json --from-git --out release-plan.json
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

- `github-actions/release.yml` — the whole staged pipeline in ten lines, by
  calling the reusable workflow the Action repository publishes.
- `github-actions/plan-only.yml` — a PR-time plan preview that publishes
  nothing.

The composed workflow applies through `validate`, exposes the observed publish
challenge, then resumes the same ledger through `verify` with explicit publish
confirmation — the threading is its job, not yours. Whether a human approves
between those stages is a property of the environment you name: protect it in
Settings → Environments and the run records `environment:` as its reviewer;
leave it unprotected and the same pipeline runs one-shot and records `self:`.
Configure trusted publishing before publishing to npm or PyPI.

The `{{setup-bun}}`, `{{install}}`, and `{{build}}` values in the generic
workflow are application scaffolding; they are not core configuration parsers
or alternate lifecycle verbs.
