# Release runbook — blocked candidate

Candidate `1bc7828` must not be released. The Plan 221 certificate is
invalidated, Plan 222 is superseded, and no live mutation occurred.

Do not supply release credentials, dispatch the repository release workflow,
publish a package, create a tag or GitHub release, or update a catalog from
this candidate. The public-boundary blockers and successor handoffs are
tracked in `docs/release-program/README.md` and
`docs/release-program/remediation/223-candidate-invalidation.md`.

Plan 233k will replace this notice with a tested runbook only after the
corrected kernel passes clean-clone certification. Plan 234k remains the sole
kernel live-mutation phase and requires an exact operator authority packet.
