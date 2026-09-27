# Provider error-policy prerequisites

Planning snapshot: **2026-09-26**, baseline
`f2266bd7065cb1378a1fbf95cc0172c7f1b389e4`. The reviewed provider files and shared
HTTP/parser helpers are unchanged from the preceding `f82f4a1` review. This record
identifies remaining work; it claims no provider implementation, new regression
result or native qualification. See [implementation status](implementation-status.md)
for completed work and [core error-policy evidence](core-error-policy-implementation.md)
for the separate core migration.

## Policy and scope

The five providers share [makeDataBoundary](../../packages/ts-release/src/Http.ts#L14).
Its `attempt`/`admit` convert every nonlocal exception into a provider failure;
`matches` converts every exception into false. Native/parser refusals need local
owners before this helper can preserve unexpected exceptions as defects.
Separate malformed-response catch blocks also need review: narrowing only the
helper leaves those successful fallback paths able to conceal bugs.

The target follows [CONTRIBUTING](../../CONTRIBUTING.md#data-failure-and-lifetime)
and pinned Effect **4.0.0-rc.115**: preserve local `ReleaseError` identity; admit
foreign instances through the stable schema-derived contract; map schema
refusals to the existing provider code/message; let unexpected exceptions die.
Use the existing [core classifier](../../packages/ts-release/src/internal/Error.ts)
as the semantic reference. Its small synchronous try/catch inside `Effect.suspend`
avoids a temporary `unknown` error channel rejected by the patched compiler.
Do not yield inside that try/catch.

`matches` should return false only for recognized admission failures and rethrow
unexpected errors to its caller. Preserve deliberate credential privacy and
native SDK failure projections. No new provider facade, optional strict mode,
durable schema, dependency upgrade or retry policy is needed.

## Owners and required translations

| Owner                                                                                                                                                                              | Remaining prerequisite                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [HTTP ownRequest](../../packages/ts-release/src/Http.ts#L55)                                                                                                                       | Detached native byte storage currently receives provider admission policy. Keep property reads outside the narrow clone adapter, and retain its provider code/message rather than accidentally exposing core `invalid-data`.                                                                                                                                                           |
| [NativeJson](../../packages/ts-release/src/internal/NativeJson.ts#L49)                                                                                                             | Fatal UTF-8 can throw before lexical admission. Existing `json-*` refusals already have typed owners. Later JSON.parse calls consume admitted syntax; do not catch the whole parser and conceal an internal bug.                                                                                                                                                                       |
| [Tar](../../packages/ts-release/src/internal/Tar.ts)                                                                                                                               | Fatal decoding in C strings and PAX fields escapes the supplied provider domain callback. npm and PyPI share this owner. Translate the decode operations without catching the whole algorithm or its callback.                                                                                                                                                                         |
| [npm Native](../../packages/npm/src/Native.ts#L18), [Wire](../../packages/npm/src/Wire.ts#L50), [Auth](../../packages/npm/src/Auth.ts)                                             | Own gzip failures, provenance UTF-8 and native byte capture. Auth's minted-token response uses ordinary JSON.parse over fatal UTF-8 at line 79: substituting the stricter native JSON parser would change accepted duplicates/numbers. `bundleFromJSON` at line 154 needs exact pinned SDK qualification; conversion can fail before its exported ValidationError is constructed.      |
| [npm Evidence](../../packages/npm/src/Evidence.ts#L195), [LocalAuthentication](../../packages/npm/src/LocalAuthentication.ts#L25)                                                  | Four nested catches retain distinct malformed-tag, incomplete-digests, malformed-version and malformed-package facets. Keep those distinctions while allowing unexpected bugs to escape. The browser-challenge catch similarly retains undefined for malformed native data, with token wiping unchanged.                                                                               |
| [GitHub Native](../../packages/github/src/Native.ts#L144), [Protocol](../../packages/github/src/Protocol.ts#L69), [Auth](../../packages/github/src/Auth.ts#L19)                    | A valid URL can contain percent-encoded bytes that fail decodeURIComponent. Translate that primitive. Restrict malformed-native response recovery to expected admission failures. The authorization probe deliberately permits exact reads when a parent is already published; recover only the required domain refusal, without hiding a nativeRequest bug.                           |
| [PyPI Archive](../../packages/pypi/src/Archive.ts), [Metadata](../../packages/pypi/src/Metadata.ts#L9), [MetadataFields](../../packages/pypi/src/MetadataFields.ts#L107)           | Own gzip/inflate and fatal UTF-8 failures. Pinned content-type 1.0.5 throws TypeError for malformed media parameters; catch only its parser call. RFC2231 parameter decodeURIComponent also needs local admission. Preserve ZIP offsets, CRC, overlap, size and path checks.                                                                                                           |
| [PyPI Evidence](../../packages/pypi/src/Evidence.ts#L82)                                                                                                                           | Remote base/file URLs and decoded filenames need expected-refusal owners. Fatal UTF-8 precedes parse5. Its duplicate-attribute callback already raises a domain error; do not catch all parser callback/traversal bugs. Preserve the existing malformed-simple fallback for actual bad input.                                                                                          |
| [MCP Protocol](../../packages/mcp/src/Protocol.ts#L189), [Auth](../../packages/mcp/src/Auth.ts#L66)                                                                                | Two `Effect.try({ catch: () => undefined })` blocks hide every exception before returning publication Unknown or observation Inconclusive. Use strict admission and typed recovery, preserving those malformed-response outcomes. Own credential-response byte decoding under its existing custom code.                                                                                |
| [OpenAI Package](../../packages/openai/src/Package.ts#L96), [Marketplace](../../packages/openai/src/Marketplace.ts#L91), [Submission](../../packages/openai/src/Submission.ts#L86) | Explicit Error branches for absent reader, root-manifest schema, dangling references, marketplace source policy and exact Bundle membership are expected refusals. Translate those branches to their existing custom code/message. Admit primitive marketplace fields before string predicates; do not catch arbitrary getters. Manifest UTF-8 remains a native decoding prerequisite. |

The compatibility decision must precede implementation: npm/GitHub/PyPI currently
use `<prefix>-data` with `<subject> data could not be admitted`; MCP/OpenAI custom
admission uses the selected code with `<subject> value could not be admitted`.
Existing domain and `json-*` errors retain their own identities. Inventing
`json-utf8` or `tar-utf8` would change this contract. Decode UTF-8 at the caller
before passing text to `decodeJson`, or qualify another deliberate projection.
The shared tar reader requires the same decision across its consumers.

Keep these existing distinctions:

- npm's file-read and Sigstore verify/sign adapters already project failures at
  native operation boundaries. Their lifetime questions are recorded in
  [native lifetime prerequisites](native-lifetime-prerequisites.md).
- GitHub observation's `Effect.orElseSucceed` is already typed recovery; strict
  producers allow defects to pass through it without replacing that combinator.
- OpenAI's empty `skillMarkdown` instructions Error is an invariant after the
  Instructions schema, outside `attempt`; it should remain a defect.
- Canonical copying rejects lone surrogates before npm's tag encoding filter.
  Already-admitted URL and BigInt inputs do not justify speculative broad catches.
- rc.115 class constructors throw ordinary Error on invalid fields. Decode
  untrusted fields before construction; do not classify arbitrary Error as schema
  refusal.
- [Catalog renderBytes](../../packages/catalog/src/Shared.ts#L55) has a separate
  broad wrapper and explicit raw Error refusals. It is not a makeDataBoundary
  consumer and needs its own bounded decision.

## Helper consumer inventory

All provider modules invoking shared `attempt`/`admit` or `matches` at this
baseline are listed below. GitHub Evidence's unrelated fact-comparison function
also happens to be called `matches`; it is not the shared helper.

| Instance                                                   | Consumer modules under that package's `src`   |
| ---------------------------------------------------------- | --------------------------------------------- |
| [npm/Native](../../packages/npm/src/Native.ts#L8)          | Protocol, Auth, LocalAuthentication, Evidence |
| [github/Native](../../packages/github/src/Native.ts#L9)    | Graph, Auth, Protocol, Wire, Observe          |
| [pypi/Native](../../packages/pypi/src/Native.ts#L5)        | Protocol, Auth, Wire                          |
| [mcp/Model](../../packages/mcp/src/Model.ts#L344)          | Model, Auth, Protocol                         |
| [openai/Package](../../packages/openai/src/Package.ts#L68) | Package, Marketplace, Submission              |

## Existing proof and gaps

This review inspected relevant assertions and selected full workflow blocks; it
was not a line-by-line rereview or execution of every suite. Retain independent
native outcomes and malformed fixtures. `rejects.toThrow`, synchronous `toThrow`
and Exit-only failure checks do not distinguish typed failures from defects.

| Existing proof                                                                                                                                                                                                                                                               | Protection to retain; specific gap                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [npm authoring](../../test/reimplementation/npm/authoring.test.ts), [protocol](../../test/reimplementation/npm/protocol.test.ts), [auth](../../test/reimplementation/npm/auth.test.ts), [local authentication](../../test/reimplementation/npm/local-authentication.test.ts) | Actual archive/metadata admission, independent version/tag facets, exact PUT bytes, no resend, credential exchange and token lifecycle. Refine affected existing generic rejection assertions to check typed code/message. Preserve the logical-clock ownership work.                                         |
| [Packed npm large-body consumer](../../test/reimplementation/npm/large-body-consumer.mjs#L56)                                                                                                                                                                                | Ordinary malformed JSON already requires ReleaseError. The existing invalid UTF-8 row only requires a throw; use it to qualify the chosen decoder contract.                                                                                                                                                   |
| [GitHub native](../../test/reimplementation/github/native.test.ts), [wire](../../test/reimplementation/github/wire.test.ts), [authority](../../test/reimplementation/github/authority.test.ts), [protocol](../../test/reimplementation/github/protocol.test.ts)              | Native URL facts, full request authority, token routing, complete pagination, coerced-target rejection and no second upload. Malformed-observation outcomes remain valuable controls; they do not demonstrate propagation of an unexpected implementation exception.                                          |
| [Warehouse protocol](../../test/reimplementation/warehouse/protocol.test.ts), [native oracle](../../test/reimplementation/warehouse/native-oracle.test.ts)                                                                                                                   | Exact multipart, JSON/HTML Simple facets, native Twine positive/negative metadata and refusal before I/O. Negative oracle toThrow checks need domain-error identity where this policy changes. No fresh fixture generation is implied.                                                                        |
| [MCP](../../test/reimplementation/ai/mcp.test.ts), [OpenAI](../../test/reimplementation/ai/openai.test.ts)                                                                                                                                                                   | Manifest variety, exact/conflicting observations, credential binding, deterministic package bytes, marketplace preservation, actual Git ownership and submission constraints. Generic rejects lack channel identity; MCP's exact/conflict/404/503 case does not reach the two unexpected-exception fallbacks. |

Before the strict change, reproduce one concrete provider callback/getter defect
through an existing real operation, preserving exception identity and checking
that no credential/read/write action occurred. Add separate proof for `matches`
or a successful fallback only when that costly failure escapes the same case.
The core host-machine and receipt-classifier regressions are not provider proof.
No such new provider reproduction is claimed here.

Proceed in bounded steps: qualify current error codes and SDK failures; implement
local compatible translations; then narrow the shared helper and direct fallback
guards coherently. Run the affected retained source/native/packed checks after
inputs settle. If only local prerequisites are implemented, report strict provider
adoption as pending: the shared helper affects all five providers.
