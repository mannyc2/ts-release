# Architecture

The release engine has one value flow:

```text
authored JSON + observed source
        ↓ pure resolution
canonical release graph
        ↓ local preparation
prepared-release/v1 bytes + blobs
        ↓ destination observation
provider publication or typed correction
```

The graph is ephemeral. It is recomputed inside the process that reads the
authored configuration and is never used as transported authority. Prepared
bytes are the explicit cross-process boundary: a publisher verifies the
manifest digest, blob digests, source identity, and publication subjects before
it can mutate a destination.

## Boundaries

- `src/resolve` turns authored values and observed facts into canonical config.
- `src/release` owns the graph, native preparation, inspection, and prepared
  bundle store.
- `src/publication` owns destination observation, mutation, and re-observation.
- `src/correction` owns provider-specific forward correction intents.
- `src/api` owns the five public lifecycle operations.
- `src/platform` composes Node or Bun services once at the host boundary.
- `apps/release-ts` owns CLI parsing and file I/O.
- `apps/ts-release-action` owns Action inputs, contained paths, and outputs.

Review is a host concern. There is no review service, approval identity,
execution ledger, or generic publication hook in the product runtime.

## Preparation

Native command preparations are represented by typed graph primitives. They run
in a staged workspace, with declared inputs, declared outputs, explicit
environment names, and source re-observation after each trusted command. The
preparer captures only declared bytes and writes them into the content-addressed
prepared store.

The graph compiler retains user jobs as native primitives. It does not clone a
provider's feature vocabulary or add capabilities without an executable
vertical test.

## Publication

Every publication subject observes first. A destination can be equivalent,
absent and mutable, conflicting, or inconclusive. Mutation is allowed only for
the exact absent/mutable observation and is followed by a fresh observation.
Unknown provider responses remain unknown until destination observation proves
the result.

Corrections are separate typed intents. npm deprecation and managed catalog
state have provider-specific correction paths; unsupported GitHub and PyPI
corrections remain explicit typed outcomes.
