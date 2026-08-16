# Adversarial traces

Status: worked state traces projected from the canonical plan/journal/replay model. Executable counterparts are under `probes/two-runner/` and `probes/journal-backends/`.

## T1. Normal npm composite success

1. Plan contains one `NpmPublishOperation`.
2. Core prepares one npm PUT containing version/tarball and initial dist-tag.
3. Core appends one singular `DispatchStarted.operationId`.
4. Registry accepts the request.
5. Core records one composite receipt with version and initial-tag facets.
6. A later clean install is CI policy, not journal state.

No member-operation list is created.

## T2. Lost npm response

1. `DispatchStarted` exists and the response disappears.
2. No npm replay protection was recorded.
3. Fresh runner observes version and tag.
4. Both satisfied -> stop satisfied.
5. Version satisfied, tag moved -> version remains complete; tag correction is a new operation.
6. Absence while the PUT may still commit -> wait or stop inconclusive.
7. Conflicting bytes -> conflict.
8. Version immutability alone never authorizes replay.

## T3. Warehouse partial publication

Three file operations: wheel A, wheel B, sdist C.

1. A returns HTTP 200.
2. B response is lost.
3. C was never attempted.
4. Fresh runner observes B by filename/hash.
5. Matching B -> satisfied by observation.
6. C remains initially dispatchable.
7. A is neither rebuilt nor reuploaded.

## T4. Warehouse exact duplicate

1. B's historical dispatch records `replay.exact-duplicate/1` with pinned Warehouse behavior, coordinate/content fingerprints, and request fingerprint.
2. Fresh runner prepares the equivalent file upload through core HTTP.
3. Identity, request, content, and scheme all match.
4. Journal CAS appends one new dispatch.
5. Pinned Warehouse accepts identical filename/hashes.
6. Different bytes fail before send or conflict at Warehouse.

## T5. Conditional Git replay

1. Operation wants ref R to move from P to Q.
2. Historical dispatch records `replay.cas/1`, expected P, desired Q, and request fingerprint.
3. Response is lost.
4. Fresh runner prepares the same core Git update.
5. Core verifies identity/fingerprint and appends one dispatch.
6. If the first request already committed, remote R is Q and expected-P cannot apply a second distinct transition.

## T6. Derived idempotency key after response loss

1. Core computes base request fingerprint F0.
2. Core derives K from scheme ID, origin dispatch ID, and F0.
3. `DispatchStarted` stores fingerprint(K), scope, F0, final request fingerprint F1, and expiry; it does not store K.
4. Runner A creates one remote effect and loses the response.
5. Runner B loads only plan/journal, derives the same K, verifies fingerprint(K) and F1, wins journal CAS, and sends.
6. Provider returns the original result; remote request count is two and effect count is one.
7. After expiry, automatic replay stops.

## T7. Equal request bytes under provider V2

History records behavior V1, lockfile L1, and request fingerprint F.

Runner B loads behavior V2 and lockfile L2, then prepares the same fingerprint F.

The result is not a different replay verdict. It is:

```text
code: provider-identity-drift
requestFingerprint: match
providerBehaviorId: mismatch V1 -> V2
providerLockfileIdentity: mismatch L1 -> L2
consequence: block automatic replay
riskAcceptance: exact human assertion
```

V2 never executes historical replay policy.

## T8. Unknown replay scheme

1. History contains `replay.idempotency-key/2`.
2. Core v1 knows only append-only `/1` meanings.
3. Request bytes otherwise match.
4. Automatic replay stops `unsupported-replay-scheme`.
5. Old event meaning is not guessed or reinterpreted.

## T9. Opaque custom provider

1. Custom provider initially dispatches through its own Effect.
2. `DispatchStarted.transportId` is `provider.opaque/1` and protection is none.
3. Response is lost.
4. Provider has no authoritative observation.
5. Core cannot prove exact-send correspondence or non-commit.
6. Operation stops `Inconclusive`.
7. Maintainer may record `RiskAccepted`; the provider remains valid.

## T10. Custom provider with authoritative request status

1. Historical receipt/request facts include a status token.
2. Fresh runner calls the authoritative status endpoint.
3. Succeeded -> satisfied.
4. Terminal rejected with no mutation -> non-commit authority.
5. Pending -> wait.
6. Expired/unknown -> inconclusive.
7. The token is observation evidence, not a replay-protection scheme.

## T11. Absence while stale request remains in flight

1. Runner A sends, then loses ownership.
2. Runner B observes absence.
3. A's request later commits.
4. Therefore B cannot turn absence into a fence.
5. B may wait, query request status, use recorded structural protection, or stop inconclusive.

## T12. Two fresh runners race

A and B load journal revision 9 and derive the same safe continuation.

1. A `appendIfRevision(9, DispatchStarted A)` -> appended revision 10.
2. B `appendIfRevision(9, DispatchStarted B)` -> revision mismatch 10.
3. A sends.
4. B reloads and does not send.
5. Executable probe result: one winner, one loser, one send, one effect.

A lease is optional and does not replace CAS.

## T13. Local filesystem CAS on unsupported network storage

1. Application points the local generation store at an undocumented network filesystem.
2. Required hard-link/synchronization semantics are not established.
3. Backend refuses support or configuration validation fails.
4. It does not silently downgrade to best-effort locking.
5. User selects S3 conditional storage or supplies a conforming `JournalStore` Layer.

## T14. CI artifacts without external state

1. Two CI runners upload different immutable journal-looking artifacts.
2. Both uploads succeed.
3. Neither upload establishes the authoritative next head.
4. No runner may send based on artifact upload alone.
5. With S3 external state, one conditional head writer wins; S3 is the journal and artifacts are bundle transport.

## T15. Explicit risky replay

1. No non-commit proof or supported protection exists.
2. Structured stop lists all facts and risks.
3. Maintainer records `RiskAccepted` containing the exact assertion.
4. A new singular `DispatchStarted` references that event.
5. Audit reports the accepted duplicate/conflict/overwrite/provider-drift risk.

## T16. Consumer failure after provider success

1. Provider receipt proves publication acceptance.
2. Separate CI installs and executes the package.
3. Packaging error causes failure.
4. Release acceptance fails.
5. Provider publication is not replayed and the receipt remains true.
6. Fix requires a new artifact/version/plan.

## T17. GitHub release and assets

1. Release creation is one operation and request.
2. Asset A upload is a second operation/request.
3. Asset B upload is a third operation/request.
4. Losing A's response does not affect release or B's operation identity.
5. Fresh runner lists assets and matches stored name, size, state, and digest where present.
6. Absence does not authorize immediate replay.

No operation-member mechanism is needed.

## T18. Apple notarization before artifact finalization

1. `effect-build-apple` constructs and signs an app/DMG/pkg.
2. It submits to Apple's notary service and records the submission identifier in its production context.
3. Response/status ambiguity is recovered internally through that identifier.
4. After acceptance, it staples and verifies.
5. Only then is the artifact finalized.
6. ts-release adopts those final bytes into its immutable bundle.
7. No pre-stapled artifact, Apple receipt, or pre-finalization event enters the ts-release distribution journal.

## T19. Plan correction

1. Historical operation I1 and events remain immutable.
2. Maintainer creates plan revision with operation I2.
3. `PlanSuperseded` links them with reason and authority.
4. I2 receives its own operation ID and attempts.
5. New provider code never reinterprets I1 as I2.

## T20. AI-native human handoff

1. Artifact work creates a plugin package and listing/test handoff directory.
2. A pure validator checks its required files, metadata, assets, release notes, attestations, and tests.
3. vNext records no OpenAI publication operation.
4. A later verified human uses the documented portal flow.
5. No fictitious provider receipt is created.
