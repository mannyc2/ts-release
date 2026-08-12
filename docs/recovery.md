# Recovery and correction

The prepared bundle is the recovery boundary. Keep the exact path-free
reference for the whole recovery window:

```sh
ts-release publish prepared:local:sha256-<manifest-digest>
```

The local CLI resolves the digest against its selected store (`--store` chooses
a non-default store). The publisher verifies the manifest and every blob,
then observes each remote subject. Equivalent content is skipped. Mutation is
possible only after a typed provider decision. A conflicting coordinate,
malformed response, authentication ambiguity, timeout, or unavailable
observation stops without mutation.

Partial success is normal distributed-system behavior. If a process disappears
after a provider accepts a request, rerun the same bundle; the destination
observation decides whether the subject is equivalent. Do not rebuild, bump a
coordinate, delete a subject, or claim a manual success.

Correction is not a generic inverse. Supply authored provider-specific desired
state alongside the same prepared reference:

```sh
ts-release correct prepared:local:sha256-<manifest-digest> correction.json
```

The kernel verifies the reference before interpreting correction content.
Executable correction remains unsupported until its provider-specific
conditional observation and recovery contract is certified. Deletion and
announcements remain outside the engine.
