> Current authority: [README](README.md), [design](design.json), and the matching
> JSON records include the accepted P0–P3 amendments. The discussion below
> preserves the earlier investigation; old topology/45-line proposals and
> research-only authorization are superseded. Native oracles remain required.

# Qualification of the research handoff

The completed lab establishes concrete local design evidence. It does **not**
produce a `UniqueSelection` receipt under the frozen tournament or implement
all 69 selected product outcomes. The original 16 cases, 14 laws, 25 hard gates,
9 ownership decisions, 6 blockers and 9 marginal probes are preserved, with
factual dispositions, in [qualification.json](qualification.json). No frozen
input or historical `Pending` record was edited to manufacture a pass.

The distinction is between an executable design proof, a proposed product
policy, and qualification of the eventual deployed product. A later deployment
test is not additional architecture research, and it is not evidence that a
small protocol fixture already implements the selected product.

## Evidence and reproducible commands

Run from the repository root with Bun. Local HTTP experiments require loopback
socket permission; they use temporary directories and local registries/Git
remotes, no publishing credentials or external mutation. Original no-network
bubblewrap gate receipts are not claimed by these commands.

| Evidence | Command | Concrete scope |
| --- | --- | --- |
| E01 machine | `bun test ./tools/architecture-lab/machine/test` | 61 tests, 364 assertions; independent M1/M2 representations, real send ordering, native codecs/errors, CAS/risk/supersession, fresh processes and owned Git objects. |
| E02 local stores | `bun test ./tools/architecture-lab/storage/stores.test.ts` | SQLite/Git: 15 tests, 67 assertions; independent writers, durability/idempotency, Git no-op, exact proposed 1 MiB bounds. |
| E03 dependency facts | `bun test ./tools/architecture-lab/integration` | 4 tests, 26 assertions: native release ID survives process replacement; wrong parent ID prevents upload. |
| E04 packed layouts | `bun tools/architecture-lab/topology/run.mjs` | Actual tarball installs, Node/Bun library, CLI application modules, local Action, npm/Python HTTP fixtures, external provider and owned Bundle publication. |
| E05 changes/metrics | `bun tools/architecture-lab/topology/probes.mjs` then `bun tools/architecture-lab/topology/metrics.mjs` | All 9 integrated changes per layout, behavioral checks and actual Git source/metadata diffs. |
| E06 upstream/Apple | `bun tools/architecture-lab/apple/build-upstream.ts` then `bun tools/architecture-lab/apple/run-experiments.ts` | Actual packed upstream finalizers; 34 adoption checks per runtime and 16 Apple protocol/lifecycle checks. |
| E07 inventories | `bun tools/architecture-lab/inventory.ts --check` and `bun tools/architecture-lab/migration.ts --check` | Historical/current source and public-surface census, 69-outcome mapping and explicit format disposition. |
| E08 graph | `bun tools/architecture-lab/topology/graphs.mjs` | Actual installed declaration resolution, source/runtime/bundle edges and public package surfaces. |
| E09 publication states | `bun tools/architecture-lab/topology/publication.mjs` | Local registry package-prefix and coordinate-skew scenarios. |
| E10 event sizes | `bun tools/architecture-lab/machine/measure-test-events.mjs` | Actual full encoded event sizes; oversized native evidence preserves uncertain dispatch. |
| E11 difficult changes | `bun tools/architecture-lab/machine/validate-extensions.mjs` | Delayed native acceptance and late facts plus complete reviewed one-shot importer; before fails, after passes. |
| E17 published history | `sha256sum docs/refactor/architecture-program/handoff/public-history/ts-release-0.3.0.tgz` | Complete archive/source/export census and actual S3 source audit; no historical execution or AWS deployment claim. |
| E14 S3 protocol | `bun test ./tools/architecture-lab/storage/s3-model.test.ts` | 11 tests, 49 assertions against independent localhost versioned HTTP object service, including actual M1/M2 continuation. |

Strict checks are `bunx --no-install tsc -p tools/architecture-lab/tsconfig.json`
and the compiler-derived declaration check described in [machine.md](machine.md).
The JSON records exact paths and hashes; [topology.md](topology.md) records the
packed source coordinate, surfaces, lifecycle checks and measurement method.

## The sixteen cases

“Established” below means the named local behavior has concrete evidence. It
never means the old canonical trace/hash was replayed in every packed layout.

| Case | Local finding and exact limit |
| --- | --- |
| C01 initial success | E01/E04: durable start precedes one send; facts reconstruct the report. Frozen C01 requires observation/revision 3; write-only success can correctly end at revision 2. |
| C02 noncommit rejection | E01: preflight failure writes no attempt; provider-proven post-start noncommit is linked and versioned. The contradictory frozen case was split into C02a/C02b; its old trace is not marked passed. |
| C03 satisfied after response loss | E01/E04: corresponding native observation satisfies without a second send. Each production provider still needs its own native correlation oracle. |
| C04 absent after response loss | E01/E06: uncertainty survives absence and restart; no blind resend. |
| C05 Git protected replay | E01: actual conditional native push, same-update and competitor behavior, private core transport ownership, multiple exact authorities and owned object restoration. Hosted Git policy is separate. |
| C06 risk acceptance | E01: request, principal/scope, all prior attempts, expiry and one extra attempt are bound. Real approval identity remains host acceptance. |
| C07 concurrent runners | E01/E02/E14: one CAS winner; an already recorded event never creates a second dispatch permit. |
| C08 endpoint correspondence | **Partial.** E01/E03/E04 reject request and native-fact drift. The exact frozen before-observation endpoint trace was not replayed; authored provider/host observation must bind the actual endpoint. |
| C09 supersession/late facts | E01/E06/E11: late receipt and observation are retained; no new dispatch or changed final Apple bytes. |
| C10 ambiguous append | E01/E02/E14: the same live invocation reconciles exact read-back; a fresh invocation obtains no permission from `AlreadyRecorded`. |
| C11 complete graph | E01: duplicate IDs, cycles, absent dependencies and unknown codecs reject before provider effects. |
| C12 open composition | E01/E04/E05: two instances and external tarball built after CLI use unchanged kernel. Application code is explicitly loaded by the host. |
| C13 Apple pre-ID loss | E06: actual packed Apple service boundary with protocol doubles retains uncertainty and does not resubmit. Native Apple acceptance is unclaimed. |
| C14 file/tree handoff | E04/E06: actual upstream finalizers, owned bytes, modes, symlinks, shared content, strict durable restore and a 95,971,456-byte selected artifact. Native signing lineage is unclaimed. |
| C15 host shadowing | E01/E04: captured interpreter host cannot be replaced by a provider-local Layer. This is not a sandbox for malicious application code. |
| C16 bound symmetry | E02/E10/E14: exact full-envelope read/write bound and oversized-evidence stop. Selecting 1 MiB is a product profile decision, not a deduction from a tiny fixture. |

## The fourteen laws

| Law | Evidence and remaining obligation |
| --- | --- |
| L01 one durable chain | E01/E02/E06: immutable journal root, global revision, admitted preparation/publication scopes, one persisted publication Plan. |
| L02 one pure owner | E01: each real candidate owns its command/report decision; neither delegates to the other. |
| L03 one interpreter/CAS authority | E01/E02: one ordered interpreter; only new successful CAS creates dispatch authority. Production credential/host wiring remains acceptance. |
| L04 facts/decisions/effects | E01/E11: pending native acceptance and errors are not completion or proven noncommit. |
| L05 host-owned journal | E01/E06: captured dependencies and exact-prefix Apple Ready CAS; no peer/filtered history. Each eventual host must preserve this. |
| L06 provider ownership | E01/E04/E06 prove concrete verticals. All 69 selected outcomes, native adapters, tests and docs remain mapped implementation scope. |
| L07 open providers | E04/E05: second instance and external package require zero kernel edits. |
| L08 neutral core | E01/E04/E08: no Node/Bun implementation in kernel; scoped CLI/Action host delegates to the same interpreter. |
| L09 lossless producer boundary | E04/E06: real upstream values cross once into owned content; the 323-line ownership/adoption baseline remains charged. |
| L10 Apple ownership | E06: upstream owns native operations/codecs, ts-release owns one journal; pre-ID loss stays inconclusive. Live Apple certification remains separate. |
| L11 hard cut/migration | E07/E11/E12: user-authorized hard cut for no known consumers; only an explicit reviewed one-shot import for discovered data, no default dual reader. |
| L12 exact surface | E04/E08 establish exact experimental surfaces. Proposed production declarations and all selected delivery exports are not shipped acceptance. |
| L13 one-way graph | E08 measures real source/runtime/declaration edges. A discovered `npm`/`npm-owned` cycle was corrected with a dedicated public owned subpath; final source-bound emitted/declaration graphs are acyclic. |
| L14 total traceability | E07 maps the retained scope/source/surface/format obligations. Inventory completeness is not completed product behavior. |

## The twenty-five original hard gates

All original commands, case/law/probe dependencies and hard-gate flags are
retained in JSON. The old gate runner was not used to accept these new lab
results. Its `Pending`-only result shape and unreachable ownership freeze remain
historical defects, detailed in [audit-evidence.md](audit-evidence.md).

| Gate | Factual disposition of the new lab |
| --- | --- |
| GM01 shared cases | Partial: all 16 obligations mapped; exact C01/C02 traces differ, C08 remains partial. |
| GM02 laws/owners | Local laws proved at stated boundaries; full production ownership and deployment acceptance remain. |
| GM03 construction | Established for tested Plan, DAG, native evidence, request and host boundaries. |
| GM04 provenance | New source/package/consumer hashes exist; no original v2 result receipt is claimed. |
| GM05 source budget | Local physical diagnostic is below the historical slice threshold; complete production relocation-charged count remains unmeasured. |
| GM06 marginal measurement | Real complete patches exist; zero-source P01 violates the frozen population rule and full role metrics are incomplete. |
| GM07 equivalence | Shared independent suites and difficult variants agree; full frozen 16-case/topology equivalence is unclaimed. |
| GM08 metric/readability | Physical/bytes/AST/printer diagnostics exist; exhaustive invalid-state and owner-hop/central-branch metrics do not. |
| GM09 offline/nonmutation | Local temporary effects only, but loopback HTTP differs from the original no-network sandbox receipt. |
| GT01 common fixture/cases | Same real source in all layouts; not all 16 failure cases inside every packed layout. |
| GT02 Node library | Established by actual installed emitted package consumers. |
| GT03 Bun library | Established by actual installed emitted package consumers. |
| GT04 CLI | Actual application loader/external extension and resource lifecycle; full production command/binary/default wiring remains acceptance. |
| GT05 Action | Actual thin bundle runs locally; hosted runner/permissions/journal default are unqualified. |
| GT06 external/two instances | Established with provider built after existing CLI and no kernel edit. |
| GT07 producer handoff | Actual upstream tarballs, strict consumers, complete 34-check fixtures and owned publication slices. |
| GT08 exact public surface | Experimental emitted surface checked; complete proposed product surface is not implemented. |
| GT09 exact packed inventory | Actual emitted/tar files, hashes and exported entrypoints inventoried. |
| GT10 complete graph | Actual source, compiler declaration, runtime-loader and bundler graphs; not future arbitrary applications or unimplemented production graph. |
| GT11 acyclic graph | Final source-bound owned emitted/declaration DAGs are acyclic in all three layouts; package count alone is not evidence. |
| GT12 skew/partial publication | Local coordinate/prefix install experiment; v2 JS/declarations remain identical, so no semantic ABI-skew claim. |
| GT13 self-release | Partial: actual builds/owned publication/order; no complete 69-scope self-release Plan, dry run or delivery replacement. |
| GT14 selective bytes | Actual selective bundle metafiles and packed-byte inventories for the fixture. |
| GT15 nine changes | All nine implemented/exercised, but P01 population and conservative median-budget conflicts remain explicit. |
| GT16 offline/nonmutation | Local registries/HTTP/Git only; not an original no-network attestation. |

## Ownership and the six historical blockers

The immutable upstream observation now changes the interpretation of the old
Plan 004 blocker. At merged PR37 commit
`ef29a087baac8bdbcd90a54bb62a2dceb739dd91`, Plan 045 preserves the September 1
npm-only scope amendment and advances the current target to 0.6.3. Credentialed
Apple artifact certification and AWS journal evidence are explicitly deferred,
not passed, and excluded from that upstream release readiness. The public
library projection remains SHA-256
`6bbbdcb00e75cd1f104aa658f4ddfe781719016a7568c7a59006ff435f52fac3`.
[Immutable upstream Plan 045](https://github.com/mannyc2/effect-build/blob/ef29a087baac8bdbcd90a54bb62a2dceb739dd91/plans/045-establish-v060-release-point.md)

The exact compressed/source/Git-blob bindings are retained in
[upstream/observation.json](upstream/observation.json). This amendment removes an
obsolete upstream prerequisite; it does **not** defer ts-release's 69 selected
outcomes or claim credentialed Apple/S3 acceptance. Historical decisions remain
verbatim in JSON with a separate current disposition.

| Ownership decision | Current disposition; historical blocker retained |
| --- | --- |
| OD01 journal law | Selected and concretely proved locally. No new ownership decision needed. |
| OD02 Bun CLI SQLite | Selected default at an explicit path remains. Local backend proved; production CLI default/lifecycle wiring must pass delivery acceptance. |
| OD03 Action journal | Default remains unselected. Local Git CAS/Action proof does not close **OB01** hosted policy/permissions/retention qualification; **OB05** profile must be explicit. |
| OD04 readiness S3 | Retain as historical/future host design, not a prerequisite of current upstream npm-only readiness. **OB03** AWS deployment is not performed; E14 establishes its local algorithm only. No generic S3 default or peer fallback is introduced. |
| OD05 segments/head | Complete immutable/versioned segments and one mutable CAS head retained. E14 proves orphan segments do not enter history and references pin version/hash. WORM alone is not head CAS. |
| OD06 classification | Build requirements/certification summaries are projections; native external facts are journaled once. **OB02** must use the current npm-only contract, not demand excluded Apple/AWS evidence. |
| OD07 Apple correlation | Local public-codec no-ID stop established. **OB06** native/private terminal Apple qualification remains for the eventual Apple product, not a current upstream npm readiness input. |
| OD08 adoption | Actual packed upstream public boundary established, including strict file/tree ownership. **OB02** historical terminal coordinate is reconciled separately from live native certification. |
| OD09 formats | **OB04** is resolved for the user's declared no-known-consumer scope by explicit hard-cut authorization. An actually discovered old payload reopens only its concrete one-shot disposition. |

The scope correction is supported by immutable current upstream source. Earlier
PR25 status language must not be stretched into successful Apple/cold-host
acceptance: that PR described inert infrastructure and incomplete external gates.
The [published consumer](upstream/published-consumer.json) now proves actual
registry-published 0.6.3 packages with strict declarations, 34 adoption checks per
Node/Bun runtime and 16 Apple protocol checks. It does not claim credentialed
Apple acceptance. The PR24 source-emitted fixture retains its exact older
provenance.

## Concrete S3 algorithm and its limits

`S3JournalModel` constructs one immutable event segment with a unique key, a
canonical full JournalEvent, revision and previous `{key, versionId, sha256}`
reference. Upload uses `If-None-Match: *`; an unreferenced upload is not history.
The one small head names the new segment and revision. Initial creation uses
`If-None-Match`; advancement uses the ETag from the loaded head in `If-Match`.
Reads follow exact segment versions, validate hashes/revisions/namespaces and
reject duplicate event IDs. Only a successful new head CAS with exact read-back
returns `Appended`. A 412 loser or fresh identical invocation supplies no new
permit; 409/404/503/lost response remains uncertain and triggers no automatic PUT.

S3's documented conditional-write and version-lock semantics motivated the
independent HTTP counterexamples: locks protect a version, while another version
or delete marker can still be created. The model's version pins preserve old
segment content; a head delete marker fails closed. A deployment must enforce
conditional head writes and prohibit destructive/rollback authority for release
writers. Object Lock alone cannot establish that trust boundary.
[AWS conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html),
[AWS Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html)

This is an executable protocol simulation, not AWS conformance or provisioning.
SigV4/OIDC, IAM, versioning, retention, encryption/access availability, real
response-loss behavior and operational lifecycle remain deployment acceptance.
The model assumes a host-supplied bounded single-attempt HTTP transport and has
explicit research capacities: 1 MiB event, 4 KiB segment overhead, 8 KiB head,
4,096 events per read. The latter capacities are not silently proposed as final
product limits.

## Source budget and decisions

The 105-line M1 file is not the kernel cost. Shared schemas, identity/native
validation, interpreter and core Git must be charged. [machine.md](machine.md)
and [source-metrics.json](../../../../tools/architecture-lab/machine/source-metrics.json)
record the final exact count: 1,089 physical lines for both candidates, 935 with M1 only. The preserved comparison slice is 2,114 lines and
its three-fifths threshold is 1,268. The full product reference is **22,971**
lines (22,916 code +55 generated policy); the half-source target is **11,485**.
Current product source is 18,252. No completed-product reduction is claimed.

The final source-only extension medians are 40/40/43 for T1/T2/T3, with maximum
73. Charging source plus package/export metadata gives medians **43/43/44**,
maximum 77. P01 is a real configuration-only change with zero product lines;
adding artificial code would corrupt the comparison. The frozen nonzero rule
rejects it, and the conservative median exceeds the old 40-line budget.
Printer diagnostics are separate; they do not replace accepted physical counts.
Thus neither M1 nor a topology is an automatic frozen tournament winner.

The earlier 2,250–3,700-line partial core/host estimate is superseded by the
central [full forecast](forecast.json). The newly audited published 0.3.0 archive
contains 1,755 lines of actual AWS session, governance and native-boundary
responsibility, beyond its 1,721-line old journal. The 145-line S3 model excludes
those responsibilities. See [public history](public-history.md) and E17 for all
522 archive-member hashes, 98 source dispositions and 186 exported declaration
names. These historical donors add no baseline or deletion credit; any maintained
translation counts in the replacement numerator. The 86-line HTTP/application/CLI fixture
still cannot stand in for complete authentication and hosts. The 11,485 ceiling
and every selected outcome remain unchanged.

Three concrete amendments need to be explicit in the implementation handoff:

1. Use the actually aligned rc.108/package coordinate supported by strict packed
   consumers. Preserve the accepted historical beta83 first-slice disposition
   and explain its supersession; do not relabel the earlier private rc.108
   comparator as previous production authority.
2. Propose **1,048,576 bytes of canonical full JournalEvent UTF-8** as the product
   profile, with identical read/write behavior across backends. Exact boundary
   tests prove enforcement, not coverage of every legitimate native payload.
   Oversized post-dispatch evidence must preserve durable uncertainty and stop;
   large artifact bytes belong in owned content outside the journal. A body
   fitting a transport limit can still overflow its encoded event envelope.
3. State how the maintainer decides from the supplemental comparisons, or
   repair/replay the frozen acceptance protocol. Preserve the zero-change and
   conservative budget conflicts; do not claim a Pareto winner from missing
   invalid-state/owner-hop metrics or unqualified gates.

The user has already authorized research implementation and a hard cut; neither
needs another permission question. Hosted Action policy selection and eventual
Apple/AWS deployment require concrete environment evidence when those products
are implemented. They are not permission questions that can turn an unrun test
into a pass, and superseded upstream gates must not block this research handoff.

Final machine tree: `25f02ed605cb054888f5aad37f55f26732d0ad57fad595eafa1483502bebd435`.
Final combined packed source: `c653f05d28e8e968b79cdd09f6ec79d36f60163b32995303ab61a2de0474244b`.
All five topology receipts bind that source; their full compressed bodies are
hash-verified by the shared evidence reader.

Published-source bound clarification: 0.3.0 admitted 1 MiB of opaque payload
inside a 1.5 MB retained object. The proposed replacement limit is 1 MiB of
full canonical JournalEvent. Neither historical publication nor the small
fixture establishes that every legitimate native provider response fits.

The final one-publication-scope admission amendment is included in the machine
count above. All five packed topology receipts have been fully refreshed and
hash-verified against that exact source.

E18 adds the exact local native checksum witness: 19 checks under each Node/Bun
runtime use GNU `sha256sum` with actual owned bundle bytes. E19 adds eight fresh
processes, two App preparations, two native post-staple TARs and a five-member
mixed Bundle bound to one final Plan at global revision 8. Six adversarial
checks reject collection/member/selection substitutions. Native Apple callbacks
remain explicit doubles; App/DMG/PKG live acceptance is not claimed.

E20 checks the final proposed kernel/provider/host/adoption/Apple/checksum
surface against the official **unpatched** Effect rc.108 archive and actually
published upstream 0.6.3 packages. Strict declarations pass and all 34 adoption
checks pass under both runtimes. The absent private `Param.getParamMetadata`
produces the expected separate TS2339 control. This evidence supports omitting
the old declaration patch in the future layout. It changes neither current
production dependencies nor the qualifications of old patched trial snapshots.
Run `bun tools/architecture-lab/machine/unpatched-effect.mjs` for an offline
receipt/source check; append `--execute` for the public-download isolated rerun.
The [receipt](upstream/unpatched-effect-consumer.json) binds exact final inputs;
no 8 MB Effect archive is retained in this handoff.

The source inventory and migration records are now losslessly compressed behind
readable JSON summaries. E07 binds both summaries, both `.gz` payloads and the
reader. `bun tools/architecture-lab/records.ts <summary.json> --check` verifies
compressed and expanded bytes; omitting `--check` prints the original records.
The 93 current-source migration rows and their dispositions are unchanged.
