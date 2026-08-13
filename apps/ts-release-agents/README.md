# ts-release agent distribution

This app is the single tracked source owner for the release skill, references,
eval cases, and provider manifest inputs. `src/build.ts` deterministically
projects provider-native Codex and Claude packages under `.release/agents/`.

The generated packages are ordinary prepared artifacts. They contain no
credentials, executable helpers, hooks, or network instructions. The source
skill teaches the automatic `ts-release` lifecycle: inspect, prepare, publish,
release, and provider-specific correction.

The check rebuilds the archives byte-for-byte, then installs archive-only
outputs into disposable Codex and Claude cache layouts. It validates the
installed native manifests and skill, runs strict Claude validation, and
requires `apps/ts-release-agents/` to remain the sole tracked skill owner. No
live provider home, marketplace, or network boundary is touched.

```sh
bun run build:agents
bun run check:agents
```
