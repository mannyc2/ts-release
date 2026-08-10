# Plan 220 — Product documentation and executable capability truth

Input-Commit: cde2449
Result-Commit: 142cfd0
Evidence-Commit: SELF
Status: DONE
Outcome: AUTOMATION-FIRST-DOCS / REGISTRY-JOINED-CAPABILITIES
Date: 2026-08-09

## Boundary

Product documentation now leads with the automatic `init`/`release` path. The
optional `prepare`/`inspect`/`publish` handoff is described as a durable byte
boundary with host-owned gating, not as engine review state. Recovery is
described as exact destination observation plus provider-specific forward
correction; partial success, conflicts, inconclusive observation, deletion,
and rollback limits are explicit.

The architecture and specification name authored intent, verified context,
ephemeral graph, prepared release bytes, and destination observation as the
canonical forms. Native preparation documents `CommandCheck`,
`CommandArtifact`, `builder: "command"`, declared artifact references, and
the trusted argv/closed-environment boundary. No generic lifecycle hook or
custom-publisher escape hatch remains in product examples.

Platform wording follows Plan 211 exactly: ts-release runs on Linux and macOS;
its Bun builder can produce Windows artifacts. The comparison is between
release automation products, records GoReleaser v2.17.1 and the three official
primary sources accessed on 2026-08-09, labels external analysis, and quotes no
unrefreshed binary-size fixture.

## Executable capability truth

`src/capabilities/registry.ts` is the runtime-owned registry. Each of its 11
entries binds an exported entrypoint, strict decoder, exact observation
semantics, vertical test, and host/target constraints. `scripts/lib/capabilities.ts`
joins it one-to-one with `docs/capability-evidence.json`; the generator rejects
duplicate, missing, extra, unreachable, unsupported, or unsafe evidence. The
generated `docs/capabilities.md` is therefore a projection of executable
composition plus dated empirical evidence, not schema-field prose.

The old `section:` docs-claim infrastructure, its test, and its gate were
deleted. `check:capabilities` is a child of `check:core`, so `check:portable`
and the Plan 219 CI workflow inherit it. README JSON configuration snippets
are AuthoredConfig-decoded; shell commands are checked against the six public
CLI commands; Action examples and templates accept only the literal
`__TS_RELEASE_ACTION_REF__` placeholder before candidate certification.

The preparation guide's public-config example is exercised by
`test/preparation-doc.test.ts` through `makeReleaseApi`: it proves the check,
generated text artifact, input/output transform, and GitHub body-artifact
dependency compile into the live inspection graph. Catalog and PyPI fixtures
were corrected to local prepared catalog/imported-file semantics rather than
advertising unsupported remote publishers.

## Verification

- `bun run check:capabilities` — PASS: 11 executable entries joined to 11
  dated evidence records.
- Capability sabotage tests — PASS: unreachable entrypoint and missing/extra
  evidence IDs fail the gate.
- `bun test` — PASS: 98 tests, 336 expectations, 32 files.
- `bun run check:core` — PASS: versions, capability truth, import/tree-shaking
  policy, TypeScript, tests, build, CLI bundle, schema, examples, README, and
  package exports.
- `bun run check:portable` — PASS: the inherited core gate plus agent, app, and
  Action surfaces all passed.
- `bun run check:readme` — PASS: 6 fenced blocks, 2 package imports, 1
  typechecked package block.
- `bun run check:examples` — PASS: 8 examples, 6 templates, 2 workflows.
- `bun run check:config-schema` — PASS.
- `bun run check:versions` — PASS: 9 sites checked.
- `git diff --check` — PASS before the implementation commit.

Required scans are empty outside the tracked release-program evidence corpus:
obsolete review/plan vocabulary, standalone Action mirror references,
GoReleaser-for-TypeScript positioning, schema `section:` claims, and the old
`hooks.*`/`publish.custom` vocabulary.

## Usability measurements

- README length: 128 lines.
- Automatic path: 2 commands (`init`, `release`).
- Optional handoff: 3 commands (`prepare`, `inspect`, `publish`).
- Public library example: one typed `release` call plus disposal.
- Action examples: one literal candidate placeholder spelling.
- Removed product concepts: reviewer identity, run/ledger/receipt protocol,
  standalone Action mirror, lifecycle hooks, custom publisher, native Windows
  execution claim, and live PyPI/Homebrew/Scoop publisher claims.

## Evidence classes

- `source-derived`: registry bindings, host outcome, generated docs, and
  product prose projections.
- `external-docs-derived`: official GoReleaser source analysis only.
- `contract-tested`: capability, preparation, README, examples, schema, and
  full portable gates.
- `live-read-verified`: none; no public destination was queried.
- `live-write-dogfooded`: none; Plan 222 owns the first authorized mutation.

## Handoff

Plan 221 may certify the clean candidate and replace the Action placeholder in
the exact candidate package only. Plan 222 may use that certified immutable
reference solely after its explicit operator packet supplies the exact
candidate, evidence commit, bundle digest, public coordinates, command, and
credentials. No product documentation or generated package from this plan
contains a concrete Action tag.
