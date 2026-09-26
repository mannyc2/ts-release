# Release completed Git repositories before application disposal

The final capability review found a retained-disk issue that becomes more
important when bounded observation keeps one application open. Each journal
snapshot allocated and fetched a new native repository, then kept it until the
runtime root closed. Catalog observation, capture and construction did the same.
Per-command output limits and eventual root cleanup did not bound the number
of obsolete repositories retained during one long invocation.

This is distinct from a prepared Git send: its returned closure still needs the
exact imported objects and credentials after preparation returns. That lifetime
and its existing no-replay/CAS authority stay unchanged.

## Smallest owner change

The private `GitRepository` gains a lazy `close` Effect implemented by the native
GitProcess owner. Initialization failure closes its new directory with `onError`;
the runtime root remains the final safety net. No public service, Scope requirement
on existing repository consumers, new package dependency or generic resource
framework is introduced.

GitJournal brackets the complete read or snapshot/append/CAS operation with
`acquireUseRelease`. It admits coordinates and resolves the separately selected
journal credential before allocating the repository, preserving the previous
order. Fetch/read failure, revision mismatch, existing-event recognition and
native push settlement all leave through that finalizer. Cleanup failure is
observable as a finalizer defect; it does not grant retry or change an ambiguous
storage outcome into a known noncommit.

GitHost brackets only its completed `observeRef`, `captureBase` and object-builder
operations. They return an owned value, with no live repository reference needed
by callers. Prepared sends retain the existing runtime lifetime. Native removal
remains synchronous at GitProcess, as was root disposal; actual process teardown
still belongs to the existing Process adapter.

## Genuine regression evidence

No new test matrix was added. Two existing native cases already perform the
relevant repeated work and exercise both Git object formats. Each now supplies
an isolated cache and checks for remaining actual Git `HEAD` files before its
outer application/builder scope closes. Existing outcome assertions are retained.

Before the production changes, the selected SHA-1 journal case passed all existing
checks but failed the new retention assertion with **nine remaining repositories**.
Log `/tmp/ts-release-git-journal-retention-red.log`, exit 1, one failure, four
filtered. Baseline source SHA256:

- GitProcess: `b2592a3ed16f8655a9df522ecf5713f5629b16255f985c3d03658fd18dafa056`.
- GitJournal: `89eb9154819b5bc91d5b463b03609a9a5372bed639395bee0a12af89381fecd7`.
- Final regression file: `7ebc25ae26702dce81f38a92d23322106c3c8e95ab6a5803eedad704d7bc4e1a`.

The unchanged regression then passed with the rest of its file: **five tests,
43 assertions**, including SHA-1/SHA-256, exact event bounds, native CAS races
and lost push-response recovery. Log
`/tmp/ts-release-git-journal-retention-green.log`. A later small source adjustment
restored coordinate/credential-before-allocation ordering through the private
selection helper; final integrated checks must include that adjustment.

After this private close capability existed, but **before editing GitHost**, its
selected SHA-1 existing case independently failed with **nine completed builder
repositories** still present. This establishes that adding a close method alone
does not fix its consumers. Log `/tmp/ts-release-git-host-retention-red.log`.
GitHost baseline SHA256
`47766389e75ef54fe9c502d10ff3957534b55b00aaec2c01e712148756586b33`;
regression file SHA256
`eac9807f3a1d8ddde073286529a190939302996d32c40b8d465dc44a97800f18`.

After the three leaf owners were bracketed, that unchanged file passed **three
tests, 40 assertions**. Existing cases still prove owned objects survive builder
disposal, later prepared sends work, changed requests refuse, competing native
refs do not overwrite and completed runs do not send again. Log
`/tmp/ts-release-git-host-retention-green.log`.

These native tests ran with pinned Bun 1.3.14, local Git repositories, explicit
temporary roots and the existing nonblocking shared verification lock. Every
fixture's outer teardown also removes the baseline retained directories when
its assertion fails. Targeted lint passed. No remote Git service, publication
or extra host profile was exercised. Final static and installed qualification
remain assigned to the combined changed-source profile.

## Final combined source qualification

After the earlier stops and bounded receipts above, the coordinator qualified the
final frozen source: static/build **exit0**, with **95 files, 676 import edges,
15 entries and 2 computed loads** (`/tmp/ts-release-final-capability-check-final.log`);
behavior **exit0, 356 pass, 0 fail, 3,808 assertions across 62 files**, 256.64 seconds
(`/tmp/ts-release-final-capability-test.log`).

This run includes the final coordinate/credential-before-allocation ordering,
GitJournal's explicit nested `AppendResult` return type, and the journal/host
repository-retention cases. It qualifies the final integrated source following
the earlier narrower green receipts and compiler correction.

Packed/installed profiles were still running when this note was appended; these
source receipts make no archive-green claim. See the coordinator's
[final qualification](final-qualification.md) for subsequent delivery receipts
and remaining native/live-provider limits.
