# ts-release Action app

This private first-party app owns GitHub Action input parsing, contained file
I/O, outputs, and the bundled Node entrypoint. It imports only the public
`@mannyc1/ts-release` root.

Commands are exactly `plan`, `doctor`, and `apply`.

- `plan` reads a workspace-contained JSON config once and writes canonical
  plan bytes.
- `doctor` consumes a plan and performs read-only review.
- `apply` consumes a plan plus a new-run or resume ledger path and never
  replans.

The Action emits `plan_id`, `execution_review_id`, `execution_receipt_id`,
`publish_review_id`, `publish_receipt_id`, `run_id`, `run_path`, `status`, and
`evidence_path`.

```sh
bun run --cwd apps/ts-release-action check
bun run --cwd apps/ts-release-action build
bun run check:action-bundle
```

The bundle freshness check rebuilds to a temporary path and compares bytes.
Plan and run artifacts are uploaded by the workflow, not by hidden Action
behavior. Publication requires a confirmed observed publish challenge and a
protected workflow environment.
