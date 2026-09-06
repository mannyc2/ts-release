# Apple preparation and producer adoption: completed local research

This handoff selects a fixed Apple preparation workflow followed by **one
persisted publication plan**, using the same physical release journal throughout.
It replaces the unproved two-plan/recipe/`PlanDerived` proposal in local plan 236.
It contains research prototypes and evidence, not production implementation or
permission to publish. The selected product scope remains
[`launch-scorecard.md`](../../research/launch-scorecard.md), including K02 and
P10-01–P10-04.

## Exact producer inputs and what was actually qualified

The selected dependency is now the actually published `effect-build@0.6.3`
family at immutable source `ef29a087baac8bdbcd90a54bb62a2dceb739dd91`.
[`published-consumer.json`](upstream/published-consumer.json) records registry
metadata, SHA-512/SHA-1 verification of downloaded tarballs, a fresh installation
without source symlinks, strict declarations, 34 Bun + 34 Node adoption checks
and 16 Apple protocol checks. The public API projection remains
`6bbbdcb00e75cd1f104aa658f4ddfe781719016a7568c7a59006ff435f52fac3`.
The retained tarballs are 47,091 bytes for effect-build (SHA-256
`508f3246ba41ef094fdca9fca796e9d80f002c3f25135f4a2de08cdd53c092f8`)
and 68,405 bytes for effect-build-apple (SHA-256
`80054e66b121d3a6486efa046832051d9a76045a85859429e8e9814ff0ec4a8f`).
Current upstream Apple/readiness qualification is documented separately from
package availability; this does not establish native Apple acceptance.

The original prototype built immutable effect-build PR24 source
`dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc` from the sibling repository's Git object
database. It does not modify that checkout, `.effect-build-hard-cut`,
`.effect-build-landing`, or `.repos/effect`.

| Evidence | Exact coordinate |
| --- | --- |
| Public API projection, PR24 | SHA-256 `6bbbdcb00e75cd1f104aa658f4ddfe781719016a7568c7a59006ff435f52fac3` |
| Combined contract, PR24 | SHA-256 `6c9422466d7e449d8d4ce7cd0fdf38cb869456993bd00bbe7eb9b685cdc11d53` |
| Terminal PR25 source recorded in reconciliation memo | `1b2ee64b2ce02cc7e816e40a3f44339d0b7fedc1` |
| Terminal PR25 merge recorded in memo | `3c3841c19bed45371539ab611c327850f8598eb6` |
| PR25 public projection | Same hash as PR24; this is projection equality, not equality of every implementation byte |
| PR25 combined contract | SHA-256 `3274c0680e3d2c031d6ccfd5aefb9d1b1235d30823e4f504571bb27cfa8d86d1` |
| Locally built `effect-build@0.6.0` tarball | 47,089 bytes; SHA-256 `d83300490ba73b65598b50b726470629338dd76947bea70ef01b338742834499` |
| Locally built `effect-build-apple@0.6.0` tarball | 50,772 bytes; SHA-256 `c4f2d86e777b667db06a139bed9cbfbbbd82019126172d7f2b11bc72b1529ad0` |

The [terminal reconciliation](../plan004-terminal-reconciliation.md) is historical
evidence for PR25, including its reported 33/33 exact-head CI and private
`notary-journal@1` representation. No new public journal API was added. We do not
import that private codec, use it as a second journal, or claim the memo proves
current registry availability. Fresh retrieval was unavailable during that
original experiment; the later recorded upstream observation and published
consumer above supersede that availability limitation.
The local sibling worktree is still on the older v0.5 source; the experiment
uses the exact PR24 Git object rather than that worktree's HEAD.

Actual dependency pins are Bun 1.3.14, TypeScript 6.0.3, and aligned
`effect` / `@effect/platform-node` / `@effect/platform-node-shared`
`4.0.0-rc.108`. Build and consumer declaration checking use `skipLibCheck:false`.
The temporary build adds `ESNext.Disposable` to upstream's library list and
places build metadata in the temporary directory. Bun packing requires the
normal publish-time conversion of Apple's `workspace:^` dependency to `^0.6.0`.
The upstream TypeScript source is unchanged. The current local Effect declaration
patch is explicitly recorded in the build receipt. At this actual pin,
`Context.Service` and `Schema.TaggedError` are the available symbols; older
ServiceMap/TaggedErrorClass skill examples are not silently assumed compatible.

The clean consumer installs actual tarballs through a registry bound only to
loopback. Bun performs ordinary semver resolution with scripts disabled and a
copy backend. No source symlink or package-manager mock supplies the consumer.
The NodeServices dependency closure requires the available `ioredis` peer;
optional native `msgpackr-extract` is omitted. Neither local packing nor this
installation is an npm publication or a test of Internet registry availability.
The later published-consumer run is the distinct registry-availability evidence.
Its unchanged Apple fixture still encodes the historical PR24 producer revision,
so that run demonstrates API/protocol compatibility, not authenticated source
lineage for the newer producer. The proposed standalone declaration updates
that literal to the selected source and records this adaptation explicitly in
[`adoption-api/emission.json`](adoption-api/emission.json).

Reproduce with Bun:

```sh
bun tools/architecture-lab/apple/build-upstream.ts
bun tools/architecture-lab/apple/run-experiments.ts
```

The second command needs local socket permission for its loopback registry.
Results, exact tarball paths, dependency hashes, and source inventory live in
[`tools/architecture-lab/apple`](../../../../tools/architecture-lab/apple/).
The emitted adopter also executes on the admitted Node 22.22.2 binary.
The selected-product size check uses existing
`.release/pypi-real-NrE6Nc/inputs/linux-x64`, SHA-256
`57a92b36ea735daf93fbbb4bdc1ab069b0c7ea402d07eb982b4fca99694d08a5`.
If that input is absent in a fresh checkout, the result explicitly records the
skipped qualification; the ordinary fixture still runs. This source file is a
local release artifact, not independent proof of compiler or signing lineage.

## Concrete adoption boundary

The actual upstream public contracts are
[`Artifact`](https://github.com/mannyc2/effect-build/blob/dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc/packages/effect-build/src/Artifact.ts),
[`Author/File`](https://github.com/mannyc2/effect-build/blob/dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc/packages/effect-build/src/Author/File.ts),
and [`Author/Tree`](https://github.com/mannyc2/effect-build/blob/dd39bd6104645d79fa52f40d0bbf291b5bf8f3dc/packages/effect-build/src/Author/Tree.ts).
`Artifact.adoptFile/adoptTree` are path-free identity projections. They do not
transfer ownership. `DecimalBytes` is a canonical decimal string, with no
safe-integer ceiling. Every durable byte count stays a string; comparisons and
stream counters use BigInt.

The executable prototype's `ContentOwner` explicitly owns stored bytes.
`adoptFile(owner, logicalName, publicArtifact)` checks the public artifact guard,
then the host opens the regular file, streams 64 KiB chunks into a new inode,
hashes and counts the copied bytes, verifies the exact declared identity, syncs
the file, and commits by a content-addressed no-replace link. The source path is
an access location, never evidence of identity. This direct public-path copy was
compared with `File.withVerifiedBytes`: both can verify bytes, but the latter
buffers the complete file and adds another copy. Streaming ingestion needs no
upstream API addition. A real existing 95,971,456-byte selected product crosses
this boundary and passes durable reloading. File ingestion and verification do
not impose a safe-integer or 64 MiB limit.

`adoptTree` uses the actual `Tree.withVerifiedSnapshot`. It first clones its
input and recomputes the upstream manifest preimage:

```text
SHA256(UTF8(JSON.stringify({ rootMode, totalBytes, entries })))
```

Entry and digest property order must match upstream's construction; generic
key sorting is a different hash. The public shape guard and snapshot verifier
alone do **not** bind supplied entry metadata to `manifestDigest`. The research
found and fixed a forged-mode acceptance bug at precisely this boundary.
The adapter copies every ordinary file into owned storage and retains actual
directory/root/file modes and symlink targets. No producer path survives in the
bundle. Duplicate or case-colliding logical names are rejected.

`OwnedFile` retains content identity, original provenance, a delivery mode, and
either the complete executable facts (native format, runtime, target) or null.
The fixed delivery policy is 0o755 for an upstream `HashedExecutable` and 0o644
for an ordinary `HashedFile`; upstream's ordinary file identity does not promise
a source mode. Tree modes are actual upstream manifest fields. Native
provenance is retained as data inside the bundle identity. It is **not** a
cryptographic authentication claim about an arbitrary uploader. Authenticated
multi-host gathering must verify and bind its producer receipt before this
boundary; a matching filename, platform label, or copied provenance object
does not replace that check.

`finalize` severs caller aliases and recursively freezes the result.
`encodeBundle` emits one exact codec encoding. `loadBundle` strictly decodes
that encoding, rejects duplicate/extra keys, checks logical identity uniqueness,
reconstructs and hashes tree manifests, checks decimal totals, sorted paths,
directory parents and symlink containment/cycles, and streams verification of
every referenced owned object. `restoreTree` then uses the real upstream
finalizer and verifies the resulting manifest again. Structural
`Schema.decode(OwnedBundle)` alone is explicitly not the durable loader.

The current tree capability is a 512 MiB total snapshot and 100,000 entries on
a worker budgeted at least 4 GiB. The adapter rejects declared overflow before
requiring a filesystem service, and wraps upstream capture with cumulative
actual-read budgets so growing bytes or entries do not bypass the declaration.
Small fixed read-chunk lengths are the only numeric narrowing. `ContentOwner.read`
is a separately bounded, 512 MiB buffering convenience; streaming verification
does not use it. Native tree footprint and peak-memory qualification remain
required because no real `.app` tree exists in the current Linux workspace.
The largest existing selected file is approximately 96 MB, not below 64 MiB.
End-to-end unbounded tree streaming is a deferred capability, not a claim made
by changing only downstream storage. Its implementation would require either
a new verified upstream stream/snapshot operation or a separately qualified
scoped tree capturer preserving exactly these laws.

## Apple architecture selection and durable association

K02's explicit scenario starts from bundle + one persisted plan + journal and
covers npm, Warehouse, GitHub and Git. P10 separately requires durable Apple
submission/polling and Gatekeeper before adoption of the final distributable.
Neither requires publication destinations to be frozen before the Apple
transformation. This is the reason for selecting the smaller workflow below.

| Question | Selected fixed preparation, then one plan | Earlier two-plan/recipe proposal |
| --- | --- | --- |
| Durable initial intent | `ApplePreparation`: owned signed-source tree, native `.app` basename, signature projection, architecture, principal/credential reference, producer pin, journal root | Initial Apple plan plus source bundle and frozen future-publication recipe |
| Submission uncertainty | Ordinary dispatch/receipt facts in one journal | Same uncertainty; second plan cannot recover an unknown Apple ID |
| Final-byte selection | One `ReadyToPlan` observation wins global CAS | New `PlanDerived` admission event and unique derivation key |
| Final publication intent | Created once from finalized owned bundle | Instantiated from a pre-recorded recipe and linked to its parent |
| Extra states | Source request, Pending/Inconclusive, Ready; one transient dispatch view | Recipe validity, parent/child ancestry, derivation pending/conflict, parent supersession effects |
| Distinct benefit | Satisfies inherited K02/P10 with no future recipe | Freezes future destination choices before Apple finishes; this is an additional product requirement |

The two-plan design was eliminated by its additional obligation and state cost,
not by a fabricated runtime or source-size benchmark. Its implementation was
not built and no measured LOC superiority is claimed. Reintroducing that
additional product requirement would require reconsidering this choice.

`ApplePreparation` is real persisted intent, counted in the code and canonical
state budget. It is not an empty context or a renamed publication plan: its
schema has one fixed native input and no operation array, dependency graph,
destination metadata, placeholder artifact, or derivation recipe. A restart
before readiness needs this input and credentials; it does not magically
reconstruct future publication destinations from deleted configuration.

The actual machine's `createPreparationScope` reconstructs a **transient**
one-operation view from that exact input to reuse its six event laws. The view
is never persisted as a second plan. `journalId` is part of both the persisted
preparation and the final Plan identity. Journal events carry the physical
`journalId` and immutable scope `planId`; the host admits the preparation view
and final publication plan in one explicit catalog. The machine validates every
scope and the entire physical history before effects. Store revision and CAS
use the complete history length, never the filtered publication event count.
Ready selection, publication binding, and combined reports use the exact
snapshot whose global revision was validated by the machine. A concurrent
append forces validation of the new prefix before selection, and each candidate
Ready event passes the machine's append laws before the storage CAS.

The association is acyclic:

1. Persist exact `ApplePreparation` and its owned source bytes. Reconstruct its
   transient scope from those bytes and its root ID.
2. Persist `DispatchStarted` before calling public `Notary.submitApp`. The
   request fingerprint describes the opaque public input, producer pin and
   authority. ZIP creation happens inside upstream, so it cannot truthfully
   include an independently pre-observed ZIP digest.
3. Persist the public `Notary.Submission` as `ReceiptAccepted`, with its codec
   version and a **Pending** disposition. Retaining a submission ID is not final
   Apple readiness. Public `info` observations bind to a preceding exact native
   receipt, including ID, transport digest, source target and architecture.
4. Public `acceptedReference` must prove Accepted and a matching staple target.
   Public `Staple.stapleApp` produces new bytes; `Assess.assess` must accept those
   same bytes. Only then adopt the final tree and store its exact bundle codec
   bytes as an immutable content object.
5. CAS-select one `ReadyToPlan` observation containing the preparation operation
   ID, native acceptance, immutable bundle-content identity, final tree identity
   and matching Gatekeeper assessment. Concurrent local transforms may produce
   different bytes; only one final identity wins. The journal event contains a
   blob reference, not an arbitrarily large bundle manifest.
6. Create the sole immutable publication Plan, whose root is the preparation
   root and whose bundle ID is that selected bundle-content digest. The host
   loads and verifies the content and its final-tree association before allowing
   the ordinary publication interpreter to run. There is no forward plan ID in
   the preparation, no plan mutation, and no ID cycle.

Changing preparation input in the same admitted context fails before native
effects. Late observations remain associated with the original scope and cannot
change the selected bundle or publication plan. `reportAppleContext` includes
both scoped reports and the prior native facts; a selected publication-only
report with a global revision is not presented as the complete Apple history.

## Public native boundary and evidence limits

The actual packed public modules are `effect-build-apple/Notary`, `/Model`,
`/Staple`, and `/Assess`. `Notary.Submission`, `Observation`, `AcceptedReference`,
`SubmissionOutcomeUnknown` and `Assess.GatekeeperAccepted` have public schemas.
The Model signature/ticket classes do not supply complete durable Schema
codecs; this prototype explicitly implements and counts the application's
signature projection and reconstructs the public class. It imports no private
producer journal. The production file branches can use existing public
`Notary.submit`, `Staple.stapleFile`, and `Assess.assess`; they are additional
consumer mappings, not missing upstream native operations.
The `.app` basename is independently bound because public `submitApp` and
`stapleApp` validate it and the accepted staple target records it. Restoration
preserves that basename. The public `SubmissionOutcomeUnknown` payload is
retained through the machine's versioned dispatch-error evidence codec; its
opaque ZIP digest is diagnostic evidence, not a claim that ZIP and source-tree
digests are identical. The executable proposed consumer surface is
[`public-api.ts`](../../../../tools/architecture-lab/apple/public-api.ts), with
the compiler-emitted [`apple-api.d.ts`](../../../../tools/architecture-lab/apple/apple-api.d.ts).

An interruption after dispatch but before a durable Apple ID stays
Inconclusive. No receipt means no guessed `info` ID and no automatic resubmit.
The public native operation is opaque, so generic process failure is not a
pre-commit proof. Apple documents app ZIP submission followed by stapling the
contained app and rebuilding the distributable ZIP; ZIP files themselves are
not staple targets. This supports the source/final byte separation, without
making a recovery-by-digest claim. [Apple workflow documentation](https://developer.apple.com/documentation/Security/customizing-the-notarization-workflow).

The local Apple tests deliberately provide protocol doubles behind the actual
public Client, Stapler and Assessor services. Their files say that they are not
signed apps or Apple tickets. No native signing, notarization, `stapler`,
`spctl`, credential, or real Apple success is asserted. Real filesystem
finalization/adoption, schema roundtrips, SQLite persistence, subprocess exits,
machine decisions and concurrent final-byte selection are executed.

The 16 lifecycle checks cover separate-process interruption after append,
after send and after receipt; typed pre-ID loss; Pending polling after restart;
staple/assessment ordering; wrong-bundle plan rejection; no repeated completion;
same physical journal through publication; one persisted Plan; late facts;
changed source and missing explicit journal-context rejection; concurrent
unvalidated-prefix rejection; two concurrent distinct final trees with one CAS
winner; and assessment failure preventing a plan. The adoption checks include
real upstream file/tree finalizers, modes, symlinks, immutable ownership,
canonical manifest vectors, durable tamper rejection, actual selected-product
size, and declared/actual resource-bound failures. Exact counts and runtime
results are in `results.json` rather than inferred from an old test transcript.

The research also exposed Bun 1.3.14's `await using(...)` parsing trap in a local
helper call. An expected process exit failed, exposing that skipped execution.
Helpers were renamed, and all reported lifecycle results were rerun with actual
machine effects. An unexecuted helper call is not accepted as passing evidence.

## Work accounting and remaining qualification

Handwritten production-shaped research source is 552 physical lines:
adoption 147, content owner 89, durable bundle codec 87, Apple preparation 224,
public export barrel 5.
TypeScript 6.0.3 printer normalization produces 661 lines for those same five
files; the physical count must not be treated as savings from compressing
several statements onto one prototype line. The inventory records both counts.
Build/test/driver source is 473 physical lines, counted separately in
`source-inventory.json`.
The machine's global-scope and native-evidence amendments and the shared journal
backends belong to their own inventories; do not count them again here.

The conservative **additional** production forecast beyond these 552 lines is:

| Work not already implemented here | Low | Expected | High | Basis |
| --- | ---: | ---: | ---: | --- |
| Content-host completion: portable content streaming/export, cleanup, filesystem admission and structured storage errors | 60 | 130 | 240 | Current owner implements private buffer/file writes, file and directory sync, atomic link commits, streaming verification; cross-host/object-store durability and portable export policy remain |
| Full app/DMG/pkg typed restoration and native service/credential/error boundary | 90 | 180 | 300 | App path is implemented; two existing upstream file branches and signature projections remain, plus host-layer construction and typed errors |
| Production integration of owned bundle/root/receipt admission and resource policy | 40 | 90 | 170 | Exact loader and acyclic root law are implemented; host wiring, gathered native-receipt authentication and full configuration admission are separate integration work |
| Additional total, excluding shared core/storage and tests | **190** | **400** | **710** | A bounded engineering forecast, not a measured implementation or a committed deletion claim |

No new upstream code is required for the selected streaming-file/bounded-tree
capability and current native operations. Full unbounded tree streaming is
separately deferred: a rough upstream extension budget is 200/450/800 additional
lines if later required, against the existing File verifier, Tree capture and
private snapshot implementations. That conditional work must be included in a
future whole-system forecast; it cannot be hidden as code relocated upstream.

Locally resolved before rewrite: actual package/public API compatibility,
file/tree ownership contract, strict durable reload, byte-count handling,
source/final ownership, one-journal global revision, opaque submission limits,
one-plan association, and the shape and cost of the native host boundary.

Still required for hosted/native qualification: credential reacquisition on a
second macOS runner, actual signature preservation and notarization correlation,
stapler validation and Gatekeeper for the admitted app/DMG/pkg matrix, native
artifact footprints and peak memory, authenticated multi-host receipt gathering,
and operational durability on each selected deployment filesystem. The PR25
memo's 28 Apple coordinates remain the matrix authority; this app protocol
prototype is not acceptance of that entire matrix. Full K02 provider and K03
Action receipts are also separate system qualifications. These open items must
not be relabeled as completed live acceptance when the architecture is frozen.


## Full selected Apple API and mixed publication bundles

The selected full public surface is now
[`apple-api.d.ts`](apple-api.d.ts), emitted from
[`proposal/apple.ts`](../../../../tools/architecture-lab/proposal/apple.ts).
It supersedes the app-only public shape in `adoption-api/apple-preparation.d.ts`.
That older declaration and the frozen app fixture remain evidence of the
bounded mechanism; their single-tree bundle equality is not the full
multi-artifact publication contract. The full proposal uses the published
0.6.3 native API at `ef29a087baac8bdbcd90a54bb62a2dceb739dd91`.

`AppPreparation`, `DmgPreparation` and `PkgPreparation` are durable tagged
Schema classes. App takes an owned Tree and the native application signature
fields (`codesign`, certificate SHA-1, hardened runtime and secure timestamp).
DMG takes an owned File and the native disk-image signature fields (`codesign`,
certificate SHA-1 and secure timestamp). Pkg takes an owned File and the native
installer fields (`productsign`, `pkgutil`, certificate SHA-1). Architecture is
bound by the preparation. These are consumer serialization projections of the
actual upstream Model constructor fields; the upstream signature constructors
are not Schema codecs. Restoring owned bytes reconstructs the corresponding
public Model signature and preserves the native operation's validation.
No serialized signature projection alone proves native signature acceptance.

`ApplePreparations` is the sole immutable collection of already owned native
inputs. `createApplePreparations` hashes the exact caller-ordered member
encodings with their derived `journalId` fields omitted, under
`ts-release/apple-preparations/1`; it injects that root into every member.
`loadApplePreparations` strictly decodes and recomputes the same identity before
store or native effects. Reordering, adding an untouched member, changing source
bytes, changing signature/authority or changing output names changes the root.
Duplicate operations and case-colliding final artifact names fail admission.
The collection contains no future destination DAG, delivery recipe or second
persisted publication Plan. Its member operation scopes are transient core views.

The native dispatch mapping is exact:

| Durable input | Submit | Finalize after recorded acceptance | Assess |
| --- | --- | --- | --- |
| App | `Notary.submitApp({bundle})` | `Staple.stapleApp({source,acceptance,outdir})` | `Assess.assess({kind:"app",artifact})` |
| DMG | `Notary.submit({kind:"dmg",artifact})` | `Staple.stapleFile({kind:"dmg",source,acceptance,outfile})` | `Assess.assess({kind:"dmg",artifact})` |
| Pkg | `Notary.submit({kind:"pkg",artifact})` | `Staple.stapleFile({kind:"pkg",source,acceptance,outfile})` | `Assess.assess({kind:"pkg",artifact})` |

App submission retains both the opaque native ZIP identity and its native
`stapleTarget` tree association. DMG/pkg bind the submitted file identity.
Polling uses only the recorded submission reference, and native correspondence
checks submission ID, kind, architecture and source/target identity. Native
pre-ID outcome loss remains uncertain. `NativeAppleError` includes the public
`Notary.SubmitAppError` alias, which already includes `SubmitError` and therefore
both native file submit cases, plus observation, stapling, assessment,
restoration/adoption and public host errors. No native error is erased merely
to give the three branches one signature.

`finishPrepared` can return a typed native observation or `ReadyToPlan`.
Status is derived from that native evidence by the provider classifier.
After native stapling and assessment, an optional `DeriveDeliveryFiles`
callback receives the actual typed final native artifact and can use upstream
producers to create archives or other finalized delivery Files. The callback
runs before readiness selection and root adoption; its returned File values do
not independently prove Gatekeeper acceptance of an extracted archive. The
corresponding consumer/native qualification remains required.

Each `ReadyToPlan` binds one immutable `outputsBundleContent`, containing the
native final artifact and its selected delivery Files. Its `finalArtifact` is
a tagged app/tree-manifest, DMG/file-bytes or pkg/file-bytes identity, with the
native acceptance and Gatekeeper evidence retained. The common journal CAS
selects exactly one such output subbundle per preparation. Late alternatives
do not replace that selected result.

The one final publication Bundle can contain every selected output member plus
other release artifacts. `validateApplePublication(inputs,plan,finalBundleContent,owner)`
validates the complete shared journal prefix and all selected preparations,
requires exact member identity for every selected output, and binds
`plan.bundleId` to the **complete** Bundle Content SHA-256. It requires the same
collection-derived journal root and exactly one final publication scope. It
does not require the final Bundle to equal one preparation's subbundle.
`reportAppleContext` retains the full native journal facts and per-preparation
reports alongside the optional final publication report at one global revision.

The separate
[`mixed composition experiment`](../../../../tools/architecture-lab/apple-composition/results.json)
exercises two app preparations, real native TAR creation after the protocol
staple boundary, a complete Bundle including a non-Apple file, one final Plan,
and fresh-process continuation through the same physical journal. The receipt
contains the authoritative current test counts and source hashes. The native
Apple operations in that experiment remain protocol doubles. The new
[`Apple type witness`](apple-api.typecheck.ts) independently checks all three
real native signature constructors and submit/staple/assess input types against
published 0.6.3. Neither establishes live codesign/notarytool/stapler/Gatekeeper
acceptance for any platform cell; that remains the explicit native matrix.
