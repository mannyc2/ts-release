# Plan 218 — Single agent-distribution application owner

Input-Commit: 5eac3da
Result-Commit: 62f0548
Evidence-Commit: SELF
Status: DONE
Outcome: SINGLE-APP-OWNER / DETERMINISTIC-PROVIDER-ARTIFACTS
Date: 2026-08-09

## Boundary

`apps/ts-release-agents/` is the only tracked agent-distribution source owner.
It contains the provider-neutral release skill and references, authored Codex
and Claude manifest fragments, eval cases, a deterministic generator, and
contract checks. The generator writes only `.release/agents/` and produces
provider-native package layouts plus fixed-byte ZIP archives. No root
marketplace, plugin mirror, example plugin, or provider-specific source copy
remains tracked.

The self-release configuration declares the generator as one ordinary
`CandidateArtifactPreparation` and declares each generated regular file and
archive as a prepared output. GitHub asset selection is explicit for the agent
archives and checksum digest. The public preparation path observes the
original clean workspace while running staged preparations, so the generator
does not require a hidden source-tree prerequisite.

## Verification

- `bun run --cwd apps/ts-release-agents check` — PASS.
- `bun run check:agents` — PASS: generator, generated safety checks, and 2
  contract tests / 6 expectations.
- Generated archives were built twice and compared byte-for-byte — PASS.
- Generated Codex and Claude manifests match root version `0.2.0` — PASS.
- `claude plugin validate` 2.1.219 on the generated Claude package — PASS.
- `bun run check:config-schema` — PASS: generated schema matches AuthoredConfig.
- `bun run check:examples` — PASS: 8 examples, 6 templates, 1 workflow.
- `bun run check` — PASS.
- `git diff --check` — PASS before the implementation commit.

Required stale-owner searches are empty outside the tracked release-program
evidence corpus and the app's intentional obsolete-owner safety check. The
environment-provided empty `.agents` mount is not tracked and contains no
agent source.

## Evidence classes

- `source-derived`: one app owner, contained generated paths, and declared
  preparation/output wiring.
- `contract-tested`: deterministic archives, manifest/version checks,
  generated safety checks, Claude validation, schema, examples, and TypeScript
  gates.
- `live-read-verified`: none; no marketplace, registry, GitHub, or workflow
  mutation was attempted.
- `live-write-dogfooded`: none.

## Physical delta

Commit `62f0548` deletes the tracked root marketplace files, old plugin tree,
example plugin, public plugin fixtures, validation helper, and associated
distribution paths. It adds one app owner and a deterministic provider
projection. The stale self-release artifact assertion now checks the declared
agent preparation and outputs rather than a source-tree plugin copy.

## Handoff

Plan 219 may consume the generated agent check through `check:portable` and
integrate the app's ordinary preparation into the two-workflow model. It must
keep generated provider layouts under `.release/agents/`, preserve the
candidate-bound archive outputs, and must not restore a second source owner.
