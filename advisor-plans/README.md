# Advisor implementation plans

Status: the portfolio is in an architecture reset. Plan 003 preserves and
characterizes the current ts-release overlay; it does not land that overlay as
the target architecture. Plan 004 independently preserves and qualifies the
effect-build release-readiness line. Plan 005 starts from the clean PR21
research coordinate, consumes both implementations as read-only evidence, and
must freeze the generated system contract, physical package topology, public
surface, and complete move/delete map before production implementation begins.
Plans 006-010, including the ordered 008B convergence wave, implement, accept,
and certify only that selected contract.
A plan is implementation guidance, not authority for remote mutation,
credentials, repository settings, default-branch merge, tag, release, or
publication.

## Active execution queue

Generated from the current v1 hard-cut and cross-repository release-readiness
review on 2026-08-30. Read each plan completely, honor every STOP condition,
and report its terminal state to the coordinating reviewer, who alone updates
the row here.

| Order | Plan | Priority | Effort | Risk | Depends on | Status |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | [003 — Preserve and characterize the full v1 overlay](003-preserve-pre-freeze-lineages.md) | P0 | M | HIGH | Exact product-overlay preservation; hash-linked `c2ac4ee` disposition | DONE — immutable evidence commit/bundle/reference manifest verified |
| 2 | [004 — Preserve and qualify the active effect-build v0.6 readiness branch](004-establish-effect-build-release-readiness.md) | P1 | M | HIGH | Terminal manifest from `codex/v060-release-readiness` source task | BLOCKED — source task active |
| 3 | [005 — Generate the system contract and select the package graph and lowest-state machine](005-freeze-research-complete-system-contract.md) | P0 | XL | HIGH | Plan 003 reference manifest; PR21 `887a9fe`; Plan 004 terminal coordinate required before final freeze | IN PROGRESS — candidate-neutral schema/input slice passed isolated CI at `a3c4ca4`; traceability, baselines, and trials remain; final freeze awaits Plan 004 terminal coordinate |
| 4 | [006 — Implement the selected deterministic release machine as a hard cut](006-build-one-deterministic-release-machine.md) | P0 | XL | HIGH | Plan 005 generated contract and migration projection | BLOCKED — architecture contract absent |
| 5 | [007 — Re-prove and compress the pre-producer provider verticals](007-reprove-and-compress-provider-verticals.md) | P0 | XL | HIGH | Plan 006 and exact Plan 007 waves | BLOCKED — deterministic machine absent |
| 6 | [008 — Integrate the real effect-build packages and close producer implementation](008-integrate-the-real-effect-build-contract.md) | P0 | XL | HIGH | Plans 004 and 007; immutable effect-build package contract | BLOCKED — upstream/source contract not terminal |
| 7 | [008B — Integrate late providers and hosts into one local candidate](008b-integrate-late-providers-and-hosts.md) | P0 | L | HIGH | Plans 007-008 on one sequential ancestry | BLOCKED — producer integration incomplete |
| 8 | [009 — Qualify shipped hosts and close every selected live acceptance row](009-close-hosted-and-live-acceptance.md) | P0 | XL | HIGH | Plan 008B exact local candidate; per-mutation authority packets | BLOCKED — integrated candidate absent |
| 9 | [010 — Certify the research-complete architecture and exact release point](010-certify-the-research-complete-system.md) | P0 | L | HIGH | Plan 009; genuine 69/69 closure; independent review | BLOCKED — acceptance incomplete |

Status values: `TODO`, `IN PROGRESS`, `DONE`, `BLOCKED — <exact gate>`, or
`REJECTED — <rationale>`.

### Dependency and authority notes

- Plan 003 creates an immutable product-overlay checkpoint, a persistent bundle,
  and a signed semantic disposition against `c2ac4ee`. It does not create an
  overlay-first-parent integration merge, repair the provisional orchestration,
  or nominate the overlay as the production baseline. The overlay, PR22, and
  Plans 173-184 are evidence inputs to Plan 005, not source to merge wholesale.
  Plan 004 preserves the exact effect-build overlay only after its active source
  task is terminal. The older 12-file `/tmp/effect-build-pr24` follow-up is
  superseded and is never copied.
- One coordinating reviewer owns this README. Executors report terminal SHAs
  and gates; they do not edit the index concurrently. Any pre-candidate status
  edit is included before the exact candidate SHA and gates are rerun; a final
  DONE/BLOCKED update occurs out-of-band and never changes the tested SHA.
- Plan 003 must not adopt an effect-build coordinate or join the overlay and
  PR22 histories with `-s ours`, a merge, or a cherry-pick. Its only source
  mutation is the separately reviewed local checkpoint commit. It does not
  authorize push, PR/default-branch merge, candidate dispatch, tag, release, or
  package publication.
- Plan 004 lands and locally qualifies the active readiness implementation; it
  does not implement or dispatch a publication lane. Push, hosted review,
  protected certification, journal deployment, and publication remain separate
  authority gates. Its cross-repository Step 6 is not implementation authority
  until Plan 005 reconciles S3 scope with the canonical backend-neutral
  `JournalStore` law and first-party Action deployment.
- Plan 005 is the mandatory architecture decision gate before any production
  refactor. Its working branch starts at PR21 `887a9fe`, not at the overlay. It
  may begin traceability, baseline, machine, and topology trials after Plan 003
  emits its immutable reference manifest; its final contract cannot freeze
  until Plan 004 supplies the exact terminal effect-build coordinate. One
  generator must produce the checked system contract, package/public-surface
  projection, physical migration/deletion projection, and execution-wave map.
  Plans 006-010 may not reinterpret those outputs.
- Plan 006 implements one pure transition machine plus one effect interpreter
  into the selected package graph. It may selectively reimplement or move code
  proven by the overlay, but it may not merge/cherry-pick the overlay or retain
  unlisted compatibility peers. Plan 007 then closes npm, Warehouse, GitHub,
  conditional-Git/catalog, and external-provider waves. Plan 008 consumes the
  real immutable effect-build package contract and closes the 26 missing P/Q
  implementations on that same ancestry. Plan 008B runs only afterward to close
  MCP/OpenAI/Action/self-release-local waves and emit one exact candidate for
  Plan 009. No parallel implementation branches require a convergence merge.
- Plan 009 is the only plan in this portfolio that requests live provider,
  journal-deployment, hosted Action, and non-manual self-release work. Every
  mutation group still requires an exact same-session authority packet.
- Plan 010 is independent certification only. A failure reopens an owning plan;
  the certifier does not patch source, weaken budgets, or rewrite evidence.
- Apple credentials and credentialed Notary-correlation evidence, npm
  credential retirement, GitHub Release immutability, npm publication, Git tag,
  and GitHub Release remain independent follow-ups. No successful local or
  hosted test implies them.

## Historical archive

Plans 001 and 002 were produced by the read-only `improve` architecture audit
on 2026-08-13. Their premises were superseded by the canonical refactor
research and subsequent implementation evidence. Neither historical plan may
be executed as written, and nothing in this directory proves implementation or
launch completion.

`AUDIT-SNAPSHOT.md` predates this plan set and is user-owned historical evidence.
Executors must not edit, rename, regenerate, or delete it.

`THREAT-MODEL.md` (added 2026-08-15) is preserved as historical risk analysis;
it is not authoritative over defenses. In particular, its single-runner
assumption and scheduled deletion list conflict with the canonical fresh-runner
continuation requirements. Product scope comes only from
`docs/refactor/research/launch-scorecard.md`; journal/replay policy comes from
`docs/refactor/research/resumability.md`; implementation order comes from
`docs/refactor/research/implementation-strategy.md`.

## Disposition

| Order | Plan | Status | Priority | Effort | Risk | Depends on |
| ---: | --- | --- | --- | --- | --- | --- |
| — | [002 — Standing rehearsal-release gate against real endpoints](002-rehearsal-release-gate.md) | REJECTED/SUPERSEDED — coupled to rejected plan 001, old shipped paths, and an invalid second-publish equivalence claim; its demand for live provider evidence survives in scorecard D01/K03 | — | — | — | Historical evidence only; do not execute |
| — | [001 — Replace the prepared-byte and typed-authority kernel with a conventional release pipeline](001-conventional-release-pipeline-hard-cut.md) | REJECTED/SUPERSEDED — contradicts canonical continuation law and assumes an unpublished pre-0.2 surface after v0.2.2 | — | — | — | Historical evidence only; do not execute |

Plans 003 and 004 are preservation/qualification lanes, not architecture
selection. They do not replace the 69 selected scorecard leaves or the accepted
ten-step implementation strategy. Plan 005 is unfinished architecture research
until its generated contract and projections pass; Plans 006-010 are successor
programs parameterized by that result, not presently executable handoffs. Live
scratch-provider work still needs explicit mutation approval and current
destination/auth design; no plan silently supplies either.

## Historical findings, not implementation authority

- **Authority-only simplification:** rejected. It would leave prepared references,
  the store, provenance, graph-to-prepared translation, Action transport, and most
  of the public lifecycle intact.
- **Prepared-only simplification:** rejected. It would leave grants, generic
  observations and decisions, recovery profiles, claims, correction, and provider
  certification around a renamed artifact model.
- **Compatibility aliases or a v2 reader:** rejected for the mainline. They would
  preserve both representations and their tests. Reconsider only if the decision
  gate discovers that 0.2.0 has escaped the repository.
- **Hooks, custom publishers, split/continue state, or new providers:** deferred.
  They are conventional features, but adding them during compression would hide
  whether the kernel actually became smaller. The target task seam should make a
  later plan straightforward.
- **Deleting provider-specific preflight and read-back:** rejected. Those checks
  protect observable release behavior and can remain local to each provider
  without a universal authority algebra.
- **Moving the old model into generated schemas, test helpers, or certification
  scripts:** rejected. That is relocation, not deletion.
- **Changing Effect versions during stabilization:** rejected. The current v1
  tree is aligned on Effect `4.0.0-rc.108`; version migration is unrelated to
  the four runtime invariants in Plan 003.

## Maintenance

Keep the historical files available for provenance, but do not revive their
status or reinterpret their checklists as current acceptance. New executable
work belongs in a separately numbered plan tied to current architecture and,
where relevant, scorecard leaf IDs. Preserve `AUDIT-SNAPSHOT.md` byte-for-byte.
