# Provider error-policy implementation

This increment follows the [provider prerequisites](provider-error-policy-prerequisites.md)
and the separately qualified [byte/archive owners](provider-native-prerequisites.md).
Its starting commit is `17d491d` (the provider inputs are unchanged from `8aa26cc`).
The complete installed Effect guide and relevant rc.115 declarations were read.
This record describes the bounded provider migration; it does not close the
remaining application, cleanup, tracing or product requirements.

## Ownership and compatibility

The existing `makeDataBoundary` remains the shared synchronous admission owner.
No service, Layer, schema facade, strict-mode option or provider registration is
introduced. Provider callbacks, artifact access, credentials and HTTP readers
retain their existing application composition. Request, Bundle, Plan and journal
bytes and dispatch authority are unchanged.

The shared policy preserves the original local ReleaseError instance, admits a
foreign instance through the existing schema-derived stable-tag guard, and maps
SchemaError to the boundary's original fixed default/custom code and message.
Unexpected exceptions become defects. `matches` returns false only for those
known domain/schema refusals; it rethrows unexpected exceptions. No raw native
message or credential response is added to the typed diagnostic.

| Owner                                     | Necessary translation or retained contract                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm Native / Wire                         | Decode native UTF-8 locally to `npm-data`, then pass the string to the existing lexical JSON parser. Its explicit `json-*` refusals and internal algorithm remain unchanged. Provenance attachment text uses the same native owner.                                                                                                                                                                                              |
| npm Auth                                  | Minted tokens retain ordinary JSON.parse semantics, including acceptance of additional fractional metadata. Native UTF-8 and that JSON.parse call project to `npm-data`; Schema decoding remains separate. The pinned bundleFromJSON conversion alone projects malformed native protobuf/bundle input. The verifier's owned byte clone keeps its historical data-refusal policy, with property capture outside the native catch. |
| PyPI Native / Archive / Metadata          | Reuse the existing provider UTF-8 owner for archive names, RFC822 metadata, JSON and HTML. The content-type parser and RFC2231 URI decode have narrow `pypi-data` projections. No surrounding grammar/traversal catch is introduced.                                                                                                                                                                                             |
| PyPI Evidence                             | Remote URL construction and filename URI decoding classify malformed input locally. parse5's existing duplicate-attribute callback remains a declared refusal. The Simple fallback handles known malformed input, while implementation/getter errors escape.                                                                                                                                                                     |
| GitHub Native / Auth / Protocol           | UTF-8 and URI-component failures retain `github-data`. The exact-read probe tolerates only the stable-tag `github-asset-parent-published` refusal. Response fallback preserves malformed-native/different-native distinctions for expected input; an unexpected error no longer becomes Unknown.                                                                                                                                 |
| MCP Model / Auth / Protocol               | Native OIDC bytes retain `mcp-oidc-response` and the fixed MCP value message. Publication/observation decoding uses the existing admission operation and typed recovery: malformed data remains Unknown/Inconclusive, unexpected exceptions remain defects.                                                                                                                                                                      |
| OpenAI Package / Marketplace / Submission | Explicit expected refusal branches now throw the existing custom ReleaseError and fixed message. Primitive marketplace strings are decoded before string predicates. Native manifest UTF-8 keeps `openai-manifest`. The impossible empty rendered instruction invariant remains an Error defect.                                                                                                                                 |

npm's independent malformed tag/version/digest/package facets and optional browser
challenge use the existing `matches` policy, rather than another public classifier.
Schema admission replaces constructor-only status validation for npm response and
observation status and GitHub native failure status. Previously those malformed
statuses raised a generic constructor Error and the surrounding broad wrapper
produced the fixed provider Fail. They now raise SchemaError and produce that same
fixed Fail. The constructors and their status ranges are retained.

Standalone public `decodeJson(Uint8Array)` is unchanged. Its raw UTF-8 behavior is
not silently revised by this provider increment. Fixed/admitted crypto algorithms,
URLs already admitted by schemas, and generated canonical JSON do not receive
speculative catch-all wrappers. SDK signing/verification and filesystem I/O keep
their deliberate native privacy projections. The separately owned signing lifetime
mask is not evidence for this classification policy.

## Smallest missing proof and chronology

Before any of this owner's production edits, three existing cases were extended:

- The public PyPI trusted-credential case supplies an exchange getter throwing a
  specific TypeError. The proof requires that exact defect and zero OIDC/exchange
  actions before the retained successful credential flow. A getter is necessary:
  an exception from invoking the callback was already outside the broad helper.
- The existing PyPI request-ownership case supplies a body getter throwing a
  specific TypeError. `node:assert.throws` requires that exact object instead of
  false. This independently covers the synchronous `matches` branch.
- The existing MCP publication/recovery case supplies a response-body getter
  throwing a specific TypeError. It must become the exact Effect defect instead
  of successful Unknown evidence. This reaches the separate direct fallback.

Command:

```sh
/tmp/ts-release-bun-qualification/node_modules/.bin/bun test test/reimplementation/warehouse/protocol.test.ts test/reimplementation/ai/mcp.test.ts --test-name-pattern 'native upload receipt|token and trusted credentials|owns one exact POST'
```

The actual baseline run exited **1**, with **0 passes, 3 failures, 5 filtered**.
Each failure reached its intended branch: MCP returned success, ownsRequest did
not throw, and trusted-host capture failed without a Die reason. Raw log:
`/tmp/ts-release-provider-policy-red.log`. The pre-edit source/test hash manifest
is `/tmp/ts-release-provider-policy-before.sha256`.

The MCP case lacked malformed-200 parser recovery coverage. After local parser
preparation, but before narrowing the shared policy, one `{}` response was added
to that same case. Its two compatibility assertions require publication Unknown
and observation Inconclusive. Both passed before the still-failing getter-defect
assertion; `/tmp/ts-release-provider-policy-mcp-control.log` records that exit **1**.
This is a pre-strict compatibility control, not an unchanged-production failing
behavior or a claim that the final MCP test is byte-identical to the first red.

Existing invalid npm exchange rows now require typed expected error codes; existing
OpenAI marketplace refusals require their historical canonical/custom code/message; the existing native
Twine invalid-MIME row requires the fixed PyPI data error. These are assertion
refinements after owner translation, not new test-first claims. No inputs, test
cases, native fixture generation or matrix were added for those controls.

## Frozen-input record and independent review

The signing lifetime change was committed separately as
`a7043878ef964dac1ebcff6e3a2569471c5dc0e9` before this owner's Auth translations.
Both SDK operation masks remain unchanged. A later source review restored
GitHub receipt correspondence to the same guarded region as before; this did
not add a test or change the expected callback/refusal contract.

An independent reviewer read the three npm Auth translations, Native.text and
the pinned SDK conversion. No actionable defect was found in that scope:
ordinary token JSON acceptance, property capture outside primitive catches and
SDK privacy/lifetime masks were retained. This is not a whole-provider review
or native signing result.

Source/test identities are retained in
`/tmp/ts-release-provider-policy-{before,after}.sha256`. Raw evidence hashes:

| Record                                     | SHA-256                                                            |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `provider-policy-red.log`                  | `661b459a9ff43838cf2c3c737b8c8b0f6ac4de7084b272d40e1636ca77857409` |
| `provider-policy-mcp-control.log`          | `98a58bbfe469f8c204e18706fabafc8e773c5b6d4b33975c70e730faf410fb9a` |
| `provider-policy-lint.log` (empty, exit 0) | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

The first integrated behavior run exposed an incorrect uniform expectation in
that OpenAI assertion refinement: an explicit `sha: undefined` is refused by
`Identity.canonical` with `invalid-json` before marketplace schema/policy admission.
Source inspection confirmed this path was unchanged from the baseline. The row's
expected code/message was corrected accordingly; production was not changed and
no new input or assertion was added. The other source rows retain their custom
`openai-marketplace` refusal.

## Qualification

The coordinated static gate passed. The full behavior command passed 354 cases
and failed only the overstrong OpenAI assertion above; its corrected existing
case then passed with 14 assertions. All seven packed providers passed 61
commands through real Bun/npm installs and Node/Bun consumers. Native SDK signing
settlement also passed in the full behavior run, without a successful live
signing claim. See [combined qualification](continuation-qualification.md) for
exact commands, stopped stages, archive identities and limits. Provider source
was frozen throughout those stages; no production change was needed after the
OpenAI assertion correction.
