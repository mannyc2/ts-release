# GoReleaser-derived outcome roadmap

Status: derived projection. Evidence authority remains `goreleaser-evidence-census.md`, `goreleaser-material-evidence.md`, and `goreleaser-material-evidence-2.md`. Scope authority is `competitive-scope.md`.

## Outcome facets

| Code | Outcome |
| --- | --- |
| `A` | provider accepted the intended mutation |
| `M` | public or authoritative metadata matches |
| `B` | intended byte identity is observed |
| `C` | a clean consumer discovers, installs, imports, downloads, or executes |
| `J` | interruption continues without blind repetition |

`C` remains a competitive evidence dimension, not a provider capability or journal event.

## Canonical scope projection

This document does not repeat independent package lists or counts.

```text
D01-D06 + P01-P10
  -> 16 vNext acceptance outcome families

A01-A03
  -> 3 architecture-proved-only AI-native outcomes

X01-X06
  -> 6 deferred destination packages
```

See `competitive-scope.md` for names and ownership.

## Distribution roadmap

| Outcome | Evidence groups | A | M | B | C | J | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| immutable bundle and plan | G01, G03, G21 | n/a | canonical manifest | content digests | local readers | same finalized bytes reused | structural vNext behavior |
| native npm | N01; G10 contrast | registry receipt | version + tag facets | tarball integrity/shasum | install/import/bin | observation; no immutability-only replay | D01 vNext |
| native Warehouse | N02; G02 contrast | one receipt/file | Simple API facts | filename/size/hash | install/import/entrypoint | per-file continuation and pinned exact-duplicate law | D02 vNext |
| GitHub tag/release/assets | G06 | separate operation receipts | complete reads | returned/downloaded digest | download/execute | observation after lost response | D03 vNext |
| Homebrew formulas | G16 | conditional ref receipt | path/ref/rendered facts | archive checksums | brew install/smoke | core Git CAS | D04 vNext |
| Scoop | G12 | conditional ref receipt | manifest path/ref | URL/hash identity | install/smoke | core Git CAS | D05 vNext |
| arbitrary custom provider | G14 | provider-defined | optional | optional | application-defined | core-transport or capability-bounded | D06 vNext |
| non-manual self-release | project decision | required operations accepted/observed | public facts | public bytes equal bundle | clean product execution | injected interruption continues | decisive integrated gate |

## Artifact-production/trust projection

P01-P10 are vNext acceptance outcomes, not adjacent work:

- executable matrices;
- binary and source archives;
- uv/Poetry wheels and sdists;
- nFPM/system packages;
- Apple app bundles, DMGs, and pkgs;
- local signing;
- Apple notarization, stapling, and verification.

These do not become ts-release provider packages. Concrete effect-build integrations own production/transformation; ts-release adopts finalized bytes. P10 is complete only after `effect-build-apple` finishes notary recovery, stapling, and verification.

## AI-native projection

A01-A03 are architecture proofs only, not vNext acceptance or publication providers:

- represent a plugin/skills package directory;
- represent local/repository marketplace files or Git updates;
- validate a human submission-handoff directory.

The handoff validator is pure. Official public publication remains a reviewed human portal flow unless future official protocol evidence changes the boundary.

## Deferred provider packages

X01-X06 remain deferred maintained packages. D06 must prove they can be added by application/provider packages without core change.

## GoReleaser Verify disposition

GoReleaser Verify demonstrates explicit outcomes:

```text
public asset downloadable
downloaded bytes match intended content
signature/checksum command succeeds
image digest/command succeeds
```

Those are byte/public-consumer evidence, not a universal phase or `ConsumerScenario` capability.

Source:

- https://goreleaser.com/customization/verify/

## Native npm and Python distinctions

GoReleaser npm cases generate wrappers that download SCM archives; ts-release D01 publishes the user's native npm tarball. GoReleaser Python builders produce wheels/sdists, while D02 requires provider-native per-file Warehouse publication and recovery. P04 owns production; D02 owns distribution.

## Census disposition projection

The existing complete crosswalk remains valid with these updated dispositions:

- G02/G03 production cases project to P01-P10 or later concrete producers, not generic adjacent work;
- G06 projects GitHub to D03 and GitLab/Gitea packages to X01/X02;
- G08/G11 destination cases remain custom-provider or deferred/later packages;
- G12 and G16 project to D05 and D04;
- G14 projects to D06;
- G17 remains explicit public-byte/signature evidence;
- G21 remains structural journal continuation;
- announcements, project management, licensing, and unrelated CI-host features remain outside the durable kernel.

No evidence row becomes stronger merely because its disposition changed. `INDEX` evidence remains `INDEX`.

## Implementation evidence progression

| Claim | Earliest useful evidence | Decisive evidence |
| --- | --- | --- |
| bundle/plan law | compile + in-process | self-release uses same finalized bytes |
| provider normal success | protocol double | scratch/public receipt |
| response-loss recovery | fault-injected double | controlled live/scratch loss |
| public byte identity | provider digest/download | self-release public bytes |
| consumer behavior | clean local consumer | representative end-user/self-release |
| custom continuation | two-process probe | fresh runner with real provider boundary |
| JournalStore CAS | two-process mechanism probes | backend conformance and CI/local use |
| Apple finalization | integration test | signed/notarized/stapled artifact adopted and distributed |
