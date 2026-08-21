# GoReleaser material evidence groups

Status: evidence companion to the 151-case census and derived outcome roadmap. This document assigns traceable evidence to material feature groups. It does not make the census index itself proof of implementation.

## Authority model

The comparison has one evidence authority and one derived product view:

1. [goreleaser-evidence-census.md](./goreleaser-evidence-census.md) preserves all 151 source cases and separate GoReleaser/current-ts-release/v0.0.7/rewrite columns.
2. This document supplies material-group evidence and grades.
3. [goreleaser-outcomes.md](./goreleaser-outcomes.md) derives product outcomes and dispositions from the census plus these evidence groups.

Earlier parity dispositions remain useful source leads but are superseded when this document or the provider research gives stronger current evidence. The census `R` column is retained as historical traceability from the recovered pass; it is not the current product-disposition authority. No older document or census proposal cell is a peer authority for rewrite scope.

## Evidence grades

| Grade | Meaning |
| --- | --- |
| `INDEX` | Case or feature name exists in the older index. No current behavior proved. |
| `DOC` | Current official documentation states the behavior. |
| `SOURCE` | Pinned current implementation source was inspected. |
| `PROBE` | Disposable executable probe exercised a local or packaged boundary. |
| `PROTOCOL_DOUBLE` | Provider contract test exercised a deterministic double. |
| `SCRATCH_PROVIDER` | Authorized real scratch endpoint accepted or exposed the result. |
| `PUBLIC_PROVIDER` | Public endpoint metadata or bytes were observed. |
| `CONSUMER` | Clean consumer installed, imported, downloaded, or executed the result. |
| `RELEASED` | A released ts-release generation shipped the behavior. |
| `PROJECT_DECISION` | Maintainer-fixed product scope or intentional exclusion. |

A higher grade does not imply every outcome facet. For example, `SOURCE` for an upload implementation does not prove `CONSUMER`.

## Pins

| Source | Pin |
| --- | --- |
| current GoReleaser | [`92453c1dbdf592d227cb236600093a503f2351f3`](https://github.com/goreleaser/goreleaser/tree/92453c1dbdf592d227cb236600093a503f2351f3) |
| preserved GoReleaser docs snapshot used by earlier research | [`cab7c6ef5d4ffc2429828f031ff7bb4645de7dad`](https://github.com/goreleaser/goreleaser/tree/cab7c6ef5d4ffc2429828f031ff7bb4645de7dad) |
| current ts-release implementation | [`d57e7e91b58683d030201d278eb96cd5acd05a21`](https://github.com/mannyc2/ts-release/tree/d57e7e91b58683d030201d278eb96cd5acd05a21) |
| ts-release v0.0.7 | [`af59436cff908fb52773cf18dd95d154f892b8de`](https://github.com/mannyc2/ts-release/tree/af59436cff908fb52773cf18dd95d154f892b8de) |
| 151-case source index | [`1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3`](https://github.com/mannyc2/ts-release/blob/1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3/docs/release-program/decisions/207-parity-source-cases.md) |

## Evidence groups

## G01 - Configuration and orchestration mechanisms

Cases:

```text
C001-C014
P004 P008 P011 P018 P020-P022 P031 P033-P034
```

Current GoReleaser evidence:

- root configuration and schema: [current source](https://github.com/goreleaser/goreleaser/blob/92453c1dbdf592d227cb236600093a503f2351f3/pkg/config/config.go)
- templates and configuration are documented throughout the customization index.

Grade: `DOC + SOURCE`.

Disposition:

- taxonomy/mechanism, not one product outcome;
- executable TypeScript and Effect composition need not reproduce every YAML knob;
- stable version/tag/source facts, dependency edges, and application configuration remain product requirements.

## G02 - Builders and producer outputs

Cases:

```text
C015-C031
P028
```

Current GoReleaser evidence:

- build pipeline source: [`internal/pipe/build/build.go`](https://github.com/goreleaser/goreleaser/blob/92453c1dbdf592d227cb236600093a503f2351f3/internal/pipe/build/build.go)
- Python `uv` builder: [`uv.md`](https://github.com/goreleaser/goreleaser/blob/92453c1dbdf592d227cb236600093a503f2351f3/www/content/customization/builds/builders/uv.md)
- Go builder and other current builders are indexed under the current build documentation.

Grade: `DOC + SOURCE`.

Current ts-release/v0.0.7:

- current ts-release has build/preparation machinery and prebuilt imports;
- v0.0.7 had narrower direct build/publish behavior;
- neither makes every GoReleaser language builder a release-core law.

Rewrite disposition:

- effect-build and arbitrary external/prebuilt producers are shipping composition;
- individual language builders are adjacent packages or custom build Effects;
- zero/one/many outputs are structural collections, not a mode.

## G03 - Packaging and transformation

Cases:

```text
C032-C047
P002-P003 P009 P016-P017 P024 P029
```

Current GoReleaser evidence:

- archives, nFPM, DMG, MSI, NSIS, app bundles, Docker, and related pipelines are documented and implemented as packaging/transformation stages.
- current nFPM source: [`internal/pipe/nfpm/nfpm.go`](https://github.com/goreleaser/goreleaser/blob/92453c1dbdf592d227cb236600093a503f2351f3/internal/pipe/nfpm/nfpm.go)
- Docker v2 documentation: [`dockers_v2.md`](https://github.com/goreleaser/goreleaser/blob/92453c1dbdf592d227cb236600093a503f2351f3/www/content/customization/package/dockers_v2.md)

Grade: `DOC + SOURCE` for material examples; remaining case rows inherit `INDEX` until individually inspected.

Rewrite disposition:

- archive/checksum production is intended shipping behavior through build/transformation composition;
- platform installers and system packages follow the selected/later
  dispositions in `launch-scorecard.md`; this material map does not decide
  their scope;
- publication to a package repository is a separate provider outcome.

## G04 - Checksums, SBOMs, signing, notarization, attestations

Cases:

```text
C048-C057
C079
P006
```

Current GoReleaser evidence:

- checksum, SBOM, binary signing, Docker signing, and notarization are current documented pipeline capabilities.
- attestation documentation describes adjacent GitHub Actions composition rather than an intrinsic GoReleaser pipeline mutation: [`attestations.md`](https://github.com/goreleaser/goreleaser/blob/92453c1dbdf592d227cb236600093a503f2351f3/www/content/customization/publish/attestations.md)

Grade: `DOC`; selected implementations also `SOURCE`.

Rewrite disposition:

- bundle content digests are structural;
- checksum files, SBOMs, signatures, and attestations are typed artifacts or external service receipts;
- no universal signing/provider service is inferred.

## G05 - Publish and hook mechanisms

Cases:

```text
C058-C059
P012-P013 P032
```

Current GoReleaser evidence:

- ordered publish pipeline: [`internal/pipe/publish/publish.go`](https://github.com/goreleaser/goreleaser/blob/92453c1dbdf592d227cb236600093a503f2351f3/internal/pipe/publish/publish.go)
- custom publishers: [`publishers.md`](https://github.com/goreleaser/goreleaser/blob/92453c1dbdf592d227cb236600093a503f2351f3/www/content/customization/publish/publishers.md)

Grade: `DOC + SOURCE`.

Rewrite disposition:

- publish phase, hooks, and pipes are mechanisms;
- ordinary Effect sequencing and custom provider packages provide extension;
- command success alone does not establish provider reconciliation.

## G06 - SCM releases

Cases:

```text
C060-C063
```

Current GoReleaser evidence:

- GitHub, GitLab, and Gitea release documentation exists under SCM publication.
- GitHub configuration: [`github.md`](https://github.com/goreleaser/goreleaser/blob/92453c1dbdf592d227cb236600093a503f2351f3/www/content/customization/publish/scm/github.md)

Grade: `DOC + SOURCE` for GoReleaser; current ts-release and v0.0.7 have `SOURCE/RELEASED` evidence for GitHub.

Rewrite disposition:

- GitHub Releases and assets are fixed shipping built-ins;
- GitLab and Gitea remain later built-ins or arbitrary custom providers;
- tag/ref, release resource, each asset, public observation, byte identity, and consumer behavior are separate outcomes.

## G07 - Snapshots and nightlies

Cases:

```text
C064-C065
P027
```

Current GoReleaser evidence:

- snapshot mode still executes build, transformation, and packaging while suppressing real publication.

Grade: `DOC + SOURCE`.

Rewrite disposition:

- snapshot/nightly is versioning, retention, destination, and mutation policy;
- it is not merely a build output and not part of the fixed provider list;
- later product work must preserve artifact transformation semantics.

## G08 - Generic blobs and external feeds

Cases:

```text
C066-C069
C081-C082
P010 P015 P030
```

Current GoReleaser evidence:

- blob and HTTP/general publication mechanisms are documented;
- Artifactory and Nexus examples use external tools/custom publishers.

Grade: `DOC`; destination-specific behavior varies.

Rewrite disposition:

- arbitrary custom providers are fixed shipping capability;
- each named store needs provider implementation identity, endpoint identity, receipt, observation, and replay laws;
- no generic "upload succeeded" claim substitutes for provider acceptance or byte observation.

## G09 - Homebrew casks

Cases:

```text
C070
P014
```

Current GoReleaser evidence:

- casks are current and distinct from formulas: [`homebrew_casks.md`](https://github.com/goreleaser/goreleaser/blob/92453c1dbdf592d227cb236600093a503f2351f3/www/content/customization/publish/homebrew_casks.md)

Grade: `DOC + SOURCE`.

Fixed rewrite disposition:

- casks are **not** in the fixed shipping scope;
- Homebrew formulas are in scope;
- cask rows remain comparison evidence and later product work;
- formula and cask semantics must not be merged merely because both use a tap Git repository.

This resolves the earlier scope inconsistency.

## Continued research

The remaining sections continue in [goreleaser-material-evidence-2.md](./goreleaser-material-evidence-2.md).
