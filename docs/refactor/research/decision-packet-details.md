# Decision packet details and source index

Status: evidence and tradeoff supplement to `decision-packet.md`.

## ConsumerScenario first-principles questions

### What concrete action consumes it?

No current core action. A release application or CI job may run `npm install`, `pip install`, `brew install`, Scoop installation, an import, or a CLI command.

### When does it run?

After provider acceptance, after public visibility, or in a separate later workflow. Different scenarios have different prerequisites.

### What changes on failure?

The selected application/CI policy fails. Historical provider acceptance remains true. Mutation replay is not authorized.

### Why not provider definition?

The scenario depends on product behavior and environment, not only provider law. One provider can have many scenarios; one scenario can span several providers.

### Substitutability law?

None was found across npm install, binary execution, Homebrew, Scoop, and application-specific imports.

### Is durable evidence required?

Not for publication correctness or resume. Normal CI logs/artifacts are sufficient unless a product separately chooses to persist acceptance reports.

### Does a public API need it?

No demonstrated API. An ordinary Effect supplied by the release application is sufficient.

### What is lost by removal?

Only a generic core registry/status/resume mechanism for arbitrary consumer tests. That loss does not block the fixed shipping scope.

Conclusion: remove completely from provider definitions and the canonical journal. Preserve clean-consumer testing as project/application policy.

## Replay alternatives

### A. Resume-time ReplaySafetyCapability

Canonical facts:

- old history plus newly installed provider code.

Failure:

- identical history can yield different verdicts across provider versions;
- verdict may not preserve evidence;
- combines static request protection with live observations.

Rejected.

### B. Dispatch-time protection interpreted by core

Canonical facts:

- prepared request fingerprint;
- provider behavior identity;
- authorization scope;
- protection scheme, key/condition, and expiry;
- journal history.

Strength:

- deterministic;
- auditable;
- no old verdict recomputation.

Weakness:

- requires a deliberately small core algebra;
- provider still must honestly prepare/send the recorded request.

Recommended.

### C. Provider-version-pinned replay classifier

Canonical facts:

- history plus exact provider executable version.

Strength:

- prevents version drift.

Weakness:

- replay logic remains executable historical policy;
- harder to audit than recorded protection;
- code availability becomes part of safety.

Useful as migration/compatibility defense, not the primary model.

### D. No automatic replay except structural proofs

Strength:

- smallest safe state space;
- arbitrary providers remain honest.

Weakness:

- fewer automatic continuations.

Recommended as the default around B: only core-supported recorded schemes enable automatic replay.

## Counterexamples used

### Idempotency key scope/expiry

- Stripe v1: 24 hours; v2: same API and account/sandbox within 30 days.
- AWS Cloud Control: 36 hours.
- Google: at least 60 minutes in documented APIs.

An unscoped string is insufficient.

### Conditional Git

Expected-old to desired-new is safe to replay because remote compare-and-swap prevents a second successful transition.

### Warehouse exact duplicate

Pinned source accepts the same filename and hashes, but rejects same filename with different content. The protection must bind coordinate and content.

### npm

Immutable version does not prevent conflict or capture mutable initial-tag effects. No automatic replay scheme is inferred.

### GitHub

No general idempotency key for release/asset creation. Observation is required after response loss.

### Write-only provider

No observation/protection means inconclusive, not provider invalidity.

### Request-status provider

Request status can prove terminal non-commit or satisfaction. It remains observation.

## Request fingerprint requirements

The normalized projection should bind:

- provider definition/behavior identity;
- endpoint/API version;
- method/operation;
- coordinate;
- canonical body/arguments;
- referenced artifact digests;
- relevant non-secret headers/options;
- idempotency key or condition;
- authorization principal/account/tenant/scope.

It should exclude freshly reacquired credential bytes and transport signatures whose semantic authority is separately bound.

For multipart or command transports, volatile boundaries/paths must either be stabilized or excluded through a provider-defined normalized projection. Built-in providers should use a core-owned prepared transport where practical.

## Secrets

Automatic replay requires recovering exact protection material.

Preferred:

- deterministic non-secret key derived from operation identity;
- durable secret-manager reference;
- encrypted journal field under an explicit storage policy.

If none is available, protection is not reusable. Credentials are always reacquired.

## OpenAI plugin distribution

Official package shape:

- `.codex-plugin/plugin.json`;
- optional `skills/`;
- optional `.app.json` or `.mcp.json`;
- assets/hooks;
- local or repository marketplace metadata.

Official public flow:

1. verified developer/business identity;
2. portal draft;
3. package/server scan;
4. listing, prompts, test cases, availability, attestations;
5. OpenAI review;
6. developer chooses Publish after approval.

The portal requires at least five positive and three negative tests. Public submission is not immediate publication and no general publication API is documented.

Sources:

- https://developers.openai.com/plugins/build/plugins
- https://developers.openai.com/plugins/deploy/submission

## Artifact production sources

- effect-build granular branch:
  https://github.com/mannyc2/effect-build/tree/15c811bb9904142a33d119766b62082f3c689f13
- GoReleaser nFPM:
  https://www.goreleaser.com/customization/package/nfpm/
- app bundles:
  https://www.goreleaser.com/customization/package/app_bundles/
- DMG:
  https://www.goreleaser.com/customization/package/dmg/
- pkg:
  https://goreleaser.com/customization/package/pkg/
- notarization:
  https://goreleaser.com/customization/sign/notarize/

## Probe limits

No new probe was added in this pass.

Existing clean-consumer probe does not prove persisted provider restoration or replay. Existing artifact probes do not prove remote/object-store behavior. Existing Effect baseline probes do not prove Workflow semantics. Alignment candidate jobs remain informational.

Recommended next discriminating probe:

```text
runner A:
  persist custom Intent
  prepare exact dispatch
  record protection and DispatchStarted
  stop before/after simulated response loss

runner B:
  load same application/provider behavior
  decode Intent
  prepare request
  compare fingerprint
  derive core replay decision
  use CAS to prevent a second runner from dispatching
```

A variant with provider behavior V2 must stop rather than reach a different automatic verdict.
