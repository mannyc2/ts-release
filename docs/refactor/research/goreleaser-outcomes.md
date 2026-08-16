# GoReleaser-derived outcome roadmap

Status: derived product roadmap. It is not the evidence authority by itself.

## Audit structure

- [goreleaser-evidence-census.md](./goreleaser-evidence-census.md) retains all 151 cases with separate GoReleaser, current ts-release, v0.0.7, and historical rewrite-proposal columns. Its `R` cells are traceability, not current product authority.
- [goreleaser-material-evidence.md](./goreleaser-material-evidence.md) assigns current primary evidence and grades to material feature groups.
- This document derives product outcomes and maps every census case to one evidence group and disposition.

Older parity documents remain source-link indexes. Their dispositions are superseded where the current evidence census, material evidence, provider research, or fixed project scope is more specific.

## Fixed shipping scope

The rewrite ships:

1. npm;
2. PyPI/Warehouse;
3. GitHub Releases and assets;
4. Homebrew formulas;
5. Scoop; and
6. arbitrary custom providers.

Homebrew casks are comparison evidence and later work, not part of this fixed scope.

## Outcome facets

| Code | Outcome |
| --- | --- |
| `A` | provider accepted the intended mutation |
| `M` | public or authoritative metadata matches |
| `B` | intended byte identity is observed |
| `C` | a clean consumer discovers, installs, imports, downloads, or executes |
| `J` | interruption continues without blind repetition |

A row can satisfy one facet while another remains `NotObserved`.

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

## Shipping outcome roadmap

| Outcome | Evidence group / census | A | M | B | C | J | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| immutable artifact bundle and canonical plan | G01, G03, G21 / C006, C032-C048, P025 | n/a | canonical manifest | content digests | local readers | same bundle reused | structural shipping behavior |
| native npm publication | N01; G10 is contrast / C071, P005 | npmjs/compatible-registry receipt | version and initial/later tag facts | tarball integrity/shasum | clean install/import/bin | provider-specific replay or observation | shipping first-party built-in |
| native Warehouse/PyPI publication | N02; G02 is contrast / C024-C025 | one receipt per file | Simple API file facts | filename/size/hash | clean install/import/bin | per-file partial continuation | shipping first-party built-in |
| GitHub tag, release, and assets | G06 / C060-C061 | provider-native ref/release/asset receipts | complete reads | returned digest or downloaded bytes | public download/execute | lost-response reconciliation | shipping first-party built-in |
| Homebrew formulas | G16 / C085 | conditional tap ref receipt | formula path/ref/rendered facts | referenced archive checksums | `brew install` and smoke | conditional Git replay/reconciliation | shipping first-party built-in |
| Scoop | G12 / C077 | conditional bucket ref receipt | manifest path/ref | URL/hash identity | clean Scoop install and smoke | conditional Git replay/reconciliation | shipping first-party built-in |
| arbitrary custom provider | G14 plus G08/G11 examples / C083 | provider-defined | optional | optional | release-policy-defined | honest capability-dependent continuation | shipping extension capability |
| non-manual ts-release self-release | project decision | all required operations accepted or observed equivalent | public facts | public bytes equal bundle | clean consumers run ts-release | one injected interruption continues | decisive integrated gate |

## Structural outcomes

| Outcome | Evidence groups | Why it falls out |
| --- | --- | --- |
| zero/one/many artifacts | G02-G03 | collections, not a mode |
| multiple package or file coordinates | N01, N02 | provider-local arrays/maps |
| prebuilt or external builders | G02 | any producer can supply owned bytes |
| checksums as content facts | G04 | bundle objects already have digests |
| per-coordinate continuation | G21 | plan Intents plus journal history |
| custom provider participation | G14 | application-supplied provider definitions and Layers |
| dependencies between provider outcomes | G01, G05 | canonical dependency edges and ordinary Effect composition |

## Adjacent composition

| Outcome | Evidence group | Direction |
| --- | --- | --- |
| build matrices and language compilers | G02 | effect-build or another producer |
| archives and source archives | G03 | build/transformation operation that returns artifacts |
| system/install packages | G03 | producer packages; repository publication remains separate |
| SBOMs, signatures, notarization, attestations | G04 | typed artifacts or external service receipts |
| changelog/release note generation | G13 | finalized text can enter provider Intents |
| announcements | G18 | sequence after required durable outcomes |
| CI hosts | G19 | execution/evidence environments |

## Later product work or custom providers

| Outcome | Evidence group | Reason |
| --- | --- | --- |
| Homebrew casks | G09 | different renderer and consumer laws from formulas |
| GitLab/Gitea releases | G06 | not in fixed first-party set |
| Winget, AUR, Nix, Krew, MCP registry | G11 | provider-specific process and acceptance laws |
| object stores and generic feeds | G08 | custom provider first; named implementation required |
| container images and indexes | G03 | OCI digest/tag laws need a dedicated model |
| npm binary wrappers | G10 | different product from native npm package publication |
| snapshots/nightlies | G07 | version/retention/destination policy |
| commercial license transport | G20 | intentionally outside ts-release |

## GoReleaser Verify user outcome

Evidence group G17 establishes the actual purpose:

- re-download published SCM release assets;
- catch broken/truncated uploads and CDN propagation failures;
- run checksum/signature or arbitrary commands over downloaded assets;
- verify images through configured commands;
- exclude package-registry-only and blob-only artifacts from automatic download.

ts-release should preserve these outcomes when required, but not the universal name `verify`.

Equivalent explicit claims are:

```text
public asset downloadable
downloaded bytes match intended content
signature/checksum command succeeds
image digest/command succeeds
```

Clean npm or PyPI install remains a separate `C` outcome.

## Native npm and PyPI distinctions

### Native npm

GoReleaser's npm cases generate wrapper packages that download SCM archives during install. ts-release publishes the user's native tarball. The bytes, package metadata, provider Intent, and consumer path differ.

### Native PyPI/Warehouse

GoReleaser's Python builders produce wheels and sdists. Its documented publication path is a hook such as `uv publish` or `poetry publish`. ts-release needs provider-native per-file Warehouse publication and recovery.

## Complete census crosswalk

Every `C001-C115` and `P001-P036` case maps exactly once.

| Evidence group | Census case IDs | Derived disposition |
| --- | --- | --- |
| G01 configuration/orchestration | C001-C014; P004; P008; P011; P018; P020-P022; P031; P033-P034 | taxonomy/mechanism or ordinary application configuration |
| G02 builders/producer outputs | C015-C031; P028 | adjacent producer composition |
| G03 packaging/transformation | C032-C047; P002-P003; P009; P016-P017; P024; P029 | adjacent or later artifact producer |
| G04 checksums/security metadata | C048-C057; C079; P006 | structural digest plus adjacent artifacts/services |
| G05 publish/hook mechanisms | C058-C059; P012-P013; P032 | taxonomy/mechanism |
| G06 SCM releases | C060-C063 | GitHub shipping; GitLab/Gitea later/custom |
| G07 snapshots/nightlies | C064-C065; P027 | later release policy |
| G08 blobs/external feeds | C066-C069; C081-C082; P010; P015; P030 | custom provider or later built-in |
| G09 Homebrew casks | C070; P014 | later product work, explicitly outside fixed formula scope |
| G10 npm wrappers | C071; P005 | later wrapper product; contrast with native npm |
| G11 other catalogs | C072-C076; C078 | custom provider or later built-in |
| G12 Scoop | C077 | shipping first-party built-in |
| G13 changelog/release notes | C080; P007; P023; P026 | adjacent composition |
| G14 custom publishers/providers | C083 | shipping arbitrary-provider capability |
| G15 project management | C084; P019 | outside durable release kernel |
| G16 Homebrew formulas | C085 | shipping first-party built-in |
| G17 Verify | C086; P001 | explicit public-byte/signature/CDN evidence, not universal phase |
| G18 announcements | C087-C101 | outside durable core |
| G19 CI hosts | C102-C115 | execution/evidence environment |
| G20 licensing | P035-P036 | intentionally outside ts-release |
| G21 durable staged continuation | P025 | structural shipping behavior |

## Evidence inheritance rule

A census row with `I` remains `INDEX` evidence. It inherits only:

- the material group's current evidence grade;
- the group's product disposition; and
- any explicit provider/project evidence linked from that group.

It does not become "researched" merely because the crosswalk is numerically complete.

## Implementation evidence progression

| Claim | Earliest useful evidence | Decisive evidence |
| --- | --- | --- |
| structural bundle/plan law | compile + in-process tests | self-release uses same bytes |
| provider normal success | protocol double | scratch/public provider receipt |
| lost-response recovery | fault-injected double | controlled scratch-provider response loss |
| public byte identity | provider digest or download | self-release public bytes |
| consumer behavior | clean local consumer | representative end-user/self-release |
| custom provider continuation | two-process clean consumer | fresh runner resumes custom provider after interruption |

## Recommendations

1. Keep census, material evidence, and roadmap as three layers rather than merging them.
2. Treat `INDEX` as a weak evidence grade.
3. Refresh material groups at pinned current source revisions.
4. Keep fixed shipping scope independent of GoReleaser feature names.
5. Report A/M/B/C/J separately.
6. Use GoReleaser Verify as evidence for a user outcome, not as an API name to copy.

## Remaining contradictions

- Many census rows still have only index-level evidence. The group mapping is auditable but not equivalent to line-by-line source research.
- Current GoReleaser Pro behavior is partly documented without inspectable OSS implementation.
- The fixed ts-release shipping scope exceeds direct GoReleaser equivalents for native npm and Warehouse.
- Some adjacent capabilities, such as archives and checksums, are required to deliver the intended product even though they do not belong in the durable provider kernel. Their exact package ownership remains open.
