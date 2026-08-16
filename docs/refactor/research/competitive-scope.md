# Canonical competitive-scope ledger

Status: canonical scope ledger for the rewrite research. Every other document links to or projects from this file; no peer document owns an independent count.

## Counting rule

An outcome family is counted once even when several tools, packages, platforms, or validation environments implement it. Acceptance scope is not implementation order.

```text
vNext acceptance:                    16
  fixed distribution:                 6
  artifact production and trust:     10

architecture-proved only:             3
  AI-native package/handoff:           3

deferred destination packages:        6
```

The 16 vNext families are release acceptance requirements. The AI-native trio must be shown compatible with the architecture but is not a vNext product commitment. The six destination-only packages remain deferred because arbitrary-provider composition prevents them from requiring core changes.

## A. vNext fixed distribution outcomes: 6

| ID | Outcome | Owner direction |
| --- | --- | --- |
| D01 | Native npm package-version publication and dist-tag management | ts-release npm integration |
| D02 | Warehouse/PyPI-compatible per-file publication | ts-release Warehouse integration; compatible implementations named explicitly |
| D03 | GitHub tag/ref, release-resource, and release-asset publication | ts-release GitHub integration |
| D04 | Homebrew formula rendering and conditional Git publication | rendering may compose with effect-build; remote mutation/recovery in ts-release Git integration |
| D05 | Scoop manifest rendering and conditional Git publication | rendering may compose with effect-build; remote mutation/recovery in ts-release Git integration |
| D06 | Arbitrary custom-provider composition and fresh-runner continuation | application/provider packages plus Layers; no core allowlist |

Homebrew casks are not silently included in D04.

## B. vNext artifact-production and trust outcomes: 10

These families are in acceptance because postponing them would freeze an executable-only artifact model. They justify concrete integrations, not a universal `Builder`.

| ID | Outcome | Boundary decision |
| --- | --- | --- |
| P01 | Executable target matrices | concrete effect-build compiler integrations |
| P02 | Binary/general archives | concrete effect-build archive transformation |
| P03 | Source archives from an explicit source snapshot | concrete effect-build transformation; ts-release adopts finalized bytes |
| P04 | Wheels and sdists through uv and Poetry | concrete effect-build integrations; Warehouse publication remains ts-release |
| P05 | nFPM/system packages such as deb, rpm, apk, ipk, Arch Linux, and MSIX | concrete effect-build integration |
| P06 | macOS app bundles | `effect-build-apple` |
| P07 | DMG construction | `effect-build-apple` |
| P08 | macOS pkg construction | `effect-build-apple` |
| P09 | Local artifact signing, including codesign/productsign and format signing | concrete effect-build transformations with scoped credential services |
| P10 | Apple notarization, stapling, and verification | `effect-build-apple`; an artifact is not finalized until this sequence completes |

P10 resolves the earlier phase tension by definition. Notary submission, polling by Apple submission identifier, stapling, and final verification are internal artifact-production work. ts-release never adopts the pre-stapled artifact as final and does not need pre-finalization journal state.

## C. Architecture-proved only: AI-native outcomes, 3

| ID | Outcome | Required proof in this rewrite | Product status |
| --- | --- | --- | --- |
| A01 | Construct a valid OpenAI plugin/skills package | ordinary artifact production can represent the directory and validation result | architecture-proved only |
| A02 | Construct or update a local/repository marketplace entry | ordinary file/Git output can represent it without a new provider law | architecture-proved only |
| A03 | Validate a public-submission handoff directory | pure validator over package, listing metadata/assets, release notes, attestations, and required positive/negative tests | architecture-proved only |

A03 is never a publication provider. Official public publication is a reviewed human portal flow unless a future official protocol proves otherwise.

Primary sources:

- https://developers.openai.com/plugins/build/plugins
- https://developers.openai.com/plugins/deploy/submission
- https://help.openai.com/en/articles/20001256-plugins-in-codex
- https://help.openai.com/en/articles/20001066-skills-in-chatgpt

## D. Deferred destination-only packages: 6

| ID | Deferred destination |
| --- | --- |
| X01 | GitLab |
| X02 | Gitea |
| X03 | Cloudsmith |
| X04 | GemFury |
| X05 | Artifactory |
| X06 | Nexus |

D06 is the architectural requirement that keeps these deferred packages from forcing later core changes.

## E. Later or adjacent outcomes

Not counted in 16, 3, or 6:

- Homebrew casks;
- Winget;
- OCI image build and registry publication;
- broad signing/attestation ecosystems beyond the concrete first integrations;
- nFPM repository publication after package creation;
- announcements;
- hosted release dashboards or catalog services.

## effect-build / ts-release boundary

```text
effect-build
  concrete artifact production and transformation
  scoped intermediate ownership
  caller-selected finalized output
  tool discovery and execution
  artifact-specific validation
  Apple notarization/stapling before finalization

ts-release
  adoption into release-owned immutable content
  release planning and provider Intent
  provider mutation through durable dispatch evidence
  journal/recovery
  provider-native receipts and observations
  release reporting
```

The current effect-build statement that it is not a generic packager describes its present surface, not an eternal domain prohibition. Expansion proceeds only through concrete integrations such as archive, uv, Poetry, nFPM, and Apple. Similarity of outputs does not establish a shared Builder law.

The immutable-content/bundle kernel remains an internal, extraction-ready ts-release library. It imports nothing from planning or providers and does not move into effect-build. Packaging that library separately is revisited only if effect-build planning converges on direct emission into the same kernel.

Pinned effect-build source:

- https://github.com/mannyc2/effect-build/tree/15c811bb9904142a33d119766b62082f3c689f13
