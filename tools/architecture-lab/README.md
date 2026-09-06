# Architecture research lab

The execution handoff is
[`docs/refactor/architecture-program/handoff/README.md`](../../docs/refactor/architecture-program/handoff/README.md).
This private lab replaces the broken research selector with concrete source
experiments, direct compiler/native tests and a small integrity checker. It does
not implement the production refactor or publish anything.

## Fast checks and exact regeneration

Run from repository root with Bun 1.3.14 and the installed aligned Effect rc.108
and TypeScript 6.0.3 dependencies. `ARCHITECTURE_NODE_BINARY` can select an
installed Node 22.22.2 executable for the recorded Node matrix. The runner checks
its version; an arbitrary system Node is not silently substituted.

```sh
bun tools/architecture-lab/verify.mjs
bun tools/architecture-lab/verify.mjs --execute
```

The first verifies the sealed files, all 226 propositions, exact original native
oracle strings for all 69 outcomes, the complete obligation inventory, compressed
evidence, public tarballs and source/forecast owners. The second also runs the
direct census, generated projection, public-history census, strict declarations,
recorded unpatched-peer check and machine/storage/native-Git/dependency tests.
It writes `handoff/verification.json`; follow a reviewed evidence change with an
explicit `--seal`, or use `--execute --seal` when recording a reviewed final run.
The seal is a checksum inventory, not an independent certificate.

`inventory.ts`, `migration.ts` and `reconcile.ts` support `--check` and otherwise
write their derived records. The two large inventory/migration records use
readable JSON summaries and lossless `.json.gz` payloads; `records.ts` checks
both compressed and exact expanded byte hashes. Use
`bun tools/architecture-lab/records.ts <summary.json> --check` to verify one,
or omit `--check` to print its complete original JSON (redirect it to a file).
`project.ts --check` verifies the exact proposed graph
and surface; use `--write` after an intentional design/API change.
`python3 tools/architecture-lab/public-history-inventory.py --check` safely
reconstructs the public 0.3.0 census from its retained tarball. Source history
commands require the four recorded local Git commits.

## Full experiments

| Command | Actual work and prerequisite |
| --- | --- |
| `bun tools/architecture-lab/topology/run.ts` | Fresh source builds, local registry/packed Node/Bun/library/CLI/Action consumers; see `topology/README.md` for all extension/publication/graph follow-ups |
| `bun tools/architecture-lab/published-upstream.mjs --offline` | Fresh consumer from retained actual producer 0.6.3 tarballs and installed dependency closure; strict declarations, Node/Bun adoption and Apple lifecycle fixture; prints its temporary directory |
| `bun tools/architecture-lab/machine/unpatched-effect.mjs --execute` | Public GET of the integrity-pinned official Effect archive, fresh isolated consumer, strict complete proposed API and actual producer adoption; no registry write |
| `bun tools/architecture-lab/checksums/run.mjs /absolute/consumer/path` | Actual native checksum fixture under Bun/Node; use the `consumer` path in the preceding unpatched receipt, or `<directory>/consumer` from published-upstream output |
| `bun tools/architecture-lab/apple-composition/run.mjs` | Fresh packed producer consumer; immutable preparation-set and eight-process mixed-release experiment |
| `bun test ./tools/architecture-lab/git-catalog/objects.test.ts` | Actual SHA-1/SHA-256 native tree/commit construction and reload after deleting repositories |
| `bun tools/architecture-lab/proposal/emit.mjs --check` | Exact compiler-derived provider/artifact/complete-Apple declaration projections and negative type witnesses, with a fresh retained-package consumer |

Local package registries and peer HTTP fixtures listen only on loopback. Some
sandbox profiles require permission for those sockets or native subprocesses.
There are no hosted publication, Sigstore signing, Apple account or AWS mutation
steps here. Full Apple native/platform acceptance remains an execution-wave
obligation even when local protocol tests pass.

The original adoption fixture used an existing real 95,971,456-byte product
input. A fresh checkout may not contain that ignored release artifact. Its
retained receipt records the exact identity and whether the case ran. Do not
turn a missing input/skip into a passing original product-size witness. Recreate
the actual product fixture or explicitly report the narrower rerun. Other local
fixture data is built by the retained drivers.

## Evidence and maintenance boundaries

The five topology JSON summaries point to losslessly compressed full records.
`topology/evidence.mjs` validates compressed/expanded hashes and reconstructs
shared exact records and runtime traces. Tarball/runtime/declaration/source
hashes remain distinct. New source or API invalidates its affected evidence;
changing a report string or rerunning the sealer cannot qualify new behavior.

Independent evidence includes native peer write counters, actual process exit
and fresh-process reads, real Git/SQLite/TAR/sha256sum behavior, external providers
built after core/CLI, native package JS/declarations, strict compiler negatives
and exact before/after extension failures. The lab does not claim a hostile-code
sandbox or the unexecuted historical bubblewrap contract. Candidate code and
its author are trusted development inputs; independent expected behavior remains
outside the candidate transition implementation.

The old framework and its red readiness checker remain archived source evidence;
their Pending-only schemas and fake/handwritten/cyclic trial results have no new
selection authority. No second stateful qualification framework replaces them.
Production gates later consume actual native evidence for the 69 outcomes,
following the exact handoff waves. Tests/oracles, fixtures, tooling, declarations,
documentation and product source are separate maintained accounting lanes.
