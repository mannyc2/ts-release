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

The CLI preserves the redacted report before returning nonzero. Its final
recovery line names the exact reference rather than guessing remote state:

```text
publish re-observes every subject and mutates only what a provider decision authorizes; conflicts and unobservable outcomes still require operator action.
Resume: ts-release publish prepared:local:sha256-<manifest-digest>
```

The Action likewise writes `prepared-ref` and `report-ref` before failing a
blocked or uncertain step. Workflow templates upload only the redacted report;
the prepared bundle stays in the dedicated content-addressed Action store.

Post-mutation confirming reads use bounded provider profiles. Their numeric
timing values are conservative `ASSUMED/UNVERIFIED` policy, not measurements of
live visibility lag. They never turn a pre-mutation inconclusive result into
absence or authorize a second write.

Correction is not a generic inverse. Supply authored provider-specific desired
state alongside the same prepared reference:

```sh
ts-release correct prepared:local:sha256-<manifest-digest> correction.json
```

The kernel verifies the reference before interpreting correction content and
binds the proposal to the exact prepared publication. Neither installed
provider has a proved conditional correction write, so the result is an
external operator proposal and no corrective mutation is sent. Deletion and
announcements remain outside the engine.
