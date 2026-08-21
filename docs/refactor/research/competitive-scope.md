# Competitive scope projection

Status: derived product view for the PR #20 research checkpoint. The sole
atomic scope authority is [`launch-scorecard.md`](launch-scorecard.md). If a
count, disposition, owner, dependency, fixture, or acceptance oracle here
drifts from an atomic row, the scorecard wins.

## Current finite shape

```text
launch candidates:                         79
  selected vNext leaves:                   69
    core delivery and reporting:            3
    provider and distribution:             35
    artifact production and trust:         28
    OpenAI plugin delivery:                  3
  unresolved candidate leaves:             10

deferred maintained destination packages:   7
named later-model leaves:                   20
```

This is not a claim that 69 independent abstractions are needed. It is an
acceptance decomposition: each leaf names one observable user outcome, a
finite fixture, and the evidence required to call it complete. Shared laws are
represented once by prerequisites `R01-R07`, not copied into capability
interfaces.

## Selected launch outcomes

### Core delivery and reporting: 3 leaves

- `K01`: a machine-readable release report projected from canonical bundle,
  plan, and journal facts;
- `K02`: fresh-runner continuation of a complete multi-provider release
  without blind mutation;
- `K03`: a packed first-party GitHub Action and a genuinely non-manual
  ts-release self-release.

These are product outcomes. A generic `verify`, `ConsumerScenario`, release
mode, or certification layer is not introduced.

### Provider and distribution: 35 leaves

| Family | Atomic leaves | Selected boundary |
| --- | ---: | --- |
| `D01` native npm | 6 | native tarballs, OIDC/provenance, dist-tags, plural workspaces, structural private omission, and lost-response continuation |
| `D02` Python indexes | 7 | per-file Warehouse/PyPI, trusted publishing, plural distributions, separately proven pypiserver/devpi behavior, and honest ambiguous continuation |
| `D03` GitHub | 6 | tag/ref, release resource, plural assets, publication, and distinct lost-response paths for releases and assets |
| `D04` Homebrew Formula | 3 | render, conditional Git publication, and fresh-runner continuation |
| `D05` Scoop | 3 | render, conditional Git publication, and fresh-runner continuation |
| `D06` custom providers | 7 | ordinary imports/Layers, durable codecs, core HTTP/Git or opaque Effect dispatch, native durable values, multiple instances, and fresh-runner honesty |
| `D07` MCP Registry | 3 | manifest, registry publication, and ambiguous-completion continuation |

Consumer installation, import, discovery, download, and execution appear in
the evidence facet `C`. They are not capabilities supplied to providers and
do not become journal events merely because they are valuable acceptance
evidence.

### Artifact production and trust: 28 leaves

The selected artifact side is deliberately concrete:

- prebuilt adoption plus the exact Bun, Deno, and Node SEA matrices already
  expressed by the pinned effect-build branch;
- deterministic ZIP and tar.gz binary archives, including malicious-layout
  rejection;
- ZIP and tar.gz source archives from an exact Git tree;
- one pinned `uv build` frontend exercised against `uv_build` and
  `poetry-core` projects;
- deb, rpm, apk, Arch, and unsigned MSIX production;
- macOS app bundles, DMGs, pkgs, Developer ID signing, and Windows MSIX
  Authenticode mechanics;
- Apple submission, fresh-runner polling, stapling, and Gatekeeper
  verification;
- deterministic SHA-256 checksums and SPDX/CycloneDX SBOMs through pinned
  Syft.

The ownership boundary is structural:

```text
effect-build
  concrete tool execution and artifact transformation
  tool-specific inputs, intermediates, and validation
  finalized outputs returned to the caller

ts-release
  immutable adoption and logical release identity
  versioned provider Intents and provider mutation
  durable journal, continuation decisions, and reports
  integrated release acceptance
```

Apple notarization crosses that boundary without creating two histories.
effect-build-apple owns the concrete notary operations; ts-release owns the
release journal and continuation. If Apple accepts a submission before its ID
is durably recorded and no authoritative correlation API closes the gap, the
truthful result is `Inconclusive`.

### OpenAI plugin delivery: 3 leaves

AI-native delivery is launch scope, not an architecture-only footnote:

- `AI01`: construct and validate an installable skills-only OpenAI plugin;
- `AI02`: create or update a repository marketplace entry through conditional
  Git state;
- `AI03`: produce and validate the complete public-submission handoff.

The final public portal review remains a human external action. The handoff
validator must not report provider success for an action no protocol performed.

## Nine launch-shaping maintainer decisions

Ten atomic decision leaves reduce to nine choices because MSI construction and
MSI signing move together.

| Decision | Leaves | Provisional recommendation |
| --- | --- | --- |
| include ipk/OpenWrt | `P05-04` | later unless embedded distribution is a product goal |
| include MSI and choose its toolchain | `P05-07`, `P09-04` | later; selected MSIX already covers a Windows installer |
| detached OpenPGP signatures | `P09-05` | later absent demand |
| keyless Cosign blob signatures | `P09-06` | later until identity and transparency policy are selected |
| OCI image/index publication | `Q03` | later; it adds a producer and destination protocol |
| hosted nightly publication | `Q05-02` | later; local no-dispatch builds already fall out structurally |
| derived SemVer proposal | `Q06-01` | later; accept an explicit version first |
| derived release notes | `Q06-02` | later; accept explicit notes first |
| macOS universal executable | `Q07` | later unless one universal download is a launch promise |

None of these choices blocks the selected 69 leaves from being specified or
implemented. Accepting one changes the scorecard disposition; it must not add
a mode or a second scope ledger.

## Deferred and later destinations

The maintained provider packages explicitly deferred until after vNext are
GitLab, Gitea, Cloudsmith, GemFury, Artifactory, Nexus, and Iru (`X01-X07`).
The custom-provider acceptance fixture must demonstrate that each could be
implemented without a core allowlist or sealed provider union.

The 20 named later leaves retain real product possibilities without pretending
they are launch acceptance. They include Homebrew Casks, Winget, source RPM,
npm wrapper packages, makeself/NSIS, Snapcraft/Flatpak/Chocolatey, AUR/NUR/Krew,
another AI registry, a named blob destination, Docker Hub metadata, AI-assisted
notes, additional compiler/transformation integrations, and independent-project
monorepo scoping.

## Competitive interpretation

GoReleaser mechanism names are evidence, not requirements. A row earns launch
scope when it contributes to the desired product and has an external oracle.
Conversely, a selected capability does not disappear merely because
GoReleaser expresses it differently. The exact historical mapping lives in
[`goreleaser-evidence-census.md`](goreleaser-evidence-census.md), and the
outcome-oriented reading lives in
[`goreleaser-outcomes.md`](goreleaser-outcomes.md).
