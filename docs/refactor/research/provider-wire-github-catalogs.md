# GitHub, Git catalog, and custom-provider wire models

Status: continuation of `provider-wire-models.md` with the same research-only guardrails.

## GitHub tag, release, and assets

Primary sources:

- https://docs.github.com/en/rest/git/refs
- https://docs.github.com/en/rest/git/tags
- https://docs.github.com/en/rest/releases/releases#create-a-release
- https://docs.github.com/en/rest/releases/assets#upload-a-release-asset

### Operation boundaries

GitHub release creation and every asset upload are separate wire requests and separate operations. No member-operation vocabulary is needed.

When ts-release owns tag creation, an explicit tag/ref transition is also a separate operation. Release creation may refer to the tag but does not collapse the ref and release-resource histories.

### Late-bound asset coordinate

A numeric release ID and upload URL exist only after release creation or observation. An asset operation therefore references the parent release operation plus its requested public name. Dispatch resolves the numeric binding from the parent receipt or fresh observation. Predicting a numeric ID is invalid; deferring all asset planning would weaken stable plan review.

### Receipt and observation

A successful asset response returns provider-native facts such as numeric ID, stored name, state, content type, size, digest when present, and URLs. The stored name is a receipt binding and may differ from the local filename.

After a lost response, a fresh runner performs complete paginated observation and applies an explicit match rule. The endpoint exposes no general idempotency key. Duplicate filename may return conflict rather than equivalent success. Absence while an upload may still be in flight is inconclusive, not replay authority.

GitHub release creation likewise relies on fresh release/tag observation after response loss. It contributes no secret replay material.

## Conditional Git publication for Homebrew and Scoop

A single commit and conditional ref update may publish several rendered paths atomically. The provider operation is the desired ref/tree transition:

```text
GitRefPublicationOperation {
  repository/ref,
  expectedRevision,
  desiredRevision/tree
}
```

Rendered formula and manifest files are artifacts, not peer remote operations. One explicit expected-old condition supplies `replay.cas/1`; Git object IDs are non-secret facts.

Rendering, publication, and consumer behavior remain distinct:

- valid local Ruby/JSON bytes do not prove ref movement;
- successful ref movement does not prove installability;
- `brew install` or Scoop smoke tests are application/CI evidence, not provider journal events.

Primary sources:

- https://git-scm.com/docs/git-push
- https://github.com/Homebrew/brew/blob/78dc68a15f167a973207437a4454381641a2f82f/docs/Formula-Cookbook.md
- https://github.com/ScoopInstaller/Scoop/tree/b588a06e41d920d2123ec70aee682bae14935939

## Arbitrary custom providers

A custom provider may supply:

```text
stable definition ID
versioned service-free Intent Schema/codec
optional prepare service
optional observe service
optional correct service
provider-native receipts/errors
operation-local Layers
```

Core owns canonical Intent encoding and operation identity. The application
assembles definitions through ordinary imports and rejects duplicate IDs; this
is resolution, not registration or admission.

### Core transport custom provider

A provider using `core.http/1` or `core.git/1` receives structural request fingerprinting and may use a supported recorded replay scheme. Core owns the final immutable request and send.

### Opaque custom provider

A provider dispatching an arbitrary Effect remains valid but cannot opt into automatic replay by implementing a projection method. After response loss:

- authoritative observation may establish satisfied, conflict, pending, or terminal non-commit;
- otherwise the operation stops `Inconclusive`;
- a maintainer may record `RiskAccepted`.

This is an explicit automation ceiling, not provider rejection.

## Evidence discipline

| Fact | Authority |
| --- | --- |
| desired endpoint, coordinate, metadata, artifact references | canonical Intent |
| exact physical request identity and replay protection | `DispatchStarted` |
| provider-returned mutation facts | provider-native receipt |
| provider-returned read facts | fresh observation |
| install/import/execute outcome | application/CI test |

Receipts and observations may reference an operation without copying Intent fields and relabeling them provider-returned.

## Remaining provider-specific choices

- whether explicit GitHub tag creation is mandatory or configured per release policy;
- exact npm-compatible registry support beyond npmjs;
- exact Python repository support beyond pinned Warehouse;
- provider-specific observation matching for GitHub assets and releases.

None requires a universal lifecycle or operation-member model.
