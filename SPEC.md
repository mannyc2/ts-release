# Release contract

The public API is the declared package entrypoints and their TypeScript
declarations. Root operations include `createOperation`, `createPlan`, `loadPlan`,
`reportRelease`, `observeRelease`, `runRelease`, `acceptRisk` and `supersedePlan`.
The `bundle` subpath owns content identity, finalization and loading; runtime
subpaths install storage and transport boundaries.

Before sending, the runner validates the Bundle/Plan binding, journal history,
provider definitions, request correspondence and explicit authorization. A
dispatch is journaled before transport. An unresolved dispatch remains remembered
across fresh runners. Observation of absence is insufficient permission to resend.

`ts-release [--observe] <application.mjs> <input.json>` invokes the application's
scoped factory. The default runs under its authorization policy; `--observe`
invokes `observeRelease` and never dispatches publication. Both emit the complete
derived JSON report. The Action accepts `application`, `input` and `observe` and
reports `plan-id` and `journal-revision`.

See [preparation](docs/preparation.md) and [recovery](docs/recovery.md) for operator
instructions. Provider, journal, Apple and installed-entrypoint behavioral tests
exercise these contracts; a generated symbol inventory is not the contract.
