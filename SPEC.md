# ts-release specification

This document defines the public lifecycle boundary and the durable prepared
release representation.

## 1. Public lifecycle

The root runtime exports are exactly:

- `correct`
- `defineRelease`
- `encodeResolvedConfig`
- `inspect`
- `makeReleaseApi`
- `prepare`
- `publish`
- `release`
- `ReleaseInputError`
- `ReleaseRuntime`
- `resolveConfig`
- `unsupportedExecutionHost`

The constructed API exposes `inspect`, `prepare`, `publish`, `release`,
`correct`, and `dispose`. `release` prepares and publishes automatically.

## 2. Durable boundary

`prepared-release/v1` is a canonical JSON manifest plus content-addressed
blobs. The manifest records verified source identity, project identity,
artifact digests, and provider publication subjects. A publisher accepts only a
canonical manifest and matching blobs.

## 3. Observation

Publication observes the configured destination before mutation and observes
again after mutation. Equivalent destinations converge without a write;
conflicts and inconclusive observations block publication. Provider correction
uses an explicit correction intent bound to the prepared digest.

## 4. Commands

The CLI commands are exactly `init`, `inspect`, `prepare`, `publish`, `release`,
and `correct`. The Action invokes the automatic `release` operation and emits
the prepared bundle path and status.

## 5. Host boundary

Node and Bun layers provide the source observer, process runner, HTTP client,
and host filesystem services. The root library is host-independent until a
caller supplies one of those layers.

## 6. Error contract

Failures remain tagged Effect errors across the API boundary. No public helper
flattens a structured error into a generic string.

## 7. Verification

The repository's checks cover schema decoding, graph linking, staged native
preparation, prepared-store integrity, provider observation, correction, CLI
cutover, Action cutover, import rules, tree shaking, and package exports.

## 8. Non-goals

The engine does not transport host review state, provide a generic rollback,
maintain an execution ledger, or expose compatibility aliases for retired
lifecycle protocols.

## 9. Release program

The coordinated implementation and certification record is maintained in
`docs/release-program/`.

## 10. License

MIT.

## 11. Status

The current source is the authoritative implementation.

## 12. Compatibility

There is no compatibility reader for obsolete lifecycle documents.

## 13. Root export audit

The root runtime exports are exactly:

- `correct`
- `defineRelease`
- `encodeResolvedConfig`
- `inspect`
- `makeReleaseApi`
- `prepare`
- `publish`
- `release`
- `ReleaseInputError`
- `ReleaseRuntime`
- `resolveConfig`
- `unsupportedExecutionHost`

## 14. End
