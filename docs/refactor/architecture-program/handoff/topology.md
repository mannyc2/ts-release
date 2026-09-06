# Executable physical-topology research

The three layouts expose a real tradeoff. A root package minimizes coordinated
publication states. A separate kernel makes a core-only installation smaller.
Separate provider packages also exclude unused provider files from installation.
The measured tree-shaken output is identical. Package count alone selects none
of them, and these experiments do not establish a qualifying Pareto winner
under the historical frozen program's complete gates.

This handoff covers authorized local research, not production refactoring or
publication. Reproduce with `tools/architecture-lab/topology/README.md`. The
hash-bound JSON/gzip receipts beside that README retain exact observations,
source/emitted inventories, dependency resolutions and supplementary metrics.
Temporary paths are diagnostics; rerunning the source produces fresh packs.
The final combined source snapshot is
`c653f05d28e8e968b79cdd09f6ec79d36f60163b32995303ab61a2de0474244b`;
the included machine tree is
`25f02ed605cb054888f5aad37f55f26732d0ad57fad595eafa1483502bebd435`.

## Same implementation, three projections

| Layout | Public cohort | Physical boundary |
| --- | --- | --- |
| T1 | `@lab/release` with root, npm, npm/owned and Python subpaths | One root package |
| T2 | `@lab/kernel`; `@lab/providers` with npm, npm/owned and Python subpaths | Kernel plus aggregate providers |
| T3 | `@lab/kernel`; `@lab/npm` with owned subpath; `@lab/python` | Kernel plus one package per provider |

`build.mjs` projects the same canonical source into these layouts, changing
coordinates and relative locations. It compiles strict source-emitted ESM and
declarations with TypeScript 6.0.3, packs them with Bun, and installs the actual
archives from a local registry into clean copied dependency trees. Consumer
processes import packed output without source aliases. Build-stage dependency
symlinks and repository ambient compiler types are separately disclosed; this
is not a claim of hermetic compilation or registry supply-chain certification.

These comparative packs use the donor's installed Effect rc.108 dependency,
including its local declaration patch. The separate
`upstream/unpatched-effect-consumer.json` proves that the selected full API and
published 0.6.3 adoption consumer work with the official unpatched archive.
The proposed manifests therefore omit that patch. The comparative dependency
inventories remain records of what this tournament actually installed.

All layouts use the same private `@lab/host` application pack for dynamic CLI
loading, thin Action mapping, HTTP transport, SQLite/Git stores and the actual
effect-build adopter. That fixed comparison control has 555 physical / 700
printer-normalized lines. Its private status does not decide the eventual
public host/adopter package boundaries. An external provider is source-compiled
and packed **after both kernel and CLI**, with the CLI archive hash retained.
It uses ordinary imports and provider definitions; no central registry changes.

The final experimental kernel contains both real machine candidates: 1,089
physical / 1,230 printer-normalized lines. The selected M1's inclusive source
is 935 physical lines. Canonical npm/Python/owned-content
provider implementation is 227 physical lines; T3 repeats the 13-line native
HTTP receipt helper in each provider package. This is measured duplication,
not a package-count penalty. Initial owned file/tree adoption, filesystem
ownership and strict bundle codec remain 323 physical / 437 printer-normalized
lines in every baseline. No wrapper-only count substitutes for that capability.

## What executes

Each layout runs 20 primary scenarios: admitted Node 22.22.2 and Bun 1.3.14,
both machine candidates, library/CLI/Action calls, separately configured native
npm/Python operations, unknown external-provider loading, lost acknowledgments,
and fresh-process restart. Node uses the real Git journal; Bun uses SQLite in
the main cross-runtime matrix. Every restart sends zero additional mutations.
The extension provider fixtures also execute Git on both runtimes.

The application module exports an Effect-valued factory. The host validates
that boundary and scopes application acquisition through machine execution;
library composition uses the same scope. Six additional packed lifecycle
fixtures prove actual OS file-descriptor closure on Node/Bun and actual SQLite
closure on Bun after success, failure after acquisition, and interruption.
They establish application-resource disposal, not immediate cancellation of
every possible third-party network operation.

Six further native cancellation fixtures exercise the actual mutation host:
the local peer commits and holds its response, the caller interrupts only after
the peer receives the request, and the peer observes the connection closing.
One durable Started fact and no acceptance receipt survive; a fresh CLI
process obtains the exact native observation with zero additional sends.

The npm fixture validates native JSON package/version/attachment metadata and
integrity. The Python fixture validates native Warehouse multipart file upload
and digest metadata. They are local protocol peers. Native service credentials,
OIDC, complete metadata compatibility, real registry policy and remote service
acceptance are not covered. The base protocol-isolation intents embed small
fixture bytes; they do not claim the final artifact ownership architecture.

Six additional packed slices supply that missing boundary: actual PR24 public
file finalization → verified adoption → owned Bundle → canonical bundle ID →
Plan with `{bytes, sha256}` content references → host-owned read/verification →
native npm request → durable restart. Producer paths are deleted before restart,
the Plan contains no artifact bytes or local path, and the repeated invocation
sends nothing. The same bundle identity survives every topology/runtime.

Each layout additionally runs the actual full file/tree adoption fixture on
Node and Bun: 34 checks each, including symlink/mode/native manifest retention,
durable load and restoration, forged input rejection, owned-content tampering,
and streaming adoption of the existing 95,971,456-byte selected artifact. The
receipt records its exact hash and existing-local-artifact provenance limit.
It records skipped checks explicitly if that optional source is absent during
reproduction. Tree adoption retains the producer handoff's documented resource
limits; see `apple-adoption.md` for the precise boundary.

The Action evidence is an actual emitted adapter that invokes the same machine
and maps report outputs. It is not GitHub runner metadata, bundle distribution,
environment-file integration or hosted execution qualification. Likewise the
CLI proves application-module loading and execution, not all production options.

## Package and dependency evidence

`results.json` contains actual archive sizes, source/emitted file hashes, all
public runtime values and compiler declaration symbols, source import syntax,
manifest edges, actual Node resolver edges with conditions, and Bun bundle
metafiles. `graph-results.json` adds recursive compiler-resolved declaration
edges, ambient boundaries, emitted module edges and acyclicity checks for the
owned module graph. Third-party internal dependency graphs are retained, not
claimed to be acyclic.

The complete owned declaration contracts also have the same normalized hash,
`969cc583d57a46cf5a34f8746c69528b30c59b976080e8fc45ff834766b3f470`.
Normalization changes only declared package coordinates/projection filenames,
verifies and omits T1's pure root re-export barrel, and folds byte-identical
receipt-helper declarations. All other declaration bytes are preserved; the
duplicated helper remains charged in the physical source and package inventory.

Final byte totals are in the receipts, which are authoritative over rounded
discussion. Both native providers depend only on Effect; the experiment finds
no difference in their third-party runtime dependency closures. The common
upstream adopter/Node host closure is separately installed. No synthetic SDK
dependency is added to manufacture a selective-install advantage.

| Final measured boundary | T1 | T2 | T3 |
| --- | ---: | ---: | ---: |
| Public cohort tarball bytes | 19,851 | 20,366 | 21,784 |
| Core-only installed own-package bytes | 96,441 | 81,345 | 81,345 |
| Npm-only installed own-package bytes | 96,441 | 96,538 | 91,187 |
| Core-only bundle bytes | 136,842 | 136,842 | 136,842 |
| Npm-only bundle bytes | 243,798 | 243,798 | 243,798 |
| Recursive installed declaration files | 183 | 182 | 183 |
| Unique declaration import edges | 1,101 | 1,100 | 1,102 |

Each compiler graph separately inventories 216 ambient files. The main Node
loader receipt retains 1,412 distinct resolution edges across the compared
executions, including actual resolver conditions; the public export comparison
covers 12 surfaces per layout, including the fixed private host and external
provider. These counts describe the concrete admitted experiment.

The measured plain-npm bundle is 243,798 bytes in all layouts, excluding Python.
The core-only bundle is 136,842 bytes in all layouts. T2/T3 exclude approximately
15 KB of provider JS/declarations/metadata from a core-only installation. T3
also excludes approximately 5 KB of unused Python files from an npm-only
installation. These are installed own-package bytes, not total disk usage,
network transfer estimates, or a forecast for unimplemented providers.

`publication-results.json` exposes successive subsets of actual source-emitted
archives through the local registry. The v2 cohort changes manifest coordinates
and exact cohort dependencies only; emitted JS/declarations are checked identical
to v1. Full-cohort installs succeed only after all one/two/three required public
coordinates exist. Provider-before-kernel installs fail. T2/T3 mixed direct
kernel-v2/provider-v1 installs physically contain two kernel versions. T3's
npm-only consumer can install while Python-v2 is unavailable. This establishes
real resolution/order/skew states, not ABI compatibility of a breaking release.
Lockstep releases need exact-cohort admission and a completion check; lockstep
naming by itself does not eliminate independently installable skew states.

## Nine executed maintenance changes

Every row has a real packed before failure and after consumer postcondition.
P01 is a configuration change; P04/P09 use explicitly described compiled
counterfactual pre-extension sources, not a fictional earlier product release.
P06 reuses the exact final baseline Git execution evidence for its after side.
P07 keeps the complete initial adopter in both trees and adds another adapter.

| Probe | Actual change | T1/T2 source +/− | T3 source +/− | Additional package/export metadata T1/T2; T3 |
| --- | --- | ---: | ---: | ---: |
| P01 | One → two registry instances; two distinct native endpoints | 0/0 | 0/0 | 0; 0 |
| P02 | New externally packed provider loaded by existing CLI | 46/0 | 46/0 | 19; 19 |
| P03 | New first-party catalog PUT/GET provider with native evidence codecs | 38/0 | 51/0 | 4; 19 |
| P04 | Pending receipt, then delayed native completion observation | 12/6 | 12/6 | 0; 0 |
| P05 | Real npm dist-tag operation added to existing provider | 43/0 | 43/0 | 0; 0 |
| P06 | Real Git journal backend added alongside SQLite | 73/0 | 73/0 | 4; 4 |
| P07 | Native path-free producer handoff header checked against resolved finalized generation | 40/0 | 40/0 | 4; 4 |
| P08 | Public canonical Plan serialization, decoded through actual loader | 7/0 | 7/0 | 0; 0 |
| P09 | Preserve factual results after supersession; explicit reviewed one-shot format migration | 47/5 | 47/5 | 0; 0 |

P03 is the retained new-provider-c shape, not a forecast that full production
signed catalogs cost 38 lines. T1/T2 reuse the existing native HTTP receipt
helper; T3 adds the actual 13-line helper to its new package. P02 measures new
provider authoring/installation on an already-open mechanism. P07 consumes the
real upstream `Artifact.adoptFile`/`adoptTree` protocol, rejects wrong resolved
generations, and restores the selected tree after producer paths are removed.
Its 40-line incremental cost does not erase the 323-line initial capability.

`metric-results.json` recomputes actual Git Myers numstat additions/deletions,
retaining complete compared authoring/emitted inventories and patch hashes.
It separates TypeScript, package/export metadata, compiler configuration and
generated JS/declarations. Printer-normalized churn is a diagnostic, not the
historical semantic-source/v3 score. No semantic score is claimed here.

| Nine-row population | T1 | T2 | T3 |
| --- | ---: | ---: | ---: |
| TypeScript gross additions total | 306 | 306 | 319 |
| TypeScript additions median / p90 / maximum | 40 / 73 / 73 | 40 / 73 / 73 | 43 / 73 / 73 |
| TypeScript full churn total | 317 | 317 | 330 |
| TypeScript full churn median | 40 | 40 | 43 |
| Source + package metadata additions total | 337 | 337 | 365 |
| Source + metadata median / p90 / maximum | 43 / 77 / 77 | 43 / 77 / 77 | 44 / 77 / 77 |
| Printer-normalized source additions median | 42 | 42 | 45 |

The frozen contract uses **gross physical additions**, with deletions recorded
separately. Its nearest-rank p90 over nine samples is the maximum. It also
demands nine nonzero observations and counts generated product inputs. P01
legitimately needs no machine/provider edit, and conservative inclusion of
package metadata puts every median above 40. These are unresolved qualification
differences requiring explicit reconciliation; the research does not silently
change the population, classify metadata away, or claim the frozen budget passes.

## Defects found and remaining decision

A minimal native probe found that one Bun 1.3.14 fetch PUT on a connection reused
after a GET can send two actual PUTs after the server commits and closes the
socket. Admitted Node sends one in the same fixture. The research mutation host
therefore uses explicit `node:http`/`node:https` requests with a fresh agent,
no retry or redirect, and bounded response handling. Packed fault scenarios
record one native mutation, a durable dispatch error, exact observation and
zero resend after restart. `fetch-retry-results.json` retains the independent
reproduction; this is a concrete transport requirement for implementation.

A cold graph review also found npm → owned-npm → npm barrel recursion. The
final source gives owned-npm a separate public subpath and removes that cycle.
It does not rely on ESM's ability to tolerate some cycles as an architectural law.

T1 has the smallest combined public archive and the fewest partial-publication
states. T2 buys the core-only installation boundary while retaining one provider
cohort. T3 buys provider-selective installation and independently inspectable
provider manifests, with additional archive/metadata and shared-helper cost.
Their emitted behavior and tree-shaken output are equal here. None dominates
all measured objectives. Physical selection and any change to frozen marginal
arithmetic require a concrete maintainer decision; a source-folder preference
or package count cannot stand in for one.

The full frozen sixteen-case matrix, every production host boundary, complete
self-release rehearsal, all retained product outcomes, hosted native services,
and the full production publication implementation remain outside this comparative receipt. Consult
the qualification/obligation matrix rather than extrapolating these local
proofs into a completed reimplementation. After selection, keep one pack
projection, its consumer/restart/transport/adoption checks and compact receipt
reader. The losing projections and historical shadow-dist tournament can leave
the active implementation path while their hash-bound research evidence is
preserved. No historical or production source is deleted by this work.

`design.json`, `layout.json` and `public-surface.json` separately project the
complete proposed production API into all three layouts. The recommended T3
has a private workspace root, `packages/kernel`, and seven provider packages;
selection remains pending. T2 also moves the independently packaged core to
`packages/kernel`; T1 retains one public repository-root package. This directory
choice preserves the measured package dependency mechanism and adds explicitly
counted workspace metadata rather than another public package.
Those full manifests add the selected published producer and native provider
dependencies. Their exact optional-peer and installed dependency graphs still
require fresh production packs in Plan 009; the smaller measured graph above
does not certify them. `project.ts --check` validates this proposal's export
ownership, module DAG and migration destinations without writing product code.
