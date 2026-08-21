# Preserved 151-case GoReleaser evidence and disposition census

Status: exact reconciliation of the historical 151-case index. It is complete
for that pinned denominator and is not advertised as an exhaustive list of
current GoReleaser. Current post-index additions are recorded in the sole scope
authority, `launch-scorecard.md`.

## Pins and evidence grades

- Historical 151-case index and then-current ts-release:
  [`1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3`](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md).
- GoReleaser source used by the material refresh:
  [`92453c1dbdf592d227cb236600093a503f2351f3`](https://github.com/goreleaser/goreleaser/tree/92453c1dbdf592d227cb236600093a503f2351f3).
- Earlier preserved GoReleaser snapshot:
  [`cab7c6ef5d4ffc2429828f031ff7bb4645de7dad`](https://github.com/goreleaser/goreleaser/tree/cab7c6ef5d4ffc2429828f031ff7bb4645de7dad).
- ts-release v0.0.7:
  [`af59436cff908fb52773cf18dd95d154f892b8de`](https://github.com/mannyc2/ts-release/tree/af59436cff908fb52773cf18dd95d154f892b8de).
- Current GoReleaser audit pin (outside the 151 denominator):
  [`97002309efe9b11cee15426c940a42c44a9f55b2`](https://github.com/goreleaser/goreleaser/tree/97002309efe9b11cee15426c940a42c44a9f55b2).

Evidence columns preserve the recovered research rather than upgrading weak
claims by disposition:

- `I`: pinned index row only; no stronger implementation or consumer proof.
- `S-*`: pinned source evidence for the named outcome.
- `D-*`: official documentation evidence.
- `P-*`: Pro documentation only; not OSS implementation evidence.
- `X-*`: superficially related but materially different outcome.
- `A-*`: no implementation identified in the pinned review.

The target column is an exact pair `kind:id`. Allowed kinds are `vnext`,
`decision`, `deferred`, `later`, `adjacent`, `mechanism`, and
`excluded`. Every ID resolves to an outcome or explicit disposition in
`launch-scorecard.md`; no unresolved sentinel, many-to-many target, or prose-only final
disposition remains.

## Complete case ledger

| Case | Capability | GoReleaser evidence | Current ts-release | v0.0.7 | Exact target | Reason | Original index pin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C001 | Introduction / schema and root config | I | I | I | mechanism:M01 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L1](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L1) |
| C002 | General configuration index | I | I | I | mechanism:M01 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L2](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L2) |
| C003 | Project name | I | I | I | mechanism:M01 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L3](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L3) |
| C004 | Global metadata | I | I | I | mechanism:M02 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L4](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L4) |
| C005 | Dist folder | I | I | I | mechanism:M02 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L5](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L5) |
| C006 | Artifact manifest | I | I | I | vnext:K01 | Atomic vNext outcome; the source case is evidence for this leaf only. | [L6](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L6) |
| C007 | Includes | I | I | I | mechanism:M04 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L7](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L7) |
| C008 | Templates and variables | I | I | I | mechanism:M04 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L8](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L8) |
| C009 | Template files | I | I | I | mechanism:M04 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L9](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L9) |
| C010 | Environment variables | I | I | I | mechanism:M04 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L10](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L10) |
| C011 | Global hooks | I | I | I | mechanism:M05 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L11](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L11) |
| C012 | Git tag discovery and sorting | I | I | I | decision:Q06-01 | Genuine maintainer choice preserved; not selected launch scope. | [L12](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L12) |
| C013 | Split and merge | I | I | I | mechanism:M06 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L13](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L13) |
| C014 | Retries | I | I | I | mechanism:M06 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L14](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L14) |
| C015 | Build phase | I | I | I | mechanism:M03 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L15](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L15) |
| C016 | Builder selection | I | I | I | mechanism:M03 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L16](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L16) |
| C017 | Go builder | I | I | I | adjacent:ADJ05 | Ordinary composition or host integration, not a release-kernel capability. | [L17](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L17) |
| C018 | Bun builder | I | I | I | vnext:P01-02 | Atomic vNext outcome; the source case is evidence for this leaf only. | [L18](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L18) |
| C019 | Node SEA builder | I | I | I | vnext:P01-04 | Atomic vNext outcome; the source case is evidence for this leaf only. | [L19](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L19) |
| C020 | Rust builder | I | I | I | adjacent:ADJ05 | Ordinary composition or host integration, not a release-kernel capability. | [L20](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L20) |
| C021 | Zig builder | I | I | I | adjacent:ADJ05 | Ordinary composition or host integration, not a release-kernel capability. | [L21](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L21) |
| C022 | Deno builder | I | I | I | vnext:P01-03 | Atomic vNext outcome; the source case is evidence for this leaf only. | [L22](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L22) |
| C023 | Python builder overview | I | I | I | mechanism:M03 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L23](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L23) |
| C024 | UV Python builder | D-BUILD | S-IMPORT | I | vnext:P04-01 | Atomic vNext outcome; the source case is evidence for this leaf only. | [L24](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L24) |
| C025 | Poetry Python builder | D-BUILD | S-IMPORT | I | vnext:P04-01 | Poetry is evidence for the poetry-core backend fixture behind the single uv build frontend, not a second builder abstraction. | [L25](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L25) |
| C026 | Prebuilt binaries | I | I | I | vnext:P01-01 | Atomic vNext outcome; the source case is evidence for this leaf only. | [L26](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L26) |
| C027 | Build hooks | I | I | I | mechanism:M05 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L27](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L27) |
| C028 | Verifiable Go builds | I | I | I | later:L19 | Concrete later-model outcome preserved outside vNext. | [L28](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L28) |
| C029 | macOS universal binaries | I | I | I | decision:Q07 | Genuine maintainer choice preserved; not selected launch scope. | [L29](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L29) |
| C030 | UPX | I | I | I | later:L19 | Concrete later-model outcome preserved outside vNext. | [L30](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L30) |
| C031 | Monorepo support | P-SCOPE | A-MULTI | I | later:L20 | Concrete later-model outcome preserved outside vNext. | [L31](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L31) |
| C032 | Package and archive phase | I | I | I | mechanism:M03 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L32](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L32) |
| C033 | Archives | I | I | I | mechanism:M03 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L33](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L33) |
| C034 | Source archive | I | I | I | vnext:P03-01 | Maps to the selected tar.gz source outcome; the ZIP sibling is a separate scorecard leaf and is not inferred from this one case. | [L34](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L34) |
| C035 | nFPM system packages | I | I | I | mechanism:M03 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L35](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L35) |
| C036 | Makeself | I | I | I | later:L05 | Concrete later-model outcome preserved outside vNext. | [L36](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L36) |
| C037 | App bundles | I | I | I | vnext:P06-01 | Atomic vNext outcome; the source case is evidence for this leaf only. | [L37](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L37) |
| C038 | Source RPMs | I | I | I | later:L03 | Concrete later-model outcome preserved outside vNext. | [L38](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L38) |
| C039 | DMG | I | I | I | vnext:P07-01 | Atomic vNext outcome; the source case is evidence for this leaf only. | [L39](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L39) |
| C040 | macOS pkg | I | I | I | vnext:P08-01 | Atomic vNext outcome; the source case is evidence for this leaf only. | [L40](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L40) |
| C041 | MSI | I | I | I | decision:P05-07 | Genuine maintainer choice preserved; not selected launch scope. | [L41](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L41) |
| C042 | NSIS | I | I | I | later:L06 | Concrete later-model outcome preserved outside vNext. | [L42](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L42) |
| C043 | Snapcraft | I | I | I | later:L07 | Concrete later-model outcome preserved outside vNext. | [L43](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L43) |
| C044 | Flatpak | I | I | I | later:L08 | Concrete later-model outcome preserved outside vNext. | [L44](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L44) |
| C045 | Chocolatey packages | I | I | I | later:L09 | Concrete later-model outcome preserved outside vNext. | [L45](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L45) |
| C046 | Docker v2 | I | I | I | decision:Q03 | Genuine maintainer choice preserved; not selected launch scope. | [L46](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L46) |
| C047 | Ko | I | I | I | adjacent:ADJ05 | Ordinary composition or host integration, not a release-kernel capability. | [L47](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L47) |
| C048 | Checksums | I | I | I | vnext:Q01 | Atomic vNext outcome; the source case is evidence for this leaf only. | [L48](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L48) |
| C049 | Docker digests | I | I | I | decision:Q03 | Genuine maintainer choice preserved; not selected launch scope. | [L49](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L49) |
| C050 | Legacy Docker images | I | I | I | excluded:E03 | Intentional exclusion from the ts-release product model. | [L50](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L50) |
| C051 | Legacy Docker manifests | I | I | I | excluded:E03 | Intentional exclusion from the ts-release product model. | [L51](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L51) |
| C052 | SBOMs | S-SBOM | I | I | vnext:Q02-01 | Maps to the selected SPDX outcome as the primary census target; CycloneDX remains its own selected leaf. | [L52](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L52) |
| C053 | Artifact size reporting | I | I | I | vnext:K01 | Atomic vNext outcome; the source case is evidence for this leaf only. | [L53](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L53) |
| C054 | Binary signing | I | I | I | mechanism:M12 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L54](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L54) |
| C055 | Archive/package/checksum signing | I | I | I | decision:P09-05 | Genuine maintainer choice preserved; not selected launch scope. | [L55](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L55) |
| C056 | Docker manifest signing | I | I | I | decision:Q03 | Genuine maintainer choice preserved; not selected launch scope. | [L56](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L56) |
| C057 | Notarization | I | I | I | vnext:P10-01 | Broad notarization heading maps to submission as the primary atomic leaf; polling, stapling, and validation remain separate siblings. | [L57](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L57) |
| C058 | Publish phase | S-PUBLISH | I | I | mechanism:M03 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L58](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L58) |
| C059 | Before-publish hooks | I | I | I | mechanism:M05 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L59](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L59) |
| C060 | SCM releases | S-SCM | S-GH | S-GH | mechanism:M12 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L60](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L60) |
| C061 | GitHub releases | S-GH | S-GH | S-GH | vnext:D03-02 | Atomic vNext outcome; the source case is evidence for this leaf only. | [L61](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L61) |
| C062 | GitLab releases | I | I | I | deferred:X01 | Concrete provider package deferred; D06 permits it without a core allowlist. | [L62](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L62) |
| C063 | Gitea releases | I | I | I | deferred:X02 | Concrete provider package deferred; D06 permits it without a core allowlist. | [L63](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L63) |
| C064 | Snapshots | D-SNAPSHOT | S-SNAPSHOT | I | mechanism:M13 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L64](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L64) |
| C065 | Nightlies | I | I | I | decision:Q05-02 | Genuine maintainer choice preserved; not selected launch scope. | [L65](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L65) |
| C066 | Blob storage | S-BLOB | I | I | later:L15 | Concrete later-model outcome preserved outside vNext. | [L66](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L66) |
| C067 | Cloudsmith | I | I | I | deferred:X03 | Concrete provider package deferred; D06 permits it without a core allowlist. | [L67](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L67) |
| C068 | GemFury | I | I | I | deferred:X04 | Concrete provider package deferred; D06 permits it without a core allowlist. | [L68](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L68) |
| C069 | DockerHub descriptions | I | I | I | later:L16 | Concrete later-model outcome preserved outside vNext. | [L69](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L69) |
| C070 | Homebrew casks | D-CASK | S-GH-GIT | S-GIT | later:L01 | Concrete later-model outcome preserved outside vNext. | [L70](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L70) |
| C071 | NPM wrapper packages | P-WRAP | X-NATIVE | X-NATIVE | later:L04 | Concrete later-model outcome preserved outside vNext. | [L71](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L71) |
| C072 | Winget | D-WINGET | A-WINGET | I | later:L02 | Concrete later-model outcome preserved outside vNext. | [L72](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L72) |
| C073 | AUR | I | I | I | later:L10 | Concrete later-model outcome preserved outside vNext. | [L73](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L73) |
| C074 | AUR source packages | I | I | I | later:L11 | Concrete later-model outcome preserved outside vNext. | [L74](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L74) |
| C075 | NUR / Nix | I | I | I | later:L12 | Concrete later-model outcome preserved outside vNext. | [L75](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L75) |
| C076 | Krew | I | I | I | later:L13 | Concrete later-model outcome preserved outside vNext. | [L76](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L76) |
| C077 | Scoop | S-SCOOP | S-GH-GIT | S-GIT | vnext:D05-02 | Atomic vNext outcome; the source case is evidence for this leaf only. | [L77](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L77) |
| C078 | MCP Registry | I | I | I | vnext:D07-02 | Atomic vNext outcome; the source case is evidence for this leaf only. | [L78](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L78) |
| C079 | Attestations | D-ADJACENT | X-NPM-PROV | I | adjacent:ADJ03 | Ordinary composition or host integration, not a release-kernel capability. | [L79](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L79) |
| C080 | Changelog | I | I | I | decision:Q06-02 | Genuine maintainer choice preserved; not selected launch scope. | [L80](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L80) |
| C081 | HTTP upload | S-HTTP | I | I | vnext:D06-03 | Atomic vNext outcome; the source case is evidence for this leaf only. | [L81](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L81) |
| C082 | Artifactory | I | I | I | deferred:X05 | Concrete provider package deferred; D06 permits it without a core allowlist. | [L82](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L82) |
| C083 | Custom publishers | S-CMD | S-SDK | S-CMD | vnext:D06-01 | Atomic vNext outcome; the source case is evidence for this leaf only. | [L83](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L83) |
| C084 | Closing milestones | I | I | I | adjacent:ADJ04 | Ordinary composition or host integration, not a release-kernel capability. | [L84](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L84) |
| C085 | Homebrew formulas | S-BREW | S-GH-GIT | S-GIT | vnext:D04-02 | Historical/pinned Formula evidence; current GoReleaser deprecates formulas in favor of casks, but ts-release intentionally retains released Formula behavior. | [L85](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L85) |
| C086 | Verify | P-VERIFY | X-OBSERVE | X-PROVIDER-CHECK | mechanism:M08 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L86](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L86) |
| C087 | Announce phase | I | I | I | adjacent:ADJ01 | Ordinary composition or host integration, not a release-kernel capability. | [L87](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L87) |
| C088 | Bluesky announcement | I | I | I | adjacent:ADJ01 | Ordinary composition or host integration, not a release-kernel capability. | [L88](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L88) |
| C089 | Discord announcement | I | I | I | adjacent:ADJ01 | Ordinary composition or host integration, not a release-kernel capability. | [L89](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L89) |
| C090 | Discourse announcement | I | I | I | adjacent:ADJ01 | Ordinary composition or host integration, not a release-kernel capability. | [L90](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L90) |
| C091 | LinkedIn announcement | I | I | I | adjacent:ADJ01 | Ordinary composition or host integration, not a release-kernel capability. | [L91](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L91) |
| C092 | Mastodon announcement | I | I | I | adjacent:ADJ01 | Ordinary composition or host integration, not a release-kernel capability. | [L92](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L92) |
| C093 | Mattermost announcement | I | I | I | adjacent:ADJ01 | Ordinary composition or host integration, not a release-kernel capability. | [L93](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L93) |
| C094 | OpenCollective announcement | I | I | I | adjacent:ADJ01 | Ordinary composition or host integration, not a release-kernel capability. | [L94](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L94) |
| C095 | Reddit announcement | I | I | I | adjacent:ADJ01 | Ordinary composition or host integration, not a release-kernel capability. | [L95](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L95) |
| C096 | Slack announcement | I | I | I | adjacent:ADJ01 | Ordinary composition or host integration, not a release-kernel capability. | [L96](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L96) |
| C097 | SMTP announcement | I | I | I | adjacent:ADJ01 | Ordinary composition or host integration, not a release-kernel capability. | [L97](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L97) |
| C098 | Teams announcement | I | I | I | adjacent:ADJ01 | Ordinary composition or host integration, not a release-kernel capability. | [L98](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L98) |
| C099 | Telegram announcement | I | I | I | adjacent:ADJ01 | Ordinary composition or host integration, not a release-kernel capability. | [L99](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L99) |
| C100 | X / Twitter announcement | I | I | I | adjacent:ADJ01 | Ordinary composition or host integration, not a release-kernel capability. | [L100](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L100) |
| C101 | Webhook announcement | I | I | I | adjacent:ADJ01 | Ordinary composition or host integration, not a release-kernel capability. | [L101](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L101) |
| C102 | CI integration index | I | I | I | mechanism:M09 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L102](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L102) |
| C103 | GitHub Actions | I | I | I | vnext:K03 | Atomic vNext outcome; the source case is evidence for this leaf only. | [L103](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L103) |
| C104 | Azure Pipelines | I | I | I | adjacent:ADJ02 | Ordinary composition or host integration, not a release-kernel capability. | [L104](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L104) |
| C105 | CircleCI | I | I | I | adjacent:ADJ02 | Ordinary composition or host integration, not a release-kernel capability. | [L105](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L105) |
| C106 | Cirrus CI | I | I | I | adjacent:ADJ02 | Ordinary composition or host integration, not a release-kernel capability. | [L106](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L106) |
| C107 | Google Cloud Build | I | I | I | adjacent:ADJ02 | Ordinary composition or host integration, not a release-kernel capability. | [L107](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L107) |
| C108 | Codefresh | I | I | I | adjacent:ADJ02 | Ordinary composition or host integration, not a release-kernel capability. | [L108](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L108) |
| C109 | Drone | I | I | I | adjacent:ADJ02 | Ordinary composition or host integration, not a release-kernel capability. | [L109](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L109) |
| C110 | GitLab CI | I | I | I | adjacent:ADJ02 | Ordinary composition or host integration, not a release-kernel capability. | [L110](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L110) |
| C111 | Jenkins | I | I | I | adjacent:ADJ02 | Ordinary composition or host integration, not a release-kernel capability. | [L111](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L111) |
| C112 | RWX | I | I | I | adjacent:ADJ02 | Ordinary composition or host integration, not a release-kernel capability. | [L112](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L112) |
| C113 | Semaphore | I | I | I | adjacent:ADJ02 | Ordinary composition or host integration, not a release-kernel capability. | [L113](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L113) |
| C114 | Travis CI | I | I | I | adjacent:ADJ02 | Ordinary composition or host integration, not a release-kernel capability. | [L114](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L114) |
| C115 | Woodpecker | I | I | I | adjacent:ADJ02 | Ordinary composition or host integration, not a release-kernel capability. | [L115](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L115) |
| P001 | Verify published assets | P-VERIFY | X-OBSERVE | X-PROVIDER-CHECK | vnext:D03-03 | Public download/digest/execute is acceptance evidence on plural GitHub asset publication, not a universal Verify capability. | [L116](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L116) |
| P002 | macOS pkg | I | I | I | vnext:P08-01 | Atomic vNext outcome; the source case is evidence for this leaf only. | [L117](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L117) |
| P003 | NSIS | I | I | I | later:L06 | Concrete later-model outcome preserved outside vNext. | [L118](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L118) |
| P004 | Smart SemVer tag sorting | I | I | I | decision:Q06-01 | Genuine maintainer choice preserved; not selected launch scope. | [L119](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L119) |
| P005 | NPM registries / wrapper packages | P-WRAP | X-NATIVE | X-NATIVE | later:L04 | Concrete later-model outcome preserved outside vNext. | [L120](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L120) |
| P006 | Native Apple sign and notarize | I | I | I | mechanism:M12 | Broad Apple signing/notarization family heading; atomic P09/P10 leaves carry scope. | [L121](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L121) |
| P007 | AI release notes | I | I | I | later:L17 | Concrete later-model outcome preserved outside vNext. | [L122](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L122) |
| P008 | Artifact if filters | I | I | I | mechanism:M06 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L123](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L123) |
| P009 | App bundles | I | I | I | vnext:P06-01 | Atomic vNext outcome; the source case is evidence for this leaf only. | [L124](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L124) |
| P010 | Cloudsmith | I | I | I | deferred:X03 | Concrete provider package deferred; D06 permits it without a core allowlist. | [L125](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L125) |
| P011 | Global metadata defaults | I | I | I | mechanism:M02 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L126](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L126) |
| P012 | Before-publish hooks | I | I | I | mechanism:M05 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L127](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L127) |
| P013 | Cross-publish | I | I | I | mechanism:M14 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L128](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L128) |
| P014 | Versioned Homebrew casks | I | I | I | later:L01 | Concrete later-model outcome preserved outside vNext. | [L129](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L129) |
| P015 | DockerHub descriptions | I | I | I | later:L16 | Concrete later-model outcome preserved outside vNext. | [L130](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L130) |
| P016 | DMG | I | I | I | vnext:P07-01 | Atomic vNext outcome; the source case is evidence for this leaf only. | [L131](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L131) |
| P017 | MSI | I | I | I | decision:P05-07 | Genuine maintainer choice preserved; not selected launch scope. | [L132](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L132) |
| P018 | Single-target pipeline | I | I | I | mechanism:M03 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L133](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L133) |
| P019 | PR template checkboxes | I | I | I | excluded:E02 | Intentional exclusion from the ts-release product model. | [L134](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L134) |
| P020 | Template entire files | I | I | I | mechanism:M05 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L135](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L135) |
| P021 | Artifacts template variable | I | I | I | mechanism:M04 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L136](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L136) |
| P022 | Split and merge | I | I | I | mechanism:M06 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L137](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L137) |
| P023 | Advanced changelog | I | I | I | decision:Q06-02 | Genuine maintainer choice preserved; not selected launch scope. | [L138](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L138) |
| P024 | Archive hooks | I | I | I | mechanism:M05 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L139](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L139) |
| P025 | Staged release commands | P-STAGED | S-PREP | I | vnext:K02 | Staged commands are not resumability; this case maps to the explicit whole-release fresh-runner outcome. | [L140](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L140) |
| P026 | Changelog preview | I | I | I | decision:Q06-02 | Genuine maintainer choice preserved; not selected launch scope. | [L141](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L141) |
| P027 | Nightlies | I | I | I | decision:Q05-02 | Genuine maintainer choice preserved; not selected launch scope. | [L142](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L142) |
| P028 | Prebuilt builder | I | I | I | vnext:P01-01 | Atomic vNext outcome; the source case is evidence for this leaf only. | [L143](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L143) |
| P029 | Podman legacy images/manifests | I | I | I | excluded:E04 | Intentional exclusion from the ts-release product model. | [L144](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L144) |
| P030 | GemFury | I | I | I | deferred:X04 | Concrete provider package deferred; D06 permits it without a core allowlist. | [L145](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L145) |
| P031 | Includes | I | I | I | mechanism:M04 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L146](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L146) |
| P032 | Global after hooks | I | I | I | mechanism:M05 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L147](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L147) |
| P033 | Monorepo | P-SCOPE | A-MULTI | I | later:L20 | Concrete later-model outcome preserved outside vNext. | [L148](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L148) |
| P034 | Custom template variables | I | I | I | mechanism:M04 | Configuration, pipeline, or extension mechanism rather than an independent user outcome. | [L149](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L149) |
| P035 | Offline Pro licenses | I | I | I | excluded:E01 | Intentional exclusion from the ts-release product model. | [L150](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L150) |
| P036 | Fallback Pro license keys | I | I | I | excluded:E01 | Intentional exclusion from the ts-release product model. | [L151](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L151) |


## Material distinctions retained by the mapping

### Evidence is not a capability

The four evidence facets stay separate:

```text
provider accepted the intended mutation
authoritative/public metadata matches
intended byte identity is observed
clean installation, discovery, import, download, or execution succeeds
```

The scorecard adds continuation as a fifth facet. A clean consumer exercise is
an acceptance oracle, not a provider interface or `ConsumerScenario`.
GoReleaser Verify cases therefore target the concrete asset outcome or the
`M08` mechanism disposition; they do not justify a universal `verify` API.

### Native npm is not a GoReleaser npm wrapper

GoReleaser's documented npm outcome generates a platform wrapper whose
postinstall downloads an SCM archive. Native ts-release npm publication sends
the user's tarball to an npm registry. The census maps wrapper cases to later
outcome `L04`; native npm scope lives only in `D01-*`.

### Python production is not Python publication

`P04-01` is one uv PEP 517 frontend with exact uv_build and poetry-core
fixtures. `D02-*` owns per-file Warehouse/compatible-server publication and
continuation. Mapping both GoReleaser UV and Poetry cases to `P04-01` does not
create two generic builder capabilities.

### Homebrew Formula evidence is historical on the GoReleaser side

The preserved source case supports the old GoReleaser Formula outcome. Current
GoReleaser documentation deprecates formulas in favor of casks. ts-release
still selects Formula rendering/publication because it is released product
behavior and has an explicit user outcome; casks remain later `L01`.

### The historical denominator is not the current product index

Current GoReleaser adds MCP Registry, Iru, and telemetry material beyond this
preserved list. MCP Registry is selected as AI-native `D07-*`; Iru is deferred
as `X07`; telemetry is mechanism `M11`. This delta is recorded in the
scorecard so the 151 number remains reproducible rather than quietly changing.

## Mechanical invariants

This document is valid only while all of the following hold:

1. Cases are exactly `C001..C115` and `P001..P036`, once each.
2. Every row has exactly one allowed target kind and one target ID.
3. Every target ID resolves in `launch-scorecard.md`.
4. No target or reason contains an unresolved sentinel.
5. Evidence grades do not become stronger merely because a disposition changed.
