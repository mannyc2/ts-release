# Proposed durable vocabulary

[`durable-vocabulary.json`](durable-vocabulary.json) fixes the spellings left
open by the generic `ProviderDefinition` interface. It is documentation for
the selected first-party implementations, not a central allowlist, runtime
registry, capability table, public export, or additional persisted object.
External providers remain ordinary imported definitions with their own IDs.

The 12 definitions cover npm publish/tag movement, Warehouse file upload, six
GitHub mutations, MCP publication, root Git ref update, and the three-kind
Apple preparation union. Every present provider-local codec channel starts at
the exact string `"1"`: `intentVersion`, `receiptVersion`,
`observationVersion`, and `dispatchError.version`. The owning definition and
channel distinguish these versions. IDs use `ts-release/<native-action>`;
they do not duplicate a schema version in the action name. These are routine
implementation choices being fixed before the rewrite, not new architecture.
Legacy donor IDs ending in `/1` and research `pr24` IDs are historical evidence;
this hard cut promises no reader for them.

Each JSON row names the proposed intent class and exact native donor symbols
whose facts and validation belong to that provider's private codecs. Donor
paths are bound to `2ef7a9a61fe40608d053569cbcd71e40fca5c181` through
[`provider-api-evidence.json`](provider-api-evidence.json). These are source
coordinates, not claims that the old wrappers already implement the new API.
Keep native receipts, observed differences, lossless IDs, diagnostics and
coordinate checks. Do not transplant provider reconciliation histories,
`automaticReplayAuthority` fields, generic request projections, or old
framework intent envelopes. The kernel owns their retained common meanings.
This projection adds no native payload fields or public receipt/error schemas.

Known native HTTP response-decoding errors use their provider's error codec
version `"1"` and remain `Inconclusive`. Apple uses the actual published
`Notary.SubmissionOutcomeUnknown` codec with version `"1"`; source/credential
and native diagnostic correspondence remain mandatory. Root Git currently
uses the kernel's error path, with no private native-error codec. Other
transport errors use the existing reserved `core-dispatch-error/1`. Local
preparation/validation errors are typed function failures and need no extra
durable wrapper. No first-party operation selects a rejection-proof codec:
`null` in the projection means the optional boundary is absent, not a JSON
null payload. Neither an HTTP failure nor a native error claiming
`before-dispatch` establishes the kernel's non-commit proof. Git's structural
`GitCas` remains the selected protected replay mechanism.

The result mapping is exact: the provider's `decodeResponse`, or Apple's
captured opaque transport, returns an Effect success containing
`{_tag:"Unknown", reason, nativeError}`. `reason` is a nonsecret string;
`nativeError` is the result of encoding the decoded native error with the
owning `dispatchError.codec`. This is the existing
[`SendResult`](kernel-api.d.ts) member, not an additional envelope. The kernel
decodes and checks correspondence before recording version `"1"` as
`ObservationRecorded` / `DispatchError` / `Inconclusive`.
Failing that Effect with `ReleaseError` instead records only the core
code/message and loses the native payload. The interpreter mapping is at
[`run.ts:197`](../../../../tools/architecture-lab/machine/src/run.ts:197);
the JSON binds the provider-native donor errors and frozen Apple codec source.
Only `Notary.SubmissionOutcomeUnknown` receives this Apple native mapping.
Other `NativeAppleError` members retain the typed function error channel;
their complete native payload is not claimed to survive the core journal path.

The scope field is the exact kernel-canonical JSON encoding of
`{definitionId,coordinate}`, with no excess keys. The JSON pins every
coordinate key and its source in the decoded intent. For example, the actual
scope string for an npm version is:

```json
{"coordinate":{"name":"@example/tool","registry":"https://registry.npmjs.org/","version":"1.2.3"},"definitionId":"ts-release/npm.publish"}
```

`principal` remains a separate request fact; credentials remain ephemeral.
Native coordinate validation occurs before authoring. A scope is not an
authorization grant: the owning definition and host still check endpoint,
method, principal, scope and the complete request binding before credentials
or dispatch. The core fingerprints body bytes and all request facts once.
Auth-only exchange calls and journal-backend credentials retain their explicit
host contracts; they are not additional publication definitions.

GitHub child coordinates contain immutable parent operation IDs. Actual
annotated-tag OIDs, release IDs and upload templates come only from admitted
parent evidence, and are checked against the constructed endpoint/body and
native response. Scope is not rewritten when that evidence arrives. Root Git
uses `{remote,ref}` and combines the selected managed files for one
principal/target into one commit operation. Its supplied `scope` must equal
that derived value; the captured branch additionally binds old/new OIDs and
owned objects. Apple uses its collection-bound journal ID, artifact name,
native kind and public credential selector. Its new spelling replaces the
research prototype's credential-selector-only scope; it does not claim that
the frozen app prototype exercised this target scope string.

Apple's opaque request uses `transport:"opaque/1"`, `method:"invoke"`, empty
headers, and `_tag:"None"` replay protection. App's endpoint is
`effect-build-apple/Notary.submitApp`; DMG/pkg use
`effect-build-apple/Notary.submit`. Its body is UTF-8 of kernel canonical JSON
over `Schema.encodeSync(ApplePreparation)(input)`, using the complete admitted
three-kind union member. `principal` comes from that member; `scope` uses the
exact coordinate above. Core `makeRequest` derives the body hash and decimal
byte count. Before native work, the captured transport strictly decodes that
body and re-derives the complete facts for comparison. Native kind and source
restoration determine the exact public call; these bytes describe an opaque
invocation and do not claim to be Apple's ZIP or native wire body.

This extends the frozen
[`app request seam`](../../../../tools/architecture-lab/apple/apple-preparation.ts:99).
[`apple-api.typecheck.ts`](apple-api.typecheck.ts) checks the actual three-kind
native input types. The existing mixed-release proof executes two app inputs
with protocol doubles, not these proposed DMG/pkg request branches. The new
IDs, versions and scope spellings likewise do not relabel that experiment's
immutable bytes as coverage of the proposed implementation.

The JSON also fixes all root formats, hash domains, event tags, replay tags and
the length-prefixed hash preimage used by
[`identity.ts`](../../../../tools/architecture-lab/machine/src/identity.ts).
`NoReplay` encodes as `_tag: "None"`. `PreparationScope` and its reconstructed
one-operation Plan view remain transient. The only persisted publication Plan
binds the complete final Bundle; Apple collection and event associations
remain those in [`apple-api.d.ts`](apple-api.d.ts).

Content hashes use exact bytes. The upstream ordered tree manifest, Git
native object hashes, registry checksums and signed provenance bytes keep
their own native algorithms and formats. `core-git-object-set/v1` and
`npm-github-actions-provenance-source/v1` are consciously retained local
formats, not external standards. The JSON lists external schema URLs, media
types and API pins separately; these do not acquire `ts-release` headers.

This is a proposed spelling freeze. The published upstream adoption, native
Git and local protocol evidence retain their original bytes and IDs. Full
provider codec implementation, strict refinements and hosted qualification
remain the explicitly identified implementation/qualification work in
[`provider-api.md`](provider-api.md),
[`apple-adoption.md`](apple-adoption.md), and the handoff; no additional test
acceptance is asserted here.
