# Canonical competitive-scope ledger

Status: canonical scope authority for PR #20. Other documents must reference
this file rather than repeat independent counts.

## Counts

```text
vNext acceptance:                        16
  fixed distribution outcomes:            6
  artifact production/trust outcomes:     10

architecture-proved only in vNext:         3
  AI-native outcomes:                      3

deferred destination packages:             6
```

Implementation order does not reduce acceptance scope.

## A. Fixed distribution outcomes: 6

| ID | Outcome | Ownership direction | Status |
| --- | --- | --- | --- |
| D01 | Native npm package-version publication and dist-tag management | ts-release npm integration | vNext acceptance |
| D02 | Warehouse/PyPI-compatible per-file distribution publication | ts-release Warehouse integration; compatible implementations named explicitly | vNext acceptance |
| D03 | GitHub tag/ref, release-resource, and release-asset publication | ts-release GitHub integration | vNext acceptance |
| D04 | Homebrew formula rendering and conditional Git publication | concrete renderer plus ts-release Git mutation/recovery | vNext acceptance |
| D05 | Scoop manifest rendering and conditional Git publication | concrete renderer plus ts-release Git mutation/recovery | vNext acceptance |
| D06 | Arbitrary custom-provider composition and fresh-runner continuation | user package/application plus Layers; no core allowlist | vNext acceptance |

Homebrew casks are not included in D04.

## B. Artifact production and trust outcomes: 10

| ID | Outcome | Working owner | Status |
| --- | --- | --- | --- |
| P01 | Executable target matrices | existing effect-build compiler integrations | vNext acceptance |
| P02 | Binary/general archives | concrete effect-build transformation | vNext acceptance |
| P03 | Source archives from an explicit source snapshot | concrete effect-build transformation; ts-release supplies release-owned source identity | vNext acceptance |
| P04 | Wheels and sdists through uv and Poetry | concrete effect-build integrations; Warehouse publication remains ts-release | vNext acceptance |
| P05 | nFPM/system packages such as deb, rpm, apk, ipk, Arch Linux, and MSIX | concrete effect-build integration | vNext acceptance |
| P06 | macOS app bundles | effect-build-apple | vNext acceptance |
| P07 | DMG construction | effect-build-apple | vNext acceptance |
| P08 | macOS pkg construction | effect-build-apple | vNext acceptance |
| P09 | Local signing, including codesign/productsign and format-specific signing | concrete effect-build transformations | vNext acceptance |
| P10 | Remote notarization, polling/recovery, stapling, and final verification | effect-build-apple | vNext acceptance; durable recovery design unresolved |

P10 ownership is decided, but its fresh-process durable design is not. The scope
ledger must not turn ownership into a false claim of completed architecture.

## C. AI-native outcomes: 3 architecture proofs

These do not block vNext release acceptance.

| ID | Outcome | Boundary | Status |
| --- | --- | --- | --- |
| A01 | Construct a valid OpenAI plugin/skills package | artifact production or ordinary Effect | architecture proof only |
| A02 | Publish/update a local or repository marketplace entry | file/Git publication | architecture proof only |
| A03 | Validate a public-submission handoff directory | pure validator over package, listing metadata/assets, release notes, attestations, and required positive/negative tests | architecture proof only; never a publication provider |

## D. Deferred maintained destination packages: 6

```text
X01 GitLab
X02 Gitea
X03 Cloudsmith
X04 GemFury
X05 Artifactory
X06 Nexus
```

Arbitrary-provider composition must allow these without core changes.

## E. Later or adjacent outcomes

- Homebrew casks;
- Winget;
- OCI images and registries;
- broader signing/attestation ecosystems;
- nFPM repository publication;
- announcements;
- hosted dashboards/catalog services.

## Responsibility boundary

```text
effect-build
  concrete production/transformation
  scoped intermediates and caller-selected outputs
  producer/tool-specific validation

ts-release
  immutable adoption
  release planning
  provider mutation
  durable journal/recovery
  reporting
```

The immutable artifact-handoff kernel remains an internal extraction-ready
library inside ts-release. This is a packaging-sequence decision, not a denial
of its generic laws.
