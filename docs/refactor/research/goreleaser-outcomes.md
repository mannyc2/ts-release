# GoReleaser-derived outcome roadmap

Status: derived product roadmap. The complete 151-case evidence comparison is retained in the current branch as [goreleaser-evidence-census.md](./goreleaser-evidence-census.md). This document references census case IDs and gives every case a current outcome and disposition.

## Two-document audit structure

The comparison is intentionally split:

1. **Evidence census:** all 151 source cases with separate columns for GoReleaser, current ts-release, ts-release v0.0.7, and the rewrite proposal.
2. **Derived roadmap:** user outcomes and product disposition, with census IDs as an auditable crosswalk.

The roadmap does not replace the census. The census does not dictate product scope merely because a mechanism exists.

## Evidence pins

- Complete census and current ts-release comparison pin: `1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3`.
- ts-release v0.0.7 pin: `af59436cff908fb52773cf18dd95d154f892b8de`.
- GoReleaser evidence pin retained by the census: `cab7c6ef5d4ffc2429828f031ff7bb4645de7dad`.
- Additional current GoReleaser review pin used by the derived roadmap: [`92453c1dbdf592d227cb236600093a503f2351f3`](https://github.com/goreleaser/goreleaser/tree/92453c1dbdf592d227cb236600093a503f2351f3).

## Fixed shipping rewrite scope

The shipping rewrite includes:

1. npm;
2. PyPI/Warehouse;
3. GitHub Releases and release assets;
4. Homebrew formulas;
5. Scoop; and
6. arbitrary custom providers.

This list is fixed. The roadmap classifies other outcomes without reopening the shipping set.

## Outcome facets

Every maintained outcome is evaluated independently for:

| Code | Facet | Question |
| --- | --- | --- |
| `A` | Provider acceptance | Did the provider accept the intended mutation or coordinate? |
| `M` | Public or authoritative metadata | Does a fresh read show the intended metadata and pointers? |
| `B` | Intended byte identity | Do provider-visible bytes or digests match the finalized bundle? |
| `C` | Consumer behavior | Can a clean consumer discover, install, download, import, or execute the release? |
| `J` | Continuation | Can response loss or process death continue without blind repetition? |

One green outcome does not imply the others. Missing consumer evidence remains `NotObserved` and never causes provider replay.

## Shipping outcome roadmap

| Outcome | Census cases | A | M | B | C | J | Product disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Finalized immutable release bundle and canonical plan | C006, C048, C053, P025 | n/a | canonical manifest | canonical digests | local readers | same bundle reused | Structural shipping behavior |
| Native npm version and dist-tag publication | C071, P005 are contrast-only wrapper rows | version/tag receipts | registry version and tag facts | tarball integrity/shasum | clean install and import/CLI | per-Intent recovery | Shipping first-party built-in |
| Native PyPI/Warehouse publication | C024-C025 are contrast-only builder rows | one receipt per file | Simple API file facts | filename/size/SHA-256 | clean install/import/CLI | partial per-file continuation | Shipping first-party built-in |
| GitHub Releases and assets | C060-C061 | release and per-asset receipts | release/tag/asset reads | asset digest or downloaded bytes | public download/execute | lost-response reconciliation | Shipping first-party built-in |
| Homebrew formulas | C085 | conditional tap ref receipt | formula path and ref | referenced archive checksums | `brew install` and smoke | conditional Git reconciliation | Shipping first-party built-in |
| Scoop | C077 | conditional bucket ref receipt | manifest path and ref | URL/hash identity | clean Scoop install and smoke | conditional Git reconciliation | Shipping first-party built-in |
| Arbitrary custom providers | C083; C066-C068 and C081-C082 are destination examples | provider-defined | provider-defined | provider-defined | provider-defined | provider-declared uncertainty laws | Shipping extension capability |
| Non-manual ts-release self-release | Derived acceptance gate, not one census mechanism | all required receipts or equivalent observations | public metadata | public bytes match bundle | clean consumers run released ts-release | one interrupted coordinate continues | Decisive integrated gate |

Native npm and native PyPI remain first-class ts-release outcomes even though GoReleaser's relevant rows describe wrapper packages and Python builders rather than native publication. The census records those differences instead of pretending feature equivalence.

## Supporting and non-shipping outcomes

| Outcome | Census cases | Classification | Direction |
| --- | --- | --- | --- |
| Build matrices and language builders | C015-C031, P028 | Adjacent composition | effect-build or another producer returns owned outputs. |
| Archives, installers, and system packages | C032-C047, P002-P003, P009, P016-P017, P029 | Adjacent or later provider-specific work | Produce artifacts outside the durable mutation kernel, then adopt them. |
| SBOM, signing, notarization, and attestations | C052, C054-C057, C079, P006 | Adjacent composition | Carry artifacts and service receipts without universal signing APIs. |
| Homebrew casks | C070, P014 | Later product work | Different renderer and consumer law; not part of formula shipping scope. |
| Other feeds and release providers | C062-C063, C066-C069, C072-C076, C078, C081-C082, P010, P015, P030 | Custom provider or later built-in | Explicit provider implementation and endpoint laws required. |
| Announcements and repository project management | C084, C087-C101, P019 | Intentionally outside core | Compose after durable release completion. |
| CI hosts | C102-C115 | Evidence environment/integration | Run ts-release; do not become provider outcomes. |

## Exhaustive census crosswalk

Every `C001-C115` and `P001-P036` case appears exactly once below. This table is the audit bridge from the complete comparison to the product roadmap.

| Roadmap bucket | Census case IDs | Disposition | Derived treatment |
| --- | --- | --- | --- |
| Configuration and orchestration mechanisms | C001-C014, P004, P008, P011, P018, P020-P022, P031, P033-P034 | Taxonomy/mechanism or ordinary configuration | Keep only laws needed by the release plan, canonical Intents, dependency graph, and application configuration. Do not copy every YAML surface as a product outcome. |
| Build systems and producer outputs | C015-C031, P028 | Adjacent composition | effect-build or another producer creates owned outputs. ts-release adopts finalized outputs; it does not absorb every language builder. |
| Packaging and installer construction | C032-C047, P002-P003, P009, P016-P017, P029 | Adjacent composition or later provider-specific work | Archives, installers, system packages, app bundles, and images are produced outside the durable mutation kernel unless a later maintained package earns its own laws. |
| Checksums, SBOM, signing, and notarization | C048-C057, P006 | Structural or adjacent composition | Bundle digests are structural. Checksum files, SBOMs, signatures, and notarization compose as owned artifacts or external service outcomes. |
| Publish-phase and hook mechanisms | C058-C059, P012-P013, P024, P032 | Taxonomy/mechanism | Represent provider dispatch and extension packages directly. A hook or phase name is not itself a provider outcome. |
| GitHub Releases and assets | C060-C061 | Shipping first-party built-in | Ship provider-local release and asset Intents, receipts, observations, response-loss recovery, public bytes, and consumer download evidence. |
| Other SCM release providers | C062-C063 | Arbitrary custom provider or later first-party package | GitLab and Gitea do not replace the fixed GitHub built-in commitment. |
| Snapshots and nightlies | C064-C065, P027 | Later product policy | Policy over versioning, retention, and destination selection; not required to define the shipping provider set. |
| Generic blobs and external feeds | C066-C069, C081-C082, P010, P015, P030 | Arbitrary custom provider or later first-party package | Each store or feed needs explicit implementation identity, endpoint identity, receipt, observation, and uncertainty laws. |
| Homebrew casks | C070, P014 | Later product work | Casks have different rendering and installation laws. They are not part of the fixed formula shipping commitment. |
| npm wrapper packages | C071, P005 | Later product work or adjacent build | GoReleaser wrapper packages are not native npm publication. Native npm remains a fixed shipping built-in even though the census rows are contrast evidence only. |
| Other package catalogs | C072-C076, C078 | Arbitrary custom provider or later first-party package | Winget, AUR, Nix, Krew, and MCP Registry remain outside the fixed first-party set. |
| Scoop | C077 | Shipping first-party built-in | Ship Scoop manifest rendering, conditional bucket Git publication, reconciliation, and clean Windows consumer evidence. |
| Attestations | C079 | Adjacent composition | Carry attestation artifacts and provider receipts without inventing a universal signing or provenance service. |
| Changelog and release notes | C080, P007, P023, P026 | Adjacent composition | ts-release may carry finalized text; generation and preview policy are neighboring concerns. |
| Arbitrary custom providers | C083 | Shipping capability | Ship the open provider contract and dynamic Node library/config boundary. Do not add a central allowlist or certification registry. |
| Closing milestones and PR UI | C084, P019 | Intentionally outside the durable release kernel | Repository project-management and PR presentation are not provider publication outcomes. |
| Homebrew formulas | C085 | Shipping first-party built-in | Ship formula rendering, conditional tap Git publication, reconciliation, and clean Homebrew install/execute evidence. |
| Published-asset acceptance and verify terminology | C086, P001 | Acceptance taxonomy/mechanism | Replace one generic verify phase with explicit provider acceptance, metadata, byte identity, consumer behavior, and evidence environments. |
| Announcements | C087-C101 | Intentionally outside ts-release core | Announcements compose after durable release outcomes and do not participate in mutation recovery. |
| CI integrations | C102-C115 | Integration/documentation surface | CI hosts run the product; they are evidence environments, not separate release-provider outcomes. |
| Durable staged continuation | P025 | Structural shipping behavior | The canonical release plan, finalized bundle, and append-only journal provide continuation without blind repetition. |
| Pro licensing | P035-P036 | Intentionally outside ts-release | Commercial license transport is unrelated to the open ts-release provider model. |

## Acceptance environments

Each claimed outcome is paired with an evidence environment:

| Environment | Typical evidence |
| --- | --- |
| `compile` | Schema, type, and static-law checks |
| `in-process` | Disposable runtime and state-fold tests |
| `clean-consumer` | Fresh package installation from packed artifacts |
| `protocol-double` | Deterministic provider acceptance and response-loss traces |
| `scratch-provider` | Authorized real-provider namespace |
| `public-provider` | Public metadata and byte observation |
| `end-user` | Representative Homebrew, Scoop, npm, or Python consumer host |
| `self-release` | Rewritten ts-release releases and consumes itself |

A roadmap row is not complete merely because one environment is green. Each evidence record names outcome, environment, subject, result, and limitations.

## Audit rules

1. The evidence census remains complete and current in the branch.
2. The roadmap references census IDs rather than replacing them with prose memory.
3. Every census case maps to one exhaustive crosswalk disposition.
4. Native npm and native PyPI additions are explicit even without native GoReleaser equivalents.
5. A mechanism such as retry, hook, phase, verify, template, or CI integration is not promoted into a user outcome by default.
6. Homebrew formulas and Scoop are fixed shipping built-ins, not optional catalog examples.
7. Arbitrary custom providers are a shipping capability, not only future extensibility.

## Conclusions

1. The 151-case comparison and the outcome roadmap are both retained.
2. The census provides GoReleaser/current-ts-release/v0.0.7/rewrite traceability.
3. The roadmap provides product disposition with an exhaustive case-ID crosswalk.
4. Shipping scope is fixed to npm, PyPI/Warehouse, GitHub Releases/assets, Homebrew formulas, Scoop, and arbitrary custom providers.
5. Provider acceptance, metadata, bytes, consumer behavior, and continuation remain separate claims.
6. The decisive gate is a non-manual self-release through the rewritten product.
