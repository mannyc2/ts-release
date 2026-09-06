# Provider contract and full-scope source forecast

[`provider-api.d.ts`](provider-api.d.ts) is the proposed replacement surface. It
contains real `Schema.Class` / `Schema.TaggedClass` declaration shapes emitted
with TypeScript 6.0.3 and Effect 4.0.0-rc.108. It does not declare existing
production exports. [`provider-api.typecheck.ts`](provider-api.typecheck.ts)
checks the proposal against the compiler-derived kernel and complete adopted
artifact declarations; this proves type compatibility, not provider acceptance.
The retained schema-only emission source contains no provider algorithms. String
refinements, strict decoding, ownership checks and native wire behavior below
remain implementation obligations, even where a declaration displays
`Schema.String` after refinement erasure.

The declaration authority is
[`tools/architecture-lab/proposal/provider.ts`](../../../../tools/architecture-lab/proposal/provider.ts).
Run `bun tools/architecture-lab/proposal/emit.mjs --check --consumer <installed-consumer>`
after the kernel projection. The consumer must contain the exact published
0.6.3 packages and Effect rc.108; omitting `--consumer` creates a temporary
consumer from the retained producer tarballs and the root dependency closure
using the existing loopback-only pack installer. The emitter compiles the
research artifact/Apple sources, records every proposed adaptation, emits the
provider declarations, and strictly checks provider/host witnesses. It never
changes research runtime formats or claims their proposed `ts-release/*`
formats were exercised in the packed protocol experiment.

The source donor is immutable ts-release overlay
`2ef7a9a61fe40608d053569cbcd71e40fca5c181`. Read it with
`git show <revision>:<path>`; it is different from current HEAD `9b14c6c`.
The provider rewrites preserve its native protocols while replacing its
duplicated application/reconciliation infrastructure with the tested kernel.
The selected producer dependency is now the published `effect-build@0.6.3`
family at `ef29a087baac8bdbcd90a54bb62a2dceb739dd91`; see
[`upstream/published-consumer.json`](upstream/published-consumer.json).
The earlier PR24 experiment remains historical evidence, not the selected
registry version. Neither run qualifies native Apple acceptance.

## Canonical ownership and host boundary

There is one existing root owner for `Content`, `File`, `Tree` and `Bundle`.
The provider declaration imports their complete tested shapes from
[`adoption-api/adoption.d.ts`](adoption-api/adoption.d.ts). There is no new
`FileRef` that drops executable delivery mode, tree paths or producer facts.
`ArtifactAccess.bundle` is the admitted, immutable bundle. Before preparation,
every referenced File/Tree must equal its bundle member under the strict codec;
matching a logical name alone is insufficient. Reads verify canonical decimal
size and SHA-256. Native provider integers are decoded without rounding, then
stored as decimal strings; content-size bounds apply before Number conversion.

Each namespace is one module of its owning vertical, not a dependency on the
other namespaces. npm, Warehouse and MCP acquire GitHub Actions OIDC through
neutral host capabilities. They do not import the GitHub publication provider.
Homebrew, Scoop and OpenAI render files; the root Git mechanism publishes a
commit containing those files. An application composes ordinary imports and
operation dependencies. It does not install providers dynamically or extend a
core provider-ID allowlist.

Author functions call core `createOperation`; core owns operation/plan hashes
and validates the entire DAG. Provider-local references derive mandatory edges;
an optional `dependsOn` argument can add edges but cannot remove those edges.
All authors validate exact native coordinate syntax and cross-field laws,
strictly decode excess properties and sever caller aliases. Shared scope values
are canonical JSON containing the definition ID and exact destination
coordinate. They contain no credentials.

`HttpProviderDefinition.ownsRequest` selects exactly one explicitly imported
definition using the complete scope, endpoint and method **before** credentials
or send. Zero or multiple matches fail. `decodeResponse(request,response)`
preserves native response facts; core subsequently decodes its versioned codec
and checks operation/request correspondence. A global status-to-success
callback is insufficient. This host-selection composition is a proposed seam;
the existing small HTTP wire slices do not establish its complete implementation.

Root owns the actual HTTP client, one-request mutation transport, no automatic
write retry/redirect, bounded read responses, read retry policy, credential
injection, redaction and lifetime. Provider helpers own authorization URL/body,
audience and response decoding. Ephemeral `CredentialExchange` responses may
contain secrets and never enter the journal or report. `OidcTokenSource` checks
the exact requested issuer, audience, repository/workflow/ref and expected
claims against the acquired identity. A helper returns headers only for the
matching endpoint/principal/scope. There is no credential callback in Intent,
PreparedRequest, Plan or an event.

The concrete additional runtime dependency roster is npm `semver@7.8.5` and
`sigstore@5.0.0`, plus OpenAI `semver@7.8.5`. The semver pin is the exact retained
overlay lock resolution; the Sigstore pin is a new explicit native-wrapper
dependency verified from its tagged source. Warehouse, GitHub, Homebrew, Scoop
and MCP add no JavaScript dependency beyond the root package and Effect. Git
is an explicit host executable. Common root OIDC acquisition/verification is
not reimplemented or charged to each publication package. All seven providers
use an exact root package version and the aligned Effect peer. Root owns
`effect-build@0.6.3`; its Apple subpath activates the optional exact
`effect-build-apple@0.6.3` peer. The complete native SDK dependency closure is
installation data, not handwritten provider source, and Sigstore has not been
installed or exercised by this declaration check.

## Concrete native behavior retained

**npm.** `PublishIntent` retains public npmjs publication, initial tag, exact
tarball, explicit token/trusted authorization and a discriminated provenance
policy. Private workspace candidates structurally omit operations. Three public
packages remain three coordinates; later tag movements are separate operations.
The provider reads package metadata from the exact tarball and checks
name/version/private/publishConfig, native SHA-1 shasum and SHA-512 integrity.
Publication and initial-tag observations remain separate facets. A moved tag
does not authorize replay of an immutable version PUT.

`ProvenanceSource` has the retained 14 fields, including its format version:
server URL, repository, workflow path/ref, source ref/commit, event, repository
and owner IDs, runner environment, run ID/attempt and public visibility.
`GitHubActionsProvenance.bundle` is a distinct immutable File containing the
signed Sigstore v0.3 JSON bundle. `createProvenance` is an explicit authorized
preparation operation before freezing Bundle/Plan. Its output must be adopted
before authoring publication. `prepare` never invokes attestation or silently
changes signed bytes. A fresh runner reuses the selected provenance File and
reacquires only publication credentials. Structural DSSE/exact-payload checks
are distinguished from cryptographic signing and verification.

The concrete native adapter is `makeSigstoreAttester`: `sigstore@5.0.0`, source
commit `7d2900eca1c22b3f87c13987c8d4b7c9a29b733a`. Its public
`attest(Buffer,payloadType,options)` accepts explicit `identityToken`,
`fulcioURL`, `rekorURL`, `tlogUpload`, `legacyCompatibility`, `retry` and
`timeout`; the adapter selects explicit identity, transparency upload, v0.3
output and zero write retries. It calls native verification with the GitHub
issuer and an escaped, anchored expected workflow certificate identity, using
the configured TUF root/cache. The default ambient CI identity provider and
default two retries are not inherited. The wrapper and its dependency are
charged to npm below; the overlay only had an injectable attester, not this
implemented native wrapper. Exact retrieved files and hashes are recorded in
`provider-api-evidence.json`. Native methods and option names were checked
against [the pinned Sigstore client](https://github.com/sigstore/sigstore-js/blob/7d2900eca1c22b3f87c13987c8d4b7c9a29b733a/packages/client/src/sigstore.ts)
and [configuration](https://github.com/sigstore/sigstore-js/blob/7d2900eca1c22b3f87c13987c8d4b7c9a29b733a/packages/client/src/config.ts).
The retained statement field order was checked against
[npm 12.0.2 provenance source](https://github.com/npm/cli/blob/v12.0.2/workspaces/libnpmpublish/lib/provenance.js).
No Sigstore signing or OIDC exchange was executed in this task.

**Warehouse.** Wheel and sdist inputs are separate tagged classes; sdist fixes
`pythonTag` to `source`. Metadata is decoded from immutable distribution bytes,
not an arbitrary caller metadata dictionary. Hosted PyPI/TestPyPI endpoints
are explicit. Compatible pypiserver/devpi inputs retain implementation/version
and `duplicateLaw: "not-inherited"`. Their exact qualification pins come from
the selected fixture matrix; a version string alone is not proof of a law.
Hosted trusted authorization binds the correct `pypi`/`testpypi` audience.
Token authorization retains an explicit username for compatible Basic auth;
hosted PyPI fixes it to `__token__`. HTTP 200 acceptance, warnings and request
IDs are native receipt facts. Uploaded digest or fabricated upload IDs are not.
Per-file Simple observations retain JSON/HTML hash, size and filename laws,
including deleted-filename conflicts. No HTTP provider acquires automatic
replay authority from a duplicate response or an absent read.

**GitHub.** Six operations remain explicit: lightweight ref, annotated object,
annotated ref, draft release, one asset, and publication. Annotated refs reference
the object operation; assets/publication reference the draft operation. Authors
derive these edges and publication depends on every selected asset, including
the zero-asset case. `ManagedTag` references an in-plan ref operation;
`ExistingTag` requires exact tag/commit observation without inventing a mutation.
The numeric release ID and upload template come from the parent operation's
validated receipt or fresh native observation; they are never authored guesses.
Multiple conflicting parent facts fail binding. Parent references must match
definition, repository, tag and operation association.

`ReleaseFacts` and `AssetFacts` preserve returned IDs, returned tag/draft,
upload-template identity, stored asset name, starter/uploaded state, size,
optional native digest and scoped URLs. Returned name is distinct from the
requested name. Missing digest requires exact download hashing for observation.
Full pagination, tag-object peeling, native status codes and pre-/post-response
loss remain part of the vertical. The proposal's decimal native IDs preserve
the value; the parser must reject or losslessly decode unsafe JSON numbers.

**Catalogs and Git.** Formula has exactly the four retained macOS/Linux cells;
Scoop has the two Windows cells. Every download uses an owned File, and its
hash is derived from Bundle, not a free second SHA field. `GitCatalog` is the
root owner for one/two/many rendered paths in one commit/ref CAS. It preserves
the donor's canonical `core-git-object-set/v1` representation of object type
and base64 bytes; it does not introduce a native `.pack` persistence format.
`CommitInput.baseObjects` binds an exact expected native commit/tree snapshot.
Construction preserves unmanaged paths, validates all managed mode/content
bindings, computes native OIDs, and returns one owned final object set. Intent
retains exact remote/ref/old/new, object format, object-set Content and managed
files. The object bytes belong to root content storage and must be included in
the immutable handoff closure. Native reconstruction admits the full desired
graph; fetching old history is a read and must not change the frozen update.

The request body remains empty to preserve the tested core Git mechanism.
`NativeHost.transport(intents,otherwise)` captures an immutable authority table
inside the actual core constructor. Each execute closure selects the full
remote/ref/old/new tuple within its principal/scope, resolves owned objects,
verifies native hashes/graph/managed paths in a private scoped repository, then
uses the exact supplied lease argv. Multiple intents sharing an authority pair
are grouped under one captured closure; duplicate tuple with different intent
bytes fails construction. Other transports use only the common non-Git fallback.
The completed research amendment is 13 additional physical core lines (58 to
71), with no new event/state or replay mechanism.

The focused real-Git suite passed **7 tests / 65 assertions**, including two
authorities, deleted producer repositories, owned object-set reload in separate
workers sharing SQLite, actual response loss and protected replay, two files
per native commit, tamper rejection before push, immutable authority-table
capture, and fallback isolation. The full native-host public API is still a
production proposal: this bounded fixture does not implement the complete
donor parser, credential environment, resource policy or all graph rejection
cases. Those costs remain in the Git forecast.

**MCP.** The declaration restores the complete retained native shape for five
registry kinds (`npm`, `pypi`, `oci`, `nuget`, `mcpb`) and three transports
(`stdio`, `streamable-http`, `sse`). It includes runtime/package arguments,
input descriptors and variables, environment/header descriptors, remotes,
repository metadata, icons and permitted publisher metadata. OCI identity
contains its exact tag/digest; MCPB carries `fileSha256`. Declaration classes
are not substitutes for the pinned schema and official registry restrictions:
exact versions, namespace authority, at least packages/remotes, duplicate names,
template variables, allowed secret descriptors and publisher-only `_meta` must
all validate. Registry mutation is one native publish followed by exact-version
observation; it does not publish referenced npm/PyPI/OCI/NuGet/MCPB packages.
Those references remain explicit coordinates, with no sibling-provider imports.
The retained schema date is 2025-12-11; its native package and transport shapes
were cross-checked against the
[official format source](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/generic-server-json.md)
and [dated schema](https://github.com/modelcontextprotocol/static/blob/main/schemas/2025-12-11/server.schema.json).

**OpenAI.** AI01 is an installable owned **Tree**, with one plugin manifest and
one skill tree. Supporting file bytes and executable modes are preserved;
effect-build/root owns materialization and tree finalization. AI02 renders
`.agents/plugins/marketplace.json` with a `local` source and `./` relative path,
preserving other admitted entries, then uses the root Git owner. AI03 takes the
same Tree, listing and logo File, starter prompts, exactly five positive and
three negative test cases, release notes and explicit attestations. Its result
is a validated handoff with human submission outstanding. It declares no
submission endpoint or publication operation. These retained boundaries agree
with the current [plugin packaging documentation](https://developers.openai.com/plugins/build/plugins)
and [submission documentation](https://developers.openai.com/plugins/deploy/submission),
read on 2026-09-05. Validator success cannot establish the truth of an attestation,
the quality of a test result or acceptance by the submission portal.

## Coverage of all 69 selected outcomes

The detailed projection is `provider-api-evidence.json`; every selected row is
assigned exactly once. Grouping here does not remove provider-specific oracles.

| Selected rows | API owner and preserved behavior |
| --- | --- |
| K01–K03 | Root report/interpreter and CLI/Action; provider native facts feed report, one-plan continuation and explicit credentials |
| D01-01–06 | Npm publication, provenance, later tags and workspace authoring |
| D02-01–07 | Warehouse per-file upload and native compatible-server laws |
| D03-01–06 | GitHub six-operation graph and native receipt/observation binding |
| D04-01–03 | Homebrew renderer; root GitCatalog CAS/recovery |
| D05-01–03 | Scoop renderer; root GitCatalog CAS/recovery |
| D06-01–07 | Existing open kernel codec/definition/host interfaces; external HTTP/Git/opaque providers and two instances |
| D07-01–03 | MCP native manifest, publish and observation |
| P01-01 | Root lossless file adoption |
| P01-02–04, P02-01–03, P03-01–02, P04-01, P05-01/02/03/05/06 | Existing effect-build executable/archive/source/uv/nFPM public operations; no provider implementation copies |
| P06-01, P07-01, P08-01, P09-01–03 | Existing effect-build Apple/Windows authoring/signing operations |
| P10-01–04 | Root Apple preparation/journal bridge plus existing upstream native operations; full hosted native matrix remains required |
| Q01 | Root deterministic checksum view of owned Bundle |
| Q02-01–02 | Existing effect-build Syft producer integration |
| AI01–03 | OpenAI Tree/marketplace/submission validator; root Git update and host materialization |

## Bottom-up production source forecast

[`provider-api-evidence.json`](provider-api-evidence.json) gives each component,
donor file/range and arithmetic. These are **full replacement implementation
lines**, not additions on top of the donor, and not an achieved source reduction.
They include native validation, provider-specific authorization, construction,
wrappers and integration. They exclude tests, generated declarations and shared
root machine/content/HTTP code, which have separate owners. The low case assumes
direct use of proved common machinery; the high case retains the donor's
separate diagnostic branches and requires more explicit native parsing. No
compression percentage or target cap was used.

| Vertical | Measured donor physical lines | Low | Expected | High |
| --- | ---: | ---: | ---: | ---: |
| npm including native Sigstore wrapper | 2,837 | 1,090 | 1,630 | 2,320 |
| Warehouse | 1,712 | 740 | 1,130 | 1,630 |
| GitHub | 3,142 | 1,020 | 1,520 | 2,180 |
| Homebrew renderer | Shared catalogs donor 359 | 140 | 200 | 280 |
| Scoop renderer | Same donor; do not add it twice | 80 | 120 | 180 |
| MCP | 1,387 | 820 | 1,180 | 1,580 |
| OpenAI | 774 | 490 | 730 | 1,030 |
| Root Git objects, catalogs and native host | 1,858 plus shared catalog slice | 710 | 1,000 | 1,460 |

The Git row was revised after the concrete
[`native Git construction experiment`](../../../../tools/architecture-lab/git-catalog/README.md):
122 physical / 157 printer lines delegate tree/commit/graph parsing to native
Git, with 2 tests / 28 assertions on both native object formats. The prior
1,010 / 1,570 / 2,200 estimate remains in the evidence for comparison. The
revision preserves 490 expected native-host lines and does not claim all Git
implementation is complete. Its expected decrease is 570 lines;
[the current program forecast](forecast.json) owns the complete arithmetic,
counting lanes and threshold status.

The Git row includes its 134-line donor authorization boundary and existing
71-line research core; do not add those again. The 550-line donor
`transport/provider-http.ts`, 240-line `core-http.ts`, and 193-line
`core-http-application.ts` move to the shared root transport/auth owner.
Their costs have not disappeared and are intentionally not counted once per
provider. Generic OIDC acquisition and HTTP mechanics belong to that root
forecast; npm/Warehouse/MCP-specific token exchange schemas/URLs and Sigstore
orchestration remain in the rows above. Thin public wrappers and new-kernel
provider context bindings are explicitly included in each row. The original
GitHub re-export of OIDC types is removed, not charged as a GitHub dependency.

The npm 90-line, owned-npm 39-line and Python 85-line wire slices are witnesses
for package/layout and machine integration. They omit full native metadata,
provenance, tag facets, Simple semantics and authority behavior, so they are
not credible full-vertical forecasts. No live npm, Warehouse, GitHub, MCP,
Sigstore, brew/Scoop consumer or OpenAI install/submission acceptance is claimed
by this provider declaration task.
