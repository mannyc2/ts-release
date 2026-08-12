181 docs/release-program/decisions/208-discovery-recovery.md
# Plan 208 — discovery-first recovery decision

Input-Commit: ff60066
Result-Commit: e4fb236
Evidence-Commit: SELF
Status: DONE
Outcome: PASS WITH CAPABILITY CUT
Date: 2026-08-09

## Authority and scope

This report is the registered research instrument for Plan 208. It contains no
production API, public CLI, durable journal, credential use, or remote
mutation. The harness models destination state, exact prepared subjects,
provider observations, and independent response loss. It does not reuse the
obsolete ReadResult, NotDispatched, approval, or ledger transition algebra.

The retained publication subjects are GitHub releases and assets, npm package
versions, and provisional per-file PyPI publication. Generic HTTP POST,
opaque argv publication, and announcements are negative controls because this
repository owns no exact observer or provider duplicate-prevention contract
for them.

## Pre-registered fault and conflict matrix

Every row was registered before the research harness was implemented. PASS
means the harness demonstrated the stated target outcome; a failure would have
blocked the decision.

| Case | Subject | Coordinate | Registered cut point | Expected target outcome | Result |
| --- | --- | --- | --- | --- | --- |
| GH-R-C1 | GitHub release | tag=v1.0.0 | before credential acquisition; no destination request | Inconclusive; no mutation | PASS |
| GH-R-C2 | GitHub release | tag=v1.0.0 | after observation begins before response; observation response is withheld | Inconclusive; no mutation | PASS |
| GH-R-C3 | GitHub release | tag=v1.0.0 | after NeedsMutation before dispatch; adapter has authorized one exact write | NeedsMutation remains local; no duplicate | PASS |
| GH-R-C4 | GitHub release | tag=v1.0.0 | after provider accepts bytes before response; destination commits then response is dropped | OutcomeUnknown; rerun observes exact subject | PASS |
| GH-R-C5 | GitHub release | tag=v1.0.0 | after uniqueness/conflict response; provider reports occupied coordinate | Conflict with structured difference | PASS |
| GH-R-C6 | GitHub release | tag=v1.0.0 | after mutation before post-mutation observation; write returned but follow-up has not started | rerun observes Equivalent or Inconclusive | PASS |
| GH-R-C7 | GitHub release | tag=v1.0.0 | during post-mutation observation; visibility is delayed or response is lost | Inconclusive; no mutation | PASS |
| GH-R-C8 | GitHub release | tag=v1.0.0 | after one subject before next; multi-subject batch loses local progress | prepared bytes rerun only missing subjects | PASS |
| GH-A-C1 | GitHub asset | release=v1.0.0/name=payload.zip | before credential acquisition; no destination request | Inconclusive; no mutation | PASS |
| GH-A-C2 | GitHub asset | release=v1.0.0/name=payload.zip | after observation begins before response; observation response is withheld | Inconclusive; no mutation | PASS |
| GH-A-C3 | GitHub asset | release=v1.0.0/name=payload.zip | after NeedsMutation before dispatch; adapter has authorized one exact write | NeedsMutation remains local; no duplicate | PASS |
| GH-A-C4 | GitHub asset | release=v1.0.0/name=payload.zip | after provider accepts bytes before response; destination commits then response is dropped | OutcomeUnknown; rerun observes exact subject | PASS |
| GH-A-C5 | GitHub asset | release=v1.0.0/name=payload.zip | after uniqueness/conflict response; provider reports occupied coordinate | Conflict with structured difference | PASS |
| GH-A-C6 | GitHub asset | release=v1.0.0/name=payload.zip | after mutation before post-mutation observation; write returned but follow-up has not started | rerun observes Equivalent or Inconclusive | PASS |
| GH-A-C7 | GitHub asset | release=v1.0.0/name=payload.zip | during post-mutation observation; visibility is delayed or response is lost | Inconclusive; no mutation | PASS |
| GH-A-C8 | GitHub asset | release=v1.0.0/name=payload.zip | after one subject before next; multi-subject batch loses local progress | prepared bytes rerun only missing subjects | PASS |
| NPM-C1 | npm tarball | pkg@1.0.0/registry=https://registry.npmjs.org | before credential acquisition; no destination request | Inconclusive; no mutation | PASS |
| NPM-C2 | npm tarball | pkg@1.0.0/registry=https://registry.npmjs.org | after observation begins before response; observation response is withheld | Inconclusive; no mutation | PASS |
| NPM-C3 | npm tarball | pkg@1.0.0/registry=https://registry.npmjs.org | after NeedsMutation before dispatch; adapter has authorized one exact write | NeedsMutation remains local; no duplicate | PASS |
| NPM-C4 | npm tarball | pkg@1.0.0/registry=https://registry.npmjs.org | after provider accepts bytes before response; destination commits then response is dropped | OutcomeUnknown; rerun observes exact subject | PASS |
| NPM-C5 | npm tarball | pkg@1.0.0/registry=https://registry.npmjs.org | after uniqueness/conflict response; provider reports occupied coordinate | Conflict with structured difference | PASS |
| NPM-C6 | npm tarball | pkg@1.0.0/registry=https://registry.npmjs.org | after mutation before post-mutation observation; write returned but follow-up has not started | rerun observes Equivalent or Inconclusive | PASS |
| NPM-C7 | npm tarball | pkg@1.0.0/registry=https://registry.npmjs.org | during post-mutation observation; visibility is delayed or response is lost | Inconclusive; no mutation | PASS |
| NPM-C8 | npm tarball | pkg@1.0.0/registry=https://registry.npmjs.org | after one subject before next; multi-subject batch loses local progress | prepared bytes rerun only missing subjects | PASS |
| PY-S-C1 | PyPI sdist | project==1.0.0/file=project-1.0.0.tar.gz | before credential acquisition; no destination request | Inconclusive; no mutation | PASS |
| PY-S-C2 | PyPI sdist | project==1.0.0/file=project-1.0.0.tar.gz | after observation begins before response; observation response is withheld | Inconclusive; no mutation | PASS |
| PY-S-C3 | PyPI sdist | project==1.0.0/file=project-1.0.0.tar.gz | after NeedsMutation before dispatch; adapter has authorized one exact write | NeedsMutation remains local; no duplicate | PASS |
| PY-S-C4 | PyPI sdist | project==1.0.0/file=project-1.0.0.tar.gz | after provider accepts bytes before response; destination commits then response is dropped | OutcomeUnknown; rerun observes exact subject | PASS |
| PY-S-C5 | PyPI sdist | project==1.0.0/file=project-1.0.0.tar.gz | after uniqueness/conflict response; provider reports occupied coordinate | Conflict with structured difference | PASS |
| PY-S-C6 | PyPI sdist | project==1.0.0/file=project-1.0.0.tar.gz | after mutation before post-mutation observation; write returned but follow-up has not started | rerun observes Equivalent or Inconclusive | PASS |
| PY-S-C7 | PyPI sdist | project==1.0.0/file=project-1.0.0.tar.gz | during post-mutation observation; visibility is delayed or response is lost | Inconclusive; no mutation | PASS |
| PY-S-C8 | PyPI sdist | project==1.0.0/file=project-1.0.0.tar.gz | after one subject before next; multi-subject batch loses local progress | prepared bytes rerun only missing subjects | PASS |
| PY-W-C1 | PyPI wheel | project==1.0.0/file=project-1.0.0-py3-none-any.whl | before credential acquisition; no destination request | Inconclusive; no mutation | PASS |
| PY-W-C2 | PyPI wheel | project==1.0.0/file=project-1.0.0-py3-none-any.whl | after observation begins before response; observation response is withheld | Inconclusive; no mutation | PASS |
| PY-W-C3 | PyPI wheel | project==1.0.0/file=project-1.0.0-py3-none-any.whl | after NeedsMutation before dispatch; adapter has authorized one exact write | NeedsMutation remains local; no duplicate | PASS |
| PY-W-C4 | PyPI wheel | project==1.0.0/file=project-1.0.0-py3-none-any.whl | after provider accepts bytes before response; destination commits then response is dropped | OutcomeUnknown; rerun observes exact subject | PASS |
| PY-W-C5 | PyPI wheel | project==1.0.0/file=project-1.0.0-py3-none-any.whl | after uniqueness/conflict response; provider reports occupied coordinate | Conflict with structured difference | PASS |
| PY-W-C6 | PyPI wheel | project==1.0.0/file=project-1.0.0-py3-none-any.whl | after mutation before post-mutation observation; write returned but follow-up has not started | rerun observes Equivalent or Inconclusive | PASS |
| PY-W-C7 | PyPI wheel | project==1.0.0/file=project-1.0.0-py3-none-any.whl | during post-mutation observation; visibility is delayed or response is lost | Inconclusive; no mutation | PASS |
| PY-W-C8 | PyPI wheel | project==1.0.0/file=project-1.0.0-py3-none-any.whl | after one subject before next; multi-subject batch loses local progress | prepared bytes rerun only missing subjects | PASS |

## Cross-cutting response cases

| Case | Registered target outcome | Result |
| --- | --- | --- |
| R-401 | 401/403 is Inconclusive; credentials are not guessed and no mutation occurs. | PASS |
| R-404 | Adapter-identified genuine absence is NeedsMutation only at the exact coordinate. | PASS |
| R-409 | 409/422 is Conflict when structured provider facts identify an occupied non-equivalent coordinate; otherwise Inconclusive. | PASS |
| R-429 | 429 is Inconclusive; retry requires a later exact observation, never status-to-mutation conversion. | PASS |
| R-5XX | 500/503 is Inconclusive and causes no mutation. | PASS |
| R-MALFORMED | Malformed JSON is Inconclusive and causes no mutation. | PASS |
| R-TRANSPORT | Transport loss is Inconclusive unless a later exact observation proves Equivalent. | PASS |
| R-IDENTICAL | Concurrent identical actor converges on one exact subject and one successful creation. | PASS |
| R-CONFLICTING | Concurrent differing actor stops with Conflict and structured differences. | PASS |
| R-LAG | Eventual-visibility lag never authorizes a second write; later observation settles Equivalent or remains Inconclusive. | PASS |
| R-SPAWN | npm/PyPI spawn failure before a child exists is a local pre-dispatch failure. | PASS |
| R-CHILD | npm/PyPI child exists and exits nonzero is Rejected, not NotDispatched. | PASS |
| R-COMMIT-LOSS | npm/PyPI child commits remotely then stdout/exit observation fails; rerun observes exact file or remains Inconclusive. | PASS |

## Target observation vocabulary

The harness returns only these four adapter observations:

- Equivalent — exact intended subject is present.
- NeedsMutation — the adapter has evidence and preconditions authorizing one
  exact write.
- Conflict — the coordinate is occupied by non-equivalent content.
- Inconclusive — no safe conclusion; mutation is forbidden.

Mutation results are Applied, Rejected, or OutcomeUnknown. A provider response
is never reduced to mutation permission by the generic coordinator.

## Provider evidence

### GitHub

The [REST releases documentation](https://docs.github.com/en/rest/releases/releases)
defines lookup by repository and tag and documents 200 success versus genuine
404 absence. Its release representation supplies tag_name, name, body, draft,
prerelease, and assets. The [release assets documentation](https://docs.github.com/en/rest/releases/assets)
supplies asset name, content_type, size, digest, and download behavior. The
harness therefore compares the complete release metadata and asset bytes/digest;
401/403, rate limits, 5xx, malformed responses, and transport loss remain
Inconclusive.

### npm

The [npm publish documentation](https://docs.npmjs.com/cli/publish/) states
that package name plus version is a unique publication coordinate and that
publication carries an integrity field. The [registry documentation](https://docs.npmjs.com/misc/registry/)
defines version metadata lookup at a configured registry. The harness compares
package name, version, registry coordinate, and the prepared tarball's
integrity. Existing non-equivalent metadata is Conflict; unavailable or
malformed integrity is Inconclusive.

### PyPI (provisional)

The [PyPI JSON API documentation](https://docs.pypi.org/api/json/) exposes
release files keyed by version with filename and hash digests, while recommending
the [Index API](https://docs.pypi.org/api/index-api/) to access all files. The
harness treats each filename as a separate subject and requires project,
version, configured index, filename, size, and digest. A version-level probe
cannot prove a complete multi-file set. If the configured index omits a
per-file digest, the automatic PyPI adapter is cut from the initial release.

## Harness result

The deterministic harness uses only exact prepared bytes, a stable destination
coordinate, destination state, and injected failure points. It proves:

- exact equality is Equivalent;
- genuine exact absence is NeedsMutation;
- occupied non-equivalent coordinates are Conflict;
- every ambiguous response or incomplete observation is Inconclusive;
- response loss after commit does not create a second subject;
- partial multi-subject publication reruns only missing subjects from prepared
  bytes;
- command process-start, child-exists, and commit-then-response-loss states are
  distinct;
- generic POST, opaque argv, and announcement controls cannot enter the
  mutation algorithm.

## Decision

### PASS WITH CAPABILITY CUT

GitHub release/assets and npm package versions converge under exact observation
and provider uniqueness, so no mutation journal is introduced for the initial
automatic set. PreparedRelease remains mandatory as the cross-process boundary.

PyPI remains provisional in the schema but is removed from the initial
automatic recovery/publish set unless the configured index exposes exact
per-file digests for every file. A version-level API response is not enough,
and no operator checkbox substitutes for the missing observer.

Plans 212–222 may proceed. Plan 214 must implement the four-way observation
contract afresh in production, retain provider-specific refusal behavior, and
keep PyPI out of the automatic initial set unless its configured index satisfies
the per-file evidence bar. Plan 214 must delete this research harness after
permanent adapter conformance tests cover the scenarios.

## Verification

- `bun test test/research/discovery-recovery-spike.test.ts` — PASS.
- `bun test test/research/discovery-recovery-spike.test.ts -t "equality|conflict|inconclusive"` — PASS.
- `bun test test/research/discovery-recovery-spike.test.ts -t "kill point"` — PASS.
- Marker scan for unresolved rows and placeholders — no matches after finalization.
- No production or public file changed; no credentials or external mutation were used.
