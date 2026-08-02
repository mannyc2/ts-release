# Release examples

These are runnable planning fixtures. They never publish during repository
checks.

```sh
cd examples/multi-target
bun ../../apps/release-ts/src/cli/main.ts plan \
  --config release.config.json \
  --out release-plan.json
```

Examples hand-state `commit`, `version`, and `tag` because they are decode
fixtures that must plan without a git repository; in a real repository
`--from-git` observes all three (see `templates/README.md`).

The examples cover agent plugin packaging, GitHub Releases, Homebrew, Scoop,
npm, first-publish npm configuration, portable CLI distribution, PyPI, and a
coordinated multi-target release. Every config supplies a complete public
project and provider shape.

Plans keep publication as data. Applying one requires the exact `PlanId`,
immutable reviewed scope, run-bound execution receipt, and—after local
materialization—the observed publish confirmation.

The named baseline behaviors exercised by these fixtures are covered by the
repository parity contract. No broader provider-parity claim is implied.
