# GoReleaser-derived outcome roadmap

Status: derived product roadmap. It is not the evidence authority by itself.

## Audit structure

- [goreleaser-evidence-census.md](./goreleaser-evidence-census.md) retains all 151 cases with separate GoReleaser, current ts-release, v0.0.7, and historical rewrite-proposal columns.
- [goreleaser-material-evidence.md](./goreleaser-material-evidence.md) and [goreleaser-material-evidence-2.md](./goreleaser-material-evidence-2.md) assign current primary evidence and grades to material feature groups.
- [competitive-scope.md](./competitive-scope.md) is the canonical current capability ledger.
- This document derives product outcomes and maps every census case to one evidence group and disposition.

Older parity documents remain source-link indexes. Their dispositions are superseded where current provider research or the canonical scope ledger is more specific.

## Outcome facets

| Code | Outcome |
| --- | --- |
| `A` | provider accepted the intended mutation |
| `M` | public or authoritative metadata matches |
| `B` | intended byte identity is observed |
| `C` | a clean consumer discovers, installs, imports, downloads, or executes |
| `J` | interruption continues without blind repetition |

A row can satisfy one facet while another remains `NotObserved`.

`C` is a competitive evidence dimension, not a provider capability or mutation-journal event. Consumer tests are application/CI policy.

## Evidence environments

```text
compile
in-process
clean-consumer
protocol-double
scratch-provider
public-provider
end-user
self-release
```

A green protocol double does not prove provider acceptance. A provider receipt does not prove clean consumer behavior.

## Fixed distribution outcomes

The fixed six distribution families are referenced, not redefined, here:

- D01-D06 in [competitive-scope.md](./competitive-scope.md).

## Shipping outcome roadmap

| Outcome | Evidence group / census | A | M | B | C | J | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| immutable artifact bundle and canonical plan | G01, G03, G21 / C006, C032-C048, P025 | n/a | canonical manifest | content digests | local readers | same bundle reused | structural shipping behavior |
| native npm publication | N01; G10 is contrast / C071, P005 | npmjs/compatible-registry receipt | version and initial/later tag facts | tarball integrity/shasum | clean install/import/bin | provider observation or recorded protection | fixed first-party built-in |
| native Warehouse/PyPI publication | N02; G02 is contrast / C024-C025 | one receipt per file | Simple API file facts | filename/size/hash | clean install/import/bin | per-file continuation | fixed first-party built-in |
| GitHub tag, release, and assets | G06 / C060-C061 | provider-native receipts | complete reads | returned digest or downloaded bytes | public download/execute | lost-response reconciliation | fixed first-party built-in |
| Homebrew formulas | G16 / C085 | conditional tap ref receipt | formula path/ref/rendered facts | referenced archive checksums | `brew install` and smoke | conditional Git replay/reconciliation | fixed first-party built-in |
| Scoop | G12 / C077 | conditional bucket ref receipt | manifest path/ref | URL/hash identity | clean Scoop install and smoke | conditional Git replay/reconciliation | fixed first-party built-in |
| arbitrary custom provider | G14 plus G08/G11 examples / C083 | provider-defined | optional | optional | application-policy-defined | capability-bounded continuation | fixed extension capability |
| non-manual ts-release self-release | project decision | required mutations accepted or observed equivalent | public facts | public bytes equal bundle | clean consumers run ts-release | injected interruption continues | decisive integrated gate |

## Artifact-production roadmap projection

The initial architecture-shaping production/trust outcomes are P01-P10 in `competitive-scope.md`:

- executable matrices;
- general and source archives;
- uv/Poetry wheel and sdist production;
- nFPM/system packages;
- app bundles, DMGs, and macOS pkgs;
- local signing;
- remote notarization/stapling.

These are not all ts-release provider packages. The working boundary is concrete effect-build production/transformation plus ts-release adoption and durable external publication.

## AI-native projection

The initial AI-native outcomes are A01-A03 in `competitive-scope.md`:

- OpenAI plugin/skills package construction;
- local/repository marketplace publication;
- validated public-submission handoff.

Official public Plugin Directory publication remains a reviewed portal flow, not an assumed API provider.

## Structural outcomes

| Outcome | Evidence groups | Why it falls out |
| --- | --- | --- |
| zero/one/many artifacts | G02-G03 | collections, not a mode |
| multiple package or file coordinates | N01, N02 | provider-local collections |
| prebuilt or external builders | G02 | any producer can supply owned bytes |
| checksums as content facts | G04 | bundle objects already have digests |
| per-coordinate continuation | G21 | plan Intents plus journal history |
| custom provider participation | G14 | application-supplied provider definitions and Layers |
| dependencies between provider outcomes | G01, G05 | canonical dependency edges and ordinary Effect composition |

## Deferred destination packages

The maintained provider packages for GitLab, Gitea, Cloudsmith, GemFury, Artifactory, and Nexus are deferred. Arbitrary-provider composition remains fixed so these destinations require no core change.

## GoReleaser Verify user outcome

Evidence group G17 establishes the actual purpose:

- re-download published SCM release assets;
- catch broken/truncated uploads and CDN propagation failures;
- run checksum/signature or arbitrary commands over downloaded assets;
- verify images through configured commands;
- exclude package-registry-only and blob-only artifacts from automatic download.

Equivalent explicit claims are:

```text
public asset downloadable
downloaded bytes match intended content
signature/checksum command succeeds
image digest/command succeeds
```

Clean npm or PyPI install remains a separate `C` outcome. No `ConsumerScenario` abstraction follows.

Source:

- https://goreleaser.com/customization/verify/

## Native npm and PyPI distinctions

### Native npm

GoReleaser generates wrapper packages that download SCM archives during install. ts-release publishes the user's native tarball. The bytes, package metadata, provider Intent, and consumer path differ.

### Native PyPI/Warehouse

GoReleaser's Python builders produce wheels and sdists. Its documented publication path is a hook such as `uv publish` or `poetry publish`. ts-release needs provider-native per-file Warehouse publication and recovery.

## Complete census crosswalk

Every `C001-C115` and `P001-P036` case maps exactly once.

| Evidence group | Census case IDs | Derived disposition |
| --- | --- | --- |
| G01 configuration/orchestration | C001-C014; P004; P008; P011; P018; P020-P022; P031; P033-P034 | taxonomy/mechanism or ordinary application configuration |
| G02 builders/producer outputs | C015-C031; P028 | concrete effect-build/other producer composition |
| G03 packaging/transformation | C032-C047; P002-P003; P009; P016-P017; P024; P029 | P01-P10 initial architecture scope or later producer |
| G04 checksums/security metadata | C048-C057; C079; P006 | structural digest plus concrete transformations/services |
| G05 publish/hook mechanisms | C058-C059; P012-P013; P032 | taxonomy/mechanism |
| G06 SCM releases | C060-C063 | GitHub fixed; GitLab/Gitea packages deferred; custom provider open |
| G07 snapshots/nightlies | C064-C065; P027 | later release policy |
| G08 blobs/external feeds | C066-C069; C081-C082; P010; P015; P030 | custom provider or later built-in |
| G09 Homebrew casks | C070; P014 | later product work, outside fixed formula scope |
| G10 npm wrappers | C071; P005 | wrapper contrast; native npm fixed separately |
| G11 other catalogs | C072-C076; C078 | custom provider or deferred/later built-in |
| G12 Scoop | C077 | fixed first-party built-in |
| G13 changelog/release notes | C080; P007; P023; P026 | adjacent composition |
| G14 custom publishers/providers | C083 | fixed arbitrary-provider capability |
| G15 project management | C084; P019 | outside durable release kernel |
| G16 Homebrew formulas | C085 | fixed first-party built-in |
| G17 Verify | C086; P001 | public-byte/signature/CDN outcome, not universal phase |
| G18 announcements | C087-C101 | later/adjacent |
| G19 CI hosts | C102-C115 | execution/evidence environment |
| G20 licensing | P035-P036 | intentionally outside ts-release |
| G21 durable staged continuation | P025 | structural shipping behavior |

## Evidence inheritance rule

A census row with `I` remains `INDEX` evidence. It inherits only:

- the material group's current evidence grade;
- the group's product disposition; and
- explicit provider/project evidence linked from that group.

It does not become researched merely because the crosswalk is numerically complete.

## Implementation evidence progression

| Claim | Earliest useful evidence | Decisive evidence |
| --- | --- | --- |
| structural bundle/plan law | compile + in-process tests | self-release uses same bytes |
| provider normal success | protocol double | scratch/public provider receipt |
| lost-response recovery | fault-injected double | controlled scratch-provider response loss |
| public byte identity | provider digest or download | self-release public bytes |
| consumer behavior | clean local consumer | representative end-user/self-release |
| custom provider continuation | two-process clean consumer | fresh runner resumes custom provider after interruption |

## Remaining limits

- Many census rows still have only index-level evidence.
- Current GoReleaser Pro behavior is partly documented without inspectable OSS implementation.
- Native npm and Warehouse remain ts-release differentiators rather than direct GoReleaser equivalents.
- Exact package ownership for some P01-P10 production outcomes remains a maintainer choice.
