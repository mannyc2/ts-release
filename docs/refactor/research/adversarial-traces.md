# Adversarial traces

Status: research-only examples. No production journal, provider, Workflow, or Activity is implemented.

## Laws

- Intent is canonical desired state.
- One external request has one write-ahead dispatch record.
- Derived state folds the canonical plan and ordered event history.
- Another dispatch needs proof the prior request cannot commit later, provider-enforced replay safety, or explicit operator risk acceptance.
- Consumer failure does not erase provider acceptance.

## Normal npmjs success

Pinned npm source sends one package PUT containing version, tarball attachment, and initial dist-tag.

```text
Intent I = publish @scope/pkg@1.2.3, artifact A, initial tag latest
DispatchStarted(D1, I)
DispatchReturned(D1, successful provider completion)
I -> Accepted(receipt)
consumer install/import/bin -> NotObserved
```

The receipt stores only provider/transport-returned facts and references I; it does not claim npm echoed package, version, tag, or digest.

## npm response loss

If the version bytes later match but `latest` points elsewhere, do not republish the immutable version. Record provider-specific facet evidence and create a new tag Intent if correction is authorized. One composite initial npm Intent remains provisional because the wire performs one PUT.

## Partial Warehouse progress

```text
sdist -> HTTP 200 -> Accepted
wheel B -> response lost -> Dispatching
wheel C -> credentials fail before DispatchStarted -> no attempt
```

A fresh runner reuses the bundle, observes B through the Simple API, and starts C only after credentials return. Poll-budget exhaustion without a provider fence becomes Inconclusive.

## Lost GitHub asset response

The asset Intent references its parent release Intent; numeric release ID is bound at dispatch. Recovery uses a complete paginated listing and compares effective stored name, state, size, media type, and digest. Absence alone does not authorize replay.

## Stale in-flight request

Cancellation and cooperative leases stop future local work but cannot fence an external request. A new runner may wait, query request status, use provider-enforced idempotency/CAS, stop Inconclusive, or record explicit risk acceptance.

## Safe conditional-Git replay

For Intent `ref P -> Q`, replaying the same compare-and-swap can be provider-safe even when the first request may have committed: at most one P -> Q update succeeds. A different current ref is Conflict unless provider-specific equivalence proves otherwise.

## Risky replay

A write-only custom provider with no replay law remains Inconclusive after response loss. Another dispatch requires an audited risk-acceptance event naming the prior dispatch, operator, reason, and duplicate/conflict risks.

## Plan correction

Never edit an old Intent or artifact in place after Conflict. Create a new canonical plan/Intent, append supersession, and preserve old receipts and observations.

## Multi-path Git publication

One conditional ref update can expose several Homebrew formula and Scoop manifest paths atomically. Rendering, Git acceptance, public observation, and each package-manager install remain separate outcomes.

## Fresh-runner custom provider

A new runner loads bundle, plan, and journal; imports the same application/configuration; resolves provider definition ID/schema version; decodes Intent; folds history; reacquires credentials; and observes or replays only under provider law. Existing clean-consumer probes do not prove this durable path.

## Limits

No live mutation, response-loss proxy, durable backend, or two-process custom-provider continuation was exercised in this pass.
