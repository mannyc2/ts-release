# GoReleaser material evidence groups G10-G21

Status: continuation of [goreleaser-material-evidence.md](./goreleaser-material-evidence.md). It is part of the same research document and has the same guardrails.

## G10 - npm wrapper packages

Cases:

```text
C071
P005
```

Current GoReleaser evidence:

- GoReleaser generates a wrapper package whose postinstall downloads an SCM release archive: [`npm.md`](https://github.com/goreleaser/goreleaser/blob/92453c1dbdf592d227cb236600093a503f2351f3/www/content/customization/publish/npm.md)

Grade: `DOC + SOURCE`.

Rewrite disposition:

- native npm tarball publication is a fixed ts-release shipping outcome;
- wrapper-package generation is a different build/distribution outcome;
- no parity claim equates them.

## G11 - Winget and other catalogs

Cases:

```text
C072-C076
C078
```

Current GoReleaser evidence:

- Winget generation, validation, Git publication/PR, catalog acceptance, visibility, and installation are separate stages.
- current source recently fixed per-architecture manifest validation: [`internal/pipe/winget/winget.go`](https://github.com/goreleaser/goreleaser/blob/92453c1dbdf592d227cb236600093a503f2351f3/internal/pipe/winget/winget.go)

Grade: `DOC + SOURCE` for Winget; other catalogs vary.

Rewrite disposition:

- outside fixed first-party shipping scope except arbitrary custom-provider support;
- later built-ins must preserve their separate provider and consumer outcomes.

## G12 - Scoop

Cases:

```text
C077
```

Current GoReleaser evidence:

- Scoop publication is a catalog/manifest plus Git repository operation.
- Scoop client source pin: [`b588a06e41d920d2123ec70aee682bae14935939`](https://github.com/ScoopInstaller/Scoop/tree/b588a06e41d920d2123ec70aee682bae14935939)

Grade: `DOC + SOURCE`; current ts-release/v0.0.7 have source/released evidence for catalog publication.

Fixed rewrite disposition:

- Scoop is a shipping built-in;
- manifest rendering, conditional bucket Git update, public metadata, URL/hash identity, and clean Windows installation remain separate outcomes.

## G13 - Changelog and release notes

Cases:

```text
C080
P007 P023 P026
```

Current GoReleaser evidence:

- changelog generation and preview are documented features.

Grade: `DOC`.

Rewrite disposition:

- ts-release may carry exact finalized release text;
- generation/AI policy is adjacent composition;
- release notes do not enter the external mutation kernel unless a provider Intent publishes them.

## G14 - Arbitrary custom publishers

Cases:

```text
C083
```

Current GoReleaser evidence:

- custom publisher commands execute per selected artifact with controlled environment and templating: [`publishers.md`](https://github.com/goreleaser/goreleaser/blob/92453c1dbdf592d227cb236600093a503f2351f3/www/content/customization/publish/publishers.md)

Grade: `DOC + SOURCE`.

Fixed rewrite disposition:

- arbitrary TypeScript provider packages are a shipping capability;
- the custom provider supplies versioned Intent decoding and whatever dispatch/observation/replay capabilities it honestly has;
- a command hook is not the only extension surface.

## G15 - Project-management actions

Cases:

```text
C084
P019
```

Current GoReleaser evidence: case index and documentation only.

Grade: `INDEX/DOC`.

Rewrite disposition: intentionally outside the durable release kernel.

## G16 - Homebrew formulas

Cases:

```text
C085
```

Current GoReleaser evidence:

- formula generation/publication documentation: [`homebrew_formulas.md`](https://github.com/goreleaser/goreleaser/blob/92453c1dbdf592d227cb236600093a503f2351f3/www/content/customization/publish/homebrew_formulas.md)
- Homebrew formula law: [`Formula-Cookbook.md`](https://github.com/Homebrew/brew/blob/78dc68a15f167a973207437a4454381641a2f82f/docs/Formula-Cookbook.md)

Grade: `DOC + SOURCE`; v0.0.7 has released Git catalog evidence.

Fixed rewrite disposition:

- formulas are a shipping built-in;
- renderer correctness, conditional tap Git publication, public ref/path observation, archive checksum identity, and `brew install`/smoke are separate outcomes.

## G17 - Verify

Cases:

```text
C086
P001
```

Current GoReleaser evidence:

- Verify is Pro and opt-in.
- It re-downloads published SCM release assets into `dist/verify`.
- It runs directory, asset, or image commands.
- It is intended to catch broken/truncated uploads, bad signatures, and CDN propagation.
- It does not currently download artifacts sent only to blob storage or package registries.
- It does not by itself prove native npm/PyPI installation.

Primary source:

- [`verify.md`](https://github.com/goreleaser/goreleaser/blob/92453c1dbdf592d227cb236600093a503f2351f3/www/content/customization/verify.md)

Grade: `DOC`; do not infer OSS implementation from Pro-only documentation.

Rewrite disposition:

- preserve its actual user outcome as explicit public-byte and command evidence where desired;
- do not create one universal `verify` API;
- provider acceptance, metadata, bytes, signatures, CDN delivery, and clean package-manager consumption remain distinct.

## G18 - Announcements

Cases:

```text
C087-C101
```

Current GoReleaser evidence: many documented announcement integrations.

Grade: `DOC`.

Rewrite disposition: intentionally outside the durable publication kernel; compose after required release outcomes.

## G19 - CI hosts

Cases:

```text
C102-C115
```

Current GoReleaser evidence: current CI guides and examples.

Grade: `DOC`.

Rewrite disposition:

- CI hosts are execution/evidence environments;
- they are not provider publication outcomes;
- fresh-runner continuation must not depend on one host's process memory.

## G20 - Pro-only mechanisms and licensing

Cases:

```text
P002-P036 not already assigned above
```

The roadmap crosswalk assigns each case to its material group. Offline/fallback license transport (`P035-P036`) is intentionally outside ts-release.

Grade: varies between `INDEX`, `DOC`, and `PROJECT_DECISION`.


## G21 - Durable staged continuation

Cases:

```text
P025
```

GoReleaser evidence:

- staged/continue behavior is a product mechanism over prior run state.

Grade: `DOC` for GoReleaser mechanism; ts-release rewrite disposition is `PROJECT_DECISION`.

Rewrite disposition:

- finalized bundle, canonical plan, and event history are structural shipping behavior;
- the natural command should continue per Intent without requiring the user to select a manual stage;
- this is not evidence that GoReleaser or any workflow engine provides external exactly-once mutation.

## Native outcomes absent from GoReleaser

## N01 - Native npm publication

GoReleaser wrapper packages are not equivalent. ts-release shipping scope includes native npm publication based on npm CLI/provider evidence.

Evidence lives in [provider-contracts.md](./provider-contracts.md).

## N02 - Native Warehouse/PyPI publication

GoReleaser Python builders produce distributions and document hook-based publication. They do not provide a native per-file Warehouse publisher.

Evidence lives in [provider-contracts.md](./provider-contracts.md).

## Outcome/evidence separation

Every maintained feature records these independently:

```text
A - provider acceptance
M - public or authoritative metadata
B - intended byte identity
C - clean consumer behavior
J - continuation/recovery
```

And one environment grade:

```text
compile
in-process
clean-consumer
protocol-double
scratch-provider
public-provider
end-user
self-release
```

Example:

```text
GitHub asset upload:
  A/SOURCE does not imply A/SCRATCH_PROVIDER
  B/provider receipt does not imply C/end-user execution
  J/protocol-double does not imply J/public-provider
```

## Project decisions inherited by the roadmap

- Shipping providers: npm, Warehouse/PyPI, GitHub Releases/assets, Homebrew formulas, Scoop, arbitrary custom providers.
- Homebrew casks are not in the fixed shipping set.
- Native npm and native PyPI are not substituted by GoReleaser wrapper/build features.
- Announcements and commercial license transport are outside the durable release kernel.
- The decisive integrated gate is non-manual ts-release self-release with external and consumer evidence.

## Remaining evidence gaps

1. Most `INDEX` census rows have not been individually source-audited; they inherit only their group disposition.
2. No new live provider mutation was run in this research pass.
3. Protocol-double behavior for ts-release does not establish real provider policy or propagation.
4. Homebrew and Scoop clean consumer evidence remains future acceptance work.
5. GoReleaser Pro Verify is documented, but OSS source is not evidence for its implementation.
6. Current GoReleaser source pin can change after this checkpoint; all claims remain pinned.
