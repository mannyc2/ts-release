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
- `status`
- `doctor`
- `check-auth`
- `check-ci`
- `validate`
- `run`
- `resume`
- `reconcile`

Useful app-local commands:

```sh
bun run --cwd apps/ts-release-action check
bun run --cwd apps/ts-release-action build
```

Use `upload-evidence: true` when a workflow should upload collected
`.release/evidence` JSON files after command completion or failure. Approved
execution still requires `execute: true`, and irreversible operations also
require `approve-irreversible: true`.
