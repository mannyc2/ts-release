# Idempotency material and remote-law authority

Status: research response to R2 plus the correction that request
correspondence does not prove remote replay enforcement.

## Secret-material result remains valid

No fixed vNext distribution provider currently requires durable replay material
that is genuinely secret.

Do not add plaintext secret material or a speculative secret-manager reference
to the v1 plan/journal model. Authentication credentials are reacquired at run
time.

## Shipping-provider survey

| Operation | Replay-related provider fact | Secret material? | Automatic replay consequence |
| --- | --- | --- | --- |
| npm package PUT | no documented idempotency-key input in pinned client | no | observe or stop after uncertainty; immutability is not replay safety |
| Warehouse file upload | pinned Warehouse compares filename/content hashes | no | exact-duplicate law is Warehouse-specific, not transport-generic |
| GitHub release/assets | no documented general idempotency key | no | reconcile through provider reads |
| conditional Git | expected and desired object IDs | no | compare-and-swap law can be structurally represented by core Git transport |
| custom HTTP | server may or may not enforce a key | normally client-derived | transport can reproduce key/request, but remote law needs separate authority |
| opaque custom transport | correspondence not structural | n/a | no automatic replay |

## Derived keys solve retention, not enforcement

Core can deterministically derive a key without storing plaintext:

```text
baseFingerprint = fingerprint(request before key insertion)
key = H("ts-release/replay.idempotency-key/1", originDispatchId, baseFingerprint)
requestFingerprint = fingerprint(request after key insertion)
```

The journal can retain:

```text
originDispatchId
baseRequestFingerprint
keyFingerprint
scopeFingerprint
requestFingerprint
validFrom
expiresAt
```

A fresh runner can reproduce the same key and exact request. That proves local
correspondence only.

Counterexample:

```text
server ignores Idempotency-Key
first request commits; response is lost
fresh runner sends same request and key
server commits again
```

Therefore `replay.idempotency-key/1` additionally needs trusted evidence that
the named endpoint/provider enforces the key under the recorded scope and
expiry.

## Exact duplicate has the same split

Core can prove:

```text
same coordinate
same content fingerprint
same request fingerprint
```

It cannot prove that a generic server treats the duplicate as equivalent
success.

Pinned Warehouse source is provider-protocol evidence for its specific
behavior. It is not inherited by every PyPI-compatible endpoint.

Source:

- https://github.com/pypi/warehouse/blob/4bdd89d85bc522a0d555a871ffe250d644c660dc/warehouse/forklift/legacy.py

## Compare-and-swap is structurally stronger

For core-owned Git, the request itself carries expected-old and desired-new ref
facts, and Git enforces the precondition.

Source:

- https://git-scm.com/docs/git-push

This still requires endpoint identity and exact request correspondence, but it
does not rely on a generic header whose semantics are unknown.

## Authority alternatives

| Alternative | Benefit | Cost |
| --- | --- | --- |
| arbitrary provider self-assertion | open | a buggy provider can claim safety the server lacks |
| built-in provider-law table | auditable | hidden allowlist/core update for custom providers |
| application-supplied trusted law binding | open and explicit | maintained policy and versioning burden |
| no automatic non-CAS replay in v1 | smallest safety surface | less automatic Warehouse/custom continuation |

No final representation is selected in this correction pass.

## R2 conclusion

The secret-material question is closed:

```text
no plaintext replay secret in v1
no speculative durable-secret union
```

The provider-law authority question is separate and remains open. Removing
secret storage does not authorize arbitrary providers to claim a replay scheme.
