# Composable handoff: a small kernel with real seams

Date 2026-09-06. Inputs: HEAD `9b14c6c14aec5c5a41b2cb0f98d6f1c63bca4d3d`
(`codex/architecture-program`), the staged handoff (index tree
`72323d6191b11d69a77022f278bd3de671f43cbe`; 192 status entries: 189 added,
1 modified, 2 untracked worktree directories) and the ignored audit under
`plans/research/handoff-audit/`. Nothing in this repository was committed,
staged, published or refactored; every run happened in disposable copies under
the job's temporary directory, and every result, patch and example is preserved
here. This directory is Git-ignored (`.gitignore:10`); the
[promotion plan](handoff-amendment.md#promotion) says how it becomes tracked.

## Conclusion

The handoff's architecture stands: **owned Bundle → immutable Plan → one Journal
→ derived Report**, M1 as the default evaluator, providers owning native
protocol, one executor owning dispatch and recovery, SQLite/Git stores,
`createApplication` as the only construction boundary. What it lacked was not
safety but *openness at the right places* and two dependency facts it had
assumed rather than measured. This packet:

1. **Opens three seams without a registry** and proves them with executable
   witnesses built from public exports only: an injectable evaluator
   (`Host.machine`, M1 default; M2 now lives *outside* the kernel and still
   passes the whole suite), a store decorator seam (a 39-line cache cuts
   authoritative reads per ordinary release from 5 to 1 while the CAS oracle
   keeps every send count), and a provider contract literal
   (`contract: "ts-release/provider/1"`) checked before any effect.
2. **Adds two small kernel laws** that remove duplicated machinery elsewhere:
   *preparation selection* (a preparation scope admits one Satisfied output;
   deletes Apple's private CAS loop, 16/16 Apple lifecycle checks and the
   eight-process composition still pass) and a *bounded, credential-free
   diagnostic* for a committed send whose receipt fails strict decoding (no raw
   response retention).
3. **Fixes the dependency contract from measurements**: Effect-family peers are
   ranges (npm ERESOLVEs exact peers; the tracked law already says so);
   provider→kernel is a **range peer plus the runtime contract check**, because
   bun 1.3.14 installs mismatched peers silently and an exact `dependencies`
   edge nests a second kernel under both installers.
4. **Settles the marginal-policy dispute with data, not a new threshold**: after
   relocating the 13-line HTTP receipt helper into the kernel (where the design
   already puts it), the TypeScript-lane medians are 37/37/37 for T1/T2/T3
   against the frozen 40; the package-metadata lane (median 0, p90 19) is
   reported separately. The proposed 40→45 change is unnecessary.
5. **Proposes seven public packages**, incorporating the user's subsequent
   grouping decision: kernel keeps `@mannyc1/ts-release` and the bin; npm, pypi,
   github, mcp and openai are separate packages; catalog contains homebrew/scoop
   subpaths. The approval concerns this grouping, not all other packet amendments.
6. **Narrows the audit's five plans to four finite prerequisites (P0–P3) and one
   W01 delta**, with exact files, checks and stop conditions, and supplies the
   handoff amendment as reviewable patches.

Caching machinery, alternate evaluators, cross-version codec maps and read
optimisation stay **out of mandatory production scope**; only the seams and the
witnesses that prove they are possible are in.

## The machine and the composition path

A release is a Plan (hashed operations over a DAG, bound to a journal id). The
executor reads the *complete* journal, validates every event against the
providers' codecs, asks the evaluator for a decision, and the **only thing that
can permit a send is a fresh successful conditional append of this invocation's
`DispatchStarted`** to the authoritative store. Read-back is never a permit;
absence is never a fence; uncertainty is journaled and later satisfied by native
observation or explicit risk acceptance. Reports, indexes and caches are derived
and are authoritative only at a revision equal to a fresh read.

An application composes everything explicitly and returns one `Host`:

```ts
export const createApplication = (input: unknown) => Effect.gen(function*() {
  const sqlite = yield* openSqliteJournal(statePath)                 // kernel default store
  const store = new CachingJournalStore(sqlite)                      // app-supplied decorator (optional)
  const host: HostShape = {
    store, transport: makeHttpTransport({...}), providers: [npm.publish, github.draft, myProvider],
    machine: historyMachine,                                          // or any Machine passing the conformance suite
    now: () => Date.now(), uniqueId: () => crypto.randomUUID()
  }
  return { host, options: { plan, authorize } }
})
```

No central allowlist, no plugin discovery, no configuration language: providers
are imports, stores/transports/evaluators are values, and the kernel verifies
laws at the boundary (see [contracts.md](contracts.md)). A compile-checked
version of this example is [`examples/application-example.ts`](examples/application-example.ts).

## Mandatory now, extensible by users, deferred

| Mandatory in W01 (kernel) | Extensible by applications (seams exist, witnesses pass) | Deferred (no API change needed later) |
| --- | --- | --- |
| M1 history evaluator as `Host.machine` default; `Machine` types exported | Alternative evaluators (M2 shipped as an example outside the kernel; memoizing wrapper) | Incremental/indexed evaluators for very long histories |
| `JournalStore` laws (conformance kit) for SQLite and Git | Cache/index decorators; S3 store; any store passing the kit | Interpreter-internal validated-prefix memo (F08) |
| Provider contract literal verified before any effect | External providers built after core and CLI (already proven); two instances | Optional legacy codec readers (`legacyReceiptCodecs`) if a release must resume across a provider bump |
| Preparation-selection law (append + read) | Multiple preparations + one publication per journal (Apple, other producers) | Cross-host partitioned releases (needs its own disposition) |
| Bounded `core-undecodable-receipt/1` diagnostic | Application-level redaction policy for the bounded message | Raw native response archival (not approved) |
| Range peers, kernel-in-Http helper, 7-package roster | Consumer overrides for cohort skew | Delta Git object sets (F13) |

## Recommended tree

```
apps/
  action/          private  node24 launcher bundle + action.yml (22 lines); runtime inputs: application path + JSON
  self-release/    private  ts-release's own createApplication: 7 npm coordinates, GitHub release, catalogs
  ts-release-agents/ private, existing product, unchanged by this packet
packages/
  ts-release/      @mannyc1/ts-release         kernel + neutral Bundle/Http/Git + node/bun hosts + bin  (exports: . ./bundle ./effect-build ./apple ./http ./git ./node ./bun)
  npm/             @mannyc1/ts-release-npm     semver, sigstore; peer kernel >=0.4.0 <0.5.0
  pypi/            @mannyc1/ts-release-pypi    (the handoff's "warehouse" vertical)
  github/          @mannyc1/ts-release-github
  catalog/         @mannyc1/ts-release-catalog exports ./homebrew ./scoop (renderers; the kernel's Git owner publishes)
  openai/          @mannyc1/ts-release-openai  plugin construction, validation, marketplace and submission preparation
  mcp/             @mannyc1/ts-release-mcp     W09
```

Group coherent capabilities under subpaths when they benefit from shared
distribution. Separate packages where independent consumption, dependencies or
substantial public APIs justify the boundary. Shared Git delivery alone does
not establish a package family. The user approved Homebrew/Scoop under catalog
and a separate OpenAI package; its semver dependency stays with OpenAI.
P0 must regenerate metadata and verify the amended seven-package graph. Existing
experiment results retain their original scope. See [decisions.md](decisions.md).

## Exact next execution step

1. Review this packet; apply `patches/handoff-design.json.patch` and
   `patches/handoff-kernel-api.d.ts.patch` to the staged handoff, add the
   projector's `package` field support (P0 in
   [implementation-plan.md](implementation-plan.md)), run
   `bun tools/architecture-lab/project.ts --write` then `--check`.
2. Execute P0–P3 (peer policy, marginal two-lane record + kernel.Http
   relocation, executor entrypoints, kernel seams on the lab) in that order;
   each has a pass witness. Reseal with `verify.mjs --seal` **only** after
   review, on the staged packet.
3. Begin W01 from PR21 ancestry with the amended `kernel-api.d.ts`.

## Packet map

| File | Content |
| --- | --- |
| [decisions.md](decisions.md) | user constraints vs defaults vs my decisions; accept/revise/reject table for every audit proposal; the four meanings of "multiple machines" |
| [contracts.md](contracts.md) | ownership trace through real files, the seams, exact TypeScript signatures, safety laws and enforcers, observable equivalence, module/export map |
| [evidence.md](evidence.md) | every command run, input identities, lane results, installer experiment, witness suite, Apple lanes, four cost assessments, unverified limits |
| [implementation-plan.md](implementation-plan.md) | P0–P3 prerequisites and the W01 delta; what supersedes or narrows audit Plans 01–05 |
| [handoff-amendment.md](handoff-amendment.md) | the amendment as patches, wave impacts, and the promotion plan for this ignored directory |
| `declarations/` | the seam declarations as a delta over `kernel-api.d.ts` |
| `examples/` | the witnesses: caching store, store laws kit, memoized and external evaluators, contract/preparation/diagnostic tests, application composition |
| `experiments/` | lane logs and results (helper relocation, installer skew, Apple selection law, witness run) |
| `patches/` | lab patches (kernel seams, tests, helper relocation, preparation selection) and handoff patches (design.json, kernel-api.d.ts) |
| `handoff-amendment/` | the amended `design.json` and `kernel-api.d.ts` as full files |
