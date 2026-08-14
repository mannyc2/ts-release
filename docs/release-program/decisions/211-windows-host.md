# Plan 211 — Windows host foundation decision

Input-Commit: 516fd61
Result-Commit: 092373f
Evidence-Commit: SELF
Status: DONE
Outcome: TARGET-ONLY
Date: 2026-08-09

> **Superseded Action-runtime detail (2026-08-12):** The target-only Windows
> decision remains current. The Node 20 Action verification below is historical;
> the current Action is a native Node 24 launcher around workflow-installed,
> pinned Bun. Installed library and CLI macOS evidence remains a separate host
> row.

## Decision

### TARGET-ONLY

ts-release runs on Linux and macOS. Its Bun builder can produce Windows
artifacts. Native Windows execution is not supported by this release-engine
candidate.

The repository has no demonstrated native Windows secure-files foundation.
The current store and drivers rely on POSIX-specific link refusal, realpath
containment, rename, and directory-sync behavior. Cross-compilation and WSL
would prove artifact production, not native Windows execution, so neither is
used as host evidence. A native foundation is not invented late in the
program; a future native-host effort needs its own bounded plan and Windows CI
proof.

## Preregistered threat matrix

The native outcome would have required one behavior-level `SecureFiles`
contract covering every case below, with no caller exposure of POSIX or Windows
flags:

| Area | Required case | Evidence in this plan |
| --- | --- | --- |
| Containment | parent traversal and absolute paths | not proven on native Windows |
| Containment | drive-relative paths and UNC paths | not proven on native Windows |
| Containment | case variants and separator normalization | not proven on native Windows |
| Link safety | symlink, junction, and reparse-point escapes | not proven on native Windows |
| Link safety | final-component swap during create/read | not proven on native Windows |
| Writes | complete temporary write before publication | not proven on native Windows |
| Writes | atomic replacement and interruption recovery | not proven on native Windows |
| Durability | file and directory synchronization semantics | not proven on native Windows |
| Recovery | cleanup after interruption and process restart | not proven on native Windows |
| Naming | reserved names and case-folding collisions | not proven on native Windows |

The fixed native budget would have permitted one shared service, one
conformance suite, one required `windows-latest` job, and at most 300
nonblank/noncomment production TypeScript lines. No native prototype was
retained because the required Windows runner and behavior-level proof are not
available in this task environment; retaining a second unproved filesystem
abstraction would violate the decision contract.

## Applied target-only cut

Commit `5b1ced7` performs the product cut:

- the three entrypoints now call one shared `unsupportedExecutionHost` guard;
- the refusal message is centralized as “ts-release runs on Linux and macOS.
  Its Bun builder can produce Windows artifacts.”;
- `apps/release-ts/release.config.json` no longer self-releases a Windows
  ts-release executable;
- the install-smoke workflow no longer downloads that Windows self binary or
  runs native Windows PyPI/Scoop self-release jobs;
- generic `windows-x64` and `windows-arm64` Bun target triples remain in the
  authored schema, target fixtures, and generic builder tests.

Commit `092373f` makes the single executable capability registry report three
independent dimensions: `executionHosts`, `artifactTargets`, and
`nativeToolHosts`. Retained capabilities execute on Linux/macOS; the Bun
builder targets Windows artifacts; no native Windows tool host is claimed.

## Inventory result

- Native refusal existed in the Bun CLI, Node CLI, and Action; it is now one
  shared guard.
- The prior Windows self-release target was present in the self config; it is
  removed.
- The deleted nFPM/profile surface has no Windows-only package profile to
  preserve after Plan 209.
- Generic Windows artifact targets remain separate from execution hosts.
- No installer, signer, Windows-native tool, or Windows host capability is
  public or documented by this plan.

## Verification

- `bun run check:self-release-config` — PASS.
- `bun run check:self-release-artifacts` — PASS (8 outputs; no Windows
  self-release binary).
- `bun run check:config-schema` — PASS.
- `bun run check` — PASS.
- `bun test` — 185 passing, 0 failing, 941 expectations.
- centralized host guard tests — PASS.
- CLI bundle under Node — PASS.
- Action bundle under Node 20-compatible runtime — PASS.
- `rg` confirms no Windows target in the self-release config or removed local
  package-profile directory; generic target fixtures remain intentionally.
- `git diff --check` — PASS.
- No external mutation, workflow dispatch, publication, or tag operation
  occurred.

## Handoff

Plans 212–213 must use the existing secure-files semantics without adding a
second native Windows implementation. Plans 219 and 221 may strengthen the
application proof on supported hosts, but may not turn cross-compilation into
native-host evidence. Any future native Windows support must reopen this
decision with the complete matrix and a non-optional Windows CI job.
