# GoReleaser outcomes

Status: active research. The existing 151-case document is used only as a feature-name and source-link index. Every current-behavior claim is being rechecked against current documentation and source.

Research baselines:

- ts-release parity index: https://github.com/mannyc2/ts-release/blob/main/docs/release-program/decisions/207-parity-source-cases.md
- current GoReleaser customization index: https://goreleaser.com/customization/
- current GoReleaser pipeline source: https://github.com/goreleaser/goreleaser/blob/main/internal/pipeline/pipeline.go
- current GoReleaser artifact source: https://github.com/goreleaser/goreleaser/blob/main/internal/artifact/artifact.go
- current ts-release: `1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3`
- released ts-release v0.0.7: `af59436cff908fb52773cf18dd95d154f892b8de`

## Evidence levels

Each outcome receives one of:

- **researched**: primary docs/source establish the behavior;
- **prototype**: a disposable executable probe exists;
- **contract-tested**: an automated provider/build contract test passes;
- **live endpoint exercised**: a real destination accepted or exposed the result;
- **consumer exercised**: a clean consumer installed/imported/executed it;
- **released**: the capability shipped in a public ts-release version.

## Classification

Every outcome is classified as one or more of:

- build;
- transformation;
- packaging;
- publication;
- observation;
- consumption;
- announcement.

Similarly named features are not treated as equivalent.

## Early corrections to the old ledger

### GoReleaser npm is a wrapper-package outcome

**Current GoReleaser documentation observed:** the `npms` feature generates a package and postinstall scripts. When installed, that package downloads the appropriate release archive and copies/extracts the binary into its `bin` directory. GoReleaser then publishes the generated wrapper to npm.

Source:

- https://goreleaser.com/customization/publish/npm/

This is not the same outcome as publishing an existing native JavaScript/TypeScript npm tarball produced from a package directory. ts-release must track both outcomes separately.

### GoReleaser builds Python distributions but has no native PyPI publisher

**Current GoReleaser documentation observed:** UV and Poetry builders can produce wheels and source distributions. The UV documentation recommends a global after hook such as `uv publish` for PyPI publication.

Sources:

- https://goreleaser.com/customization/builds/builders/uv/
- https://goreleaser.com/customization/builds/builders/poetry/

**Inferred:** native PyPI-compatible publication remains a ts-release differentiator. GoReleaser can accomplish it through arbitrary command composition, but it does not currently expose a provider-native PyPI publication integration equivalent to its GitHub/Homebrew/npm features.

### GoReleaser `verify` is SCM asset/public-delivery verification

**Current GoReleaser documentation observed:** since v2.17, `verify` re-downloads published SCM release assets into `dist/verify` and runs configured directory- or asset-level commands. Image verification operates against published image references/digests. It runs after publication and before announcement, can load prior run state, retries CDN downloads, and currently excludes artifacts published only to blob storage or package registries.

Source:

- https://goreleaser.com/customization/verify/

Guarantees it can establish include:

- the public SCM delivery URL serves complete assets;
- downloaded files match a published or local checksum list when configured;
- signatures/certificates verify when configured;
- image digests/signatures verify when configured;
- arbitrary commands succeed against the download directory or individual assets.

It does not by itself establish clean `npm install`, `pip install`, Homebrew installation, Scoop installation, or package-registry propagation.

## Initial outcome ledger

| Outcome | Class | Multiplicity/dependencies | Current GoReleaser | Current ts-release | v0.0.7 | Natural Effect expression | Structural or distinct capability | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Arbitrary/prebuilt builder | build | zero/one/many outputs | import pre-built binaries plus multiple language builders/hooks | closed recipes/capabilities; custom prepared paths constrained | prebuilt artifact paths and configured builders | any Effect producing finalized artifacts | should fall out of artifact ingestion | researched |
| effect-build executable matrix | build | many correlated targets | GoReleaser has its own builders/matrices | custom Bun compiler/recipe path | Bun-oriented build support | `compileExecutableMatrix` then finalize outputs | distinct generic build capability owned by effect-build | researched |
| Archives | transformation/packaging | many input files -> many archives | first-class archive pipeline | limited/current recipe machinery | artifact-first archive examples | Effect transform from resolved inputs to finalized archive | distinct transform, ordinary multiplicity | researched |
| Source archives | packaging | source identity -> archive | first-class source archive | not a stable current public outcome | no complete parity | source snapshot Effect -> archive | distinct capability | researched |
| Checksums | transformation | set of artifacts -> checksum file(s) | first-class checksums | current digests are internal/prepared facts; product file varies | checksums used by catalog generation | Effect over finalized artifact set | distinct transform; selection falls out of data | researched |
| Signing/notarization | transformation/external service | selected artifacts, identities, credentials | first-class signing and notarization | not rewrite-complete | not generally released | provider/tool Effects over artifacts | distinct product capability | researched |
| SBOMs | transformation | selected artifacts -> one/many SBOMs | first-class SBOM pipeline | absent as product capability | absent | cataloger Effect producing artifacts | distinct transform | researched |
| Attestations | transformation/publication | subject artifacts + identity | first-class attestations | provenance fields exist for some providers, no general capability | limited | attestor Effect returning receipt/artifact | distinct capability | researched |
| Native npm tarball publication | publication/consumption | many package coordinates | not equivalent; npm feature publishes generated wrappers | current npm provider supports exact prepared tarball | npm target published package path | provider-local npm publish Effect | distinct provider capability | released in v0.0.7; current researched |
| Downloading npm wrapper package | packaging/publication/consumption | wrapper package depends on SCM archives | first-class Pro npm feature | absent | absent | generate wrapper, publish, clean install | distinct capability | researched |
| PyPI-compatible publication | publication/consumption | many project/files | hook/custom command, no native provider | current exact per-file provider | plural Twine upload to arbitrary URL | provider-local upload per file | distinct provider capability | released in v0.0.7; current researched |
| GitHub Release | publication/observation | one release, many assets | first-class SCM release | current provider with exact asset facts | `gh release create` plus field/name check | provider-local release and asset Effects | distinct provider capability | released |
| GitLab/Gitea release | publication | one release, many assets | first-class SCM alternatives | absent | absent | provider packages with native clients | distinct capability | researched |
| Homebrew Formula/Cask | packaging/publication/consumption | many formulas/casks and architecture artifacts | first-class Homebrew publication | current GitHub-coupled catalog provider | generic Git target, plural Homebrew artifacts | render file -> conditional Git push -> optional clean install | distinct integrations; plurality structural | released Formula support; Cask pending |
| Scoop | packaging/publication/consumption | many manifests | first-class Scoop publication | current GitHub-coupled catalog provider | generic Git bucket target | render manifest -> conditional Git push -> clean install | distinct integration | released |
| Winget | packaging/publication/consumption | installer plus version/locale manifests | first-class publication | absent | absent | render typed manifest set -> provider submission | distinct capability | researched |
| OCI images | build/packaging/publication/consumption | many platforms/images/manifests | Docker v2, ko, registries | absent | absent | image builder/pusher Effects with digest receipts | distinct resource model, not regular-file-only | researched |
| nFPM/system packages | packaging | many formats/targets | `.deb`, `.rpm`, `.apk`, `.ipk`, Arch, MSIX | absent | absent | package transform Effects | distinct packaging capability | researched |
| Changelog/release notes | transformation/publication | commits/issues -> text; consumed by release provider | first-class changelog and release notes | notes exist but generation not broad | basic identity/notes | Effect producing text artifact/value | distinct generation capability | researched |
| Monorepo/multiple releases | orchestration | zero/one/many definitions/packages | Pro monorepo prefix/dir model | current schemas impose provider-specific structure | multiple targets possible, no ideal multi-definition model | ordinary arrays/records plus explicit dependency sequencing | multiplicity should fall out; release selection may be distinct | researched |
| Snapshot | build | artifacts only, no publication | first-class `--snapshot`; no upload | partial dry-run/simulation concepts | limited | run build transforms without publication Effects | mostly falls out of phase selection; naming is policy | researched |
| Nightly | build/publication | recurring mutable/prerelease channel | first-class nightly behavior | absent | absent | scheduled release program plus channel policy | distinct product policy | researched |
| Custom publisher | publication | configured publishers x filtered artifacts | commands run sequentially by publisher, parallel across artifacts | current custom provider admission constrained | extension through target registry only | import arbitrary package and compose Effect | should fall out of TypeScript/Layer composition | researched |
| Hooks | any phase | zero/one/many commands | global/build/publish hooks | custom graph/recipes | command operations | ordinary Effect sequencing/finalizers | should mostly fall out | researched |
| Blob/general upload | publication | many objects | blob storage, HTTP, Artifactory | absent as general product feature | absent | provider-local upload Effect | distinct provider capability; shared file handling may be generic | researched |
| Public SCM asset verification | observation/consumption | many downloaded assets and images | current Pro `verify` | current internal/provider reobservation, not equivalent | field/name checks | public download plus configured commands | distinct acceptance capability | researched |
| Package-manager consumer verification | consumption | exact version/package in clean environment | not established by SCM `verify` | ad hoc release evidence | smoke workflows existed | `npm install`, `pip install`, `brew install`, `scoop install` Effects | distinct promised outcome | partially released/tested; needs live recertification |
| Announcements | announcement | many destinations after dependencies | many first-class announcers | absent | absent | provider-local notification Effects sequenced after desired evidence | distinct integrations; sequencing structural | researched |

## GoReleaser architecture observations

**Source-observed:** current GoReleaser has one globally ordered pipeline spanning environment/Git setup, build, transforms, packaging, publication, metadata, verification, and announcement.

Source:

- https://github.com/goreleaser/goreleaser/blob/main/internal/pipeline/pipeline.go

**Source-observed:** its artifact model uses a central artifact-type enumeration and an `Extras map[string]any`; adding uploadable types requires synchronized central lists.

Source:

- https://github.com/goreleaser/goreleaser/blob/main/internal/artifact/artifact.go

**Inferred:** ts-release should pursue outcome parity without copying this global pipeline, central enum, metadata bag, or hook system. Ordinary Effect composition can make some named GoReleaser features disappear while preserving the user capability.

## Current source index by required area

- Builders: https://goreleaser.com/customization/builds/builders/
- Prebuilt binaries: https://goreleaser.com/customization/builds/prebuilt/
- Archives: https://goreleaser.com/customization/archive/
- Source archives: https://goreleaser.com/customization/source/
- Checksums: https://goreleaser.com/customization/checksum/
- SBOMs: https://goreleaser.com/customization/sbom/
- Signing/notarization: https://goreleaser.com/customization/sign/
- Attestations: https://goreleaser.com/customization/publish/attestations/
- SCM releases: https://goreleaser.com/customization/release/
- Homebrew: https://goreleaser.com/customization/publish/homebrew/
- Scoop: https://goreleaser.com/customization/publish/scoop/
- Winget: https://goreleaser.com/customization/publish/winget/
- NPM: https://goreleaser.com/customization/publish/npm/
- Python UV: https://goreleaser.com/customization/builds/builders/uv/
- OCI/Docker v2: https://goreleaser.com/customization/package/dockers_v2/
- nFPM: https://goreleaser.com/customization/package/nfpm/
- Custom publishers: https://goreleaser.com/customization/publish/publishers/
- Hooks: https://goreleaser.com/customization/general/hooks/
- Blob storage: https://goreleaser.com/customization/publish/blobs/
- Verification: https://goreleaser.com/customization/verify/
- Monorepo: https://goreleaser.com/customization/monorepo/
- Snapshots: https://goreleaser.com/customization/publish/snapshots/
- Nightlies: https://goreleaser.com/customization/publish/nightlies/
- Announcements: https://goreleaser.com/customization/announce/

## Next research passes

1. Replace every old 151-case disposition with current source evidence.
2. Record exact multiplicity and dependencies rather than feature booleans.
3. Distinguish build outputs, published resources, observations, and consumer outcomes.
4. Recheck whether each current ts-release capability is reachable through shipped entrypoints, not merely present in source.
5. Add executable evidence levels and commands to reproduce each prototype/live exercise.
6. Produce rewrite-acceptance and next-tier subsets only after the ledger is evidence-complete.