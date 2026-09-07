# W02 bounded independent correction review

Reviewer: existing independent agent `/root/review_beta_declaration` (Hypatia),
2026-09-07. This review is not wave or release-candidate certification.

The reviewer reproduced six material defects and the implementer addressed them:
full native body correspondence, observed native hashes incorrectly trusted as
expected values, missing trust validation of loaded provenance, signing a payload
unrelated to configured source, empty identity selecting Sigstore ambient CI, and
Buffer/nested request aliasing across asynchronous hashing. Regression witnesses
are in npm/protocol.test.ts, npm/auth.test.ts and kernel/admission.test.ts.

The reviewer independently reran29tests/278assertions and the actual Node22.22.2
native Sigstore consumer with its authentic public attestation and four rejection
controls. It reported no remaining material defect in those reviewed corrections.
The initial native verification attempt lacked network; an authorized read-only
rerun passed. No automatic approval rejection occurred.

The review correctly limited two initial controls: changing the repository rejects
at statement admission, while a one-byte root rejects structural proof admission.
The native consumer now corrupts a well-formed Merkle path hash, reaching native
verification; its receipt calls the other control `statement-source-admission`.
No isolated DER-extension negative is claimed. Authentic successful verification
includes the actual source-extension checks. Bun1.3.14 fails TUF root signatures
on the same fixture; the Node success does not qualify direct Bun Sigstore.

The reviewer independently exercised21tests/202assertions for transport preflight,
core Git, npm tag semantics and process restart. It found that false/0/empty-string/
null optional preparation members were silently omitted. The correction accepts
only undefined or a function; the reviewer reran6tests/47assertions and confirmed
malformed capabilities reject before journal access. Fresh CAS, receiver capture,
separate request bytes and discarded closures remain sound.

The final local native transcript gap is closed by the official npm/libnpmpublish
encoder oracle. The reviewer independently reran1test/9assertions, verified both
official source hashes and regenerated the fixture in a fresh directory with
equal parsed output. The full PUT comparison excludes only npm _nodeVersion and
JSON key order; the tag body is exact. This is native encoding, not hosted acceptance.

Retirement review confirmed the original npm source hash,525lines and27declarations.
The old implementation had no executable conditional correction adapter; refusal
preserves that guarantee. The reviewer reports no actionable safety issue remaining
in these bounded corrections. It confirmed variance arithmetic and identified only
modest local cleanup opportunities; no justified1000-line simplification exists in
this wave. The failed cumulative tripwire and full ceiling remain visible. Native
hosted publishing/OIDC, Bun Sigstore, full-cohort/CLI/Action and69launch outcomes
remain open.
