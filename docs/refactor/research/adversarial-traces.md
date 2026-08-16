# Adversarial traces

Status: worked state traces, not executable tests.

## T1. Normal npm success

1. Plan contains one initial npm publish Intent.
2. Provider prepares the registry PUT and no automatic replay protection.
3. Core appends `DispatchStarted`.
4. Registry returns documented success.
5. Core appends `ReceiptAccepted`.
6. Publication is accepted. A later clean install is CI policy, not journal state.

## T2. Lost npm response

1. `DispatchStarted` exists.
2. Connection disappears after the request may have reached the registry.
3. No receipt exists.
4. Fresh runner observes package version and dist-tag.
5. Outcomes:
   - version and tag satisfied -> `ObservationRecorded`, stop satisfied;
   - version satisfied, tag differs -> version remains complete; tag correction is a new Intent;
   - absent while request could still commit -> stop/wait inconclusive;
   - conflicting bytes/version -> conflict.
6. Version immutability alone never authorizes replay.

## T3. Warehouse partial publication

Three file Intents: wheel A, wheel B, sdist C.

1. A returns HTTP 200 -> receipt accepted.
2. B response is lost.
3. C was never attempted.
4. Fresh runner observes B by filename/hash.
5. If B is present with intended hash, it is satisfied by observation.
6. C is initially dispatchable.
7. A is not rebuilt or reuploaded.

## T4. Warehouse exact duplicate replay

1. Upload response is lost.
2. The earlier request is no longer in flight, or operator chooses to use the documented exact-duplicate law.
3. Historical dispatch records `ExactDuplicateAccepted` with Warehouse behavior ID, filename, content fingerprint, and request fingerprint.
4. Fresh runner prepares byte-equivalent upload under matching behavior ID.
5. Core authorizes exact replay.
6. Warehouse returns HTTP 200 for identical filename/hashes.
7. Different bytes would fail fingerprint comparison before send or conflict at Warehouse.

## T5. Git compare-and-swap replay

1. Intent wants `refs/heads/main` to move from P to Q.
2. Dispatch records expected P and desired Q.
3. Response is lost.
4. Fresh runner prepares the same `P -> Q` update.
5. Core recognizes unexpired/unchanged `CompareAndSwap` protection.
6. CAS journal append permits one runner to dispatch.
7. If first request already committed, replay sees Q or fails expected-P precondition; it cannot apply a second distinct mutation.

## T6. Idempotency key with expiry

1. Prepared request records key K, account/scope S, request fingerprint F, and expiry E.
2. Response is lost.
3. Before E, fresh runner prepares same F under same S and recovers K.
4. Core may authorize replay.
5. After E, automatic replay is denied even if K is reused by provider code.
6. A new request needs observation, non-commit proof, or risk acceptance.

## T7. Different provider code on two runners

History records behavior ID V1 and request fingerprint F.

Runner A loads provider V1 and prepares F.
Runner B loads provider V2 and prepares G.

- A receives the deterministic core replay decision.
- B stops because behavior ID/fingerprint mismatch.
- V2 cannot reinterpret V1 history as safe.

If V2 prepares F but has a different behavior ID, it still stops until an explicit compatibility/migration decision exists.

## T8. Lost GitHub asset response

1. Asset Intent references parent release Intent and requested public name.
2. Parent release receipt/observation supplies release ID.
3. Asset upload is dispatched without idempotency key.
4. Response is lost.
5. Fresh runner lists assets and compares effective name, state, size, and digest.
6. Matching uploaded asset -> satisfied.
7. `starter` asset after documented 502 -> provider-specific failed state/correction.
8. Absence while upload may still be in flight -> inconclusive, not replay authority.

## T9. Write-only custom provider

1. Dispatch is recorded with `replayProtection: None`.
2. Response is lost.
3. Provider has no observation or request-status API.
4. Fresh runner cannot prove commit or non-commit.
5. Automatic replay is unavailable.
6. Maintainer may stop or append `RiskAccepted` and start a new attempt.

This provider is valid; its resumability ceiling is explicit.

## T10. Custom provider with request status

1. Dispatch response returns a request token, or the token was known before dispatch.
2. Fresh runner calls the authoritative status endpoint.
3. Status:
   - succeeded -> satisfied by observation;
   - terminal rejected/no mutation -> non-commit authority;
   - pending -> wait;
   - expired/unknown -> inconclusive.
4. Request status is reconciliation evidence, not replay protection.

## T11. Absence while stale request remains in flight

1. Runner A sends request and loses its lease.
2. Runner B reads the destination and sees absence.
3. A's request later commits.
4. Therefore B cannot convert absence to non-commit proof.
5. B waits, uses request status, uses recorded replay protection, or stops inconclusive.

## T12. Two fresh runners

Both runners load journal version 9 and derive replay-safe.

1. A compare-and-swap appends `DispatchStarted` at version 9 -> version 10.
2. B's append at version 9 fails.
3. B reloads and does not send.
4. The lease is optional; CAS is the dispatch gate.

## T13. Explicit risky replay

1. No non-commit proof or replay protection exists.
2. Maintainer reviews Intent, receipts, observations, and risk.
3. Maintainer appends `RiskAccepted` describing scope and reason.
4. New `DispatchStarted` references that event.
5. The event is not named `ReplayAuthorized`; it records a real human decision.

## T14. Consumer failure after accepted publication

1. Provider receipt proves npm publication acceptance.
2. Separate CI job runs `npm install` and CLI smoke test.
3. Test fails because entrypoint packaging is wrong.
4. CI/release policy fails.
5. Journal does not replay npm publication and does not mark the provider receipt uncertain.
6. The fix is a new version/plan, not mutation recovery.

## T15. OpenAI public plugin handoff

1. Artifact production emits plugin manifest, skills, optional MCP references, listing assets, tests, and release notes.
2. ts-release may publish a repository marketplace entry.
3. Public submission packet is validated.
4. A verified human uses the OpenAI portal.
5. OpenAI reviews.
6. After approval, a human chooses Publish.
7. No fictitious automated OpenAI provider receipt is recorded.

## T16. Notarization changes final bytes

1. App bundle and DMG are locally constructed and signed.
2. Notary submission is dispatched; response is lost.
3. Fresh runner reconciles status with provider request identity.
4. After acceptance, stapling changes DMG bytes.
5. Final release bundle cannot have committed the pre-stapled DMG as the final artifact.
6. This trace must inform the production/release phase boundary before it is frozen.

## T17. Plan correction

1. Historical Intent I1 and dispatch events remain immutable.
2. Maintainer creates plan revision with Intent I2.
3. `PlanSuperseded` links I1 to I2 and records reason/authority.
4. I2 receives its own operation ID and attempts.
5. New provider code never reinterprets I1's request as I2.
