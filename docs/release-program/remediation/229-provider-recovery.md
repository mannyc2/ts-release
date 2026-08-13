# Plan 229 — Provider recovery and forward correction

Status: IMPLEMENTED / CONTRACT-TESTED / ZERO-LIVE-MUTATION

Date: 2026-08-12

This document is generated from `installedPublicationProfiles`, the same
registered values consumed by the publication adapter and recovery coordinator.
Edit the registry, not this table, then run `bun run generate:recovery-docs`.
Only installed npm and GitHub publication modules appear here. PyPI and catalog
profiles remain owned by Plans 230 and 231 and are not presented as installed.

## Independent recovery axes

No column implies another: in particular, identifier reuse, replay, exposure,
correction, and history are independent facts.

| Module | Prepared variant | Observation | Authoritative absence | Create authorization | Replay | Identifier reuse | Exposure | History | Installed correction adapters |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `publish.npm` | `PreparedNpmPublication` | conditional | provider-specific | authenticated-namespace-and-unique-coordinate | coordinate-unique | consumed-after-delete | persistent-to-consumers | optional-evidence | none |
| `publish.github` | `PreparedGitHubPublication` | exact | provider-specific | authenticated-namespace-and-unique-coordinate | coordinate-unique | reusable | persistent-to-consumers | optional-evidence | none |

## Read-convergence policy

The numeric timing policies remain **ASSUMED/UNVERIFIED**. No authorized live
mutation established provider visibility timing. They may bound confirming
reads after one same-invocation mutation, but they never authorize retrying a
mutation, provider decision, conclusive fact, or pre-mutation observation.
Pre-mutation `Inconclusive` fails closed. `AuthoritativelyAbsent` and
conclusive `PresentDifferent` stop immediately. Exhaustion preserves the
full ordered trace in `UncertainSubject`.

| Module | Contract label and basis | Observation retry | Fixed eligible result | Fixed exhaustion |
| --- | --- | --- | --- | --- |
| `publish.npm` | ASSUMED/UNVERIFIED: no authorized live mutation evidence establishes npm read-convergence timing. | 6 attempts; 2000 ms base × 2; 30000 ms cap; 120000 ms budget | `VisibilityPending | Inconclusive` | `UncertainSubject with full trace` |
| `publish.github` | ASSUMED/UNVERIFIED: no authorized live mutation evidence establishes GitHub read-convergence timing. | 5 attempts; 1000 ms base × 2; 15000 ms cap; 60000 ms budget | `VisibilityPending | Inconclusive` | `UncertainSubject with full trace` |

For GitHub set equality, observation recursively peels annotated tags, reads
the exact release coordinate, and exhausts the paginated release-asset list.
A malformed or failed later page is `Inconclusive`; search indexes are not
observation evidence.

## Provider evidence and correction decision

### npm

Evidence was reviewed 2026-08-12. Observation sources:
[1](https://github.com/npm/registry/blob/main/docs/responses/package-metadata.md), [2](https://docs.npmjs.com/cli/v11/commands/npm-publish/). Correction sources:
[1](https://docs.npmjs.com/cli/v11/commands/npm-deprecate/), [2](https://docs.npmjs.com/policies/unpublish/).

Correction conclusion: Official npm documentation exposes deprecation but no conditional update bound to an observed package generation. Therefore the
installed correction-adapter list and the profile's correction axis are both
empty. The public authored request remains useful only as a canonical,
exactly-bound operator proposal; ts-release sends no corrective mutation.

### github

Evidence was reviewed 2026-08-12. Observation sources:
[1](https://docs.github.com/en/rest/git/refs?apiVersion=2022-11-28), [2](https://docs.github.com/en/rest/git/tags?apiVersion=2022-11-28), [3](https://docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28), [4](https://docs.github.com/en/rest/releases/assets?apiVersion=2022-11-28). Correction sources:
[1](https://docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28#update-a-release), [2](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api?apiVersion=2022-11-28#use-conditional-requests).

Correction conclusion: GitHub documents conditional reads, but unsafe-method conditions are unsupported unless an endpoint says otherwise; the release update endpoint documents none. Therefore the
installed correction-adapter list and the profile's correction axis are both
empty. The public authored request remains useful only as a canonical,
exactly-bound operator proposal; ts-release sends no corrective mutation.

For npm, deprecation adds a consumer-visible warning and does not erase or free
the published package/version. npm's unpublish policy says a used
`package@version` cannot be reused even after unpublish, so the registered
identifier-reuse axis is `consumed-after-delete`; unpublish is outside this
plan. For GitHub, release metadata and assets may remain exposed to consumers;
release/tag/asset deletion is neither modeled nor admitted as correction.

Every authored correction is bound only after loading the exact prepared
bundle. Its canonical intent carries the whole prepared digest, the selected
publication id and destination, and an internally derived SHA-256 of that
exact prepared publication subject. npm additionally binds the prepared
tarball SHA-512 integrity. Authored input cannot supply or override destination
or baseline fields. Catalog and PyPI correction variants are unreachable.

Two actors cannot silently overwrite each other: absent an installed
conditional correction adapter, both receive independently canonical operator
proposals and neither sends a provider mutation. Ordinary publication cannot
apply those proposals, erase a correction, resurrect a consumed npm coordinate,
or interpret deletion as rollback.

## Verification boundary

The local contract suite exercises canonical profile equality, registration
mismatch rejection, bounded reread behavior, exact provider observations,
pagination failure, authored correction binding, baseline tampering, and two
concurrent unsupported correction actors. This plan performed no live npm or
GitHub provider-resource read or mutation and acquired no credentials.
