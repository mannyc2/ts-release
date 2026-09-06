# Executable topology research

These local experiments compare the same real machine, npm/Python protocols,
owned artifact boundary, journal stores, external provider and hosts in three
physical package layouts. They change research source only. No remote publish
command exists in the runner.

From the repository root, after its Bun dependencies are installed (including
the aligned Effect packages and TypeScript 6.0.3):

```sh
bun tools/architecture-lab/apple/build-upstream.ts
bun tools/architecture-lab/topology/run.ts
bun tools/architecture-lab/topology/probes.mjs
bun tools/architecture-lab/topology/publication.mjs
bun tools/architecture-lab/topology/graphs.mjs
bun tools/architecture-lab/topology/metrics.mjs
bun tools/architecture-lab/topology/fetch-retry.mjs
```

The upstream builder reads the immutable effect-build PR24 revision from its
local checkout. Its receipt supplies the temporary upstream pack directory;
`LAB_UPSTREAM` may select a freshly built equivalent directory. The main runner
freezes source and checks that it did not change during execution. Later
commands consume that run's packed artifacts. Run them before cleaning `/tmp`;
a fresh checkout reproduces by rerunning the commands, not by following saved
temporary paths. The selected existing 95,971,456-byte artifact is optional on
a different machine: the actual adoption fixture records that check as skipped
when the path is absent, rather than claiming equivalent evidence.

Bun 1.3.14 performs actual clean installs through a loopback-only local registry
serving exact locally packed dependency closures. No registry fallback is
configured. The optional `msgpackr-extract` 404 is expected. Local loopback
binding permission is required. The admitted Node executable is explicitly
`/home/cjpher/.local/share/fnm/node-versions/v22.22.2/installation/bin/node`.
Set `ARCHITECTURE_NODE_BINARY` for another installation; the runner verifies
that it is exactly Node 22.22.2 before building. The old architecture-program
tool package is not a dependency of this lab.
Compiler-only build stages use dependency symlinks and repository ambient type
definitions; installed runtime consumers use copied package files without
source aliases. This is reproducible local artifact qualification, not a fully
hermetic supply-chain certification.
The comparative Effect pack includes the donor's installed declaration patch.
The separate handoff `upstream/unpatched-effect-consumer.json` qualifies the
selected API and published producer consumer against official unpatched
rc.108; proposed production manifests omit the donor patch.

Each `*-results.json` is a readable summary with a hash-bound `.json.gz`
artifact retaining exact file inventories, graphs or observations. Import
`readEvidence` from `evidence.mjs` to verify and expand the lossless artifact.
Pack byte hashes describe that concrete execution; source and emitted file
inventories are the stable comparison basis when archive timestamps differ.
`graphs.mjs` and `metrics.mjs` additionally verify the installed declarations,
module DAG and actual Git Myers source/metadata changes from the recorded packs.

The conclusions and limits are in
`docs/refactor/architecture-program/handoff/topology.md`. These receipts are
not replacements for the historical frozen runner's differently specified
gate records.

The full proposed production layouts are a separate projection of the handoff
API declarations and `handoff/design.json` module catalog. Review or regenerate
them with `bun tools/architecture-lab/project.ts --check` or `--write`.
The projector writes only handoff `layout.json` and `public-surface.json`;
it resolves migration destinations and validates export ownership and the
proposed module DAG. It does not create production files or turn a proposed
manifest into evidence of an installed full-product consumer.
