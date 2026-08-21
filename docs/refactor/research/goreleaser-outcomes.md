# GoReleaser-derived outcome roadmap

Status: derived projection. [`launch-scorecard.md`](launch-scorecard.md) is the
sole product-scope authority. [`goreleaser-evidence-census.md`](goreleaser-evidence-census.md)
is the exact authority for the preserved historical 151-case mapping. This
document explains the product consequences; it creates neither rows nor
counts.

At this checkpoint the scorecard projects 69 selected vNext leaves, no
unresolved candidate leaves, 7 deferred maintained destinations, and 30 named
later leaves, including 10 evaluated candidates resolved to later work. Those
numbers are repeated here only as a checkable snapshot.

## Evidence terminates outside the model

| Facet | Required question |
| --- | --- |
| `A` acceptance | Did the provider or tool accept the intended operation? |
| `M` metadata | Does an authoritative public/read endpoint expose the intended coordinate and state? |
| `B` bytes | Are the intended bytes, digest, archive contents, signature, or package payload observed? |
| `C` consumer | Can a clean consumer discover, install, import, download, or execute the result? |
| `J` continuation | Can a fresh runner continue without blindly repeating an uncertain mutation? |

These are independent evidence facets. Normal documented success remains
success. Reconciliation belongs to the possible-dispatch/no-response path.
Re-downloading bytes can establish `B` or `C` where the product promises it;
it is not a universal `verify`, `verifyInstall`, or `ensurePublished` phase.

`C` is especially not a provider capability. It is an acceptance oracle for a
product outcome and belongs in representative integration fixtures.

## Exact historical reconciliation

The census contains exactly `C001-C115` and `P001-P036`, with no gap,
duplicate, unresolved target, or many-to-many final disposition.

```text
151 historical cases
  28 -> selected vNext leaves
   0 -> unresolved launch decisions
   7 -> deferred maintained providers
  38 -> named later-model leaves
  33 -> adjacent composition
  39 -> mechanism or taxonomy
   6 -> intentional exclusion
```

One source case can be evidence for only one primary atomic target in this
census. That rule prevents a broad heading such as "notarization", "signing",
or "verify" from silently counting several product outcomes. Sibling scorecard
leaves still exist when the domain requires them.

Evidence strength is preserved independently from disposition. An index-only
claim remains index-only even when it maps to a selected vNext leaf.

## Product roadmap derived from the census

### Release kernel and delivery

- immutable content, a durable plan, and one append-only history are
  structural prerequisites, not user-selectable modes;
- the release report is a view of those facts, never a peer representation;
- whole-release continuation is judged operation by operation, with recorded
  request/replay evidence and current provider observations kept distinct;
- a first-party GitHub Action and ts-release self-release are integrated
  acceptance, not documentation-only CI examples.

### Distribution protocols

| Product outcome | GoReleaser relationship | ts-release requirement |
| --- | --- | --- |
| native npm publication | GoReleaser's npm feature produces platform wrappers that download SCM assets | publish the user's native tarballs, manage tags, support plural workspaces, and continue honestly |
| Python distribution | GoReleaser Python builders produce wheels/sdists; that is not Warehouse publication | effect-build produces finalized files; ts-release publishes and reconciles each file |
| GitHub release/assets | close analogue, but release creation and each asset have distinct mutation surfaces | independent receipts, observations, byte evidence, and lost-response paths |
| Homebrew Formula | current audited GoReleaser source no longer establishes Formula publication; the preserved historical case does | render a Formula, publish paths atomically through conditional Git, then install/test |
| Scoop | catalogue rendering and Git delivery decompose cleanly | render from canonical artifact facts; publish paths through the same Git CAS law |
| custom providers | plugins are analogous only at the composition boundary | ordinary imports and operation-local Layers; no allowlist, sealed union, or singleton provider service |
| MCP Registry | current addition beyond the 151-case denominator | validated manifest, registry publication, and ambiguous-completion continuation |

Provider packages are concrete DI. They need no universal `Publisher` merely
because their effects are analogous. Shared core transport exists only where
substitutability under the same request/dispatch laws has been demonstrated.

### Production and trust

The selected competitive plan includes actual artifacts rather than only an
extensible artifact enum:

- prebuilt adoption and the pinned effect-build executable matrices;
- binary and source ZIP/tar.gz archives;
- one uv-based Python build frontend tested with two PEP 517 backends;
- deb, rpm, apk, Arch, and MSIX system/install packages;
- macOS app, DMG, pkg, signing, notarization, stapling, and verification;
- MSIX Authenticode mechanics;
- SHA-256 checksum and SPDX/CycloneDX SBOM views.

Wheels and sdists belong to effect-build because they are concrete production.
Warehouse upload belongs to ts-release because it is a provider mutation. The
same division applies to Apple: concrete tooling remains in effect-build-apple,
while release-level durable history remains in ts-release.

### AI-native distribution

The selected AI-native product is OpenAI-specific and finite:

- construct an installable skills-only plugin package;
- publish/update a repository marketplace entry through ordinary conditional
  Git;
- validate a complete portal-submission handoff.

The human review/portal action is deliberately outside provider success. Other
AI registries remain later provider packages until a named protocol and oracle
exist.

## Verify disposition

The useful GoReleaser Verify outcomes are retained as ordinary evidence:

```text
an asset is publicly downloadable
downloaded bytes equal the intended bytes
a checksum or signature validates
an image digest and execution result match
```

They do not justify a universal post-publication reread. For example, a
successful npm response is provider-native success; clean install is a
representative product gate; registry observation is needed only when it
answers an explicit metadata/byte promise or reconciles ambiguous completion.

## Competitive gaps after selected vNext

The scorecard keeps the remaining gaps finite rather than hiding them behind
"parity":

- ten candidate leaves resolved to later work through nine decisions covering
  ipk, MSI/toolchain, OpenPGP, Cosign, OCI, nightlies, version derivation,
  notes derivation, and universal macOS output;
- seven deferred maintained destination providers;
- thirty named later leaves for additional catalogs, installers, ecosystems,
  transforms, and planning policy.

Announcements, project-management mutations, CI-host setup, and unrelated
compiler ecosystems compose around a release result or finalized artifact.
They are not forced into the release kernel.

## Current GoReleaser delta outside the historical denominator

The pinned current-source audit adds three facts that must not be retrofitted
into the 151 rows:

- MCP Registry publication is now represented by selected family `D07`;
- Iru is a concrete deferred destination `X07`;
- product telemetry is classified as mechanism/policy `M11`.

Homebrew evidence also needs a date boundary: the historical index supports
Formula-related cases, while the audited current source emphasizes Casks.

## Implementation evidence progression

| Claim | First useful evidence | Decisive evidence |
| --- | --- | --- |
| bundle/plan law | compile-time and in-process probes | self-release consumes the same finalized bytes and history |
| normal provider success | protocol double | scratch/public provider receipt |
| response-loss continuation | fault-injected double | controlled scratch-provider loss and authoritative observation |
| public byte identity | digest/download oracle | self-release public bytes equal canonical bundle bytes |
| consumer behavior | clean local consumer | representative clean end-user fixture |
| custom-provider continuation | separate-process probe | clean application with a real external provider package |
| journal CAS | two-process race | backend conformance on supported local/CI deployment surfaces |
| Apple finalization | tool integration fixture | signed, notarized, stapled artifact adopted and distributed |

No production API name is selected by this roadmap. The atomic outcome and its
oracle come first; the smallest Effect expression that entails it is an
implementation-phase decision.
