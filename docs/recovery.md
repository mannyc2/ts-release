# When a release stops halfway

The prepared bundle is the recovery boundary. A release can be resumed by
running the publisher against the same bundle; it does not rebuild artifacts or
re-read authored configuration.

```sh
ts-release publish .release/ts-release/prepared/<manifest-digest>
```

Publication is destination-observed. If a provider response is lost, the
publisher observes the destination again before deciding whether the subject
converged. A conflicting or inconclusive observation remains blocked for the
host to resolve.

If a valid publication needs correction, create one canonical provider-specific
correction intent bound to the prepared digest and run:

```sh
ts-release correct <prepared-bundle> correction-intent.json
```

Corrections are forward provider actions. They do not pretend that a generic
rollback exists.
