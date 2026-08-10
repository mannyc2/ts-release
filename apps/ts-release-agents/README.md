# ts-release agent distribution

This app is the single tracked source owner for the release skill, references,
eval cases, and provider manifest inputs. `src/build.ts` deterministically
projects provider-native Codex and Claude packages under `.release/agents/`.

The generated packages are ordinary prepared artifacts. They contain no
credentials, executable helpers, hooks, or network instructions. The source
skill teaches the automatic `ts-release` lifecycle: inspect, prepare, publish,
release, and provider-specific correction.

```sh
bun run build:agents
bun run check:agents
```
