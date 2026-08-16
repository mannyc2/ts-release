# Adversarial traces

Status: reasoned state traces over current research. They are not live provider
tests.

## T1. Normal npm success

1. Plan contains one composite initial npm publish Intent.
2. Core derives operation ID from plan and canonical Intent.
3. Provider prepares the exact package PUT.
4. Core appends `DispatchStarted`.
5. Registry returns documented success.
6. Core appends the provider/transport receipt.
7. Version and initial tag effects are represented by the composite receipt and
   later observation; clean install remains CI policy.

## T2. Lost npm response

1. `DispatchStarted` exists.
2. Response is lost after the PUT may have reached the registry.
3. npm has no documented replay key for this operation.
4. Fresh runner observes version and tag.
5. Version+tag satisfied -> stop satisfied.
6. Version satisfied/tag moved -> immutable facet complete; correction is a new
   tag Intent.
7. Absent while the request may still commit -> pending/inconclusive.
8. Version immutability alone never authorizes replay.

## T3. Warehouse partial publication

Three independent file Intents: wheel A, wheel B, sdist C.

1. A returns HTTP 200.
2. B response is lost.
3. C was never attempted.
4. Fresh runner observes B by filename and hash.
5. Matching B -> satisfied by observation.
6. C -> initial dispatch allowed.
7. A is neither rebuilt nor reuploaded.

## T4. Warehouse exact-duplicate claim without trusted authority

1. Upload response is lost.
2. Historical request and content fingerprints are available.
3. Core can reproduce byte-identical upload.
4. Provider package asserts `replay.exact-duplicate/1`.
5. If the endpoint is Warehouse at the pinned behavior, source supports the
   exact-duplicate law.
6. If the endpoint is merely "PyPI-compatible" and does not implement that law,
   replay can conflict or duplicate work.
7. Therefore request correspondence is insufficient; a trusted protocol-law
   authority is required before automatic replay.

## T5. Git compare-and-swap replay

1. Intent wants ref R to move from P to Q.
2. Core-owned Git request records P, Q, and exact ref.
3. Response is lost.
4. Fresh runner prepares the same conditional update.
5. Git enforces expected-old P.
6. Journal CAS permits one runner to send.
7. If first request committed, replay observes Q or fails the P precondition; it
   cannot create a second distinct ref transition.

## T6. Idempotency header ignored by server

1. Custom provider uses core HTTP and inserts derived key K.
2. Core records and sends the exact request.
3. Server ignores the header, commits effect E1, and response is lost.
4. Fresh runner sends the same request and K.
5. Server commits E2.
6. Core transport correspondence was correct; remote idempotency was false.

Law: `replay.idempotency-key/1` requires trusted remote protocol evidence, not
merely a header and fingerprint.

## T7. Equal wire facts, different installed code

Historical facts:

```text
operation ID O
request fingerprint F
endpoint E
authorization scope A
replay protection R
```

Runner V1 and runner V2 prepare the same O/F/E/A/R. Package version and lockfile
provenance differ.

Two policies:

```text
strict implementation policy -> stop
wire-correspondence policy    -> same replay decision
```

No fixed-provider counterexample currently shows that code provenance alone
changes remote replay safety when the exact core request and trusted remote law
match. Provenance remains useful in the explanation.

If V2 prepares different bytes, the fingerprint mismatch stops replay under
both policies.

## T8. Provider-controlled operation identity

1. Plan stores canonical Intent bytes I.
2. Provider V1 returns operation ID hash("v1", I).
3. Provider V2 returns hash("v2", I).
4. Fresh runner sees a different operation despite unchanged plan facts.

Core-derived identity removes this installed-code dependency:

```text
hash("ts-release/operation/1", planId, definitionId, schemaVersion, I)
```

## T9. Lost GitHub asset response

1. Asset Intent references parent release Intent and requested name.
2. Parent receipt/observation supplies numeric release ID.
3. Asset upload is dispatched without a general idempotency key.
4. Response is lost.
5. Fresh runner lists assets and compares returned name, state, size, and digest.
6. Matching uploaded asset -> satisfied.
7. Documented starter asset after 502 -> provider-specific failed state.
8. Absence while upload may still be in flight -> inconclusive, not replay
   authority.

## T10. Write-only custom provider

1. Provider uses opaque dispatch with `replay.none/1`.
2. Response is lost.
3. No observation/status API exists.
4. Automatic replay is unavailable.
5. Maintainer stops or records `RiskAccepted` for a new attempt.

The provider remains valid; its resumability ceiling is explicit.

## T11. Two fresh runners

Both load journal revision 9 and derive that a next attempt is allowed.

```text
A appendIfRevision(9, DispatchStarted) -> Appended(10)
B appendIfRevision(9, DispatchStarted) -> RevisionMismatch(10)
```

A may send. B reloads and does not send. This does not fence an older request
already in flight.

## T12. Structured stop after unsupported law

1. Historical dispatch claims unknown `replay.idempotency-key/2`.
2. Core does not reinterpret it under `/1` semantics.
3. Stop explanation records scheme, request match, endpoint, scope, expiry,
   unsupported status, and the exact risk a maintainer would accept.
4. No automatic send occurs.

## T13. Journal backend race

The accepted law selects one winner. Which implementation provides it is open.

- SQLite transaction: one winner locally.
- dedicated Git ref: expected-old/fast-forward push should select one winner,
  but focused probe/live-host evidence is pending.
- S3 `If-Match`: strong AWS candidate, not mandatory default.
- CI artifact uploads: both may succeed and therefore cannot gate send.

## T14. Apple notarization response loss

1. effect-build-apple submits finalized pre-staple bytes.
2. Apple accepts the submission.
3. Process disappears before durable submission state is complete.
4. New runner must recover the submission identity or prove safe resubmission.
5. After acceptance it staples and verifies final bytes.
6. Only then can ts-release adopt the artifact.

Ownership is decided; durable recovery is not.

## T15. Consumer failure after accepted publication

1. Provider receipt establishes npm publication acceptance.
2. Separate CI job runs `npm install` and a smoke command.
3. Test fails because package entrypoint is broken.
4. Release policy fails.
5. Mutation journal does not replay npm publication.
6. Fix requires a new version/plan.

## T16. Plan correction

Historical Intent and journal events remain immutable. Correction creates a new
plan revision or superseding Intent with its own core-derived operation ID.
