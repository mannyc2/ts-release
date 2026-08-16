# Custom-provider clean-consumer probe

This is a disposable research fixture, not a proposed release API.

It tests one narrow architecture claim at Effect `4.0.0-rc.109`:

1. a small core package contains no provider list or registration mechanism;
2. a separately packed package defines its own client service, `make`, `layer`,
   `layerConfig`, provider-local receipt, and publication Effect;
3. a separately packed Node CLI dynamically imports a consumer-owned module;
4. a clean temporary project installs all three tarballs and runs a publication
   the CLI could not have known when it was built.

This proves ordinary package/TypeScript/Layer composition. It does **not** prove
that a Bun/Node SEA or other single-file standalone executable preserves a host
module loader. Such a distribution would additionally need a documented module
loading boundary, filesystem access, package resolution in the consumer
project, and a security/trust policy for executing arbitrary code.

`test:standalone` records a separate Bun standalone result without treating
success as required. The research question is whether the packaging format
preserves the consumer-side loader, not whether providers should join an
allowlist when it does not.
