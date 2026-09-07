# ts-release

Owned Bundle → immutable Plan → one Journal → derived Report.

This checkout is implementing the 0.4 hard cut. W01 provides the release kernel,
owned Bundle/content, HTTP receipt contracts, and scoped local SQLite storage.
The root, bundle, http, node, and bun entries have implemented subsets of the
planned public API. Remaining symbols, provider packages and native outcomes
are tracked in `docs/refactor/execution/GOAL.md`; this is not a release candidate.

The shared CLI runs `ts-release <application.mjs> <input.json>`. The explicit,
trusted application exports `createApplication(input)`, returning a scoped Effect
with the Bundle, host and run options. The application selects its providers,
layers and dispatch authorization. The CLI emits the complete derived JSON report.
Exit codes are 0 for all operations Satisfied, 2 for an unresolved report, 1 for
invalid usage or failure, and 130/143 for SIGINT/SIGTERM. Signals interrupt the
application and await its scope cleanup. Always consult the journal before
resuming an interrupted release; a process exit cannot prove non-commit.
Effect's default logs go to stderr. On a signal, pending stdout/stderr writes are
cancelled and output may be partial; use the exit code and durable journal.
