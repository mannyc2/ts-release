# Idempotency material and secret-retention research

Status: decision-grade response to research question R2. The fixed law is that
no plaintext secret material enters the plan, journal, bundle, logs, or reports.

## Result

No fixed vNext distribution provider requires durable replay material that is
genuinely secret.

The v1 replay model is therefore derived-key-only. Remove:

```text
PersistedValue | DurableSecretReference
```

from idempotency-key protection. Do not add a secret-manager reference form in
v1. Authentication credentials remain secrets, but they are reacquired at run
time and are not replay keys.

## Shipping-provider survey

| Shipping operation | Provider replay mechanism | Secret durable material? | v1 consequence |
| --- | --- | --- | --- |
| npm package PUT | pinned npm client sends the package document without a documented idempotency key | no | after uncertainty, use observation or stop; immutability alone is not automatic replay protection |
| Warehouse file upload | pinned Warehouse recognizes exact duplicate filename/content hashes and rejects conflicting reuse | no; filename and hashes are public content facts | `replay.exact-duplicate/1` may apply only to the pinned behavior and exact request/content |
| GitHub release creation | official request documents tag and release fields, not an idempotency key | no | reconcile by tag/release observation; absence does not fence an in-flight create |
| GitHub asset upload | official request documents raw bytes plus name/label and returns `422` for an existing filename | no | observe asset name/digest; duplicate-name conflict is not exact-duplicate success |
| Homebrew/Scoop conditional Git update | explicit expected-old commit ID through `--force-with-lease=<ref>:<expect>` | no; Git object IDs are non-secret | `replay.cas/1` records expected and desired revisions |
| arbitrary core-HTTP custom provider | core derives any supported client idempotency key from durable non-secret dispatch facts | no | automatic replay only through the core transport and a supported scheme |
| opaque custom transport | no structural correspondence between recorded and sent request | not applicable | no automatic replay; observe, stop inconclusive, or require `RiskAccepted` |

## npm

Pinned `libnpmpublish` builds one metadata document containing the version,
initial dist-tag, and attachments, then sends one PUT (or one staging POST).
The visible request construction exposes no idempotency-key parameter or
header. Registry authentication and optional provenance credentials are
separate from replay protection.

An npm version coordinate is immutable, but a repeated PUT can conflict and the
same physical request also asks for a mutable initial tag. npm therefore does
not contribute secret key material or a generic automatic replay law.

Source:

- https://github.com/npm/cli/blob/51c2bf81fa2c31547d0fec44fff2aaac3d9a9862/workspaces/libnpmpublish/lib/publish.js

## Warehouse

Pinned Warehouse source compares uploaded hashes with existing file state. An
exact duplicate can be classified from filename and content hashes; conflicting
reuse is rejected. Those facts are non-secret and already belong to the
operation, artifact, and request fingerprints.

No replay token needs to be retained. The behavior is pinned-provider evidence,
not a law automatically inherited by every PyPI-compatible repository.

Source:

- https://github.com/pypi/warehouse/blob/4bdd89d85bc522a0d555a871ffe250d644c660dc/warehouse/forklift/legacy.py

## GitHub Releases and assets

The official create-release request documents the repository coordinate,
`tag_name`, target, name, body, and release flags. It does not document an
idempotency-key field. The created resource is observable through the release
API.

The official asset upload request sends raw bytes with a required name and
optional label. Uploading the same filename again returns `422`; a successful
asset response includes an asset digest. This supports reconciliation, not
static exact-duplicate replay.

Sources:

- https://docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28
- https://docs.github.com/en/rest/releases/assets?apiVersion=2022-11-28

## Conditional Git updates

The explicit form:

```text
git push --force-with-lease=<ref>:<expect>
```

updates only when the remote ref still equals the supplied expected value and
fails otherwise. Expected and desired object IDs are content-addressed Git
facts, not secrets.

Source:

- https://git-scm.com/docs/git-push

## Core-derived idempotency keys

A provider does not supply a request projection in v1. A provider that wants
automatic HTTP replay prepares an immutable request through the core-owned HTTP
transport. Core owns both canonicalization and key derivation.

The `replay.idempotency-key/1` derivation is conceptually:

```text
baseRequestFingerprint = CoreHttp.fingerprint(
  exact prepared request before the core-derived idempotency field,
  excluding reacquired authentication material
)

key = Encode(
  SHA-256(
    "ts-release/replay.idempotency-key/1" ||
    originDispatchId ||
    baseRequestFingerprint
  )
)

requestFingerprint = CoreHttp.fingerprint(
  exact prepared request after key insertion
)
```

The event records only:

```text
{
  schemeId: "replay.idempotency-key/1",
  originDispatchId,
  baseRequestFingerprint,
  keyFingerprint,
  scopeFingerprint,
  requestFingerprint,
  validFrom,
  expiresAt
}
```

It does not record the key value. A fresh runner derives the same key, verifies
its fingerprint, reconstructs the immutable prepared request, and compares the
final request fingerprint. If the remote protocol's idempotency field or key
constraints cannot be expressed by the supported core transport, the provider
does not receive automatic replay in v1.

The two-runner probe exercises this path across response loss: two separate
processes derive the same key, two requests reach the protocol double, and only
one remote effect is created. The durable journal contains the key fingerprint,
not the key plaintext.

## Scope and expiry remain mandatory

A non-secret key is not sufficient by itself. The event still binds:

- provider definition, behavior, and lockfile identity;
- endpoint and authorization identity;
- provider-defined key scope;
- base and final request fingerprints; and
- validity interval.

Official out-of-scope examples confirm these dimensions. AWS Cloud Control
accepts a client token supplied by the caller, limits it to 128 characters, and
expires it after 36 hours. This is evidence that client tokens can be derived
non-secret identifiers while scope and expiry remain part of the replay law.

Source:

- https://docs.aws.amazon.com/cloudcontrolapi/latest/APIReference/API_CreateResource.html

## Future counterexample rule

A future first-party provider may prove that safe replay requires a
server-generated secret capability that cannot be deterministically recreated.
That would be a new evidence-backed scheme and a new durable-secret design. It
does not justify carrying an unused secret-reference union in v1.

Until such a provider is promoted into scope:

```text
secret replay material required
  -> unsupported automatic replay
  -> observation, Inconclusive, or RiskAccepted
```
