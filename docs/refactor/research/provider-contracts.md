# Provider boundaries and optional operations

Status: canonical provider-extension analysis for PR #20. This revision reopens
identity and replay-authority fields that the first probe merely exercised.
Provider wire facts remain in `provider-wire-models.md` and
`provider-wire-github-catalogs.md`.

## Fixed conclusions

- There is no universal `Publisher` service.
- `prepare`, `observe`, and `correct` are optional provider-local operations,
  not members of one mandatory lifecycle.
- A write-only provider is valid. After response loss it may remain
  `Inconclusive`.
- `ConsumerScenario` and durable consumer-acceptance records are not provider
  capabilities.
- Arbitrary providers are ordinary packages plus Layers. Durable continuation
  additionally requires that a fresh runner can identify and decode persisted
  provider Intent.

## The first probe did not establish a five-field law

The first two-runner probe selected and exercised:

```text
definitionId
intentSchema
intentSchemaVersion
behaviorId
operationId(intent)
```

Its type assertion restated that selected shape. It proved that the shape
compiled and that the fixture used it consistently. It did not prove that all
five fields were necessary, minimal, or preferable.

The corrected probe now compares the selected shape with smaller alternatives.

## Provider-definition alternatives

### A. Provider-controlled operation identity

```ts
interface ProviderDefinition<I> {
  readonly definitionId: string
  readonly intentSchemaVersion: string
  readonly intentSchema: Schema.Schema<I>
  readonly operationId: (intent: I) => OperationId
}
```

Counterexample: two provider versions can assign different IDs to identical
canonical Intent bytes. A fresh runner then depends on installed executable
code to reproduce an identity that core can derive itself.

### B. Core-derived operation identity

```text
operationId = hashCanonical(
  "ts-release/operation/1",
  {
    providerDefinitionId,
    intentSchemaVersion,
    canonicalIntent
  }
)

operationKey = { planId, operationId }
```

`operationId` is a core-derived identity for the provider-local Intent bytes.
`operationKey` supplies the owning plan/bundle envelope needed to interpret
bundle-relative references. This avoids asking provider code to reproduce
identity while also avoiding a second copy of plan facts inside the operation
hash. The provider supplies the Schema and canonical Intent bytes; it does not
supply the identity projection.

The focused identity probe demonstrates:

- the same plan/definition/schema/Intent produces one stable operation ID under
  two provider implementations; and
- provider-controlled projections can produce different IDs for the same
  Intent.

This supports B as the current recommendation. It does not select the final
hash framing or Schema API.

### C. Behavior and lockfile identity as replay authorities

The strict candidate blocks automatic replay when either value changes, even
when these facts match:

```text
operation ID
endpoint
authorization identity and scope
exact immutable request fingerprint
replay scheme, scope, condition, and expiry
```

No concrete fixed-provider counterexample was found in which sending the same
core-owned request under the same remote replay law becomes unsafe solely
because an unrelated dependency or provider package version changed.

A decoder or reporting implementation may change, but that affects how a new
response is interpreted, not whether the exact request is safe to send. An
opaque provider Effect may change arbitrary behavior, but opaque transports do
not receive automatic replay in the current model.

Therefore behavior/package/source/lockfile identity is best treated as optional
implementation provenance and diagnostics, not a replay authority. This is a
provisional recommendation with high confidence, not a claim that provenance
has no audit value.

## Smallest durable definition under current evidence

```ts
interface ProviderDefinition<I> {
  readonly definitionId: string
  readonly intentSchemaVersion: string
  readonly intentSchema: Schema.Schema<I>
}
```

The Schema boundary must provide one canonical encoding. Core derives operation
identity. Application composition supplies optional provider-local services:

```text
prepare
observe
correct
```

Implementation provenance may be recorded separately:

```text
package version
source revision
lockfile digest
build identity
```

Those fields explain which code produced an event. They do not override equal
wire evidence or create a second operation identity.

## Core transport evidence versus provider replay-law evidence

These are distinct.

### Core transport evidence

A core-owned immutable prepared request can establish:

- the exact request projection recorded before dispatch;
- the exact request sent;
- equivalence of a newly prepared replay request;
- whether the transport boundary was crossed; and
- the request fingerprint, endpoint, and authorization scope.

### Provider protocol evidence

Core transport cannot establish that a remote server:

- honors an idempotency-key header;
- uses the claimed key scope or expiry;
- treats an exact duplicate as equivalent success; or
- implements a particular conditional-write law.

Those are provider protocol laws.

## Who may select a replay scheme?

Four alternatives remain under review.

| Alternative | Strength | Failure mode |
| --- | --- | --- |
| any provider selects a scheme during preparation | open extension surface | arbitrary assertion can claim a law the server does not enforce |
| core recognizes selected provider behavior IDs | simple automatic policy | hidden allowlist and manually maintained behavior attestations |
| application supplies a trusted protocol-law binding | explicit authority and custom participation | another maintained policy object must be audited and versioned |
| automatic replay only for structurally evidenced built-in laws | smallest safe v1 | fewer automatic custom-provider continuations |

`core.git/1` compare-and-swap is closest to structural because core prepares the
expected-old/desired-new Git update and Git itself enforces the precondition.

`replay.idempotency-key/1` and `replay.exact-duplicate/1` are not structural
merely because they appear in the journal. Their use still requires a trusted
provider-law authority. No final authority model is selected in this pass.
Unsupported or untrusted laws result in observation, `Inconclusive`, or
`RiskAccepted`, never automatic replay.

## Custom providers

A custom provider unknown when core was built can still participate:

1. the release application imports its package;
2. the package supplies the versioned Intent Schema and provider-local Layers;
3. core derives operation identity from the persisted canonical Intent;
4. a fresh runner loads the same application and resolves the definition ID;
5. observation and correction remain optional;
6. automatic replay is available only when both request correspondence and a
   trusted replay-law authority exist.

This is resolution, not admission or certification.

## Current recommendation

- Remove provider-controlled `operationId(intent)` from the canonical provider
  definition.
- Keep behavior and lockfile identity as optional provenance, not replay gates.
- Retain core-owned transport as the request-correspondence mechanism.
- Keep provider replay-law authorization explicitly unresolved instead of
  pretending transport correspondence proves remote idempotency.
