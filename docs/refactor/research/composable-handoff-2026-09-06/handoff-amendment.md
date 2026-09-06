# Proposed handoff amendment

The amendment is delivered as patches against the **staged** handoff at index
tree `72323d6191b11d69a77022f278bd3de671f43cbe`, plus the lab patches that
produced the evidence. Nothing has been applied to the repository.

## Patches

| Patch | Target | Effect |
| --- | --- | --- |
| `patches/handoff-design.json.patch` (text-preserving) | `docs/refactor/architecture-program/handoff/design.json` | status note; `recommendation.topology` → `T3c` with reason; two-lane `marginalPolicy` with the measured 2026-09-06 numbers; new `peerPolicy` (Effect ranges, kernel range peer `>=0.4.0 <0.5.0`, runtime contract `ts-release/provider/1`); seven-package `T3c` alternative; `package` field on every provider (`warehouse→pypi`, `homebrew/scoop→catalog`, `openai→openai`); `kernel.Entry` exports `kernel.Decision`; purposes on `kernel.Decision`/`kernel.Release`; invariants rewritten for peers/contract and added for Host composition, derived state and preparation selection. The user approved the catalog/OpenAI grouping; `selection.topology` remains `null` pending review of the complete topology. |
| `patches/handoff-kernel-api.d.ts.patch` (81 lines) | `handoff/kernel-api.d.ts` | `Host.machine`, `Machine`/`MachineConstructor`/`Next`/`CandidateRequest`, `historyMachine`, `sameProtectedRequest`/`sameStrings`, `PROVIDER_CONTRACT`, `ProviderDefinition.contract`, `CoreUndecodableReceipt`; header note |
| `patches/kernel-seams-lab.patch`, `patches/kernel-seams-tests-lab.patch` | `tools/architecture-lab/machine/**`, `storage`, `integration` | the seams and laws on the tested prototype; M2 moved to an external example; tests parameterised over evaluators |
| `patches/preparation-selection-lab.patch` | `tools/architecture-lab/{machine/src,apple}` | kernel law + Apple `runPreparation` simplification (validated by the Apple lanes) |
| `patches/helper-relocation-lab.patch` | `tools/architecture-lab/{machine,topology}` | `kernel.Http` relocation used by the relocated lane |

Full amended files: `handoff-amendment/design.json`, `handoff-amendment/kernel-api.d.ts`.

## Prose amendments (small, to be applied by hand)

- `handoff/README.md` "two concrete maintainer choices": topology → one
  recommendation (T3c) with the approved catalog/OpenAI grouping; marginal policy →
  two lanes, 40 kept, metadata reported, 45 withdrawn.
- `handoff/topology.md`: add the relocated-lane row (37/37/37) and the
  installer-skew paragraph (npm enforces peers; bun does not; `dependencies`
  nests kernels); state the range-peer + contract-literal law.
- `handoff/hosts.md`: one paragraph on composition (evaluator, store decorator,
  transport, providers supplied through `createApplication`; no registry) and
  one on derived state (L3).
- `handoff/machine.md`: the evaluator seam replaces "remove runtime candidate
  selection"; M2 becomes a documented external example; preparation-selection
  law and bounded diagnostic added to the laws table.
- `handoff/waves.md` / `waves.json`: W01 obligations gain the four items in
  [implementation-plan.md](implementation-plan.md) (W01 delta); W06 "catalog
  package"; W08 F09; W09 separate `mcp` and `openai` packages; W10
  seven-coordinate cohort preflight; `commonCommands` keep
  `check:architecture-program` once P2 makes it real.
- `handoff/qualification.md`: GM06/GT15 rows cite the two-lane record and the
  relocated measurement; C08 note about the self-referential fixture (F11).
- `handoff/forecast.md`/`forecast.json`: kernel row +36, Apple row −17,
  `densityAdjusted` and `perWaveBudget` fields (P2).

## Application order

1. Apply the two handoff patches; make the `project.ts` changes (P0); run
   `project.ts --write` then `--check`.
2. Apply the lab patches (P1, P3); run the lab suite, the Apple experiments and
   `emit.mjs --check`; regenerate `source-metrics.json`.
3. Apply the prose amendments; update `forecast.json`.
4. Maintainer review; `bun tools/architecture-lab/verify.mjs --seal`;
   `bun tools/architecture-lab/verify.mjs`.
5. Commit the staged handoff together with the amendment on
   `codex/architecture-program`.

## Promotion

This directory is ignored (`.gitignore:10`) and would vanish from a clean clone.
The tracked authority remains `docs/refactor/architecture-program/handoff/`.
Promotion means: the patches above land in the tracked handoff; the examples
become `tools/architecture-lab/machine/witnesses/` (tracked lab tests); the
experiment results are summarised in the tracked `topology.md`/`machine.md`
tables with their hashes; and this packet is archived verbatim under
`docs/refactor/research/composable-handoff-2026-09-06/` **only if** the
maintainer wants the narrative preserved (otherwise the tracked amendment is
the record). Until that happens, nothing here is authority; the audit's
`decision-packet.md` and this packet's `decisions.md` are inputs to the
maintainer's `design.json` edit, not substitutes for it.
