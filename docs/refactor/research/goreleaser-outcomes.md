# GoReleaser outcome roadmap

Status: research checkpoint. This document converts the earlier 151-case mechanism census into a product-outcome roadmap for ts-release. It does not promise feature parity, select production APIs, or treat every GoReleaser pipe as a distinct user outcome.

## Preserved source census

The complete 151-row audit remains available at the immutable pre-roadmap pin:

- [151-case census at `d57e7e9`](https://github.com/mannyc2/ts-release/blob/d57e7e91b58683d030201d278eb96cd5acd05a21/docs/refactor/research/goreleaser-outcomes.md)

That ledger remains useful for traceability. This document supersedes its row-by-row product interpretation. Several rows are implementation mechanisms, configuration variants, or neighboring tools rather than separate outcomes.

## Current external evidence

Current GoReleaser source is pinned for this review at [`92453c1dbdf592d227cb236600093a503f2351f3`](https://github.com/goreleaser/goreleaser/tree/92453c1dbdf592d227cb236600093a503f2351f3).

Official outcome references include:

- [builds](https://goreleaser.com/customization/builds/)
- [archives](https://goreleaser.com/customization/archive/)
- [checksums](https://goreleaser.com/customization/checksums/)
- [SBOMs](https://goreleaser.com/customization/sbom/)
- [signing](https://goreleaser.com/customization/sign/)
- [attestations](https://goreleaser.com/customization/attestations/)
- [release providers](https://goreleaser.com/customization/release/)
- [Homebrew](https://goreleaser.com/customization/homebrew/)
- [Homebrew casks](https://goreleaser.com/customization/homebrew_casks/)
- [Scoop](https://goreleaser.com/customization/scoop/)
- [Winget](https://goreleaser.com/customization/winget/)
- [Krew](https://goreleaser.com/customization/krew/)
- [Nix](https://goreleaser.com/customization/nix/)
- [AUR](https://goreleaser.com/customization/aur/)
- [Chocolatey](https://goreleaser.com/customization/chocolatey/)
- [Linux packages through nfpm](https://goreleaser.com/customization/nfpm/)
- [Snapcraft](https://goreleaser.com/customization/snapcraft/)
- [Docker images](https://goreleaser.com/customization/docker/)
- [generic blob publication](https://goreleaser.com/customization/blob/)
- [custom publishers](https://goreleaser.com/customization/publishers/)
- [npm wrapper packages](https://goreleaser.com/customization/npm/)
- [changelog](https://goreleaser.com/customization/changelog/)
- [announcements](https://goreleaser.com/customization/announce/)

GoReleaser's npm support packages downloadable binaries for npm consumption. It is not evidence for native publication of an existing TypeScript package. GoReleaser's Python builders are not a native Warehouse/PyPI publishing outcome. ts-release should include native npm and native PyPI outcomes because they are central to its domain even though GoReleaser lacks direct equivalents.

## Outcome facets

Every roadmap item is evaluated across four independent facets:

| Code | Facet | Question |
| --- | --- | --- |
| `A` | Provider acceptance | Did the provider accept the intended coordinate or mutation? |
| `M` | Public metadata | Does a fresh public or authoritative read show the intended metadata and pointers? |
| `B` | Intended byte identity | Do provider-visible bytes or digests match the finalized bundle? |
| `C` | Consumer behavior | Can a clean consumer discover, install, download, or execute the release? |

A capability can satisfy one facet without satisfying the others. For example, a Git ref update can satisfy `A` while Homebrew installation remains `C = NotObserved`.

## Roadmap classifications

- **Structural / falls out from the model:** obtained by finalized bundles, typed provider coordinates, the journal, and ordinary composition rather than a dedicated feature family.
- **Restored first-cut behavior:** existing ts-release behavior that should return early in the rewrite.
- **Distinct built-in capability:** provider or product behavior that deserves a maintained first-party implementation.
- **Arbitrary custom-provider capability:** possible through the provider contract without a first-party implementation.
- **Adjacent composition:** belongs in a neighboring build, signing, registry, or CI tool and should compose with ts-release.
- **Later product work:** valuable, but not required to establish the first durable release path.
- **Taxonomy or mechanism:** implementation vocabulary, not a user outcome by itself.
- **Intentionally outside ts-release:** not a target responsibility.

## Core outcome roadmap

| Outcome | A | M | B | C | Classification | Direction |
| --- | --- | --- | --- | --- | --- | --- |
| Build a target matrix | n/a | n/a | output digests | executable smoke optional | Adjacent composition | effect-build or another build system produces owned outputs; ts-release adopts finalized outputs. |
| Collect logical artifacts into one immutable release bundle | n/a | manifest | canonical digests | local readers | Structural / falls out | Root release program finalizes one canonical manifest and durable byte set. |
| Produce archives | n/a | manifest entries | archive digest | local extraction | Adjacent composition | Archive construction is a build/output transformation; ts-release stores and publishes the result. |
| Produce checksums | n/a | checksum artifact | digest law | consumer verification | Structural / falls out | Bundle digests fall out; publishing a checksum file is an ordinary artifact. |
| Produce SBOMs | n/a | SBOM artifact | SBOM digest | verifier-specific | Adjacent composition | External generator creates the SBOM; ts-release carries and publishes it. |
| Sign artifacts or checksum files | signature-provider acceptance | signature metadata | signed digest | signature verification | Adjacent composition | Signing service/tool owns key and signature law; ts-release journals returned signatures and publishes them. |
| Produce provenance or attestations | attestation-provider acceptance | attestation metadata | subject digests | verifier acceptance | Adjacent composition / later gate | Compose with Sigstore or CI attestation tools; do not invent a generic signing abstraction. |
| Publish a GitHub/GitLab/Gitea release | release accepted | release metadata | uploaded asset digests | public download | Distinct built-in capability | First-party adapters where maintained; provider-local refs, releases, and assets remain separate operations. |
| Publish generic object-store blobs | object accepted | object metadata | checksum or content comparison | public/private download | Arbitrary custom provider initially; possible built-in later | AWS S3 and each compatible endpoint need explicit implementation identity and laws. |
| Run a custom post-publish command | command exit only | tool-defined | tool-defined | tool-defined | Arbitrary custom-provider capability | A provider package can invoke a tool, but must still provide typed intent, receipt, observation, and uncertainty behavior. |
| Native npm package publication | version/tag accepted | registry metadata and dist-tags | tarball integrity | clean `npm install` and import/CLI run | Restored first-cut behavior and distinct built-in | Model immutable version and mutable dist-tag separately. |
| Native PyPI file publication | each file accepted | Simple API file records | per-file SHA-256 | clean install/import/CLI run | Restored first-cut behavior and distinct built-in | Continue per filename; Warehouse laws are not generic compatible-index laws. |
| Downloadable binary wrapper on npm | npm package accepted | npm metadata | embedded/downloaded binary digest | wrapper install and execution | Later product work or adjacent composition | Distinct from native TypeScript package publication; adopt only if ts-release needs this distribution form. |
| Homebrew formula publication | Git ref accepted | formula metadata/render | referenced archive digest | `brew install` and executable smoke | Distinct built-in capability | Formula language, tap Git publication, rendering, and install evidence remain separate. |
| Homebrew cask publication | Git ref accepted | cask metadata/render | referenced artifact digest | `brew install --cask` and artifact smoke | Later distinct built-in | Separate law from formulas. |
| Scoop manifest publication | Git ref accepted | manifest render | URL/hash identity | Scoop install and executable smoke | Restored first-cut or early distinct built-in | Keep catalog Git acceptance separate from Windows consumer evidence. |
| Winget manifest publication | repository/PR accepted | manifest validation and catalog state | installer hashes | Winget install | Later product work | Provider process and validation are materially different from a direct Git catalog. |
| Krew plugin index publication | Git ref/PR accepted | plugin manifest | archive checksums | `kubectl krew install` and smoke | Later product work | A dedicated catalog provider if prioritized. |
| Nix package or flake publication | Git or registry accepted | Nix expression/flake metadata | fixed-output hashes | evaluation/build/install | Later product work / adjacent composition | Nix evaluation is a consumer/build outcome, not merely Git acceptance. |
| AUR package publication | Git accepted | PKGBUILD metadata | source checksums | clean package build/install | Later product work | Requires AUR-specific coordinate and consumer environment. |
| Chocolatey package publication | feed accepted | package metadata | nupkg checksum | Chocolatey install and executable smoke | Later product work | Dedicated provider and Windows evidence environment. |
| Debian/RPM/APK packages | package output only unless repository published | package metadata | package digest | package-manager install | Adjacent composition, with repository publishing later | nfpm-like construction belongs to build tooling; repository mutation is a separate provider. |
| Snap publication | store accepted | channel/revision metadata | uploaded snap digest | clean snap install/run | Later product work | Dedicated store/channel contract. |
| Container image publication | registry manifest accepted | tags/manifests/index | layer/config digest graph | pull and container smoke | Later distinct built-in or adjacent composition | OCI has its own immutable digest and mutable tag laws; do not force it through file publication. |
| Multi-architecture container index | registry index accepted | platform descriptors | manifest/layer digests | platform-specific pull/run | Later product work | Separate operation graph under OCI provider. |
| Changelog generation | n/a | release text | source-input digest optional | human review | Adjacent composition | ts-release can carry generated text; generation policy is not a provider outcome. |
| Announcements | channel accepted | message visible | n/a | recipient-specific | Intentionally outside first release core | Notification integrations compose after durable provider outcomes. |
| Release verification command | none by itself | command-defined | command-defined | command-defined | Taxonomy or mechanism | Replace one generic `verify` concept with explicit A/M/B/C outcomes and environments. |
| Retry | none by itself | none | none | none | Taxonomy or mechanism | Journal transition policy, not a product outcome. |
| Matrix fan-out | none by itself | none | none | none | Taxonomy or mechanism | Graph execution mechanism. |
| Hooks and pipes | none by themselves | none | none | none | Taxonomy or mechanism | Extension mechanism only. |
| Arbitrary dynamic provider package | provider-defined | provider-defined | provider-defined | provider-defined | Arbitrary custom-provider capability | Clean Node module loading is the first library boundary; sealed standalone loading remains a separate requirement. |
| Non-manual ts-release self-release | all required coordinates accepted or reconciled | public release metadata | all public bytes match finalized bundle | clean consumers install/run the released product | Decisive acceptance gate | The rewritten product must release itself without manual mutation or blind replay. |

## First-cut product slice

The first durable slice should be narrow enough to validate the architecture but broad enough to exercise different provider laws.

### Structural first-cut

- direct immutable finalized bundle;
- canonical manifest and domain-separated bundle identity;
- provider-local logical operations and attempts;
- durable journal with accepted, observed-equivalent, proven-noncommit, pending, conflict, and inconclusive states;
- per-coordinate continuation using the same finalized bytes; and
- two-dimensional acceptance evidence.

### Restored and first-party provider outcomes

Recommended first-cut built-ins:

1. native npm version and dist-tag outcomes;
2. native Warehouse/PyPI per-file outcomes;
3. GitHub tag/release/asset outcomes; and
4. one Git catalog path, likely the current Scoop-style catalog, to exercise conditional ref publication and consumer evidence distinct from registry upload.

This set covers immutable package coordinates, mutable pointers, partial multi-file progress, response-loss reconciliation, Git compare-and-swap, and clean consumer installation.

### Custom-provider boundary

The first cut should allow a clean Node consumer module to provide its own Layer and export an already-closed release program containing an unknown provider. That proves library extensibility. It does not require a sealed single-file executable to discover packages at runtime.

## Later built-ins versus arbitrary providers

A feature can be architecturally valid without a first-party built-in. The decision to package and maintain a provider depends on user demand, provider law stability, test environment cost, and maintainer capacity.

The following are plausible custom providers before first-party adoption:

- AWS S3 or a named S3-compatible implementation;
- OCI registries;
- GitLab or Gitea releases;
- Winget, Krew, Nix, AUR, Chocolatey, and Snap;
- announcement channels; and
- organization-specific deployment catalogs.

The core must not certify these providers or imply parity because they compile. Each claimed A/M/B/C outcome requires explicit evidence.

## Acceptance roadmap

For each maintained built-in, the roadmap should progress through evidence environments rather than one generic tier:

| Outcome claimed | Minimum useful evidence | Strong evidence | Decisive evidence |
| --- | --- | --- | --- |
| Provider acceptance | protocol double or scratch provider receipt | real provider receipt | self-release journal receipt |
| Public metadata | fresh scratch/public read | independent public read | self-release public metadata |
| Intended bytes | provider digest or downloaded bytes | independent download and digest | self-release public bytes equal finalized bundle |
| Consumer behavior | clean local/scratch install | representative end-user host | clean consumer installs/runs the self-released ts-release |
| Recovery | deterministic fault trace | provider scratch response-loss test | self-release continuation without blind repetition |

A green provider job does not imply all five rows. Missing consumer evidence is recorded as `NotObserved`, not silently promoted to success.

## Outcomes intentionally not copied from GoReleaser

- Go-specific cross-compilation conventions are not the ts-release root model.
- Every pipe or YAML stanza is not a separate product capability.
- npm binary wrappers are not a substitute for native npm package publication.
- Python build support is not a substitute for native Warehouse upload.
- one generic post-hook or custom-publisher success does not establish provider reconciliation.
- announcements and changelog generation do not belong in the durable mutation kernel.
- one generic `verify` phase is rejected in favor of explicit A/M/B/C outcomes.

## Conclusions

1. The 151-row census is preserved for audit, but the product roadmap is outcome-oriented.
2. Provider acceptance, public metadata, intended bytes, and consumer behavior are separate claims.
3. Native npm and native PyPI are first-class ts-release outcomes even without native GoReleaser equivalents.
4. Finalized bundles, checksums, and per-coordinate continuation fall out from the core model.
5. Build, archive, SBOM, signing, and provenance tools should compose through owned outputs unless ts-release later earns a dedicated implementation.
6. Catalogs and package managers need distinct provider and consumer evidence, not one Git-push success.
7. The decisive gate is a non-manual self-release through the rewritten product with public byte and consumer evidence.
