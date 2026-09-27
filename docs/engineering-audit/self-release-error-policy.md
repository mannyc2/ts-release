# Self-release failure policy

Baseline: `17d491dfc0cbcbdb0653c233cc2981091c0dc321`. This separate W3 owner
uses the existing application boundary; it adds no runtime service or public
package API. Effect stays 4.0.0-rc.115. The installed guide and existing core and
Catalog classifier decisions were reused; the application's privacy contract
requires a different expected-failure projection.

## Inventory and compatibility

All twelve `Model.attempt` callers were reviewed before changing the shared
helper. Known local or stable-schema foreign ReleaseError and SchemaError now
remain typed failures with the **existing subject-specific fixed diagnostic**.
Unexpected throws become defects. Unlike the core, this application does not
preserve arbitrary declared code/message text, which can contain credential or
provider diagnostics. The existing native `io` projection and its separately
qualified read/write settlement masks remain unchanged.

| Caller                               | Local expected-failure owner                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| prepare: preparation-input           | Existing Schema decoding.                                                                                                                   |
| prepare: repository                  | Decode Repository through Schema before construction; rc.115 class `.make` otherwise throws a generic Error with a SchemaIssue cause.       |
| prepare: preparation-policy          | Four deliberate guards now throw the existing fixed admission failure; native-provenance refusal retains its preparation-policy projection. |
| prepare: notes                       | Catch only fatal UTF-8 decoding.                                                                                                            |
| application: input                   | Existing Schema decoding.                                                                                                                   |
| application: source                  | Catch only fatal UTF-8 before the unchanged public lexical JSON parser and Schema admission.                                                |
| application: notes                   | Same fatal UTF-8 owner.                                                                                                                     |
| application: plan                    | Same UTF-8/JSON/Schema separation.                                                                                                          |
| application: publication-policy      | Seven intentional policy guards now throw the existing fixed admission failure.                                                             |
| application: provenance-runtime      | Preserve fixed subject projection of its known runtime refusal.                                                                             |
| application: authentication-response | Project declared provider failures, preserve unexpected capture defects.                                                                    |
| application: journal-remote          | Catch only URL construction; explicitly type the route-policy refusal.                                                                      |

`admissionFailure` centralizes the already-existing fixed message in the private
application model; `decodeText` owns only its native decoder call. Unexpected
getters and surrounding algorithms are not enclosed by those native catches.
The JSON tokenizer's native algorithm errors remain defects; standalone public
JSON behavior is unchanged. Historical Plan parsing outside `Model.attempt` is
not silently assigned a new error projection.

No Bundle/Plan/journal identity, candidate bytes, policy admission rule, credential
selection, publication authorization, retry or lifetime behavior changes here.
Existing durable models and provenance/runtime checks remain authoritative.

## Necessary proof and chronology

Existing application tests cover exact candidate retention, original-journal
binding, supersession, safe public observation, credential routes, malformed
retained input and provenance approval. Their generic Promise rejection checks
could not show that this separate helper preserves defects or its intentional
privacy projection. One additional case at the actual preparation entrypoint
throws from a metadata getter, requires Die/no Fail, and checks no Bundle was
retained. The same case checks the private owner's projection of a declared
secret-bearing ReleaseError. It does not duplicate renderer, provider or native
lifetime matrices.

Before production edits, the selected case failed on `Cause.hasDies: false`:
`/tmp/ts-release-application-error-policy-red.log`, exit 1, 0 pass/1 fail/11
filtered. Baseline Model SHA256
`1babf2149ed98b28605f06f585fa84b81b0c01d713bc1470e980992b5eda09a3`,
application `087ff7da3d71a78651809975f23b61d639d0162737e7f11031716ffdb517d17d`,
prepare `2d62a461b62d0ab695b81dd8fd1fa73157c00625f0f4e50fd03ac5993b5f6c12`.
The test SHA256 was
`bc866b8a2eb9e90bc37f41e3b291bc88cdcc75f623e6e7962b093fb605922491`.

After the twelve callers and helper were repaired, the identical selected test
passed: exit 0, 1 pass, 5 assertions, 11 filtered; raw log
`/tmp/ts-release-application-error-policy-green.log`. Subsequent formatting only
expanded the import declaration; final integrated checks must use those final
bytes. Schema wraps the throwing getter in its own defect; no arbitrary Cause
unwrapping or original-object identity is promised across that adapter.

Command (Bun 1.3.14):

```sh
bun test test/reimplementation/self-release/application.test.ts --test-name-pattern 'application admission preserves defects'
```

Targeted strict lint passed for the three application files and changed test
(the same invocation included the independent executor script). Full static,
regenerated delivery and existing application qualification are owned by the
integrator after concurrent provider/observation inputs settle. No installed,
live-provider, native-host-range or full-profile claim follows from this focused
source check. Malformed UTF-8 and URL primitives were classified by their narrow
owners in source; no new native-input matrix is claimed.

The first coordinated static build stopped on the patched compiler's
`preferTypedSchemaDecoder` warning: Repository input had already acquired its
encoded field types. That admission now uses `Schema.decodeSync` rather than
`decodeUnknownSync`, retaining runtime validation and compile-time input checking.
No behavior stage ran in that stopped batch; its raw log is
`/tmp/ts-release-coordinated-continuation-check.log`.

Generated delivery now contains the same private error/text owners in Model,
application and prepare. Bun's input-helper bundling also retains the pure
`Schema.is(Schema.Struct(ReleaseError.fields))` initialization from Model; it adds
no native operation, environment read or publication effect to module loading.

## Integrated result

The final combined static gate passed after the typed decoder correction. The
actual application, preparation and native lifetime cases passed in the 354
passing full-suite cases; the sole failed case was the separate OpenAI assertion,
subsequently corrected without a runtime change. Delivery regenerated the three
application modules and bundled input helper. Physical installed current archives
then passed isolated Node preparation and Bun input generation. See
[coordinated qualification](continuation-qualification.md) for the stopped stages,
exact input/archive identities and supported-host limits. No live release,
credential or signing action was needed to establish this admission policy.
