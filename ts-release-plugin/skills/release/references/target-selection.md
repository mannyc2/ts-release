# Target selection

Map the user's distribution goal to existing configuration sections. Never
invent a key; if the goal is not in this table, it belongs in the non-goals
list or in a feature request to the maintainers.

## Supported targets

| Goal | Configuration | Notes |
|---|---|---|
| npm package | `publish.npm` (+ optional `npmPackage`) | token by env name or trusted publishing; optional provenance |
| GitHub Release + assets | `publish.github` | assets selected from built/imported/archived outputs; checksum file included |
| Homebrew formula | `publish.homebrew` | product-owned immutable preset; tap repo push or pull request |
| Scoop manifest | `publish.scoop` | product-owned immutable preset; bucket repo push or pull request |
| PyPI wheels | `pypiWheel` + `publish.pypi` | wheel assembly profile plus registry release, trusted publishing supported |
| Bun-compiled per-target executables | `builds[]` with `builder: "bun"` | targets like `linux-x64`, `darwin-arm64`, `windows-x64` |
| Platform-neutral plugin/skill ZIP | `archives[]` with `files` patterns | no build step; deterministic recursive file packaging (see `configuration.md`) |
| Checksums | `checksum` | one digest file over release artifacts |
| Generic catalog file in another repo | `catalogs[]` | whole-file render with `sha256`/`downloadUrl`/`assetName` facts; reviewed push or PR |
| Package stores (snap/chocolatey) | `publish.packageStores` | closed immutable profiles |
| Named providers (GitLab/Gitea releases, S3/GCS/Azure puts, Artifactory, …) | `publish.providers` | closed provider profile ids only |
| Announcements (Slack, Discord, SMTP, …) | `publish.announce` | closed announcement profile ids; credential by env name |
| Changelog | `publish.changelog` | deterministic local mode or reviewed-transform mode |

## Non-goals — do not promise these

- No third-party skill registries (Skills.sh, Smithery, `npx skills`, or
  similar). GitHub hosts the source and release assets; public marketplace
  submission is a manual operator action.
- No automatic submission to the OpenAI Plugins Directory or Anthropic's
  community marketplace; ts-release only builds and verifies the artifacts.
- No marketplace JSON read-modify-write: catalogs render whole files from
  planned data, never merge remote mutable state.
- No MCP servers, hooks, agents, or executable helpers inside plugin
  archives packaged by ts-release configuration in this workflow.
- No container image build pipeline, no code signing service, no rollback or
  transactional guarantee for remote systems.
- No runtime registration of custom providers, renderers, or profiles;
  provider/preset vocabularies are closed per installed version.
- No dynamic un-reviewed commands: custom publish hooks are conspicuous,
  reviewed, manual-reconciliation operations.

When the user asks for an unsupported surface, say it is out of scope for
the installed version instead of approximating it with invented keys.
