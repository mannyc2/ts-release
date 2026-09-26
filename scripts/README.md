# Maintained checks

Use the pinned Bun for installation, builds and tests, plus a supported Node
executable on PATH or selected by `TS_RELEASE_ACCEPTANCE_NODE`. npm is an external
installer under test. Each profile below qualifies its listed stages; none is
the complete native, hosted and release qualification matrix.

| Profile | Existing command and stages | Prerequisites and evidence |
| --- | --- | --- |
| Static | `bun run check`: compiler-patch guard, formatting, build, strict lint, root/portable/Node types, imports and package entries. | Frozen installation with lifecycle scripts. Raw command exit and diagnostics. |
| Behavior | `bun run test`: the maintained Bun suite, selecting Node for native workers. | Relevant local Git, Python and catalog fixtures. Select a file with `bun test <path>` when a focused proof suffices. |
| Portable runtime | `bun run check:portable-runtime`: provenance runtime, behavior, packed core, packed catalog/transports, packed Action and installed workflow, in that order. | Supported Node, Python/catalog fixtures and package-install access. Receipts in `.release/checks` plus printed temporary directories. This excludes retained distribution and the separate producer/Sigstore profiles below. |
| Static plus portable runtime | `bun run check:portable`. | Both profiles above, without a second static pass. A stopped aggregate is incomplete even if later stages are run separately. |
| Retained distribution | `bun run release:prepare <new-directory>`, then `bun scripts/check-distribution.ts <directory>`; CI also selects `--hosted`. | Clean committed source and retained exact seven-package candidate. Installs those archives and exercises production application/Action recovery against local TLS peers. Candidate identities and the script's acceptance records bind the proof. |
| Native Sigstore | `bun run check:native-npm-sigstore`. | Supported Node selected by `TS_RELEASE_NATIVE_NODE`, authentic retained attestation and production TUF metadata access. `.release/checks/native-sigstore.json`; read-only verification, without signing or publication. |
| Producer and Apple adapter integration | `bun run check:effect-build-integration`: existing artifact tests, packed artifacts, then packed Apple adapter/recovery. | Retained producer archives and native tools from `setup:native-producers`, explicit absolute Node and `TS_RELEASE_ALPINE_DEPENDENCIES`. The standalone Apple check consumes `TS_RELEASE_PACKED_ARTIFACT_WORK`. Printed evidence directories identify archives and commands. This does not certify native macOS/Windows or live notarization. |
| External provider | `bun run check:packed-external`. | Supported Node and clean package installs; builds a separately packaged fixture provider and consumes actual core archives. Evidence is retained in its printed temporary directory. |

The individual packed provider commands remain available for changes affecting
one boundary. Their script records the selected providers and prerequisites;
passing one selection does not qualify all others. Avoid repeating successful
checks unless their inputs changed or a remaining concern justifies it.

`build:delivery` builds packages and the checked-in Node Action launcher.
It also generates the npm/GitHub starter from the production release application.
`release:prepare <new-directory>` retains the complete seven-package cohort from
a clean committed candidate. `release:check <directory>` verifies its identities;
`bun scripts/check-distribution.ts <directory>` installs those exact archives and
exercises nonempty publication through the production application and Action,
including process interruption and fresh-cache recovery against local TLS peers.
`check:provenance-runtime` verifies native trust-root signatures under Node without
networking; it is narrower than the native Sigstore profile. See the
[release runbook](../docs/release-runbook.md) for separately authorized publication.
Research ancestry, migration, source-budget and API-projection gates were retired;
see `docs/design-decisions.md` for the retained recovery decision.

For the existing Linux portable profile, install its native fixtures first:

```sh
bun run setup:native-python
bun run setup:native-catalog
bun run check:portable
```

The catalog fixture installer currently targets Linux x64. `bun run test` resolves
Node on PATH (or TS_RELEASE_ACCEPTANCE_NODE) and passes its absolute path to the
tests that run fixtures under both runtimes. Use a supported Node version. `check:installed-workflow`
exercises real Git publication through both installed entrypoints, including a
response lost at process interruption and continuation with an empty local cache.

CI currently runs static checks on Linux and macOS with Node 24.15.0 and Bun
1.3.14. Linux then runs the portable runtime and retained distribution stages;
macOS runs packed core imports/declarations. A local Linux/Node 22 run does not
establish those other host results. Review the workflow when changing this matrix.

Record the commit and any retained dirty patch/hash, exact commands, selected
runtimes/platform, raw exits and receipt paths with the change. A failed or
unrun stage remains explicit; cached output cannot establish a remote action.
Build, pack and native commands sharing outputs must run sequentially. Preparation
and local acceptance do not authorize publication of the reviewed candidate.
