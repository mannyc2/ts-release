How can we reduce LOC and do it in a more "effect" way? Avoid local defenses, broad fallbacks, weak invariants, duplicated workflows, abstractions that do not reduce state space, and machinery added to compensate for unclear design. Prefer turning invalid states into impossible states over handling malformed cases everywhere. The goal is to recover code that feels like a deterministic machine, not an organism that needs another machine to diagnose it.

The file below is one TypeScript source file from ts-release, a release tool built on effect@4.0.0-beta.83 (this repo is the Effect v4 source). Ground every suggestion in what this repo already provides: cite the exact `Module.export` names and their defining source files under packages/effect/src. If a suggestion depends on an API you cannot find in this repo, do not make it.

Path: {path}
Role: {role}

```ts
{source}
```
