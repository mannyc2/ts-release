# ts-release Action App

This private first-party app builds the `mannyc2/ts-release-action` JavaScript
action. It adapts GitHub Action inputs, outputs, step summaries, and optional
evidence artifact uploads to the reusable `@mannyc1/ts-release` workflow APIs.

The bundled action runtime composes Node platform services, the platform command
runner, and the library live target/HTTP workflow layer at the action boundary.
`runtime: bundled` is the supported mode. `runtime: workspace` is intentionally
blocked until a same-module-graph Node platform setup can be required safely.

Supported action commands are:

- `plan`
- `validate-config`
- `eligibility`
- `check-intent`
- `doctor`
- `check-auth`
- `check-ci`
- `validate`
- `run`
- `reconcile`

Useful app-local commands:

```sh
bun run --cwd apps/ts-release-action check
bun run --cwd apps/ts-release-action build
```

Use `upload-evidence: true` when a workflow should upload collected
`.release/evidence` JSON bundles after command completion or failure. Approved
execution still requires `execute: true`, and irreversible operations also
require `approve-irreversible: true`.

`eligibility` decides whether the configured release strategy should run.
`check-intent` is the stricter read-only gate for intent-file workflows: it
fails when required intent files are missing, while explicit no-release intent
files pass with `should_release=false`.
