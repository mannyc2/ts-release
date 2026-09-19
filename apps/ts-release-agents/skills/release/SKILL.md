---
name: "release"
description: "Author and run an explicit ts-release application against one durable journal."
---

# ts-release release skill

Use the installed package and repository evidence as the authority. Read the
workspace package manifests and selected application module before suggesting
edits.

## Release boundary

- The application exports `createApplication(input)` as a scoped Effect.
- It owns the exact Bundle, immutable Plan, one Journal, providers, transports,
  credential acquisition, clock and authorization decision.
- The CLI invocation is `ts-release <application.mjs> <input.json>`.
- The Action accepts the same `application` and JSON `input`, then reports the
  exact plan ID and global journal revision.
- Reports are derived views. Only a fresh conditional journal append can grant
  one invocation permission to send.

Treat publish operations as data until execution is explicitly approved. Never
invent a second workflow authority, generic rollback, provider hook, package
discovery system or host review protocol.

## Safety

Keep Action paths inside the workspace. Credentials are acquired at the exact
host boundary and never placed in Bundle, Plan, Journal, report, configuration
or prompts. Treat conflicts and inconclusive observations as stopped work; do
not retry an unknown remote mutation blindly. Preserve the exact Bundle, Plan,
journal coordinate and typed error when handing work to a human.

## CLI

```sh
ts-release ./release-application.mjs ./release-input.json
```

A release host may add review or environment protection outside the engine;
do not place that policy into immutable release data or claim that a validated
OpenAI handoff means portal submission or publication occurred.
