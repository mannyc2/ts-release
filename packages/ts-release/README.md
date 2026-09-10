# ts-release

Run an authored release application with immutable Bundle and Plan inputs and a
durable journal:

```sh
ts-release ./release.mjs ./release-input.json > release-report.json
ts-release --observe ./release.mjs ./release-input.json > release-report.json
```

The trusted module exports `createApplication(input)`, a scoped Effect returning
`{ bundle, host, options }`. The application supplies providers, credentials,
storage and explicit `options.authorize`. The CLI's observe mode records fresh
provider evidence without dispatching publication; application setup still runs.

Rerun the original invocation to continue with the same Bundle, Plan, content and
journal. Fresh runners must retain unresolved dispatch history. Destination
absence alone never authorizes resend. Reports are derived views, not authority.

JSON goes to stdout, diagnostics to stderr. Exit codes: 0 satisfied, 2 incomplete,
1 usage/application failure, 130/143 interruption. Interrupted output may be
partial; inspect the durable journal before continuing.

The root exports planning, provider and recovery APIs. Use `bundle`, `http`, `git`,
`node`, `bun`, `effect-build` and `apple` subpaths for their respective capabilities.
See the [application guide](https://github.com/mannyc2/ts-release/blob/main/docs/preparation.md)
and [recovery guide](https://github.com/mannyc2/ts-release/blob/main/docs/recovery.md).
