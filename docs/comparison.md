# Choosing a release workflow

ts-release is an application-composition library and CLI. Use it when releases
need exact artifact ownership, explicit provider wiring and durable recovery of
uncertain dispatches. The application owns preparation, credentials and storage.

The CLI runs `ts-release [--observe] <application.mjs> <input.json>`. It does not
provide a configuration-only build wizard. For setup and operator guidance, see
[preparation](preparation.md) and [recovery](recovery.md).
