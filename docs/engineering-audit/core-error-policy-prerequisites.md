# Prerequisites for strict core error classification

This is planning evidence, not a completed implementation or qualification
report. The read-only review examined the core `attempt` callers and the helpers
they invoke in `.provider-validation-defects`, at commit
`e0bedee2433e7d2dccee94131c8f51824ac97902`. Source line references below identify
that snapshot. The Git/SQLite subset received an independent review. No source
edits, builds, tests or native failure reproductions were performed for this
inventory.

The bounded [provider validation change](provider-validation-defects.md) handles
the captured synchronous `validatePlan` callback. It does not make the shared
[core helper](../../packages/ts-release/src/internal/Error.ts#L14) safe to narrow.
That helper still preserves only local `ReleaseError` instances and converts
every other throw to `invalid-data: Value could not be admitted`.

The intended policy remains the one in [CONTRIBUTING](../../CONTRIBUTING.md):
expected failures stay typed, programming defects stay defects, valid multiple
package instances use stable error contracts, and credential privacy projection
remains explicit. A global `TypeError`, `SyntaxError` or `RangeError` catch cannot
implement this policy: the same JavaScript error class can represent either a
native parser refusal or a bug in a supplied callback.

## Concrete exception owners that need attention

| Owner and affected core callers | Current raw exception source | Minimum prerequisite before narrowing `attempt` |
| --- | --- | --- |
| [Identity.ts:84](../../packages/ts-release/src/internal/Identity.ts#L84), `parseCanonical`; called by [StoreCodec.ts:14](../../packages/ts-release/src/platform/StoreCodec.ts#L14) and [GitObjects.ts:46](../../packages/ts-release/src/platform/GitObjects.ts#L46) | `JSON.parse` receives foreign serialized JSON. | Translate malformed JSON at this parse operation. Preserve the subsequent canonical-comparison refusal. Do not catch the complete caller or all `SyntaxError` values globally. |
| [StoreCodec.ts:14](../../packages/ts-release/src/platform/StoreCodec.ts#L14), `readEvent` | Fatal UTF-8 decoding receives stored event bytes. | Translate decoder refusal locally. Size, schema, canonical and journal-binding refusals already have owners. SQLite read and Git journal read/roundtrip call this helper. |
| [GitProcess.ts:183](../../packages/ts-release/src/platform/GitProcess.ts#L183), `nativeText` | Fatal UTF-8 decoding receives native Git output. | Translate refusal in this narrow text owner. This covers `checkedText` at 191, GitRemote at 18, GitObjects at 46, GitJournal at 189 and GitHost at 123. |
| [GitProcess.ts:107](../../packages/ts-release/src/platform/GitProcess.ts#L107), runtime option admission | `realpathSync`, `lstatSync` and `accessSync` operate on configured native paths. | Translate native filesystem failures at those operations. Existing option and file-kind guards already throw the local `git-process` refusal. |
| [GitProcess.ts:114](../../packages/ts-release/src/platform/GitProcess.ts#L114) and [138](../../packages/ts-release/src/platform/GitProcess.ts#L138) | `mkdtempSync` creates the private runtime/repository directories. | Give directory creation a local native failure projection. Cleanup currently runs outside `attempt`; do not silently fold cleanup policy into this classification change. |
| [GitJournal.ts:67](../../packages/ts-release/src/platform/GitJournal.ts#L67) | `mkdirSync` creates the configured cache directory. | Translate that filesystem operation. The adjacent credential method binding at 66 is a dependency-contract operation, not filesystem refusal. |
| [SqliteJournal.ts:29](../../packages/ts-release/src/platform/SqliteJournal.ts#L29), constructor and acquisition at 131 | Directory creation, `Database` construction, and SQL initialization/transaction calls at 32–59. | Translate native FS/SQLite failures without swallowing callback defects or existing typed refusals. Bun's pinned SQLite declarations expose `SQLiteError`; native error text must not escape the safe failure projection. |
| [SqliteJournal.ts:69](../../packages/ts-release/src/platform/SqliteJournal.ts#L69), read attempt at 67 | SQL query/all/get calls at 69–82, followed by the stored-event parser. | Separate native database failures from row schema failures and revision/journal guards. Apply the stored-event parser prerequisite above. |
| [SqliteJournal.ts:99](../../packages/ts-release/src/platform/SqliteJournal.ts#L99), append attempt at 95 | SQL transaction/query/get/run calls through 123. | Classify native SQLite failure locally while retaining schema/domain refusals and unexpected transaction-body defects. |
| [HttpTransport.ts:55](../../packages/ts-release/src/platform/HttpTransport.ts#L55), `headers` | Node `validateHeaderName` and `validateHeaderValue` throw for malformed header data. | Translate precisely these native validators. They are reached by request preparation at 282, credential processing at 99, reads at 335 and credential exchange at 368. Duplicate/framing/TLS/binding checks already throw typed errors. |
| [GithubOidc.ts:182](../../packages/ts-release/src/platform/GithubOidc.ts#L182), runner URL admission | `new URL(rawUrl)` receives environment input without a preceding parse guard. | Admit the URL before construction, or translate the native parse refusal locally. Keep the origin checks before reading the runner bearer. |
| [GithubOidc.ts:93](../../packages/ts-release/src/platform/GithubOidc.ts#L93), token verification invoked at 228 | JWK import and signature verification consume external key/signature material. | Give expected native key/signature refusal a fixed safe owner projection. Do not wrap the entire verifier and conceal unrelated defects. |
| [GithubOidc.ts:84](../../packages/ts-release/src/platform/GithubOidc.ts#L84), 85, 216 and 228 | `decodeJson` performs fatal UTF-8 decoding of token segments and response bodies. | Handle byte decoding at the reviewed OIDC owner before passing text to the existing parser, or explicitly design a compatible parser error contract. Do not silently change every provider's parser failure projection. |

Native failures that currently reach core `attempt` become the fixed
`invalid-data` refusal. Introducing new owner-specific codes is a separate public
behavior decision. The default compatibility target is to retain the existing
safe code/message while moving responsibility to the operation that can reject.

SQLite initialization has an additional lifecycle concern: `db.close()` at
[line 61](../../packages/ts-release/src/platform/SqliteJournal.ts#L61) can replace
the initialization failure. The acquired journal's finalizer at 132 already runs
outside `attempt`. Neither issue is repaired merely by classifying SQLite errors.

## Parser and native distinctions

`Identity.copyData` at [line 67](../../packages/ts-release/src/internal/Identity.ts#L67)
parses the output of the owned canonical serializer. Unlike `parseCanonical`, it
does not consume foreign JSON syntax. An unexpected parse failure there is not a
reason to treat every `SyntaxError` as an ordinary data refusal.

[NativeJson.ts:38](../../packages/ts-release/src/internal/NativeJson.ts#L38) has a
different split. Its fatal UTF-8 decoder at 40 can reject malformed bytes. The
tokenizer and recursive grammar admission already use `fail` for malformed
syntax, depth, duplicate keys, unsafe numbers and ambiguous strings. Its later
`JSON.parse` calls at 47 and 94 operate on syntax admitted by that parser; an
unexpected failure there needs investigation as a parser defect, not a blanket
catch.

This parser is exported by [Http.ts:1](../../packages/ts-release/src/Http.ts#L1)
and used by GitHub, npm, PyPI, MCP and OpenAI packages. Turning its raw UTF-8
exception directly into a core `ReleaseError` would change provider failures:
their `makeDataBoundary` currently maps that exception to a provider-specific
code, but preserves a local `ReleaseError`. A core-only migration must avoid that
unreviewed change.

Ordinary HTTP and Git URL admission already use
[publicUrl](../../packages/ts-release/src/Http.ts#L90), which calls `URL.canParse`
before construction. They do not share the missing guard in the runner OIDC URL
path.

WebCrypto SHA-256 already has an explicit fixed failure projection at
[Identity.ts:90](../../packages/ts-release/src/internal/Identity.ts#L90).
[GitObjects.ts:27](../../packages/ts-release/src/platform/GitObjects.ts#L27) and
[GitJournal.ts:33](../../packages/ts-release/src/platform/GitJournal.ts#L33) use
fixed or admitted SHA algorithms. These are not foreign syntax parsers. An
unavailable host crypto capability may warrant a local operational policy;
internal algorithm/type misuse is a defect. This review did not reproduce either
case and does not justify a blanket crypto catch.

Byte copies at [Provider.ts:160](../../packages/ts-release/src/Provider.ts#L160),
173 and [HttpTransport.ts:374](../../packages/ts-release/src/platform/HttpTransport.ts#L374)
also deserve an explicit compatibility decision. A detached supplied buffer can
make native copying throw; the broad helper currently turns that into typed
refusal. If that behavior is retained, own the copy operation narrowly. Do not
apply the same rule to arbitrary getters or callback bugs around it. This is a
code-derived compatibility concern, not a reproduced regression.

Canonicalization and DAG traversal have no explicit depth bound. Adding one
would change admitted inputs and needs its own rationale. Resource exhaustion
does not justify globally catching `RangeError`.

## Callers whose expected refusals are already classified

The following groups primarily invoke schema decoding/encoding, canonical
validation or explicit domain guards. They need correct shared classification,
not new broad native catches:

- [Plan.ts:13](../../packages/ts-release/src/Plan.ts#L13), 14, 63, 64 and 95:
  descriptor/codec admission, DAG rules and plan reconstruction. Supplied codec
  implementation failures remain distinct from rejected input.
- [Provider.ts:163](../../packages/ts-release/src/Provider.ts#L163), 171 and 177:
  request facts, canonical facts, secret-header and replay guards, apart from the
  byte-copy decision above. `nativeEvidence` at 343 decodes, encodes and compares
  exact canonical representation.
- [Host.ts:89](../../packages/ts-release/src/internal/Host.ts#L89), 124, 130, 155,
  158 and 159, and [Release.ts:37](../../packages/ts-release/src/Release.ts#L37),
  46, 74, 154, 158, 159, 163, 180 and 195: owned snapshots, scopes, evidence,
  transport authority and history rules. Provider callbacks reached through
  evidence verification still require defect preservation.
- [ArtifactReader.ts:27](../../packages/ts-release/src/internal/ArtifactReader.ts#L27),
  [Content.ts:41](../../packages/ts-release/src/internal/Content.ts#L41),
  [Checksums.ts:17](../../packages/ts-release/src/internal/Checksums.ts#L17),
  [FinalizedReport.ts:50](../../packages/ts-release/src/internal/FinalizedReport.ts#L50)
  and 57, and [Identity.ts:100](../../packages/ts-release/src/internal/Identity.ts#L100):
  schema, bounds, member and canonical guards.
- [GitCatalog.ts:146](../../packages/ts-release/src/internal/GitCatalog.ts#L146),
  156, 174, 238 and 264, and GitRemote/GitObjects/GitJournal structural checks:
  schema admission plus explicit `invalid`/`fail` guards. Native parser and I/O
  exceptions are the specific gaps listed above. Dependency method bindings in
  GitCatalog at 163–165 are not data parsers.
- [Apple Model](../../packages/ts-release/src/apple/Model.ts#L71),
  [Preparation](../../packages/ts-release/src/apple/Preparation.ts#L32),
  [Native](../../packages/ts-release/src/apple/Native.ts#L66) and
  [Provider](../../packages/ts-release/src/apple/Provider.ts#L126) attempt calls:
  durable schema and evidence/source/output correlation. Native tools, artifact
  operations and content-owner Effects run outside these synchronous attempts.
- [GitAuthority.ts:166](../../packages/ts-release/src/internal/GitAuthority.ts#L166)
  and [Http.ts:215](../../packages/ts-release/src/Http.ts#L215): explicit transport
  authority and credential-route admission. The route's acquisition callback is
  invoked after the latter attempt.

Pinned Effect rc.115 distinguishes ordinary schema refusal from codec defects.
`effect/src/Schema.ts:1234–1269` returns/throws `SchemaError` for ordinary schema
failure and throws a global `Error` carrying the Cause when its synchronous
adapter encounters a non-schema failure or defect. Use `Schema.isSchemaError`,
whose stable marker is defined in `effect/src/internal/schemaError.ts:4`, instead
of assuming every exception from a decoder means invalid input. Preserving a
defect through the current synchronous adapter may preserve that wrapper rather
than the original callback exception directly; changing decoder APIs is a
separate compatibility decision.

The shared policy should preserve valid `ReleaseError` fields through the stable
tagged contract, including independent constructors, and project ordinary schema
refusal to the existing safe data error. It should not turn arbitrary schema
filter/transform defects into typed refusal.

## Defects, privacy and post-dispatch behavior

Unexpected exceptions from HTTP ownership callbacks at
[HttpTransport.ts:300](../../packages/ts-release/src/platform/HttpTransport.ts#L300),
provider correspondence/classification reached through
[Journal.ts:94](../../packages/ts-release/src/Journal.ts#L94), and host clock or
machine callbacks at [Host.ts:73](../../packages/ts-release/src/internal/Host.ts#L73),
170 and [Release.ts:149](../../packages/ts-release/src/Release.ts#L149), 170 are
programming defects. Missing dependency methods and throwing object/proxy traps
are not native parser failures. If malformed dependency shapes must remain typed
admission errors, add explicit owner shape/callability checks rather than
retaining a catch around everything.

Privacy deliberately has a different boundary:

- [GitProcess.ts:80](../../packages/ts-release/src/platform/GitProcess.ts#L80)
  already covers credential acquisition and returned-value processing with a
  fixed failure projection, preserving interruption without retaining a
  secret-bearing remainder of a mixed Cause.
- [HttpTransport.ts:80](../../packages/ts-release/src/platform/HttpTransport.ts#L80)
  protects acquisition, but returned-secret enumeration/validation at 99–104
  lies outside that protection. A strict shared helper would let those defects
  escape to callers. Cover this secret-processing owner explicitly while
  preserving interruption and safe binding/TLS/collision refusals. Credential
  exchange at 368 has the same need for deliberate treatment of live secret data.
- OIDC token/key parsing needs the local native projections listed above. A raw
  native cause must not become a diagnostic channel for credential material.
- [npm Auth.ts:77](../../packages/npm/src/Auth.ts#L77) uses its own helper around
  raw token-response JSON/UTF-8 decoding. npm authorization and local
  authentication require their own later review; they are not repaired by
  changing core `attempt`.
- The legacy Promise application's factory normalization is explicitly local at
  [Application.ts:135](../../packages/ts-release/src/platform/Application.ts#L135).
  Preserve that published compatibility adapter. Its separate `Effect.try` is
  not a reason to retain broad normalization in all core operations.

Two post-dispatch projections must be reviewed explicitly:

1. [GitJournal.ts:187](../../packages/ts-release/src/platform/GitJournal.ts#L187)
   parses the push witness, then `orElseSucceed` at 200 turns typed failure into
   `AmbiguousStorageOutcome`. A raw UTF-8 defect would bypass this fallback after
   a possible push. The native-text prerequisite must preserve typed refusal.
2. [Release.ts:231](../../packages/ts-release/src/Release.ts#L231) currently turns
   both rejected receipt data and a receipt-classifier programming exception
   into durable `CoreUndecodableReceipt`. Strict classification would preserve a
   programming defect and leave the recorded dispatch unresolved. Expected
   schema/domain receipt refusals must retain the existing durable fallback.
   The change in defect behavior needs explicit review, including retained
   no-resend behavior, rather than being hidden in a helper refactor. The local
   bounded diagnostic fallback at 252 remains a deliberate separate policy.

## Proof gaps and ordered bounded slices

Reuse existing real-owner tests. In particular,
[HTTP admission tests](../../test/reimplementation/transports/http.test.ts#L273)
already cover malformed header values and absence of credential acquisition;
the live-header cases at 313 cover refusal before a journal start. Several assert
only Promise rejection, which passes for both typed failure and defect. The
necessary improvement for classification is to inspect the typed Cause at that
existing owner, not to add a parallel fixture or repeat the same input matrix.

Existing [credential tests](../../test/reimplementation/transports/credentials.test.ts#L11)
cover interruption/privacy, RSA/JOSE verification and host/origin admission.
[SQLite tests](../../test/reimplementation/kernel/sqlite.test.ts#L11) and
[Git journal tests](../../test/reimplementation/transports/git-journal.test.ts#L77)
cover durable bounds, incompatible history and lost native push responses. Their
existence is not proof that every missing native exception owner is exercised
or that Fail/Die classification is asserted. Review the relevant existing case
before adding a minimal owner-specific case. This inventory does not claim a
red/green result for any proposed change.

Recommended sequence:

1. **Stored/canonical JSON and Git UTF-8 owners.** Classify the actual foreign
   parse/decoder operations, retain safe refusal fields and the Git ambiguous
   outcome projection, and leave the exported provider parser unchanged.
2. **Git and SQLite native I/O owners.** Classify expected filesystem/database
   errors at their native boundaries. Treat the separate close/cleanup concerns
   as lifecycle work with their own proof if included.
3. **HTTP/OIDC admission and credential privacy.** Own header validation, runner
   URL/JWK/byte admission and returned-secret processing. Preserve interruption
   and keep provider-specific helpers outside this slice.
4. **Strict shared core classification.** Preserve stable known release errors
   and ordinary schema refusals; retain unexpected exceptions as defects. Review
   byte-copy compatibility and post-dispatch receipt classification explicitly.
   Keep the Promise loader's deliberate compatibility behavior local.

The final shared-helper change should follow these prerequisites, not substitute
for them. Provider `makeDataBoundary.attempt`, `admit` and `matches` remain a
separate semantic review because they also own provider-specific parser and
privacy contracts.
