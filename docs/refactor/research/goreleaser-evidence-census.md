# GoReleaser outcome ledger

Status: recovered complete 151-case refresh. Each case has separate status for
current GoReleaser (`G`), current ts-release (`T`), v0.0.7 (`V`), and the rewrite
proposal (`R`). No aggregate `released/researched` cell is used.

## Pins and codes

- GoReleaser OSS source: `cab7c6ef5d4ffc2429828f031ff7bb4645de7dad`.
- 151-case index and current ts-release:
  `1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3`.
- ts-release v0.0.7: `af59436cff908fb52773cf18dd95d154f892b8de`.

Codes:

- `I`: pinned index row only; no stronger product or consumer proof.
- `S-*`: pinned source evidence for the named code outcome.
- `D-*`: current documentation evidence.
- `P-*`: Pro documentation only; OSS source is not implementation evidence.
- `X-*`: superficially related but a different outcome.
- `A-*`: no implementation identified in the pinned review.
- `RESTORE`, `OPEN`, `GAP`, `FUTURE`, `OPTIONAL`, `EXTERNAL`: proposal status,
  not implementation.

Material outcomes remain separate:

```text
provider accepted publication
public metadata observed
intended byte identity observed
clean consumer installation or execution succeeded
```

## Complete case ledger

| Case | Capability | G | T | V | R | Pin |
| --- | --- | --- | --- | --- | --- | --- |
| C001 | Introduction / schema and root config | I | I | I | OPEN | [L1](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L1) |
| C002 | General configuration index | I | I | I | OPEN | [L2](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L2) |
| C003 | Project name | I | I | I | OPEN | [L3](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L3) |
| C004 | Global metadata | I | I | I | OPEN | [L4](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L4) |
| C005 | Dist folder | I | I | I | OPEN | [L5](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L5) |
| C006 | Artifact manifest | I | I | I | OPEN | [L6](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L6) |
| C007 | Includes | I | I | I | OPEN | [L7](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L7) |
| C008 | Templates and variables | I | I | I | OPEN | [L8](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L8) |
| C009 | Template files | I | I | I | OPEN | [L9](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L9) |
| C010 | Environment variables | I | I | I | OPEN | [L10](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L10) |
| C011 | Global hooks | I | I | I | OPEN | [L11](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L11) |
| C012 | Git tag discovery and sorting | I | I | I | OPEN | [L12](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L12) |
| C013 | Split and merge | I | I | I | OPEN | [L13](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L13) |
| C014 | Retries | I | I | I | OPEN | [L14](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L14) |
| C015 | Build phase | I | I | I | OPEN | [L15](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L15) |
| C016 | Builder selection | I | I | I | OPEN | [L16](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L16) |
| C017 | Go builder | I | I | I | OPEN | [L17](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L17) |
| C018 | Bun builder | I | I | I | OPEN | [L18](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L18) |
| C019 | Node SEA builder | I | I | I | OPEN | [L19](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L19) |
| C020 | Rust builder | I | I | I | OPEN | [L20](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L20) |
| C021 | Zig builder | I | I | I | OPEN | [L21](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L21) |
| C022 | Deno builder | I | I | I | OPEN | [L22](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L22) |
| C023 | Python builder overview | I | I | I | OPEN | [L23](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L23) |
| C024 | UV Python builder | D-BUILD | S-IMPORT | I | GAP-BUILD | [L24](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L24) |
| C025 | Poetry Python builder | D-BUILD | S-IMPORT | I | GAP-BUILD | [L25](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L25) |
| C026 | Prebuilt binaries | I | I | I | OPEN | [L26](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L26) |
| C027 | Build hooks | I | I | I | OPEN | [L27](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L27) |
| C028 | Verifiable Go builds | I | I | I | OPEN | [L28](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L28) |
| C029 | macOS universal binaries | I | I | I | OPEN | [L29](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L29) |
| C030 | UPX | I | I | I | OPEN | [L30](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L30) |
| C031 | Monorepo support | P-SCOPE | A-MULTI | I | OPEN-MULTI | [L31](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L31) |
| C032 | Package and archive phase | I | I | I | OPEN | [L32](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L32) |
| C033 | Archives | I | I | I | OPEN | [L33](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L33) |
| C034 | Source archive | I | I | I | OPEN | [L34](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L34) |
| C035 | nFPM system packages | I | I | I | OPEN | [L35](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L35) |
| C036 | Makeself | I | I | I | OPEN | [L36](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L36) |
| C037 | App bundles | I | I | I | OPEN | [L37](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L37) |
| C038 | Source RPMs | I | I | I | OPEN | [L38](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L38) |
| C039 | DMG | I | I | I | OPEN | [L39](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L39) |
| C040 | macOS pkg | I | I | I | OPEN | [L40](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L40) |
| C041 | MSI | I | I | I | OPEN | [L41](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L41) |
| C042 | NSIS | I | I | I | OPEN | [L42](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L42) |
| C043 | Snapcraft | I | I | I | OPEN | [L43](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L43) |
| C044 | Flatpak | I | I | I | OPEN | [L44](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L44) |
| C045 | Chocolatey packages | I | I | I | OPEN | [L45](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L45) |
| C046 | Docker v2 | I | I | I | OPEN | [L46](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L46) |
| C047 | Ko | I | I | I | OPEN | [L47](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L47) |
| C048 | Checksums | I | I | I | OPEN | [L48](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L48) |
| C049 | Docker digests | I | I | I | OPEN | [L49](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L49) |
| C050 | Legacy Docker images | I | I | I | OPEN | [L50](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L50) |
| C051 | Legacy Docker manifests | I | I | I | OPEN | [L51](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L51) |
| C052 | SBOMs | S-SBOM | I | I | OPEN | [L52](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L52) |
| C053 | Artifact size reporting | I | I | I | OPEN | [L53](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L53) |
| C054 | Binary signing | I | I | I | OPEN | [L54](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L54) |
| C055 | Archive/package/checksum signing | I | I | I | OPEN | [L55](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L55) |
| C056 | Docker manifest signing | I | I | I | OPEN | [L56](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L56) |
| C057 | Notarization | I | I | I | OPEN | [L57](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L57) |
| C058 | Publish phase | S-PUBLISH | I | I | OPEN | [L58](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L58) |
| C059 | Before-publish hooks | I | I | I | OPEN | [L59](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L59) |
| C060 | SCM releases | S-SCM | S-GH | S-GH | RESTORE-GH | [L60](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L60) |
| C061 | GitHub releases | S-GH | S-GH | S-GH | RESTORE-GH | [L61](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L61) |
| C062 | GitLab releases | I | I | I | OPEN | [L62](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L62) |
| C063 | Gitea releases | I | I | I | OPEN | [L63](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L63) |
| C064 | Snapshots | D-SNAPSHOT | S-SNAPSHOT | I | OPEN-SNAPSHOT | [L64](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L64) |
| C065 | Nightlies | I | I | I | OPEN | [L65](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L65) |
| C066 | Blob storage | S-BLOB | I | I | OPEN | [L66](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L66) |
| C067 | Cloudsmith | I | I | I | OPEN | [L67](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L67) |
| C068 | GemFury | I | I | I | OPEN | [L68](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L68) |
| C069 | DockerHub descriptions | I | I | I | OPEN | [L69](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L69) |
| C070 | Homebrew casks | D-CASK | S-GH-GIT | S-GIT | RESTORE-CATALOG | [L70](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L70) |
| C071 | NPM wrapper packages | P-WRAP | X-NATIVE | X-NATIVE | FUTURE-WRAP | [L71](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L71) |
| C072 | Winget | D-WINGET | A-WINGET | I | FUTURE-WINGET | [L72](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L72) |
| C073 | AUR | I | I | I | OPEN | [L73](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L73) |
| C074 | AUR source packages | I | I | I | OPEN | [L74](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L74) |
| C075 | NUR / Nix | I | I | I | OPEN | [L75](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L75) |
| C076 | Krew | I | I | I | OPEN | [L76](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L76) |
| C077 | Scoop | S-SCOOP | S-GH-GIT | S-GIT | RESTORE-CATALOG | [L77](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L77) |
| C078 | MCP Registry | I | I | I | OPEN | [L78](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L78) |
| C079 | Attestations | D-ADJACENT | X-NPM-PROV | I | EXTERNAL-ATTEST | [L79](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L79) |
| C080 | Changelog | I | I | I | OPEN | [L80](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L80) |
| C081 | HTTP upload | S-HTTP | I | I | OPEN | [L81](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L81) |
| C082 | Artifactory | I | I | I | OPEN | [L82](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L82) |
| C083 | Custom publishers | S-CMD | S-SDK | S-CMD | OPEN-LIB | [L83](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L83) |
| C084 | Closing milestones | I | I | I | OPEN | [L84](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L84) |
| C085 | Homebrew formulas | S-BREW | S-GH-GIT | S-GIT | RESTORE-CATALOG | [L85](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L85) |
| C086 | Verify | P-VERIFY | X-OBSERVE | X-PROVIDER-CHECK | OPTIONAL-ACCEPT | [L86](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L86) |
| C087 | Announce phase | I | I | I | OPEN | [L87](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L87) |
| C088 | Bluesky announcement | I | I | I | OPEN | [L88](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L88) |
| C089 | Discord announcement | I | I | I | OPEN | [L89](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L89) |
| C090 | Discourse announcement | I | I | I | OPEN | [L90](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L90) |
| C091 | LinkedIn announcement | I | I | I | OPEN | [L91](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L91) |
| C092 | Mastodon announcement | I | I | I | OPEN | [L92](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L92) |
| C093 | Mattermost announcement | I | I | I | OPEN | [L93](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L93) |
| C094 | OpenCollective announcement | I | I | I | OPEN | [L94](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L94) |
| C095 | Reddit announcement | I | I | I | OPEN | [L95](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L95) |
| C096 | Slack announcement | I | I | I | OPEN | [L96](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L96) |
| C097 | SMTP announcement | I | I | I | OPEN | [L97](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L97) |
| C098 | Teams announcement | I | I | I | OPEN | [L98](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L98) |
| C099 | Telegram announcement | I | I | I | OPEN | [L99](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L99) |
| C100 | X / Twitter announcement | I | I | I | OPEN | [L100](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L100) |
| C101 | Webhook announcement | I | I | I | OPEN | [L101](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L101) |
| C102 | CI integration index | I | I | I | OPEN | [L102](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L102) |
| C103 | GitHub Actions | I | I | I | OPEN | [L103](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L103) |
| C104 | Azure Pipelines | I | I | I | OPEN | [L104](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L104) |
| C105 | CircleCI | I | I | I | OPEN | [L105](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L105) |
| C106 | Cirrus CI | I | I | I | OPEN | [L106](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L106) |
| C107 | Google Cloud Build | I | I | I | OPEN | [L107](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L107) |
| C108 | Codefresh | I | I | I | OPEN | [L108](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L108) |
| C109 | Drone | I | I | I | OPEN | [L109](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L109) |
| C110 | GitLab CI | I | I | I | OPEN | [L110](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L110) |
| C111 | Jenkins | I | I | I | OPEN | [L111](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L111) |
| C112 | RWX | I | I | I | OPEN | [L112](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L112) |
| C113 | Semaphore | I | I | I | OPEN | [L113](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L113) |
| C114 | Travis CI | I | I | I | OPEN | [L114](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L114) |
| C115 | Woodpecker | I | I | I | OPEN | [L115](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L115) |
| P001 | Verify published assets | P-VERIFY | X-OBSERVE | X-PROVIDER-CHECK | OPTIONAL-ACCEPT | [L116](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L116) |
| P002 | macOS pkg | I | I | I | OPEN | [L117](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L117) |
| P003 | NSIS | I | I | I | OPEN | [L118](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L118) |
| P004 | Smart SemVer tag sorting | I | I | I | OPEN | [L119](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L119) |
| P005 | NPM registries / wrapper packages | P-WRAP | X-NATIVE | X-NATIVE | FUTURE-WRAP | [L120](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L120) |
| P006 | Native Apple sign and notarize | I | I | I | OPEN | [L121](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L121) |
| P007 | AI release notes | I | I | I | OPEN | [L122](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L122) |
| P008 | Artifact if filters | I | I | I | OPEN | [L123](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L123) |
| P009 | App bundles | I | I | I | OPEN | [L124](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L124) |
| P010 | Cloudsmith | I | I | I | OPEN | [L125](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L125) |
| P011 | Global metadata defaults | I | I | I | OPEN | [L126](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L126) |
| P012 | Before-publish hooks | I | I | I | OPEN | [L127](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L127) |
| P013 | Cross-publish | I | I | I | OPEN | [L128](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L128) |
| P014 | Versioned Homebrew casks | I | I | I | OPEN | [L129](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L129) |
| P015 | DockerHub descriptions | I | I | I | OPEN | [L130](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L130) |
| P016 | DMG | I | I | I | OPEN | [L131](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L131) |
| P017 | MSI | I | I | I | OPEN | [L132](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L132) |
| P018 | Single-target pipeline | I | I | I | OPEN | [L133](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L133) |
| P019 | PR template checkboxes | I | I | I | OPEN | [L134](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L134) |
| P020 | Template entire files | I | I | I | OPEN | [L135](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L135) |
| P021 | Artifacts template variable | I | I | I | OPEN | [L136](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L136) |
| P022 | Split and merge | I | I | I | OPEN | [L137](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L137) |
| P023 | Advanced changelog | I | I | I | OPEN | [L138](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L138) |
| P024 | Archive hooks | I | I | I | OPEN | [L139](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L139) |
| P025 | Staged release commands | P-STAGED | S-PREP | I | OPEN-DURABLE | [L140](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L140) |
| P026 | Changelog preview | I | I | I | OPEN | [L141](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L141) |
| P027 | Nightlies | I | I | I | OPEN | [L142](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L142) |
| P028 | Prebuilt builder | I | I | I | OPEN | [L143](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L143) |
| P029 | Podman legacy images/manifests | I | I | I | OPEN | [L144](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L144) |
| P030 | GemFury | I | I | I | OPEN | [L145](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L145) |
| P031 | Includes | I | I | I | OPEN | [L146](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L146) |
| P032 | Global after hooks | I | I | I | OPEN | [L147](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L147) |
| P033 | Monorepo | P-SCOPE | A-MULTI | I | OPEN-MULTI | [L148](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L148) |
| P034 | Custom template variables | I | I | I | OPEN | [L149](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L149) |
| P035 | Offline Pro licenses | I | I | I | OPEN | [L150](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L150) |
| P036 | Fallback Pro license keys | I | I | I | OPEN | [L151](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md#L151) |

## Material cell explanations

### GitHub release and assets (`S-GH` / `RESTORE-GH`)

GoReleaser and current/v0.0.7 ts-release have source evidence for GitHub release
publication. That does not combine the following cells:

| Outcome | Evidence status |
| --- | --- |
| provider accepted release object | source/documented write receipt; no live mutation in this checkpoint |
| provider accepted each asset | per-asset source/documented receipt |
| public metadata observed | separate API read |
| intended byte identity observed | digest/size receipt or fresh observation, stated explicitly |
| clean execution succeeded | not established; optional platform-specific acceptance |

The rewrite restores provider-local create/upload results and response-loss
reconciliation. It does not require a universal post-success Verify operation.

### Native npm versus wrapper npm (`P-WRAP`, `X-NATIVE`)

GoReleaser Pro NPM generates a platform wrapper package whose install logic
downloads an archive from an SCM release. Current and v0.0.7 ts-release publish
a user's native npm tarball. These are different built bytes, registry
coordinates/receipts, and consumer paths. Native npm publication must be
restored; wrapper generation is a separate future builder.

### Python builders (`D-BUILD`, `S-IMPORT`, `GAP-BUILD`)

UV and Poetry rows establish Python distribution building. They do not
establish native PyPI-compatible publication. ts-release import/preparation of
existing distributions is not the same builder outcome. PyPI acceptance remains
per file and has its own response-loss and clean-install contract.

### Attestations (`D-ADJACENT`, `X-NPM-PROV`, `EXTERNAL-ATTEST`)

The official page composes GoReleaser results with GitHub Actions artifact
attestation. It is adjacent workflow composition, not a native GoReleaser
pipeline stage proved by OSS source. Narrow npm provenance in current ts-release
is also not a general attestation pipeline.

Primary page:
https://goreleaser.com/customization/publish/attestations/

### Winget (`D-WINGET`, `A-WINGET`, `FUTURE-WINGET`)

Keep separate: manifest generation, local validation, Git publication, PR
creation, catalog acceptance, public visibility, and clean `winget install` /
execution. Documentation for generation/submission does not prove later tiers.

Primary page:
https://goreleaser.com/customization/publish/winget/

### Catalogs (`D-CASK`, `S-SCOOP`, `S-BREW`, `S-GH-GIT`, `S-GIT`)

Formula/manifest generation and Git publication are separate from catalog
visibility and clean Homebrew/Scoop installation. v0.0.7 used generic Git;
current source is GitHub-coupled. The proposal restores generic conditional Git
as the publication protocol and keeps consumer tests optional and named.

### Monorepo (`P-SCOPE`, `A-MULTI`, `OPEN-MULTI`)

GoReleaser Pro monorepo configuration scopes tags, directories, changelogs, and
project settings. It does not prove one run coordinating multiple logical
releases with stable cross-release identity, dependencies, partial success, and
resume.

Primary page:
https://goreleaser.com/customization/monorepo/

### Snapshot (`D-SNAPSHOT`, `S-SNAPSHOT`, `OPEN-SNAPSHOT`)

Snapshot mode changes identity and suppresses normal publication, but still
performs configured build, transformations, and packaging. It is not merely a
build outcome.

Primary page:
https://goreleaser.com/customization/publish/snapshots/

### Verify (`P-VERIFY`, `X-OBSERVE`, `X-PROVIDER-CHECK`, `OPTIONAL-ACCEPT`)

Verify is Pro documentation evidence. OSS pipeline source does not demonstrate
the Pro stage. Its re-download/command behavior establishes only configured
checks and does not automatically prove npm, pip, Homebrew, Scoop, or Winget
installation. Current observations and v0.0.7 provider checks are different
outcomes.

Primary page:
https://goreleaser.com/customization/verify/

### Custom publishers (`S-CMD`, `S-SDK`, `OPEN-LIB`)

GoReleaser command publishers, v0.0.7 command targets, and the current provider
SDK are separate extension mechanisms. The clean Node probe proves only that a
consumer module can close its own Layer before a CLI runs the Effect. It does
not yet prove the ts-release provider, reporting, orchestration, or resume laws.

### Staged commands (`P-STAGED`, `S-PREP`, `OPEN-DURABLE`)

Prepare/publish command boundaries are not a durable resume guarantee. The
write-ahead journal, artifact granularity, retention, compatibility, and
provider reconciliation laws must be selected separately.

## Structural versus distinct outcomes

Effect composition naturally expresses collection cardinality, dependency on a
prior result, fail-fast versus collect-all, and package imports. It does not make
compiler integrations, packaging, signing, registries, catalog renderers,
consumer environments, changelog policy, or durable progress/reconciliation
free.

Every material implementation must move from `I` to a named evidence code and
one of the four outcome tiers. No row selects a universal Publisher, universal
Verify method, or root release API.
