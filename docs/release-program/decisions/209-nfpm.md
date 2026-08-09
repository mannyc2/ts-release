# Plan 209 — nFPM and local-profile decision

Input-Commit: 4f7eb70
Result-Commit: 4f7eb70
Evidence-Commit: SELF
Status: DONE
Outcome: RETIRE-PROFILES
Date: 2026-08-09

## Decision

### RETIRE-PROFILES

Plan 207 already removed the detached local package-profile product and test
surface. The bounded real-tool experiment below confirms that no nFPM recipe
should be admitted as a capability or provisional public contract in this
program. Plans 212 and 213 proceed with the native contribution and command
contracts, without an nFPM-specific branch or registry entry.

## Experiment record

- Tool: nFPM v2.47.0, official Linux x86_64 archive
  [`nfpm_2.47.0_Linux_x86_64.tar.gz`](https://github.com/goreleaser/nfpm/releases/download/v2.47.0/nfpm_2.47.0_Linux_x86_64.tar.gz).
- Acquisition source: [official nFPM v2.47.0 release](https://github.com/goreleaser/nfpm/releases/tag/v2.47.0).
- Published checksum source: [`checksums.txt`](https://github.com/goreleaser/nfpm/releases/download/v2.47.0/checksums.txt).
- Verified SHA-256: `0660ca602b2d2d2ae4781a06c692b3eeb9d437ffea05b831d76e41f4a3188783`.
- Host: `linux/x64`; reported Go tool version `go1.26.4`.
- Version probe: `nfpm --version` reported `GitVersion: 2.47.0`.
- Expected argv: `nfpm package --config nfpm.yaml --packager deb --target output/ts-release-nfpm-spike.deb`.
- Working directory: fresh isolated staging directory for each run.
- Environment: closed to `PATH=/usr/bin:/bin`; no shell evaluation or secrets.
- Input: one executable fixture and one typed `deb` configuration.
- Output contract: exactly one nonempty regular `.deb` file under the staging
  output directory, then size and SHA-256 capture.

The real binary successfully produced a valid nonempty package with the
expected argv and isolated staging. Independent fresh runs did not produce
stable bytes: one run produced 690 bytes with SHA-256
`93fa40655749a4df2be17266877a0c3bc20d819ad4a1ad299c270313d173b76d`; a later
fresh run produced 690 bytes with SHA-256
`ddd7dae70eb08c7f59ab46045c654721368cf2ae563cb57546a5a73f5cecafbe`.
Immediate repeated runs also produced a distinct 692-byte output. The
variation is enough to fail the admission bar for exact reusable release
bytes; it is not repaired by a generic command runner.

## Fixed admission bar

ADMIT-NFPM required one generic argv/process/output boundary plus one typed
recipe to prove version preflight, total placeholder rendering, isolated
staging, exact output existence, package-format validation, and SHA-256 capture
in one real-tool run, within 220 research TypeScript lines, with no legacy
profile registry or arbitrary options surface. The real run proved execution,
but failed reproducibility of the produced package bytes. Therefore the
admission outcome is RETIRE-PROFILES.

No tracked spike fixture remains. No production source, public config,
capability entry, executor, remote repository, or package publication was
added. No root installation, credentials, or remote mutation was used.

## Residual-surface check

- Plan 207 removed `src/recipes/packages/**` profile declarations and the
  detached package-tool test.
- There is no `LocalToolProfile`, `preflightTool`, or `nfpms` product match in
  live `src`, `test`, or `apps` surfaces.
- Generic operation `profileId` fields used by existing operation contracts
  are unrelated to local package profiles and remain owned by their operation
  model; they do not reintroduce a package-profile registry.
- Plan 207 translation case C035 remains explicitly planned/deferred, not
  silently supported.

## Verification

- The pinned binary checksum verification — PASS.
- Two independent fresh real-tool runs — PASS for execution and output
  validation; FAIL for deterministic byte identity, which is the recorded
  retirement criterion.
- Temporary spike fixture removed before the report-only evidence commit.
- `git diff -- src` — empty for Plan 209.
- No real package repository or remote release was mutated.
- `bun test` and the portable gate remain the verified Plan 207 green baseline;
  Plan 209 changes no production or public file.

## Handoff to Plan 212

Plan 212 may proceed without an external-tool profile capability. It must keep
generic process/output contribution contracts separate from tool-specific
preflight and validation, and it must not resurrect the fifteen-profile union,
arbitrary options records, shell execution, or a provisional nFPM registry
entry. A future nFPM admission requires a new bounded real-tool experiment and
its own vertical proof.
