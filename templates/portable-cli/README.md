# Portable CLI template

This complete fixture plans one Bun CLI for GitHub Releases, npm, Homebrew,
Scoop, and PyPI wrapper wheels. Update all product and provider identities
before use.

```sh
ts-release plan --config release.config.json --out release-plan.json
ts-release apply release-plan.json --plan-id PLAN_ID --review-only --scope all
```

Materialize through `validate`, review the observed publish challenge, then
resume the same ledger through `verify`.
