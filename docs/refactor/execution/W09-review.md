# W09 implementation review

This is an implementer material review, not an independent candidate review.
No separate reviewer was commissioned for this wave, so it does not satisfy the
independent final review required by Plan010.

The MCP review checked the admitted schema against the selected official
2025-12-11 contract and traced each write fact back to the immutable intent.
Request ownership now recomputes the canonical body SHA-256 in addition to
checking endpoint, method, headers, principal, byte length and body bytes; a
tampered recorded digest is rejected. Package versions cannot use ranges or
mutable `latest` coordinates. OCI references require an exact tag or digest;
MCPB references require an exact public release URL and SHA-256. Token and OIDC
credentials are admitted only for the exact publish or observation endpoint and
scope. Response loss leaves the write unknown, while version read-back can only
classify exact, conflicting, pending or inconclusive facts; it cannot authorize
a blind resend.

The OpenAI review followed bytes from owned Content through the finalized Tree,
marketplace update and handoff document. Case-folded path collisions, traversal,
links, unsupported modes, missing directories, extra plugin files, substituted
content identities and token-shaped text reject. The marketplace update keeps
unrelated entries and uses the shared conditional-Git operation for exact bytes.
The handoff requires the plugin Tree and logo to be exact members of one owned
Bundle and validates exactly five positive and three negative cases. Its only
success value is `validated-handoff-human-submission-required`; no portal client,
approval or publication state is present.

Projection review moved both proposal authorities to compiler-read production
declarations. The full emission inventory now contains89 source/declaration
owners; public-surface and import checks include both packages. MCP's sole added
runtime edge, `node:crypto`, is explicit in the design. Fresh packed consumers
freeze97 source/package bindings and load the seven package graph with no source
edits.

Retirement review re-parsed the three deleted TypeScript files and matched all49
recorded declaration hashes and348 physical lines. The old agent contract test
was deleted because it only exercised the retired mutable installer; the new
production tests exercise the selected package and protocol boundaries. Agent
application metadata and its stale skill are explicitly deferred to W10 rather
than mislabeled as completed OpenAI behavior.

Source review confirms14,874 product lines:12,783 replacement and2,091 remaining
legacy. The W09 replacement tripwire is exceeded by1,783 and the projected full
product still exceeds its unchanged ceiling by1,740. No denominator, selected
outcome, fixture, generated-data or metadata lane was changed to manufacture a
pass. This review supports local W09 closure only; hosted/native acceptance,
Action/self-release convergence, final source reduction and independent complete
candidate review remain open.
