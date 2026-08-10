# Release-automation comparison

This is a tradeoff comparison between release automation products, not a
language comparison. ts-release has not executed GoReleaser; the GoReleaser
rows below are `external-docs-derived` from the official documentation listed
in the source column and accessed on 2026-08-09. The documentation's current
stable revision is GoReleaser `v2.17.1`.

| Question | ts-release | GoReleaser evidence | Evidence class |
| --- | --- | --- | --- |
| Automatic default | `ts-release release` prepares and publishes automatically | `goreleaser release` is documented as the one-command build/archive/publish path | external-docs-derived |
| Optional separation | `prepare` creates exact bytes; `publish` consumes only those bytes | `goreleaser build`, `--skip=publish`, and Pro split/merge provide separate execution modes | external-docs-derived |
| Build ecosystem | Bun builds for retained Linux/macOS hosts and Windows artifact targets | Official docs list Go, Rust, Zig, TypeScript with Bun/Deno, and Python | external-docs-derived |
| Packaging ecosystem | Deterministic archives/checksums plus the retained npm/GitHub/catalog slice | Official docs list a broader package, signer, container, and destination ecosystem | external-docs-derived |
| Recovery distinction | Each adapter observes exact subjects before and after mutation; conflicts stop | This comparison makes no recovery claim about GoReleaser because this repository did not execute it | contract-tested / source-derived |
| Operational tradeoff | Narrower surface, explicit prepared boundary, typed provider correction | Broader mature ecosystem and GoReleaser Pro distributed preparation | external-docs-derived |

Primary sources:

- [GoReleaser introduction](https://goreleaser.com/getting-started/intro/) —
  one-command automation, supported language/tool families, accessed
  2026-08-09; documentation revision current at `v2.17.1`.
- [GoReleaser quick start](https://goreleaser.com/getting-started/quick-start/) —
  release, build-only, snapshot, and skip-publish flows, accessed 2026-08-09;
  documentation revision current at `v2.17.1`.
- [GoReleaser split and merge](https://goreleaser.com/customization/general/partial/)
  — Pro distributed preparation and merge, accessed 2026-08-09; documentation
  revision current at `v2.17.1`.

No size comparison is quoted here: Bun and Go binary size depends on the exact
entrypoint, runtime, toolchain, and compression. A future reproducible fixture
may add a dated measurement without turning it into a product constant.
