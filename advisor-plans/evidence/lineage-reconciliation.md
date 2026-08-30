# ts-release pre-freeze lineage reconciliation

Status: hash-attested preservation evidence; not architecture authority.

## Coordinates and method

- Base: `1e9efd717ff9d5dc2dbe5e079894cd8e92eb7ed3`
- PR21 research: `887a9fe2b35590f3088ffeee84f32722796e03ab`
- PR22 prototype: `c2ac4ee4e7f02d74a7a1ff435bdfeaca6890b720`
- Overlay evidence: `2ef7a9a61fe40608d053569cbcd71e40fca5c181`
- Overlay tree: `4e71a43c14f2dc980fadae024020d294270e6565`

The comparison domain is the sorted set of paths changed from the base to
PR22. Each path is classified by comparing its PR22 blob with the immutable
overlay tree. The canonical comparison encoding is one UTF-8 line per path,
`status<TAB>path<LF>`, sorted first by status and then by path, using the
status literals `different`, `missing`, and `same`.

- Compared: 89
- Same: 64
- Different: 16
- Missing from overlay: 9
- Canonical comparison SHA-256:
  `e3baf5b0214ea5c10ac8afb7f9a96567131a74e38afbec439607401c2227c874`

`same` means byte-identical evidence, not selected target architecture.
`different` and `missing` rows below state the semantic disposition that Plan
005 must consume. No row authorizes a merge or cherry-pick.

## Semantic disposition of non-identical paths

| Path | PR22 proposition | Overlay witness | Disposition | Law / scorecard | Required freeze action |
| --- | --- | --- | --- | --- | --- |
| `docs/refactor/research/README.md` | Research index for the reviewed vNext slice | Later research index in the overlay | `evolved-evidence` | all 69 selected rows | Baseline both coordinates; the scorecard, not either index, owns scope. |
| `docs/refactor/research/cross-repository-delivery.md` | effect-build produces finalized outputs; ts-release owns release history | Expanded producer-handoff and application boundary research | `evolved-evidence` | `R05`, `P01-*` | Freeze the effect-build/ts-release contract and test it from packed coordinates. |
| `docs/refactor/research/decision-packet.md` | Bundle, Plan, Journal, Report and ordinary imported providers | Later decisions and implementation evidence | `evolved-evidence` | `R01`-`R07` | Freeze each durable fact, decision, effect, and owner in `SYSTEM.json`. |
| `docs/refactor/research/effect-patterns.md` | Aligned Effect family, service-free codecs, operation-local Layers | rc.108 prototype patterns | `evolved-evidence` | `R06`, `D06-*` | Trial exact Effect/package composition; do not inherit beta.83 or rc.108 by ancestry. |
| `docs/refactor/research/launch-scorecard.md` | Canonical 69-row product and evidence denominator | Expanded implementation-status evidence | `evolved-evidence` | all 69 selected rows | Map every row exactly once into `WAVES.json`; preserve red external gates. |
| `scripts/lib/import-rules.ts` | Initial dependency constraints | Broader overlay directory matrix | `evolved-evidence` | `R01`-`R06`, `D06-01` | Replace directory convention with a checked package/module ownership DAG. |
| `scripts/lib/public-api-policy.ts` | Existing six-entrypoint API remained unchanged by PR22 | Overlay four-entrypoint/59-runtime-name policy | `evolved-evidence` | `K03`, `D06-01` | Inventory runtime and declaration exports; select the surface only after topology trials. |
| `src/model/digest.ts` | Domain-separated durable identities | Later digest and strict-durable-text prototype | `candidate-for-reimplementation` | `R01`, `R02`, `D06-02` | Freeze canonical bytes, brands, domains, and hostile vectors before implementation. |
| `src/platform/bun-journal.ts` | First-party SQLite `appendIfRevision` fence | Later Bun journal and continuation prototype | `candidate-for-reimplementation` | `R03`, `K02`, `D06-07` | Trial the journal law across process boundaries and reject host dependency shadowing. |
| `src/publication/npm-native.ts` | Native npm request/receipt/observation law | Split npm definition, application, native, and live modules | `candidate-for-reimplementation` | `D01-01`-`D01-06` | Re-prove request correspondence, exit-zero success, ambiguity, and absence handling. |
| `src/release/artifact-bundle.ts` | Immutable byte ownership and logical artifact references | Later bundle prototype | `candidate-for-reimplementation` | `R01`, `P01-01` | Select one artifact canon and one adoption boundary; delete peer digest/size authorities. |
| `src/release/journal.ts` | Append-only durable fact history | Later event algebra and store boundary | `candidate-for-reimplementation` | `R03`, `K02` | Freeze event schemas, append authority, late evidence, and migration disposition. |
| `src/release/release-plan.ts` | Strict service-free durable plan and derived identities | Later plan, dependency, and producer-fact prototype | `candidate-for-reimplementation` | `R02`, `D06-02` | Freeze one plan canon and reject unresolved or duplicate operation ownership. |
| `src/release/release-report.ts` | Report is a pure projection, never status authority | Later report projection | `candidate-for-reimplementation` | `K01` | Prove decode/re-derive equality and remove every independently authored status. |
| `test/core/bun-journal-v1.test.ts` | SQLite CAS and reopening witnesses | Expanded journal tests | `retained-evidence` | `R03`, `K02` | Convert the strongest cases into topology-independent hard traces. |
| `test/core/release-kernel-v1.test.ts` | Bundle/plan/journal/report laws and npm continuation | Expanded kernel and supersession witnesses | `retained-evidence` | `K01`, `K02`, `R01`-`R03` | Preserve behavior cases, including linked late evidence; do not preserve file shape. |
| `.github/workflows/refactor-research-probes.yml` | Remote research-probe runner | No overlay path | `historical-only` | `M09` | Preserve the PR21/PR22 CI receipts; design new gates from `gates.json`. |
| `apps/ts-release-action/dist/index.js` | Generated first-party Action bundle | `apps/ts-release-action/dist/index.cjs` | `historical-only` | `K03` | Freeze one Node 24 Action delivery artifact and reject duplicate bundle formats. |
| `src/platform/npm-native-client.ts` | Operation-local npm process client | `src/publication/npm-live.ts` plus transport/application seams | `candidate-for-reimplementation` | `D01-01`, `D01-02`, `D01-06` | Keep concrete execution outside the kernel and bind it to the exact prepared request. |
| `src/publication/npm-operation.ts` | npm operation definition and execution boundary | `src/publication/npm-application.ts`, `npm-native.ts`, and release definitions | `candidate-for-reimplementation` | `D01-*`, `R06` | Freeze definition/driver ownership without a central provider registry. |
| `test/core/workflow-shape.test.ts` | Negative architectural-shape witnesses | import-rule, packed-consumer, and public-surface tests | `retained-evidence` | `D06-01`, `K03` | Re-express every relevant prohibition in the ownership-DAG and packed-host gates. |
| `test/fixtures/native-npm-target/bin.js` | Real packed npm bin fixture | Current packed npm and external-provider fixtures | `retained-evidence` | `D01-01`, `D01-04` | Require a clean packed consumer with import and bin execution. |
| `test/fixtures/native-npm-target/index.js` | Real packed npm import fixture | Current packed npm and external-provider fixtures | `retained-evidence` | `D01-01`, `D06-01` | Require clean Node and Bun imports from exact tarball bytes. |
| `test/fixtures/native-npm-target/package.json` | Exact npm coordinate/manifest fixture | Current npm protocol and packed-consumer fixtures | `retained-evidence` | `D01-01`, `D01-05` | Freeze manifest/public-private policy in the topology trial. |
| `test/protocol/npm/native-npm-vertical.test.ts` | End-to-end native npm protocol/continuation witness | `npm-complete-model.test.ts` and `npm-live.test.ts` | `retained-evidence` | `D01-01`-`D01-06` | Preserve all protocol cases and add live/hosted acceptance without copying test structure. |

## Known correctness gaps carried into the freeze

These are required target traces, not reasons to patch the prototype:

1. host dependency-shadow rejection;
2. observation must not precede request-correspondence proof;
3. linked late outcomes after supersession must be accepted while new dispatch
   is rejected;
4. Git-ref journal writes and reads must enforce symmetric size bounds;
5. GitHub graph rejection must occur before any remote effect; and
6. the preserved overlay fails `git diff --check` because
   `test/fixtures/openai-plugin-process.ts` has one blank line at EOF. The
   captured check output has SHA-256
   `c49a0468fe68b5f726dcfe5ec0b3489a981126578adc5562925777557efdc421`.

## Escaped durable-data inventory

Finding: `unresolved-external`; no PR22/overlay `release-plan/v1`, journal-v1,
or `release-report/v1` payload is proven in this checkout, but copies outside
the checkout cannot be excluded without an operator inventory.

Evidence:

- Two ignored local roots exist: `.release/` and
  `examples/multi-target/.release/`.
- The only candidate durable JSON found there identifies itself as
  `prepared-release/v2`, `ts-release-action-report/v2`, or
  `release-evidence/v2`; no PR22/overlay plan, journal, or report format literal
  was found.
- No dedicated local Git ref matching a ts-release journal/run namespace was
  found.
- GitHub PR21 and PR22 are open draft PRs, unmerged. Their descriptions state
  that no live public-registry mutation was performed.
- No operator attestation about copies outside this checkout was available.

Therefore absence is not asserted globally. PR22 was an unmerged draft whose
vNext model was deliberately internal and whose own release record claims no
live mutation, so no public compatibility promise is inferred. The target
performs a hard cutover: it must not accept either prototype codec by default.
Discovery of an escaped coordinate before certification creates a specific
`MIGRATION.json` row; it never creates a fallback reader or makes a prototype
the new canon.

## Canonical 89-path comparison

```text
different\tdocs/refactor/research/README.md
different\tdocs/refactor/research/cross-repository-delivery.md
different\tdocs/refactor/research/decision-packet.md
different\tdocs/refactor/research/effect-patterns.md
different\tdocs/refactor/research/launch-scorecard.md
different\tscripts/lib/import-rules.ts
different\tscripts/lib/public-api-policy.ts
different\tsrc/model/digest.ts
different\tsrc/platform/bun-journal.ts
different\tsrc/publication/npm-native.ts
different\tsrc/release/artifact-bundle.ts
different\tsrc/release/journal.ts
different\tsrc/release/release-plan.ts
different\tsrc/release/release-report.ts
different\ttest/core/bun-journal-v1.test.ts
different\ttest/core/release-kernel-v1.test.ts
missing\t.github/workflows/refactor-research-probes.yml
missing\tapps/ts-release-action/dist/index.js
missing\tsrc/platform/npm-native-client.ts
missing\tsrc/publication/npm-operation.ts
missing\ttest/core/workflow-shape.test.ts
missing\ttest/fixtures/native-npm-target/bin.js
missing\ttest/fixtures/native-npm-target/index.js
missing\ttest/fixtures/native-npm-target/package.json
missing\ttest/protocol/npm/native-npm-vertical.test.ts
same\tdocs/refactor/research/adversarial-traces-2.md
same\tdocs/refactor/research/adversarial-traces.md
same\tdocs/refactor/research/artifact-model.md
same\tdocs/refactor/research/artifact-storage.md
same\tdocs/refactor/research/competitive-scope.md
same\tdocs/refactor/research/decision-packet-details.md
same\tdocs/refactor/research/effect-architecture-patterns.md
same\tdocs/refactor/research/fresh-runner-resumability.md
same\tdocs/refactor/research/goreleaser-evidence-census.md
same\tdocs/refactor/research/goreleaser-material-evidence-2.md
same\tdocs/refactor/research/goreleaser-material-evidence.md
same\tdocs/refactor/research/goreleaser-outcomes.md
same\tdocs/refactor/research/idempotency-material.md
same\tdocs/refactor/research/implementation-strategy.md
same\tdocs/refactor/research/journal-backends.md
same\tdocs/refactor/research/probes/.gitignore
same\tdocs/refactor/research/probes/artifact-finalization.ts
same\tdocs/refactor/research/probes/artifact-owned-bundle.ts
same\tdocs/refactor/research/probes/artifact-reference-scope.ts
same\tdocs/refactor/research/probes/artifact-schema-load.ts
same\tdocs/refactor/research/probes/custom-provider/README.md
same\tdocs/refactor/research/probes/custom-provider/cli/package.json
same\tdocs/refactor/research/probes/custom-provider/cli/src/index.ts
same\tdocs/refactor/research/probes/custom-provider/cli/tsconfig.json
same\tdocs/refactor/research/probes/custom-provider/core/package.json
same\tdocs/refactor/research/probes/custom-provider/core/src/index.ts
same\tdocs/refactor/research/probes/custom-provider/core/tsconfig.json
same\tdocs/refactor/research/probes/custom-provider/package.json
same\tdocs/refactor/research/probes/custom-provider/provider/package.json
same\tdocs/refactor/research/probes/custom-provider/provider/src/index.ts
same\tdocs/refactor/research/probes/custom-provider/provider/tsconfig.json
same\tdocs/refactor/research/probes/custom-provider/scripts/test-clean-consumer.mjs
same\tdocs/refactor/research/probes/custom-provider/scripts/test-standalone-loader.mjs
same\tdocs/refactor/research/probes/custom-provider/tsconfig.base.json
same\tdocs/refactor/research/probes/effect-baselines/beta83/package.json
same\tdocs/refactor/research/probes/effect-baselines/beta83/probe.ts
same\tdocs/refactor/research/probes/effect-baselines/beta83/tsconfig.json
same\tdocs/refactor/research/probes/effect-baselines/rc108/package.json
same\tdocs/refactor/research/probes/effect-baselines/rc108/probe.ts
same\tdocs/refactor/research/probes/effect-baselines/rc108/tsconfig.json
same\tdocs/refactor/research/probes/effect-baselines/rc109/package.json
same\tdocs/refactor/research/probes/effect-baselines/rc109/probe.ts
same\tdocs/refactor/research/probes/effect-baselines/rc109/tsconfig.json
same\tdocs/refactor/research/probes/journal-backends/README.md
same\tdocs/refactor/research/probes/journal-backends/probe.mjs
same\tdocs/refactor/research/probes/journal-backends/worker.mjs
same\tdocs/refactor/research/probes/package.json
same\tdocs/refactor/research/probes/probe-effect-build-alignment.mjs
same\tdocs/refactor/research/probes/probe-tsconfig.json
same\tdocs/refactor/research/probes/two-runner/README.md
same\tdocs/refactor/research/probes/two-runner/core.mjs
same\tdocs/refactor/research/probes/two-runner/helpers.mjs
same\tdocs/refactor/research/probes/two-runner/identity-alternatives.mjs
same\tdocs/refactor/research/probes/two-runner/probe.mjs
same\tdocs/refactor/research/probes/two-runner/runner.mjs
same\tdocs/refactor/research/probes/two-runner/scenarios-basic.mjs
same\tdocs/refactor/research/probes/two-runner/scenarios-race.mjs
same\tdocs/refactor/research/probes/two-runner/shape.ts
same\tdocs/refactor/research/product-api-examples.md
same\tdocs/refactor/research/provider-contracts.md
same\tdocs/refactor/research/provider-extension-runtime.md
same\tdocs/refactor/research/provider-wire-github-catalogs.md
same\tdocs/refactor/research/provider-wire-models.md
same\tdocs/refactor/research/resumability.md
```

## Attestation

This document was produced after explicit operator authorization and is made
read-only in the external evidence directory. Its SHA-256 is recorded in
`v1-reference-manifest.json`. No signing key or cryptographic identity was
configured, so this is a hash-linked integrity attestation rather than a
detached identity signature.
