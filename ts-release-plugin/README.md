# ts-release agent plugin

One shared `release` skill that teaches an agent host how to drive
[ts-release](https://github.com/mannyc2/ts-release): configure, plan, review,
diagnose, materialize, and resume staged releases. The same skill tree ships
with native manifests for both OpenAI/Codex (`.codex-plugin/plugin.json`) and
Claude Code (`.claude-plugin/plugin.json`).

## Install from the repository marketplace

OpenAI/Codex:

```sh
codex plugin marketplace add mannyc2/ts-release
codex plugin add ts-release@mannyc2-ts-release
```

Claude Code:

```sh
claude plugin marketplace add mannyc2/ts-release
claude plugin install ts-release@mannyc2-ts-release
```

Claude Code namespaces the skill as `/ts-release:release`.

Each tagged release also publishes `ts-release-plugin-<version>.zip` (with a
checksum entry) as a GitHub release asset; the ZIP contains this directory as
its single top-level folder.

## Version contract

The plugin version always equals the ts-release package version. Both native
manifests, both repository marketplace entries, and the self-release
configuration are checked for agreement by `bun run check:skill-plugin`; a
version bump that misses one of them fails the repository gates. On `0.x`,
treat every minor release as potentially breaking.

## What the skill does

- Recons the target repository before proposing configuration.
- Maps distribution goals onto supported ts-release configuration only —
  npm, GitHub Releases, Homebrew, Scoop, PyPI, files-only archives, generic
  catalogs — and refuses to invent keys or surfaces.
- Plans first, persists the canonical plan bytes and `PlanId`, and explains
  stages, risks, and review boundaries.
- Diagnoses with the read-only `doctor` path; credentials appear only as
  environment-variable names.
- Materializes only after the user confirms ts-release's execution review,
  and stops at the publish review challenge.
- Resumes interrupted runs from the ledger and reconciles unknown remote
  outcomes without blind retries.

## What the skill does not do

- It never publishes on its own authority. Publication always flows through
  ts-release's execution and publish review gates, confirmed by the user.
- It never stores or prints secret values.
- It does not bundle MCP servers, hooks, agents, or executable helpers —
  this package is instructions and reference data only.
- It does not submit this plugin (or anything else) to any public
  marketplace; that remains a manual operator action.

## Layout

```text
.codex-plugin/plugin.json    OpenAI/Codex-native manifest
.claude-plugin/plugin.json   Claude Code-native manifest
skills/release/SKILL.md      the one shared skill
skills/release/references/   five self-contained reference documents
evals/cases.json             eight behavioral evaluation cases
LICENSE                      MIT (self-contained copy)
```

All references are self-contained: an installed/cached copy of this
directory works without network access and never reads outside its root.
