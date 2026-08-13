# Release-automation comparison

This is a tradeoff comparison between release automation products, not a
language comparison. ts-release has not executed GoReleaser; the GoReleaser
rows below are `external-docs-derived` from the official documentation listed
in the source column and accessed on 2026-08-09. They are not evidence about
GoReleaser behavior beyond those cited pages.

| Question | ts-release | GoReleaser evidence | Evidence class |
| --- | --- | --- | --- |
| Automatic default | `ts-release release` prepares and publishes automatically; one-command release is the usability floor | `goreleaser release` is documented as the one-command build/archive/publish path | external-docs-derived |
| Optional separation | `prepare` creates exact bytes; `publish` consumes only those bytes | `goreleaser build`, `--skip=publish`, and Pro split/merge provide separate execution modes | external-docs-derived |
| Build ecosystem | Bun compilation, prebuilt artifacts, declared commands, archives, and checksums; host and target claims remain separate | Official docs list Go, Rust, Zig, TypeScript with Bun/Deno, and Python | external-docs-derived |
| Packaging ecosystem | The kernel installs npm, prebuilt wheel/sdist PyPI publication, GitHub Releases, and typed Homebrew/Scoop catalog Git delivery | Official docs list a broader package, signer, container, and destination ecosystem | external-docs-derived |
| Recovery distinction | Safe partial-effect recovery is the intended differentiator: each adapter observes exact subjects before and after mutation, and conflict or uncertainty stops | This comparison makes no recovery claim about GoReleaser because this repository did not execute it | contract-tested / source-derived |
| Operational tradeoff | Narrower surface, explicit prepared boundary, typed provider correction | Broader mature ecosystem and GoReleaser Pro distributed preparation | external-docs-derived |

Primary sources:

- [GoReleaser introduction](https://goreleaser.com/getting-started/intro/) —
  one-command automation and supported language/tool families, accessed
  2026-08-09.
- [GoReleaser quick start](https://goreleaser.com/getting-started/quick-start/) —
  release, build-only, snapshot, and skip-publish flows, accessed 2026-08-09.
- [GoReleaser split and merge](https://goreleaser.com/customization/general/partial/)
  — Pro distributed preparation and merge, accessed 2026-08-09.

A provisional local measurement on 2026-08-12 compiled the current
`apps/release-ts/src/cli/node-main.ts` entrypoint with Bun 1.3.14 for
`bun-linux-x64`: the unstripped ELF was 95,766,656 bytes, and the local build
reported 0.30 seconds elapsed with 386,560 KiB maximum RSS. This is cost
context, not a GoReleaser comparison or candidate certificate. The clean
result commit must repeat the measurement and record compressed and
per-target sizes before release.
