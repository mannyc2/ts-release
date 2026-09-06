# Decision packet

Each item states the alternatives, the evidence, a recommendation, and what
recording it changes. Nothing here is approved until the maintainer records
it in `design.json` (`selection` / `recommendation` fields) and the packet is
re-projected (`project.ts --write`) and re-sealed (`verify.mjs --seal`).

## D1 Physical topology

| Option | Evidence for | Evidence against | Consequence if chosen |
| --- | --- | --- | --- |
| **T1** root package + subpaths | smallest metadata (129 + 46 lines), zero partial-publication states, passes frozen marginal rule (TS lane, P01 = 0) | no selective provider install; sibling-isolation is lint, not structure; external providers are packages while first-party are subpaths | `design.selection.topology = "T1"`; 63 modules under `src/` |
| **T3′** kernel + npm/warehouse/github/catalog (renderers as catalog subpaths), MCP/OpenAI added at W09 as packages | selective install, structural sibling isolation, first/third-party symmetry, matches the maintainer's stated inclination and `ARCHITECTURE.md:126` renderer model | 4–6 partial-publication states, ≈220 manifest lines, cohort preflight required, needs D4 | new projection in `design.json.alternatives` (add `T3prime`), regenerate |
| T3 as projected (8 packages) | selective install | fails frozen marginal rule (43) by a lab artifact; two renderer-only packages; most metadata | not recommended |
| T2 kernel + aggregate providers | core boundary | no selective install; one extra package with no ownership benefit | not recommended |

Recommendation: decide between **T1** and **T3′** after Plan 02's helper
relocation run; if selective installation or structural isolation is not
valued enough to pay the cohort/publication cost, choose T1.

## D2 Admit configuration-only zeroes in the nine-probe population

Recommendation: **yes**. Amend `inputs/trial-spec.json`
`topologySelectionPolicy.marginalBudget.sampleUnit` from
`one-nonzero-observation-per-predeclared-probe` to
`one-observation-per-predeclared-probe; configuration-only changes record their real zero`,
record the new hash in `qualification.json` `inputBindings`, and note the
amendment in `qualification.md` GM06/GT15. Basis: Plan 005 §Step 5 lists the
second-instance probe with the invariant "zero kernel edits"; the anti-dilution
sentence targets reused scorecard rows.

## D3 Median ceiling 40 → 45

Recommendation: **no**. Keep 40 on the TypeScript lane (Plan 005 numerator);
add a metadata lane with its own reported quantiles and budget (proposal:
median ≤ 5, p90 ≤ 25). Record both in `design.json.recommendation.marginalPolicy`
as `{ typescriptMedianAtMost: 40, metadataP90AtMost: 25, configurationOnlyObservationsAllowed: true }`.

## D4 Provider → kernel edge kind (T2/T3/T3′ only)

| Option | Behavior under skew | Cost |
| --- | --- | --- |
| exact `dependencies` (as projected) | installs two kernels silently; module-private state splits | none at install; hidden runtime hazard |
| exact `peerDependencies` (recommended) | install-time refusal/warning; one kernel | consumers must install the kernel explicitly (they already do: CLI, Action, self-release manifests list it) |
| range peer | allows drift inside a cohort | contradicts lockstep single-version policy |

Recommendation: exact peer + a Host-construction check that every provider's
declared kernel version equals the running kernel (one line per provider
definition: `kernel: "0.4.0"`).

## D5 Effect peer range

Not really open: the tracked law (`scripts/lib/versions.ts:49-50`) and
effect-build's own peer make the range peer the only consistent choice.
Record `effect: ">=4.0.0-rc.108 <4.1.0-0"` (and the same for
`@effect/platform-node`, `@effect/platform-bun` optional peers) with exact dev
pins; see Plan 01.

## D6 Journal event profile 1,048,576 bytes of canonical full event

Recommendation: **accept as proposed** (OB05), with the provider obligation
that receipts/observations are projected to bounded facts before journaling
and the F06 raw-receipt retention bounded by the same profile.

## D7 Undecodable committed receipt

| Option | Effect |
| --- | --- |
| fail the run, journal nothing (current) | safe; evidence lost; write-only providers stuck until risk acceptance |
| record `DispatchError` with a core codec carrying the raw receipt text (recommended) | safe; evidence retained; observation can still satisfy later |

## D8 Versioned codec channels

Recommendation: change `ProviderDefinition` to codec maps keyed by version
before the W01 API freeze (Plan 04). Alternative: keep single versions and
write the operational law "provider package versions are pinned for the life
of a release" into `hosts.md` and the CLI/Action acceptance.

## D9 Deletion of retired research tooling

| Option | Lines removed | Risk |
| --- | --- | --- |
| W10 (as planned) | ≈43k at the end | dead code is carried through ten waves; CI still references it |
| W01 (recommended) | ≈43k now: `tools/architecture-program`, `prototypes/research-complete-*`, `.github/workflows/ci.yml` lock-hash steps | E12 binds one file (`trial-probe-evaluator.ts`); copy it under the handoff and re-seal |

## Out of scope for this packet (correctly deferred)

Action shared-store default (OB01), operational S3/WORM (OB03), Apple native
acceptance (OB06/P09/P10), Windows signing backend, live registry acceptance
(Plan 009), certification (Plan 010).
