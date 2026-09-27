# Actual request preflight

This is the bounded native npm/GitHub and maintained self-release adoption of
[R34](requirements-status.md). The baseline is `084a9b9`. It does not make legacy
providers, every transport, or every future request preflight-capable.

## Failure and before-fix proof

The existing application could publish an earlier package before discovering a
static native-wire refusal in the later core package. Plan admission and byte
ownership alone did not execute the HTTP transport's complete request parser.

The refusal was reproduced without replacing that parser. An actual Bun-packed
package contains custom manifest metadata with 127 nested arrays. The npm archive
parser admits this JSON, and public `inspectTarball`, `publish` and `prepare`
succeed. Embedding the manifest under the native publication document's
`versions`/version members adds depth; the real `ownsRequest` parser then refuses
the 1,041-byte request. `/tmp/ts-release-preflight-depth-probe.log` records the
unchanged-package probe. The separate existing >18 MiB archive is not repacked or
expanded into another fixture matrix.

Before production edits, the existing self-release credential-laziness case was
extended with that archive as the late core package. It invokes the real factory
and common application runner, uses the native temporary Git journal and native
HTTP admission, and substitutes only the actual HTTP send with an acknowledged
fixture response decoded by the real npm provider. No registry publication occurs.
The exact expected refusal is `http-request-owner`. The contract assertion is zero
earlier sends, publication credential requests and durable dispatch starts.

The first sandboxed attempt stopped at `git-journal`; it is environmental evidence,
not the behavioral red. The selected case was then run with approved escalation
using Bun 1.3.14 and Node 22.22.2. It reached the intended HTTP refusal and failed
with **one send, one npm credential request and one DispatchStarted**. The command
exited **1**: zero passes, one failure, 11 filtered cases, 11 assertions.

```sh
bun test test/reimplementation/self-release/application.test.ts --test-name-pattern 'application admits retained data and resolves real HTTP transport credentials lazily'
```

That selected temporary-native-fixture run preceded receipt of the shared lock
path and did not hold it; no root build/profile ran concurrently. Subsequent
coordinated verification uses nonblocking `/tmp/the-show-full-verification.lock`.
The production/source/test baseline hashes are retained in
`/tmp/ts-release-preflight-baseline.sha256`.

| Evidence                            | SHA-256                                                            |
| ----------------------------------- | ------------------------------------------------------------------ |
| `preflight-depth-probe.log`         | `25c554bbf663149eb3718dfba9061faf9d5d0f96f4f318b0f05a7c0be0c6f418` |
| `preflight-application-red.log`     | `5df69db78edbece3fb869c9dac9f3bfc29af82caea14dead6a6ba789f33708d5` |
| `preflight-application-sandbox.log` | `b3f9def77139aa916313be4d38966193ec033705e054b677d6ff6ae9c9c9c693` |
| `preflight-baseline.sha256`         | `972c8535322ebf9cfdfdd3b06f50a812704da3066ebcdf0eed1eabe9651f62f7` |

## Existing owners and compatibility

- `ProviderDefinition.preflight` is an optional local request function. It returns
  the actual prepared bytes or explicit missing declared parent IDs. The provider
  owns which native facts are usable; the kernel checks nonempty, unique, declared
  dependency IDs without interpreting opaque native receipt shapes.
- `Transport.validate` is optional credential-free native admission. HTTP
  preparation and validation call the same existing byte/header/endpoint/method
  and unique-native-owner admission. Only preparation then resolves publication
  credentials and returns a send closure. This does not introduce another parser.
- `preflightRelease` admits the Plan and actual durable history, then checks local
  requests for unfinished operations even behind unfinished ordering dependencies. It uses existing request
  ownership, correspondence, transport binding and fingerprint functions. Missing
  provider/transport support for unfinished operations fails with distinct
  `preflight-*-unsupported` errors; it is never represented as missing future
  parent facts. Already Satisfied operation IDs and a superseded Plan are reported
  separately without reconstructing new requests or requiring optional support.
- npm shares its exact local request builder between preflight and execution.
  Local archive/provenance structure is checked; SDK signature/trust verification
  remains mandatory in execution preparation. A checked request is not a claim of
  cryptographic trust.
- GitHub reuses its existing parent selector and graph's required parent IDs.
  Present conflicting/malformed facts fail. Only absent actual parent facts defer
  an annotated ref, managed draft, asset upload or publication. No IDs, successful
  receipts or upload templates are synthesized. Deferred asset bytes are still
  read and verified. Live GitHub precondition reads remain in execution prepare.
- The maintained factory calls explicit preflight before returning an authorized
  Application, and before opening local `.npmrc` authentication. No new common
  application hook, runtime flag or automatic legacy `runRelease` behavior is
  introduced. The observation verifier already forces `authorize:false`.

The report contains safe checked request facts/fingerprints, deferred ownership
facts and settled/superseded status for one admitted journal prefix. It retains no body or send permit and adds
no durable event/Plan/Bundle format. Actual execution reconstructs and rechecks
requests, performs live checks and cryptographic verification, resolves credentials
and acquires fresh kernel CAS authority exactly as before. Concurrent changes and
future native facts still require those final checks.

Durable journal reads can perform native I/O and require their separately bound Git
credentials. This preflight makes no claim of zero journal network activity. It
does not invoke publication credential resolution, provider remote probes, signing
or trust-network verification. `check-credentials` remains an explicit separate
diagnostic, and native Git/Apple/other provider adoption remains unsupported until
those owners implement the optional local contract.

## Other necessary controls and qualification

The existing >18 MiB public-package consumer additionally invokes native HTTP
validation on its already-created valid request and existing changed-body control,
with credential resolution forbidden. Existing GitHub wire cases distinguish
actual prepared, absent-parent and conflicting-parent results. One existing core
host case checks explicit unsupported capabilities before provider work or publication effects.
These new API assertions are post-implementation controls, not claims that absent
methods constituted the original behavioral red.

Source review after the initial implementation found a compatibility risk: later
admitted observations preserve that a GitHub draft is now public, and native asset
construction correctly refuses writing to that parent. Reconstructing a new
request for an already Satisfied asset would therefore reject a completed run.
The existing completed GitHub DAG case now verifies that preflight returns its
satisfied IDs without attempting those writes, even without optional transport
support. Superseded Plans likewise have no new requests to admit. This uses
admitted history status, never dependency readiness or a new dispatch decision.

The same application case additionally seeds one acknowledged operation through
the unchanged legacy runner, then verifies that an authorized factory still
refuses the unfinished late npm request without another send or credential
request. That resumed-history control was added after the initial implementation;
the final test is not byte-identical to the original red. Its original zero-action
assertion and natural refusal remain intact. Capability-refusal controls admit
durable history first, but perform no provider work or publication actions.

The integrator rebuilt the public exports. The selected R34 source proofs passed
under the shared nonblocking lock with approved native-fixture escalation: **8
passes, zero failures, 35 filtered cases, 76 assertions across four files**, exit
**0**, in `/tmp/ts-release-preflight-selected-green.log`. The input manifest is
`/tmp/ts-release-preflight-qualified-inputs.sha256`. This covers the natural
zero-action refusal and resumed late package, native GitHub prepared/deferred/
conflicting facts, completed histories and explicit unsupported capabilities.
The >18 MiB control remains part of the integrator's existing full behavior run;
it was not repeated in this selected batch. Full static/behavior and installed
qualification remain pending here. No live-provider acceptance is claimed.

The selected green log SHA-256 is
`2d47ffe6ea35f49b12ec907fe8d5c5003f2d60f58ba918d2124e63318e3f449d`;
the qualified input manifest SHA-256 is
`eed92c866188a0b7f061fe61a82f7f227ceaef768c0170e722e591729424ab7e`.

The second combined static pass stopped at `Binding.ts`: the pinned compiler did
not narrow a possibly undefined dependency after calling the imported inferred
`never` function. The integrator changed that branch to explicitly `return
invalid("undeclared-parent")`, retaining the same refusal. The stop is recorded in
`/tmp/ts-release-final-capability-check-corrected.log`; no behavior stage had run.
The first combined static stop concerned separately owned Git/SQLite annotations,
not a completed R34 qualification.

The third combined pass completed package compilation and lint, then stopped in
root test types (`/tmp/ts-release-final-capability-check-qualified.log`). The
heterogeneous admission Effects now state their intentionally ignored success
type, and application error-code assertions use the existing ReleaseError Schema
to narrow the AdoptionError/ReleaseError union. No cast or suppression was added.
Source review also moved an existing changed-candidate case's Effect.exit around
both factory and runner: authorized history admission now refuses its unchanged
unknown scope earlier. That assertion-scope correction preceded behavior testing;
it is not recorded as an observed failing behavior. The earlier targeted lint
against stale declarations was diagnostic only, not a locked successful gate.

The independent HTTP lifetime owner reviewed only the admission extraction and
found no actionable defect: existing check order, per-provider byte copies,
credential ordering and prepared-send binding were retained; validation creates
no resource/cache/send closure and invokes neither authorization nor native HTTP.
The independently repaired cleanup region was unchanged by this extraction.
This is a source review, not a runtime or installed-consumer result.

The integrator also added the fixed `http-request-owner` code to the existing
`check-credentials` diagnostic allowlist (R35), so an authorized factory's wire
refusal is not labeled unclassified. No native message or private code is emitted.
The existing diagnostic case failed with `unclassified` against rebuilt baseline
inputs, then passed unchanged after the allowlist edit: one case, three assertions.
Logs are `/tmp/ts-release-preflight-diagnostic-red-qualified.log` and
`/tmp/ts-release-preflight-diagnostic-green.log`. The red shell wrapper later printed
the log and exited zero; the retained assertion failure is the red evidence, not
a claimed captured Bun exit status. An earlier stale-export stop is not behavioral
evidence.

## Adoption and handoff disposition

The final read-only review closes the unspecified need for another adoption
abstraction. R34 and [W6.4](refactor-plan.md#w6--implement-adopter-improvements-as-separately-reviewable-product-work)
require exact qualified-byte handoff while leaving product policy with its owner;
they do not require a new wrapper around existing mechanisms. Public
`EffectBuild.adoptFile` checks the owned copy against the producer's supplied
byte count and SHA-256 (`EffectBuild.ts:64–85`); `adoptTree` checks each manifest
entry. `loadBundle` admits the canonical codec and verifies retained content.
`prepareRelease` consumes supplied tarballs without repacking, while the maintained
starter is generated from that application's authored sources. The existing
preparation case proves that changing a producer path does not change retained
bytes. [Installed integration evidence](continuation-qualification.md) records
physical package installation and starter preparation, not downstream migration,
signing or hosted publication.

The qualification boundary remains explicit: `PreparationInput.packages`
(`apps/self-release/src/Model.ts:46`) names paths and public names, not an external
CI qualification receipt. A Bundle hash proves content identity, not successful
qualification. Applications adopting prior CI output must admit the exact
source/profile/producer-attempt/member identities and bind the retained bytes to
that evidence. Reactor's ABI/SBOM/export policy and Browserbase's release-set and
immutable Git storage policy remain consumer-owned. Their distinct storage and
graph rules do not justify another universal candidate format or storage facade.

The current release workflow deliberately performs fresh qualification for new
candidates (`.github/workflows/release.yml:48–83`) and restores earlier candidates
only through explicit run selection plus expected Bundle/Plan digests
(`:133–173`). It has no latest-attempt CI reuse selector and no claimed cache-miss
fallback. Its instruction to retry only publication after dispatch (`:123`) and
the starter's retained-byte guidance do not misstate rerun eligibility. No workflow
or maintained-doc correction is required by this review. The broader incident
mapping's optional exact-source reuse adapter remains a separate opportunity:
if implemented, it must bind the actual producer attempt/artifact identities and
make ineligible reuse an explicit miss leading to full qualification. Existing
byte-ownership proof is not evidence for that unimplemented optimization.

One concrete optional P2 simplification survives the deletion test. Browserbase,
Reactor and `scripts/prepare-release.ts:159–166` manually extract the transitive
`@sigstore/tuf/seeds.json`. The npm owner's `SigstoreTrustOptions` requires
`tufRootPath` (`packages/npm/src/Auth.ts:254,269`), as does the application Schema
(`Model.ts:28`). Pinned `sigstore` 5.0.0 already permits omission
(`dist/config.d.ts:28`) and forwards it to its TUF client (`dist/sigstore.js:87–93`).
Pinned `@sigstore/tuf` 5.0.0 selects its public-good mirror and seeds a missing
cache from its own package-relative `seeds.json` (`dist/index.js:24,43–52`,
`dist/client.js:76–98`); its package includes that file. An existing cached root
is retained. This supports a future deliberate SDK-default choice at the existing
npm trust owner, preserving explicit roots, cache/timeout ownership, source/issuer
checks and joined SDK settlement, without a new bootstrap service or dependency.
It establishes API and installed-package closure feasibility only. Current native
verification and declaration fixtures supply explicit roots; exposing omission
would require affected installed/native verification with a fresh cache and the
existing real signed bundle before claiming equivalent trust behavior. No such
API change or runtime qualification was performed in this read-only review.

## Final changed-input qualification

The final static gate passed, followed by **356 behavior cases, zero failures,
3,808 assertions across 62 files**. This includes the natural late request refusal,
resumed and completed histories, and the existing >18 MiB native-request case.
Packed core strict declarations now name the public preflight API. All seven
provider archives with native transport cells, packed Action, and installed
ordinary/interrupted workflows passed. The refreshed generated starter also
prepared an exact candidate and generated `authorize:false` input against current
physical packages. No new production/test input changed after qualification.

[Final qualification](final-qualification.md) retains the 382-file input identity,
actual commands/exits, archive hashes and raw receipts. Earlier static stops and
selected-control chronology above remain unchanged. The standalone starter
proof is preparation/input closure, not an authorized live preflight/publication;
application behavior and native transport admission have their separate source
and installed proof owners. Native Git/Apple/other provider preflight remains
explicitly unsupported until those owners implement the optional contract.
