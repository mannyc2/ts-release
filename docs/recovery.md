# Recovery and correction

The prepared bundle is the recovery boundary. Keep the exact directory for
the whole recovery window:

```sh
ts-release publish .release/ts-release/prepared/<manifest-digest>
```

The publisher verifies the manifest and every blob, then observes each remote
subject. Equivalent content is skipped. A safe authoritative absence can be
created or updated. A conflicting coordinate, corrected state, malformed
response, authentication ambiguity, timeout, or unavailable observation is
inconclusive and stops without mutation.

Partial success is normal distributed-system behavior. If a process disappears
after a provider accepts a request, rerun the same bundle; the destination
observation decides whether the subject is equivalent. Do not rebuild, bump a
coordinate, delete a subject, or claim a manual success.

Correction is not a generic inverse. Create a canonical provider-specific
correction intent bound to the prepared digest:

```sh
ts-release correct <prepared-bundle> correction-intent.json
```

npm deprecation and managed catalog state have explicit forward correction
paths. GitHub release correction and arbitrary PyPI file yank are unsupported
because safe conditional observation and remediation are not proven. Deletion
and announcements remain outside the engine.
