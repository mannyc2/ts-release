# Canonical competitive-scope ledger

Status: canonical scope ledger for PR #19. Other research documents project from this file and must not maintain independent scope lists.

## Counting rules

An outcome family is counted once even when several packages or platforms implement it. Counts describe product outcomes, not package count or implementation stages.

The fixed distribution scope has 6 families. The recommended initial competitive scope adds 10 artifact-production/trust families and 3 AI-native distribution families, for 19 initial outcome families total. Only the first 6 are already fixed product decisions; the additional 13 are research recommendations whose exact delivery depth remains a maintainer choice.

Six destination-only provider packages are explicitly deferred.

## A. Fixed shipping distribution outcomes: 6

| ID | Outcome | Initial owner direction | Status |
| --- | --- | --- | --- |
| D01 | Native npm package-version publication and dist-tag management | ts-release npm integration | Fixed shipping |
| D02 | Warehouse/PyPI-compatible per-file distribution publication | ts-release Warehouse integration, compatible implementations named explicitly | Fixed shipping |
| D03 | GitHub tag/ref, release-resource, and release-asset publication | ts-release GitHub integration | Fixed shipping |
| D04 | Homebrew formula rendering and conditional Git publication | renderer may compose with effect-build; mutation/recovery in ts-release Git integration | Fixed shipping |
| D05 | Scoop manifest rendering and conditional Git publication | renderer may compose with effect-build; mutation/recovery in ts-release Git integration | Fixed shipping |
| D06 | Arbitrary custom-provider composition and fresh-runner continuation | user package/application plus Layers; no core allowlist | Fixed shipping |

Homebrew casks are not silently included in D04. Formula and cask semantics differ. Casks remain later product work unless separately promoted.

## B. Recommended initial artifact-production and trust outcomes: 10

These outcomes affect the artifact/lifetime boundary enough that postponing all of them risks freezing an executable-only model. The recommendation is to exercise each family before calling the rewrite architecture complete. This does not imply a universal `Builder`.

| ID | Outcome | Boundary recommendation | Confidence |
| --- | --- | --- | --- |
| P01 | Executable target matrices | existing effect-build compiler integrations | High |
| P02 | Binary/general archives | concrete effect-build transformation | High |
| P03 | Source archives from an explicit source snapshot | effect-build transformation; ts-release supplies release-owned source identity | Moderate |
| P04 | Wheels and sdists through uv and Poetry | concrete effect-build integrations; Warehouse publication remains ts-release | High |
| P05 | nFPM/system packages such as deb, rpm, apk, ipk, Arch Linux, and MSIX | concrete effect-build integration | High |
| P06 | macOS app bundles | concrete effect-build Apple packaging integration | High |
| P07 | DMG construction | concrete effect-build Apple packaging integration | High |
| P08 | macOS pkg construction | concrete effect-build Apple packaging integration | High |
| P09 | Local artifact signing, including codesign/productsign and package-format signing | concrete effect-build transformations with scoped credential services | Moderate |
| P10 | Remote notarization and stapling | architecture-shaping cross-boundary flow; final owner unresolved | Moderate |

P10 is deliberately separate from P09. Notarization is an external, potentially long-running mutation whose result can be lost, while stapling changes final bytes. It therefore challenges a model in which every external mutation occurs only after the immutable release bundle is finalized.

## C. Recommended initial AI-native outcomes: 3

Official OpenAI documentation, accessed 2026-08-16, defines plugins as packages with `.codex-plugin/plugin.json` and optional skills, MCP configuration, assets, and hooks. Local and repository marketplaces are separate from the universal public directory.

| ID | Outcome | Automation boundary | Status |
| --- | --- | --- | --- |
| A01 | Build a valid OpenAI plugin/skills package | artifact production; concrete effect-build integration or ordinary Effect | Recommended initial |
| A02 | Publish/update a local or repository marketplace entry | file or conditional Git publication; ts-release can automate | Recommended initial |
| A03 | Produce and validate a public-submission handoff | ts-release can assemble listing data, skill bundle, test cases, release notes, and policy inputs; a human uses the OpenAI portal | Recommended initial |

The public Plugin Directory is not currently modeled as an API-backed provider. Official publication requires portal submission, OpenAI review, approval, and a developer-initiated publish action. Inventing an automated provider would overstate the available protocol.

Primary sources:

- https://developers.openai.com/plugins/build/plugins
- https://developers.openai.com/plugins/deploy/submission
- https://help.openai.com/en/articles/20001256-plugins-in-codex
- https://help.openai.com/en/articles/20001066-skills-in-chatgpt

## D. Deferred destination-only provider packages: 6

Arbitrary-provider composition must make these possible without core changes, but maintained first-party packages may follow the rewrite release:

| ID | Deferred destination |
| --- | --- |
| X01 | GitLab |
| X02 | Gitea |
| X03 | Cloudsmith |
| X04 | GemFury |
| X05 | Artifactory |
| X06 | Nexus |

## E. Later or adjacent outcomes

These remain visible but are not counted in the 19-family initial recommendation:

- Homebrew casks;
- Winget;
- OCI image build and registry publication;
- broad signing/attestation ecosystems beyond the concrete first integrations;
- nFPM repository publication after package creation;
- announcements;
- GitHub/GitLab/Gitea destination packages beyond the fixed GitHub path;
- hosted release dashboards or catalog services.

## effect-build boundary

The working law is:

```text
effect-build
  concrete artifact production and transformation
  scoped intermediate ownership
  caller-selected finalized output
  tool discovery and execution
  artifact-specific validation

ts-release
  adoption into release-owned immutable content
  release plan and provider Intent
  external publication mutation
  durable journal and continuation
  provider-native receipts and observations
  release reporting
```

The effect-build branch currently says it is not a generic build orchestrator or packager. That is an accurate statement of its current product surface, not proof that packaging is outside its coherent domain forever. The same branch already contains both scoped JavaScript-bundle transformation and `produceExecutable` publication to a caller-selected final path.

Expansion is justified only through concrete, independently useful integrations such as uv, Poetry, nFPM, and Apple packaging. No universal builder service follows from the fact that all produce files.

Pinned effect-build source:

- https://github.com/mannyc2/effect-build/tree/15c811bb9904142a33d119766b62082f3c689f13
- https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build/src/Integration.ts
- https://github.com/mannyc2/effect-build/blob/15c811bb9904142a33d119766b62082f3c689f13/packages/effect-build/src/JavaScriptBundle.ts

Relevant current GoReleaser product evidence:

- https://www.goreleaser.com/customization/package/nfpm/
- https://www.goreleaser.com/customization/package/app_bundles/
- https://www.goreleaser.com/customization/package/dmg/
- https://goreleaser.com/customization/package/pkg/
- https://goreleaser.com/customization/sign/notarize/
