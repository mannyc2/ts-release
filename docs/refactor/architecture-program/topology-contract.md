# T3 provider-vertical topology hypothesis

Status: non-authoritative candidate research. This document records why
`T3-provider-verticals` is worth trialing; it is not an ownership decision,
maintainer decision, input binding, generated result, or freeze artifact. T1,
T2, and T3 remain peer candidates until their real prototype slices pass or
fail the shared hard gates and the trial policy produces a unique selection or
a measured `MaintainerDecisionRequired` outcome. [`launch-scorecard.md`](../research/launch-scorecard.md)
remains the sole product-scope authority.

## Hypothesis

The T3 hypothesis is one neutral kernel package plus one package per
first-party provider vertical. Hosts would be applications or kernel subpaths,
not separate host packages. T3 proposes no aggregate first-party provider
bundle and no third shared artifact package.

## Package graph

Illustrative names use the existing `@mannyc1` npm scope. A qualifying topology
must make names a generated, rename-safe field of its specification; no name
in this hypothesis is a frozen public commitment.

| Package | Role |
| --- | --- |
| `@mannyc1/ts-release` | Kernel: canonical durable chain, pure transition owner, effect interpreter, journal law and `JournalStore` interface, strict adoption envelope, provider SDK surface. Imports no concrete provider. |
| `@mannyc1/ts-release-npm` | `D01` native npm vertical |
| `@mannyc1/ts-release-warehouse` | `D02` Python index vertical |
| `@mannyc1/ts-release-github` | `D03` GitHub tag/release/asset vertical |
| `@mannyc1/ts-release-homebrew` | `D04` Homebrew Formula vertical |
| `@mannyc1/ts-release-scoop` | `D05` Scoop vertical |
| `@mannyc1/ts-release-mcp` | `D07` MCP Registry vertical |
| `@mannyc1/ts-release-openai` | `AI01`-`AI03` OpenAI plugin-delivery vertical |

The roster tracks the scorecard's selected families exactly; it is a
projection, not a second scope ledger. A deferred maintained destination
(`X01`-`X07`) becomes one new sibling package with zero kernel edits. Custom
third-party providers (`D06`) are ordinary external packages importing the
kernel's provider SDK and are structurally identical to first-party verticals.
The CLI and the GitHub Action remain hosts under `apps/*` or kernel subpaths.
effect-build and effect-build-apple remain external repositories crossing the
adoption boundary; no shared artifact package is introduced.

## Dependency edges

Under T3, the hypothesized import and manifest graph would be acyclic and
one-way:

```text
provider vertical -> kernel                (exact-pinned, only edge)
host application  -> kernel + chosen providers
kernel            -> effect family + effect-build adoption protocol
```

Provider siblings would never import one another or appear in one another's
manifests, making sibling edges unrepresentable rather than lint-guarded.
Host-neutral code would import no Node or Bun implementation. These are the
same invariants gates `GT10` and `GT11` check; T3 hypothesizes that the topology
makes them structural.

## Version policy

T3 proposes that all first-party packages version in lockstep: one shared
version, bumped and published atomically as one release set by the non-manual
self-release (`K03`), with every provider-to-kernel dependency pinned to that
exact version. There are no independent version tracks, no compatibility
ranges between first-party packages, and no partial-set publication as a
success state. Kernel-provider version skew is thereby collapsed to the states
gate `GT12` proves are rejected. The self-release doubles as the
plural-workspace npm acceptance evidence for `D01`.

## Generated surfaces

A qualifying T3 implementation would use one checked topology specification to
generate every package manifest, export map, bin entry, host entrypoint, and
TypeScript project reference together, extending plan 005 law 12 from one
package to the package set. A scope or name change, a new vertical, or an
export change would be one reviewed edit to that specification followed by
regeneration; hand-edited manifests would be forbidden.

## Research basis

1. Providers are heterogeneous: npm, Warehouse, GitHub, and catalogs share no
   interchangeable publisher service, so verticals are semantically
   self-contained seams
   ([`provider-contracts.md`](../research/provider-contracts.md),
   [`provider-extension-runtime.md`](../research/provider-extension-runtime.md)).
2. The growth axis is provider packages: seven deferred maintained
   destinations are counted as packages, and `D06` requires external providers
   to ship with no core allowlist, sealed union, or kernel edit
   ([`competitive-scope.md`](../research/competitive-scope.md)).
3. The closest ecosystem analogy, Effect SQL, packages this shape as a kernel
   plus per-backend clients chosen by application Layers
   ([`provider-extension-runtime.md`](../research/provider-extension-runtime.md)).
4. The dynamic CLI must load provider packages unknown when the CLI was
   built; separate packages make the third-party path first-class
   ([`provider-extension-runtime.md`](../research/provider-extension-runtime.md)).
5. Plan 005 laws 6-7 already force the logical kernel/provider boundary; this
   hypothesis explores one physical packaging, naming, and version policy that
   those laws leave open.

## Explicit neutrality

- The machine selection (`M1-extracted-fold` versus `M2-total-transition`)
  remains open and is unaffected by this record.
- The topology selection (`T1-root`, `T2-kernel-provider-bundle`, or
  `T3-provider-verticals`) remains open and is unaffected by this record.
- No `packages/*` tree, workspace manifest, or production package is created
  by this record; any selected physical migration remains plan 006
  implementation scope.
- All six freeze blockers (`OB01`-`OB06`) remain open, and the final plan 005
  contract freeze still awaits the terminal Plan 004 coordinate.
- No push, publication, tag, or remote mutation authority is created here.
