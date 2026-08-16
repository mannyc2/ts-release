# Adversarial traces: risky replay, correction, and fresh-runner continuation

Status: continuation of [adversarial-traces.md](./adversarial-traces.md). It is part of the same research document and has the same guardrails.

## Trace 7 - risky replay for an unobservable custom provider

### Provider capability

```text
Intent decoding: yes
Dispatch: yes
Observation: no exact coordinate read
Idempotency key: no
Conditional mutation: no
```

### History

```text
E1 = DispatchStarted(D1, I-X attempt 1)
request may have committed
response lost
```

Derived state:

```text
I-X = Inconclusive
```

### Automatic behavior

No second dispatch.

### Operator decision

The CLI shows:

- exact Intent;
- bundle digest;
- prior physical dispatch;
- provider-declared lack of observation/replay safety;
- possible duplicate/conflict effect.

If the maintainer accepts risk:

```text
E2 = ReplayAuthorized {
  basis: RiskAccepted,
  priorDispatch: D1,
  maintainer,
  reason,
  acceptedRisks
}

E3 = DispatchStarted(D2, I-X attempt 2)
```

### Law exercised

Arbitrary providers remain valid without pretending their resumability is stronger than their protocol.

## Trace 8 - plan correction

### Original plan

```text
P1:
  I-A = GithubAssetIntent(name tool.tar.gz, artifact digest X)
```

History:

```text
I-A -> Conflict(existing asset digest Y)
```

### Incorrect correction

Mutate I-A or replace digest X inside P1. This rewrites history and invalidates operation identity.

### Lawful correction

Create:

```text
P2 supersedes P1
I-B = new canonical Intent {
  chosen correction policy,
  new name or deletion/replacement authority,
  artifact digest X
}
```

Journal:

```text
PlanSuperseded(P1, P2, reason, maintainer)
```

P1 history remains immutable. P2 has a new plan ID and Intent ID.

### Law exercised

Corrections are new desired facts, not edits to prior evidence.

## Trace 9 - fresh-runner custom-provider continuation

### Runner A

Application imports `@acme/ts-release-registry` and supplies:

```text
definitionId = acme-registry
schemaVersion = 3
Intent Schema
Dispatch capability
Observation capability
Layer
```

Runner A:

1. finalizes bundle B;
2. writes plan P with encoded custom Intent;
3. appends `DispatchStarted(D1)`;
4. exits before a response event.

### Runner B

A clean CI runner has:

```text
no workspace from runner A
B + P + journal in durable storage
same release application/configuration
provider package version compatible with schema 3
new credentials
```

Runner B:

1. loads application and provider definition resolver;
2. resolves `(acme-registry, 3)`;
3. decodes and canonical-round-trips Intent;
4. loads bundle-bound artifact handles;
5. folds journal to `Dispatching(D1)`;
6. acquires lease/CAS;
7. runs provider observation;
8. appends observation or replay authorization; and
9. continues.

### Failure modes

```text
provider definition missing
  -> precise MissingProviderDefinition, no mutation

schema version unsupported
  -> IncompatibleProviderDefinition, no mutation

bundle expired
  -> MissingFinalizedInput, no mutation

credentials unavailable
  -> run diagnostic, operation remains Dispatching/Planned

observation inconclusive
  -> Inconclusive, no automatic replay
```

### What this trace still requires proof for

The existing clean-consumer probe does not prove this trace. A two-process persistence probe and later scratch-provider test are required.

## Trace 10 - one Git update publishes several formula paths

### Renderer outputs

```text
F1 = Formula/foo.rb
F2 = Formula/foo@1.rb
S  = managed-state.json
```

These are exact finalized artifacts or rendered tree entries.

### Publication Intent

```text
I-G = GitRefPublicationIntent {
  expectedOld: P,
  newTree: hash(F1, F2, S, existing unmanaged tree),
  managedPaths: [F1, F2, S]
}
```

One commit and one conditional ref update publish all paths.

### Result

```text
ref update accepted
  -> Git publication Accepted

formula paths visible with exact blobs
  -> metadata/byte observation

brew install foo succeeds
  -> consumer evidence

brew install foo@1 fails
  -> separate consumer failure
```

There is no provider partial state in which only F1 was published by the ref update. Rendering could have failed per path before dispatch, but Git publication is one atomic ref fact.

## Trace 11 - Homebrew and Scoop share a Git transaction law but not one provider model

### Common lower-level law

Both may publish exact files through:

```text
conditional Git ref update
```

### Distinct upper-level facts

```text
Homebrew:
  Ruby formula rendering
  formula name/path
  archive URLs/checksums
  brew install/test

Scoop:
  JSON manifest rendering
  bucket path
  architecture URLs/hashes
  Scoop install/smoke
```

A shared Git capability can be reused. A shared `CatalogPublisher` that erases renderer and consumer semantics cannot.

## Trace 12 - public observation succeeds, consumer fails

### Example

```text
npm publish accepted
packument version and integrity equivalent
tarball downloadable
npm install fails because package entrypoint is broken
```

Journal/evidence:

```text
A = Accepted
M = Equivalent
B = Equivalent
C = ObservedFailure
```

The provider operation remains satisfied. The release policy decides whether C blocks overall completion. The system does not republish the immutable version.

## Cross-trace invariants

1. Intent is canonical desired state.
2. Physical dispatch is one historical event.
3. Provider-returned receipt facts are not invented from request data.
4. Fresh observations are not receipts.
5. Consumer evidence is not provider reconciliation.
6. Absence cannot fence an in-flight mutation without provider law.
7. Safe replay can come from noncommit proof or provider replay safety.
8. Risky replay is explicit and audited.
9. Plan correction creates new canonical Intents.
10. Fresh runners require exact provider definition resolution.

## Limits

These traces are reasoned executions over pinned protocol/source facts. They do not establish:

- actual propagation timing;
- real provider response-loss behavior;
- storage transaction correctness;
- Effect Workflow runtime behavior in ts-release;
- clean Homebrew/Scoop consumer success; or
- a complete custom-provider resume implementation.

Those require the implementation/evidence sequence in [implementation-strategy.md](./implementation-strategy.md).
