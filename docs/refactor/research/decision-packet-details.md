# Decision packet details and counterexamples

Status: evidence/tradeoff supplement to `decision-packet.md`.

## 1. What the corrected probe establishes

The two-runner probe establishes:

- the selected strict shape compiles and executes;
- runner B can reproduce a core-owned request;
- a journal CAS can prevent two fixture runners from sending;
- strict implementation drift produces a structured stop; and
- a core-derived operation ID remains stable across two provider
  implementations in the focused identity comparison.

It does not establish:

- that five ProviderDefinition fields are minimal;
- that behavior or lockfile identity should block replay;
- that equal request bytes prove server idempotency;
- that the fake remote is a provider protocol; or
- that the local CAS seam is a production backend.

## 2. Operation identity alternatives

| Alternative | Canonical input | Installed-code dependence | Counterexample |
| --- | --- | --- | --- |
| provider `operationId(intent)` | provider executable projection | yes | V1 and V2 hash the same Intent under different domains |
| core hash of definition/schema/Intent | canonical durable bytes | no | must be paired with the owning plan ID to interpret bundle-relative references |
| random ID stored with plan | stored peer identifier | no after creation | can disagree with canonical Intent and cannot be recomputed |

Recommendation: core-derived provider-local identity, paired with `planId` as
the operation key. `planId` is not another input to the operation hash.

## 3. Strict versus bytes-sufficient replay

### Strict implementation policy

Blocks on behavior ID or whole-lockfile change.

False-positive examples:

- documentation-only or unrelated dependency lockfile update;
- test-runner dependency update;
- provider package rebuild with unchanged request construction;
- dependency graph change that does not affect the prepared request.

It also has false-negative limits:

- provider source may change without a lockfile change;
- a manually maintained behavior ID may not be bumped.

### Bytes-sufficient correspondence policy

For core-owned transports, compare:

```text
operation ID
endpoint
non-secret authorization identity/scope
immutable request fingerprint
replay key/condition and scope
validity interval
trusted remote replay law
journal CAS
```

No concrete fixed-provider counterexample was found in which all of these match
and local implementation drift alone makes the repeat request unsafe.

A changed response decoder can affect receipt/reporting behavior, but it does
not change whether the exact request is safe to send. Observation compatibility
is a separate provider operation.

Recommendation: implementation provenance is diagnostic, not a replay gate.

## 4. Request correspondence versus protocol authority

Counterexample:

```text
custom provider prepares an HTTP POST
adds Idempotency-Key: K
server ignores the header
first request commits, response is lost
core sends byte-identical request with K
second effect is created
```

Core proved correspondence. It did not prove remote enforcement.

Authority alternatives:

| Model | Auditability | Custom-provider effect | Hidden allowlist risk |
| --- | --- | --- | --- |
| provider self-asserts scheme | low | open | no, but unsafe assertion possible |
| core recognizes provider behavior IDs | medium | closed unless core changes | high |
| application trusts a protocol-law declaration | explicit | open | no core allowlist, but maintained policy |
| built-in structural laws only | high | custom replay conservative | low |

`core.git/1` CAS is structurally strongest because core constructs the expected
old and desired new ref update and Git enforces it. Warehouse exact-duplicate
and generic idempotency-key behavior remain provider-law claims.

No final authority representation is selected.

## 5. Journal backend alternatives

The law is fixed; implementation set is not.

### Filesystem generations

Current evidence is Linux-local only. Windows/macOS durability remains unproved.

### SQLite

Strong portable local candidate. It needs a safe local/block filesystem and
does not by itself solve multi-host CI.

### Dedicated Git ref

A fast-forward commit chain or explicit expected-old push can provide a
repository-native CAS. It avoids a second cloud account for GitHub Actions but
requires write permission, careful ref policy, and a response-loss read-back.

### S3

Strong conditional cross-host storage for AWS users. It is not entailed by
release-provider scope.

### User-supplied JournalStore

Needed if the product supports deployments that already rely on a database or
object store not maintained first-party. The shared law makes this ordinary
Layer substitution rather than a release mode.

## 6. Apple notarization

Concrete notary operations belong to effect-build-apple, but they execute under
ts-release's release operation and journal. This preserves one authoritative
history while keeping Apple tool/protocol details concrete.

A correct coordinated design must address:

```text
submission accepted
process disappears before submission ID/result is durably recorded
new runner receives same pre-notarization bytes
polls or reconciles without blind resubmission
staples and verifies final bytes
ts-release adopts only then
```

The package boundary is decided. effect-build-apple may expose typed
submit/info/staple/validate Effects and values; it must not create a peer
workflow history. The pre-recorded-submission-ID correlation gap remains open
and may truthfully produce `Inconclusive`.

## 7. Minor correction

The replay law has four cases, not "three facts": initial dispatch, proven
non-commit, trusted replay protection, and explicit risk acceptance.
