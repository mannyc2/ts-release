# Recovery

The prepared bundle is the recovery boundary. Re-run `publish` with the same
bundle; it does not rebuild or reinterpret authored configuration. A lost
provider response is resolved only by observing the destination again.

Conflicts and inconclusive observations remain blocked. If a provider-specific
correction is needed, create a canonical correction intent bound to the bundle
digest and run `correct`. Corrections move forward through provider semantics;
they are not generic rollback.
