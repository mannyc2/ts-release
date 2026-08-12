# Changelog

## 0.2.0 - blocked

Candidate `1bc7828` is not releasable. The earlier Plan 221 certificate is
invalidated and Plan 222 is superseded; no public mutation occurred.

The deterministic candidate audit found release-blocking defects at the
shipped boundaries, including an unreachable CLI credential path, false-green
Action status, malformed GitHub asset upload, dropped npm trusted-publishing
intent, unsafe credential/process handling, unreachable claimed capabilities,
and preparation inputs not fully bound to verified source bytes.

Do not use this pending entry as release instructions and do not provide npm,
GitHub, or catalog credentials to this candidate. Remediation is tracked in
`docs/release-program/README.md`; a complete replacement changelog is owned by
Plan 233k after the corrected kernel is independently certified.
