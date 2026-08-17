# Fresh-runner continuation

Status: operational projection of `resumability.md`.

## Target scenario

```text
new CI runner
no previous workspace or process memory
durable bundle + plan + journal
credentials reacquired
release application and provider definitions loaded
continuation proceeds without blind mutation replay
```

## Required durable inputs

1. immutable bundle and bundle ID;
2. canonical provider Intents and dependency edges;
3. provider definition ID and Intent schema version;
4. core-derived operation IDs;
5. ordered journal events and journal revision;
6. request correspondence and replay-protection facts;
7. a resume locator for the durable root; and
8. any non-secret provider receipts or request-status tokens needed for
   reconciliation.

Package/source/lockfile provenance may be retained for audit, but it is not a
required replay authority under the current recommendation.

## Continuation algorithm

1. Load and validate bundle, plan, and journal.
2. Fold current operation state.
3. Load the release application.
4. Resolve provider definition ID and schema version.
5. Run fresh observation when supported.
6. Prepare a candidate immutable request without sending.
7. Recompute core-derived operation and request fingerprints.
8. Compare endpoint, authorization identity/scope, request, replay protection,
   and expiry.
9. Establish whether the replay scheme has a trusted remote-law authority.
10. Derive the next action in core.
11. Compare-and-swap append `DispatchStarted`.
12. Send only after append success.
13. Record receipt, terminal non-commit proof, or fresh observation.

## Installed-code divergence

The previous strict candidate made implementation drift itself a stop:

```text
same request fingerprint
behavior ID differs
lockfile differs
-> stop
```

That is fail-closed, but it still makes continuation depend on installed code.
The corrected comparison is:

```text
same canonical operation
same immutable request
same endpoint and authorization scope
same replay protection and validity
same trusted provider law
-> same automatic decision
```

If new code renders different bytes, uses a different endpoint, or changes the
protection facts, replay stops. If only package/source/lockfile provenance
changes, that drift is explained but does not independently block under the
current recommendation.

This policy has no effect on opaque custom transports: they do not receive
automatic replay because core cannot prove send correspondence.

## Structured stop explanation

Every stop should report:

- recorded and candidate operation IDs;
- request fingerprint comparison;
- endpoint and authorization-scope comparison;
- replay scheme, scope, and expiry comparison;
- whether remote-law authority is absent or unsupported;
- implementation provenance drift as diagnostic context;
- current observation state; and
- the exact risk a `RiskAccepted` event would authorize.

A bare "provider version changed" refusal is insufficient.

## Journal compare-and-swap

If runners A and B both load revision 41:

```text
A appendIfRevision(41, DispatchStarted) -> Appended(42)
B appendIfRevision(41, DispatchStarted) -> RevisionMismatch(42)
B reloads and does not send
```

The `JournalStore` law is accepted. Which first-party backends ship is reopened
in `journal-backends.md`.

## Custom-provider ceilings

- dispatch only, no observation or trusted protection: response loss becomes
  `Inconclusive`;
- request-status observation: committed, rejected, pending, or unknown can be
  learned;
- core-owned request plus trusted replay law: exact automatic replay may be
  available;
- opaque dispatch: no automatic replay;
- unknown provider definition or schema: stop before mutation.

This is capability-bounded continuation without provider admission.
