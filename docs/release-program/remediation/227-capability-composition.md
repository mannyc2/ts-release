# Plan 227 — Capability composition and executable field truth

Input-Commit: 97bb04b20caff948dc0686fe8e149a408c15eae0
Result-Commit: SELF
Evidence-Commit: SELF
Status: COMPLETE — DETERMINISTIC CAPABILITY AND FIELD CONTRACT CLOSED
Outcome: STRICT-AUTHORED-SURFACE / EXECUTABLE-OWNERSHIP / FOUR-TARGET-HARD-CUT
Date: 2026-08-12

Commit convention: `SELF` means this completed implementation and its
deterministic handoff are intentionally co-committed in candidate result X. It
does not name Plan 233 certificate Y or supply live-provider evidence.

## Decision

Accepted configuration is installed only when one executable capability owns
its exact strict-schema paths and contributes their resolved or graph effect.
The generated capability page joins those modules to dated evidence and keeps
execution-host, artifact-target, native-tool, and credential claims separate.

The hard cut removes accepted fields whose values had no distinct effect:
authored source commit, npm package-name duplication, and publication mode.
`npmPackage.build` is the one added package-build primitive: it carries an exact
argv and nonempty package-relative output roots into `GraphNpmPackageBuild`,
runs in private exact-Git staging, rejects undeclared mutations and linked,
missing, overlapping, or escaping roots, and feeds those bytes to exact offline
`npm pack`. The release-graph digest, npm version/executable digest, and network
isolation identity enter the durable preparation basis.

Linux is the only installed execution host. The advertised Bun artifact targets
are exactly Linux x64/arm64 and macOS x64/arm64. Windows targets decode as
unsupported and are not shipped. Linux preparation requires external Bun and
`libseccomp.so.2`, including when the standalone CLI is used.

## Deterministic closure

- `bun run check:config-schema` — PASS; generated schema equals `AuthoredConfig`.
- `bun run check:capabilities` — PASS; 5 executable modules and 4 exact Bun
  artifact targets.
- `bun run check:feature-translation` — PASS; 260 historical paths remain
  assigned to 44 exact families, while all 87 currently accepted fields join
  exactly once to 86 executable witnesses: 14 paired/discriminant invariants
  carry an explicit invalid-combination refusal, 82 witnesses change resolved
  intent, 61 change or refuse graph semantics, and 57 change the release-graph
  digest that enters prepared input basis. `$schema` changes authored bytes only;
  the three single-valued trusted-attestation literals are strict rejection
  witnesses rather than fictional alternative accepted values.
- `bun run check:examples` — PASS; 10/10 retained examples/templates strictly
  resolved, compiled, prepared, and inspected; 7 GitHub and 9 npm subjects in
  both graph and durable forms; 12 portable target artifacts; 4 unsupported
  migration refusals.
- Focused field/target/graph/preparation/isolation run — PASS; 42 tests, 138 expectations,
  including build-before-pack, cleanup and mutation refusal, exact provenance
  differences, TCP/UDP/DNS/HTTP denial, unavailable-filter refusal, and
  non-stdio descriptor closure.
- `bun run check:readme` — PASS; 10 fenced blocks, 2 package imports, and 1
  typechecked block.
- `bun run check` — PASS after the Plan 227 implementation; the final
  integrated candidate repeats this gate after Plan 225's authority-schema
  addition and related fixture updates.

No provider was contacted and no public mutation was authorized. Cross-compiled
Mach-O headers are artifact-target evidence, not a macOS execution-host claim.
Clean-candidate repeat and live publication remain downstream Plans 233k/234k.

## Successor handoff

Plan 228k may rely on the exact graph-owned package build and field ownership
contract. Plan 233k must repeat generated, four-target build/header, package,
and self-release gates from clean candidate X; it must not restore removed
fields or advertise Windows/macOS execution hosts. Plan 234k remains the only
phase allowed to seek public mutation authority.
