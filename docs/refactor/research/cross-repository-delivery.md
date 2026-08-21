# Cross-repository delivery program

Status: research plan for a coordinated effect-build and ts-release vNext. It
derives scope from [`launch-scorecard.md`](launch-scorecard.md) and does not
freeze npm package names, production APIs, or dependency versions.

## Product boundary

The two repositories form one release product without becoming one framework:

```text
source/tool inputs
  -> effect-build concrete production and transformation
  -> finalized caller-selected outputs
  -> ts-release immutable adoption and release planning
  -> provider mutation and durable continuation
  -> machine report plus external acceptance evidence
```

The handoff is deliberately small. effect-build does not need ts-release's
provider model or journal. ts-release does not need tool-specific intermediate
files, process management, or build-provider options. Both may share an
extraction-ready immutable artifact package later if a second real consumer
requires it; vNext does not begin by creating a third repository.

## Pinned research baseline

- effect-build research branch:
  `15c811bb9904142a33d119766b62082f3c689f13`;
- Effect public-surface alignment candidate: `4.0.0-rc.108` at
  `bef7bf38ae4b73d5511043f707aed083de5da7cc`;
- production alignment decision: exact `4.0.0-beta.107` family at
  `3c495ae7c96d43bfc3b8020250562a194c2c895e`;
- ts-release PR #20 corrected research base:
  `2fbb58c3dadb874a528d37530603aa8b396f30c5`.

The historical pins make the research reproducible. The beta.107 line is the
production decision required by the repository's aligned-beta policy. Every
Effect package in each install graph moves together; the release must not mix
beta/RC versions merely to satisfy individual probes.

## Capability ownership

### Existing effect-build capability to integrate

| Area | Research-pin status | vNext work |
| --- | --- | --- |
| Bun executable | exact six-cell target matrix exists | return finalized outputs under the common handoff; integrated run fixtures |
| Deno executable | exact six-cell target matrix exists | same handoff and integrated fixtures |
| Node SEA | Linux x64 GNU exists with internal esbuild stage | preserve exact supported scope; do not advertise a broader matrix |
| platform/process execution | existing foundation | retain scoped lifetimes and typed tool failures |

### Concrete effect-build capability to add

Package names below are working boundaries, not registry commitments.

| Working boundary | Selected outcome |
| --- | --- |
| archives | deterministic ZIP/tar.gz; exact Git-tree source archives; unsafe-layout rejection |
| Python | one pinned uv frontend, exercised against `uv_build` and `poetry-core` projects |
| nFPM | deb, rpm, apk, Arch, and MSIX production |
| Apple | app bundles, DMG, pkg, Developer ID signing, notary operations, stapling, Gatekeeper verification |
| Windows signing | SignTool MSIX Authenticode mechanics; production credential backend remains open |
| SBOM | pinned Syft SPDX JSON and CycloneDX JSON integrations |

SHA256SUMS may remain a deterministic view in the immutable handoff kernel
rather than earning a standalone effect-build package.

### ts-release capability to add

| Area | Selected outcome |
| --- | --- |
| artifact kernel | immutable content ownership, logical identity, final bundle, durable load boundary |
| plan/history | versioned provider Intents, core-derived operation identity, append-only journal fold |
| continuation | initial send, observation, trusted protected replay, proven noncommit, explicit risk acceptance, honest stop |
| providers | npm, Python indexes, GitHub, conditional Git, MCP Registry, external-provider envelope |
| catalog products | Formula and Scoop rendering from canonical artifact/release views |
| product delivery | machine report, GitHub Action, non-manual self-release |
| AI-native | OpenAI plugin build/validation, repository marketplace update, portal handoff validator |

## Handoff laws

Every producer integration must satisfy the same small boundary without
pretending its build semantics are interchangeable:

```text
input
  explicit source/artifact handles and tool-specific options

output
  zero or more finalized logical files
  public/logical names
  owned immutable bytes or a transfer that becomes owned on adoption
  tool/target provenance needed for reporting

forbidden leakage
  private temporary path as provider identity
  mutable Uint8Array alias retained by caller or producer
  ambient global artifact reader/writer service
  producer-owned peer checksum/manifest authority
```

The receiving bundle derives content identity and rejects duplicate logical
identity conflicts. Two logical artifacts may share one content object without
sharing meaning. Finalization must not be advertised as a TypeScript one-shot
proof when an aliased mutable draft can still be retained.

## Wire-first implementation sequence

The sequence is vertical. Each provider slice reaches its external oracle and
report before another generalized orchestration layer is added.

### Milestone 0: freeze only prerequisites

1. resolve the nine scorecard choices or accept the provisional deferrals;
2. select the minimum production Effect version and keep install graphs
   aligned;
3. implement immutable bundle/load-boundary laws;
4. implement durable plan, journal events, and `appendIfRevision` contract;
5. select the first supported local/CI journal deployments through evidence,
   not the provider list;
6. keep execution approval explicit: plans are data until approved.

Exit: a fresh process can decode an untouched plan/bundle/journal and produce
the same operation identities and report without dispatch.

### Milestone 1: native npm vertical slice

Implement native tarball publication, initial tag receipt, dist-tag movement,
plural workspaces, private omission, normal success, and ambiguous completion.

Exit: a scratch npm fixture covers `A/M/B/C/J`, including a response-loss case
that never converts observed absence into permission to resend.

### Milestone 2: Python file plurality

effect-build adds the selected uv frontend/fixtures. ts-release adds per-file
Warehouse publication, trusted publishing, four-file progress, pypiserver and
devpi compatibility boundaries, and ambiguous continuation.

Exit: the same finalized wheel/sdist set passes metadata and clean-install
oracles, while provider-specific duplicate laws remain separate.

### Milestone 3: GitHub resource graph

Implement tag/ref, draft release, independent asset operations, publication,
and separate response-loss paths for release creation and asset upload.

Exit: zero and three asset fixtures pass; the report exposes partial progress;
the 502/starter case is distinguished from genuinely unavailable responses.

### Milestone 4: conditional Git products

Implement the core expected-old/desired-new Git request, Formula and Scoop
renderers, one/two-path atomic commits, lost-response read-back, and clean
consumer fixtures.

Exit: one conditional transport law serves both products without merging their
rendering or consumer semantics.

### Milestone 5: custom-provider proof

Promote the clean-consumer research into a packed external provider fixture
with a service-free Intent codec, core HTTP and opaque variants, two configured
instances, native durable values, and process-2 continuation.

Exit: core and CLI are unchanged when the provider package is added. The
write-only opaque variant stops `Inconclusive` after uncertain completion.

### Milestone 6: broad artifact production

Deliver archive/source-archive, system package, Apple, Windows signing, and
SBOM integrations in effect-build. Each producer has a pinned external tool,
finite output matrix, negative fixtures, and clean-consumer oracle.

Exit: every selected `P`/`Q` scorecard row returns finalized outputs through
the same handoff and passes its own tool/format oracle.

### Milestone 7: MCP and OpenAI-native delivery

Implement MCP Registry manifest/publication/continuation and the three OpenAI
plugin leaves. Repository marketplace mutation reuses conditional Git. Portal
submission remains a validated handoff, not a fake remote provider.

Exit: schema/public registry/clean discovery evidence exists for MCP; clean
local install, marketplace discovery, and positive/negative submission tests
exist for the OpenAI plugin.

### Milestone 8: product release gate

Ship the first-party GitHub Action and use it to release ts-release without a
manual publication workflow. Inject interruption at every dispatch boundary
in scratch repositories before self-release.

Exit: the public package/assets/catalog bytes equal the finalized bundle;
consumer fixtures pass; a fresh runner reaches a truthful terminal report.

## Representative fixture portfolio

One self-release cannot exercise the domain. The coordinated gate needs:

| Fixture | Primary leaves |
| --- | --- |
| three-package TypeScript workspace with one private package | `D01` |
| pure-Python projects using uv_build and poetry-core | `P04`, `D02` |
| portable CLI executable matrix | `P01-P03`, `D03-D05`, `Q01-Q02` |
| Linux system-package CLI | `P05-01` through `P05-05` as selected |
| Windows MSIX/signing application | `P05-06`, `P09-03` |
| Apple arm64/x64 app and installer | `P06-P10` |
| external provider application with two endpoints | `D06` |
| MCP server package | `D07` |
| skills-only OpenAI plugin | `AI01-AI03` |
| ts-release itself | `K01-K03` integrated release gate |

Fixtures should be small products, not synthetic representations of internal
state. Their assertions terminate at tool formats, provider endpoints, public
bytes, and clean consumers.

## Cross-repository change protocol

1. Land shared-law research and fixtures before naming broad abstractions.
2. For an effect-build addition, first land a producer fixture and finalized
   handoff result; then consume its released/pinned package from ts-release.
3. Keep coordinated integration PRs linked with exact commit/package pins.
4. Never make ts-release CI depend on an unpublished mutable checkout as the
   claimed release path.
5. Keep API compatibility shims local to the repository that owns them; do not
   add a release mode to mask version skew.
6. Publish incremental packages through the new non-manual path as soon as the
   corresponding vertical slice is trustworthy.

The versioning strategy may use prereleases while the contract is settling,
but the acceptance report must always record exact package/source identity as
diagnostic provenance.

## Durable Apple boundary

Apple notarization is the only selected producer flow that performs a remote
mutation before ts-release receives final bytes. To preserve one history:

```text
ts-release operation/journal
  records exact pre-notary artifact digest and dispatch facts
  invokes concrete effect-build-apple notary operation
  records returned submission ID/status as provider-native facts
  invokes polling/stapling/verification using recorded ID
  adopts only final verified bytes
```

effect-build-apple must not create a second authoritative workflow journal.
It may expose concrete submit/info/staple/validate Effects and typed values. A
future durable workflow engine can host the accepted history, but cannot
replace the provider law or close the commit-before-record gap automatically.

## Scope expansion rule

A new package, service, mode, or durable record enters the program only when:

1. a scorecard outcome and external oracle require it;
2. it owns one canonical fact or makes an invalid state unrepresentable;
3. a smaller view/composition cannot provide the outcome;
4. at least two implementations are genuinely substitutable before a common
   interface is introduced; and
5. its lifecycle and fresh-runner interpretation are explicit.

The standing review question remains: why does this capability not already
fall out from the bundle, plan, provider Intent, and ordinary Effect
composition?
