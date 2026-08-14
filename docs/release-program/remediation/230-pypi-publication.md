# Plan 230 — Prebuilt PyPI publication

Input-Commit: 410c31675b92d4084f87a9059c090740f92b1dc2
Result-Commit: SELF
Evidence-Commit: SELF
Status: LOCAL IMPLEMENTATION COMPLETE / DELTA CERTIFICATION AND LIVE RELEASE GATED
Outcome: CONTRACT-TESTED EXACT-FILE TOKEN PATH / EXTERNAL TRUSTED PUBLISHING / ZERO LIVE MUTATION
Date: 2026-08-13

## Non-authority statement

This handoff records the post-kernel implementation. It is not a delta release
certificate and authorizes no PyPI or TestPyPI upload. Plan 230 requires the
successful Plan 234 kernel live certificate and published `0.2.0` coordinates
before delta certification or a separately authorized PyPI live plan can run.
Those prerequisites did not exist when this handoff was written. No public
provider credential was acquired, and no public file, publisher, project, or
correction was read or mutated.

## 2026-08-14 product-decision addendum

The `0.2.2` npm/GitHub release now satisfies the historical kernel-coordinate
prerequisite, and the product owner explicitly selected four embedded-binary
`ts-release` wheels. The repository implementation therefore reopens only its
own wrapper-wheel decision:

- manylinux 2.17 x64 and arm64;
- macOS 13 x64 and arm64;
- one executable, Python launcher, and exact compatibility tag per wheel;
- a dedicated `pypi-release.yml` whose isolated publisher job invokes only
  `pypa/gh-action-pypi-publish@release/v1` with OIDC.

This addendum does not authorize a live upload or publisher/configuration
mutation. The exact new candidate and prepared distribution evidence must be
certified after the implementation is committed. PyPI must then be configured
for the documented repository/workflow/branch/environment identity before a
separately authorized one-time dispatch. The cross-compiled macOS wheel tags
remain artifact-target evidence, not macOS execution-host certification.

## Implemented vertical slice

- Strict authored and resolved `publish.pypi` forms select only `pypi` or
  `testpypi`, one or more prepared artifact IDs, and either a project-scoped
  token reference or an explicitly external trusted-publisher description.
- Preparation accepts prebuilt `.whl` and `.tar.gz` sdists only. It parses ZIP
  or gzip/tar structure with size/path/link checks, validates wheel tags and
  `WHEEL`, validates sdist root and `PKG-INFO`, and requires filename,
  configured project/version, and embedded Core Metadata to agree. Wrapper
  wheel generation, native-wheel orchestration, custom indexes, and arbitrary
  child-process upload are absent.
- Every file is an independent prepared publication subject with exact
  filename, size, SHA-256, media type, parsed distribution identity, canonical
  Simple URL, and canonical upload audience. Duplicate filenames are rejected
  before a prepared bundle can be committed.
- Observation negotiates JSON Simple API v1, requires API 1.1 or newer fields,
  and compares the exact filename, size, SHA-256, and unyanked state. Malformed
  content, HTML fallback, missing equality fields, unsupported versions,
  redirects, authorization failures, throttling, server errors, and project
  404 are inconclusive. Only a standards-shaped visible project page omitting
  the exact filename proves the initial file-absence precondition.
- Token mutation uses one typed multipart POST per file. The host projects the
  environment value as `Basic(__token__:<token>)` only inside the authorized
  PyPI HTTP sink; the token is absent from config, prepared bytes, request
  objects received by the adapter, reports, and test output. Redirects are not
  followed and post-dispatch transport loss is classified as outcome unknown.
- Trusted publishing is owned by the official
  `pypa/gh-action-pypi-publish@release/v1` integration. The durable form names
  its repository, workflow/ref, environment, and complete project authority
  set. The stock coordinator refuses it before dispatch and does not claim to
  implement or recover PyPI's implementation-specific manual OIDC exchange.
- Yanking is observed but has no mutation adapter. A yanked exact filename is
  a conflict. Filename reuse remains `consumed-after-delete`.

## Terminal history boundary

PyPI is registered with `historyRequirement: "durable-cas-required"` and
unsafe replay. Coordinator construction rejects such a subject without a
terminal claim function. For a missing exact file, the subject atomically
claims `(subject, prepared-manifest-digest)` before mutation credential
acquisition. An unavailable or occupied claim blocks without upload.

`PublicationClaimStore` is a public host seam, available through the Node,
Bun, and custom layer constructors. Its contract requires an atomic terminal
claim shared by every runner that could dispatch the subject; leases,
runner-local files, workspaces, caches, and process memory do not qualify.
The stock CLI and Action intentionally install no weaker substitute, so their
PyPI token mutation path fails closed. Contract tests use a shared in-memory
double across fresh subject graphs to prove the transition, not production
durability. A real integrator must supply the shared store.

## Source decisions

Primary specifications were re-read on 2026-08-13:

- Python Packaging User Guide, Simple Repository API: JSON media type,
  `meta.api-version`, filename, hashes, yanked state, and API 1.1 file size;
- Python Packaging User Guide, File Yanking: yanked files remain represented
  and the value is boolean or reason string;
- PyPI Upload API: legacy endpoint, multipart upload, one file per request;
- PyPI Trusted Publishers: the official PyPA Action is the supported workflow
  integration, while manual exchange is implementation-specific and carries
  no compatibility guarantee.

Evidence class: `external-docs-derived` for those protocol decisions and
`source-derived` / `contract-tested` for this implementation. No timing value
or provider behavior is labeled live verified.

## Local verification

The local suite covers valid wheel/sdist preparation, malformed paths and
metadata disagreement, exact Simple equality/conflict/absence, yanked state,
the HTTP/content/version failure matrix, separate PyPI/TestPyPI origins,
secret-free token projection, deterministic multipart upload, two-file
partial convergence, response loss, fresh-graph terminal-claim replay
refusal, external trusted-publisher refusal, strict public config through the
root API and host credential boundary, generated schema/capability/recovery
surfaces, and the full existing regression suite.

The following gates passed in the implementation worktree:

- `bun run check`
- `bun test test/core/pypi-preparation.test.ts`
- `bun test test/protocol/pypi/pypi-provider-protocol.test.ts`
- `bun test test/api.test.ts test/publication/release-coordinator.test.ts`
- `bun run check:config-schema`
- `bun run check:capabilities`
- `bun run check:recovery-docs`

The final all-plans aggregate and exact result commit are recorded only after
the remaining post-kernel plans are closed. Local protocol doubles are not
live PyPI evidence.

After Plans 231–232 were integrated, the complete current-worktree
`check:portable` aggregate also passed with the admitted Node 24.15.0 and npm
11.17.0 runtimes: 372 tests / 2,186 expectations / zero skips or failures,
generated schema/capability/recovery evidence, built library/CLI/Action,
external package consumers, provider-native agent archives, and app/Action
cutover suites. The packed package contained 463 files; its Bun and npm
consumers retained exact Effect beta.83 alignment and `[1, 2]` artifact-array
shapes. This remains `contract-tested` current-worktree evidence, not a clean
delta certificate or live PyPI evidence.

## Remaining gated work

The Plan 230 implementation handoff is complete. Its delta certification and
live-release steps remain gated, not waived: first complete Plan 234 for the
kernel and publish its exact `0.2.0` coordinates, then create a separately
authorized delta packet naming the exact PyPI/TestPyPI project, version,
filenames, candidate commit, prepared digest, shared claim-store owner, and
credential references. Any live upload, first-project creation, trusted-
publisher configuration change, or yanking action requires that new authority.
