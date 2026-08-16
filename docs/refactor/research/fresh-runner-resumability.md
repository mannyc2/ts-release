# Fresh-runner continuation

Status: operational projection of `resumability.md`.

## Target scenario

```text
new CI runner
no previous workspace
no process memory
durable bundle + plan + journal
credentials reacquired
release application/provider definitions loaded
continuation proceeds without blind mutation replay
```

## Required durable inputs

1. immutable bundle and bundle ID;
2. canonical provider Intents;
3. provider definition ID, Intent schema version, and behavior ID;
4. dependency edges;
5. ordered journal events;
6. journal compare-and-swap version;
7. durable references needed to reacquire credentials or replay key material;
8. source/application/lockfile identity sufficient to load compatible provider code.

Consumer test output is not required for mutation continuation.

## Continuation algorithm

1. Load and validate the bundle, plan, and journal.
2. Fold current per-Intent state.
3. Load the release application.
4. Resolve each provider definition by ID and schema version.
5. Reject automatic mutation when behavior identity is incompatible.
6. Run fresh observations where the provider supports them.
7. Prepare any candidate request without sending it.
8. Compute the normalized request fingerprint and replay protection.
9. Ask core's pure replay decision function whether an attempt is authorized.
10. Compare-and-swap append one `DispatchStarted`.
11. Send only after the append succeeds.
12. Record the provider receipt, terminal non-commit proof, or fresh observation.

## Installed-code divergence

Two runners with identical history can load different provider packages. They must not thereby reach different automatic replay verdicts.

The rule is:

```text
same behaviorId + same requestFingerprint + same protection facts
  -> same core replay decision

behaviorId or requestFingerprint mismatch
  -> no automatic replay
```

The newer provider may still offer an explicit migration or a read-only observation compatibility path. That path does not rewrite historical replay evidence.

Remaining dependency: a provider implementation can violate its contract by sending a request different from the recorded prepared request. Built-in providers should minimize this with core-owned transports. Opaque custom Effects cannot be made non-malicious by TypeScript types.

## Journal compare-and-swap

Suppose runners A and B load journal version 41 and both determine that exact replay is safe.

```text
A appends DispatchStarted at expected version 41 -> succeeds, version 42
B appends DispatchStarted at expected version 41 -> fails
B reloads version 42 and does not send
```

The append and dispatch gate must be ordered so that a runner cannot send after losing the compare-and-swap.

A lease can improve ownership and liveness but is not the safety authority. It cannot fence a stale request already in flight at a provider.

## Storage mechanisms

| Mechanism | Fresh-runner bundle | CAS journal | Concurrent takeover | External exactly once |
| --- | --- | --- | --- | --- |
| local files | only with durable shared volume | weak unless filesystem supports atomic protocol | weak | no |
| SQLite | yes on durable/shared volume | transactional | cooperative; deployment-specific | no |
| remote database/object store | yes | strong conditional writes possible | strongest initial fit | no |
| CI artifacts plus rerun | bundle yes; mutable progress awkward | weak without external state | CI-specific | no |
| Effect Workflow memory engine | no cross-process durable guarantee | engine-local | test/local | no |
| Effect Cluster Workflow | durable messages/results with infrastructure | engine-managed | engine-managed | no |
| Temporal | durable workflow/activity history | engine-managed | strong worker coordination | no |
| explicit release journal | exactly tailored to provider evidence | chosen backend | chosen backend | no |

Temporal explicitly recommends idempotent Activities because an external effect may complete and the worker may crash before the completion event is recorded. Durable execution does not remove the provider boundary.

Sources:

- https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/effect/src/unstable/workflow/Activity.ts
- https://github.com/temporalio/documentation/blob/7f42b11f9ea68c1b463527fc1c13150a61c5cd16/docs/encyclopedia/activities/activity-definition.mdx

## Custom-provider continuation

A custom provider is resumable when the fresh runner's application supplies the matching provider definition and any required Layers.

Capabilities determine the ceiling:

- dispatch only, no observation/protection: response loss stops inconclusive;
- authoritative status observation: continuation may classify committed, rejected, or pending;
- recorded core-supported protection: exact replay may proceed;
- unsupported opaque replay law: no automatic replay;
- behavior mismatch: no automatic replay.

This is honest capability-bounded resumability, not provider admission.

## Retention and expiry

Continuation can fail precisely because:

- bundle expired;
- journal expired;
- provider definition unavailable;
- schema migration unavailable;
- replay key expired;
- replay key secret reference unavailable;
- request-status retention expired;
- provider observation no longer authoritative.

These are limits of the evidence, not reasons to rebuild or blindly replay.
