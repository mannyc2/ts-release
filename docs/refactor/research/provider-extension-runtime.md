# Custom-provider composition and fresh-runner loading

Status: operational continuation of `provider-contracts.md`.

## Ordinary Effect composition

Concrete clients, credentials, rate limits, observation code, and correction code are ordinary services supplied by Layers. This does not imply a common publication service.

A shared abstraction is introduced only for one proved law:

- provider-definition resolution reconstructs persisted Intent types;
- core HTTP/Git transports structurally bind prepared requests to sends;
- `JournalStore` atomically appends one event at one expected revision.

There is no universal `Publisher`, custom request-projection interface, or provider admission registry.

## Fresh-runner application contract

A fresh runner has:

```text
durable bundle locator and digest
durable release plan
durable journal locator
no previous process memory
newly acquired credentials
release application/configuration
```

The application supplies the definitions and Layers needed by the plan. The plan stores definition ID, Intent schema version, behavior ID, and operation ID. The first dispatch records the provider lockfile identity used at preparation time.

The application does not serialize a Layer, closure, client, or historical replay classifier.

## Strict provider identity

Automatic replay requires all of:

```text
same definitionId
same Intent schema version and canonical Intent
same behaviorId
same provider/application lockfile identity
same core transport scheme
same endpoint and authorization identity
same re-prepared request fingerprint
same replay-protection scope and unexpired scheme
successful journal appendIfRevision
```

A mismatch produces a structured stop. Equal bytes do not relax behavior/lockfile drift in v1. The explanation reports every compared fact, matched and mismatched values, the consequence, and the exact assertion a later `RiskAccepted` would make.

There is no v1 migration operation. A provider upgrade that cannot satisfy strict identity may observe, create a new plan, or proceed only after human risk acceptance.

## Core-owned transports

### HTTP

Core constructs and freezes the exact HTTP method, endpoint, non-secret semantic headers, body bytes, derived idempotency material, and fingerprint. The transport sends that immutable value only after `DispatchStarted` is durably appended.

### Git

Core constructs the exact repository/ref coordinate, expected revision, desired revision, and command/protocol projection. A compare-and-swap ref update is recorded as `replay.cas/1` before send.

### Opaque provider Effect

Opaque code may still participate in initial dispatch and observation, but automatic replay is disabled. No TypeScript interface can prove that arbitrary code sends only the recorded bytes or performs no additional effects. The safe cost of not using a core transport is less automation, never weaker replay safety.

## Two-process probe result

`probes/two-runner/probe.mjs` runs runner A and runner B as separate Node processes with durable files as their only shared state.

It demonstrates:

- crash after `DispatchStarted` before send;
- response loss after one simulated provider effect;
- deterministic key derivation without plaintext key persistence;
- request re-preparation and fingerprint comparison;
- V2 behavior/lockfile drift stopping while request fingerprint remains equal;
- unknown replay-scheme and opaque-transport stops;
- one CAS winner, one loser, one send, and one external effect.

The probe's directory lock is only a seam. Production backend selection is in `journal-backends.md`.

## Dynamic loading boundary

A dynamic Node/TypeScript CLI can load provider packages selected by the release application. A sealed executable has a separate module-resolution problem and is not evidence for a closed provider union.

## Closest Effect analogy

Effect SQL remains the closest analogy: shared operations exist only where backend laws align, while concrete packages retain backend-specific services. Release destinations are additive, so the analogy stops before a universal publication service.

## Failure reporting

A fresh runner distinguishes:

```text
UnknownProviderDefinition
UnsupportedIntentSchema
ProviderIdentityDrift
UnsupportedTransport
UnsupportedReplayScheme
ExpiredReplayProtection
RequestMismatch
JournalRevisionMismatch
Satisfied
Conflict
Pending
Inconclusive
```

These are explanations or typed failures derived from one plan/journal history. They are not release modes or a second synchronized state table.
