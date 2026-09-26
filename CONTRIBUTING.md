# Contributing

ts-release publishes reviewed artifact bytes through one durable release authority.
Read [the architecture](ARCHITECTURE.md), [durable decisions](docs/design-decisions.md)
and the affected package guide before changing that contract. Keep each change
focused on an observable behavior or an enforceable engineering requirement.

## Toolchain and commands

Use the pinned Bun package manager and a supported Node runtime from `package.json`.
Install with `bun install --frozen-lockfile`. Runtime `effect` and platform packages
stay aligned; compiler/linter upgrades are separate from runtime upgrades. Read
the complete installed `node_modules/effect/AGENTS.md` and version-matched examples
and source before using unfamiliar Effect APIs.

| Command                            | Claim                                                           |
| ---------------------------------- | --------------------------------------------------------------- |
| `bun run check:toolchain`          | The expected patched Effect compiler is active.                 |
| `bun run format:check`             | Maintained source has canonical Prettier formatting.            |
| `bun run lint`                     | Type-aware safety rules and justified suppression policy hold.  |
| `bun run check`                    | Required static/build, import and export checks pass.           |
| `bun run test -- <selection>`      | The selected existing Bun behavior checks pass.                 |
| `bun run check:packed-kernel`      | Actual core archives work through installed public entries.     |
| `bun run check:packed-action`      | The bundled Action resolves and runs the installed application. |
| `bun run check:installed-workflow` | The installed release/recovery workflow works.                  |
| `bun run check:portable`           | Every stage in the existing portable profile passes.            |

Provider/native checks in `package.json` have additional prerequisites; run the
ones affected by the change. Native fixture setup and live publication are
different operations. Ordinary verification must not send a publication or use
inherited publishing credentials. A dry run does not prove live authentication.

Patched TypeScript owns typechecking, declarations and Effect diagnostics. The
`typescript-api` dependency is a pinned parser API for architecture inspection
only: TypeScript 7 no longer provides that JavaScript compiler API. Installed
Apple fixture transpilation uses Bun's transpiler.
It is not a second diagnostic engine. Installation without lifecycle scripts must
not silently make stock compiler success an acceptable check.

Warnings configured as blocking remain blocking. Fix a finding at its semantic
owner. An unavoidable suppression names a narrow foreign/runtime contract and
its evidence; do not use broad disables, unsafe double assertions, project
exclusions or relaxed declaration checking to obtain a pass.

## Ownership and boundaries

The kernel owns candidate admission, journal interpretation and dispatch permission.
Providers own codecs, exact request construction and corresponding evidence.
Native adapters own resources and transport behavior. Applications choose concrete
providers, credentials, storage and approval. CLI and Action own process execution
and safe presentation. Deterministic identity/history functions remain ordinary
pure functions; request data does not become a service.

Before changing an owner, enumerate every affected service/tag/Layer, constructor,
callback bag, runtime capability, substitute and unsafe data boundary. Record its
contract, construction requirements, production selection, consumers, decoding
owner, resource lifetime, existing proof and keep/merge/remove/relocate decision.
Trace a caller-visible operation to its composition root. Prefer deletion or an
existing owner over a registry, facade, forwarding service or duplicated schema.

Capture stable dependencies when constructing a capability; preserve caller error
and service requirements. Provide concrete layers only where the implementation
choice belongs. Scope belongs to the resource owner, not whichever helper happens
to call `provide`. Compare Effect platform services before adding native I/O.
Retain a native adapter only for a concrete contract such as exact wire bytes,
no implicit resend, process-tree cleanup, conditional writes or fsync semantics.

| Domain                                | Required boundary                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| Portable core entries                 | No host globals, runtime services or optional native peers in their closure.             |
| Native providers and Node/Bun entries | Only declared host types and dependencies; no implied browser portability.               |
| CLI, Action and self-release          | Explicit runtime composition, inert importable definitions, safe process output.         |
| Build/verification tooling            | Host APIs at the executable edge; fully checked code, no publication authority.          |
| Tests and examples                    | Real declared host and dependencies; cross-package use through supported public entries. |

Strict compiler policy includes unchecked indexes, exact optionals, unknown catch
values, implicit overrides, fallthrough checks, verbatim modules and no emit on
error. Each project declares its ambient types. Keep `skipLibCheck: false` for
installed declarations. Import rules apply to type-only dependency direction as
well as runtime edges. Computed loads require a named trusted host boundary.
Public entries must not perform I/O, inspect environment or register resources at
import time. Check absent optional peers from an isolated installed consumer.

### Compiler and import closures

The root project checks tooling and tests with Bun types. Package projects override
that ambient environment; passing only the root project does not prove portability.
All projects retain `skipLibCheck: false`. The regular check runs the two additional
core closure projects after building package declarations.

| Project                                      | Standard libraries and ambient types               | Scope                                                                  |
| -------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| `packages/ts-release/tsconfig.build.json`    | ES2022, Disposable; `bun-types`                    | Full distribution, including the Bun SQLite entry.                     |
| `packages/ts-release/tsconfig.portable.json` | ES2022, DOM, DOM.Iterable, Disposable; `types: []` | Root, bundle, HTTP, effect-build and Git public source closures.       |
| `packages/ts-release/tsconfig.node.json`     | ES2022, Disposable; `node`                         | Node and Apple public entries plus the CLI, without Bun ambient types. |
| Catalog and OpenAI build projects            | ES2022, DOM, DOM.Iterable, Disposable; `types: []` | Portable source with declared package dependencies.                    |
| GitHub, MCP, npm and PyPI build projects     | ES2022, Disposable; `node`                         | Intentionally native provider code; no browser portability promise.    |
| Action and self-release projects             | ES2022, Disposable; `node`                         | Native application composition.                                        |

Node projects include [types/node-compat.d.ts](types/node-compat.d.ts) for one pinned
declaration gap: Effect rc.115's `Channel.d.ts` uses global `TextDecoderOptions`,
whereas `@types/node` 25.9.3 exports that type from `node:util`. The compatibility
interface extends those exact native options; it adds no runtime polyfill and
does not skip dependency checking. Revisit it when upgrading either dependency.
The native npm SDK additionally brings an explicit DOM library reference through
`@types/make-fetch-happen`; its declaration closure is therefore not DOM-free.

`check:import-rules` checks every production source owner, declared dependency,
public workspace subpath, case-correct target and initialization cycle. Type-only
edges still obey ownership direction. With `verbatimModuleSyntax`, inline-only
`import { type T }` and `export { type T }` retain empty runtime imports; use
declaration-level `import type` and `export type` when the edge should erase.
The two computed loads are limited to the trusted Application path and the
Action's application-installed core instance. Its retained import inventory covers
all public entries and records module-evaluation candidates for review; static
analysis does not prove arbitrary external dependencies pure. Installed consumer
checks remain the authority for optional-peer absence and actual package loading.

## Data, failure and lifetime

Use one Schema per logical structured model and derive variants unless their
semantics differ. Prefer `Schema.Class`, tagged classes and tagged errors using
the API available in the pinned Effect version. Construct classes from fields;
use named factories for derived forms and never override their constructors.
Numeric refinements express real domain constraints, including finite/safe values
where required; do not silently change historical candidate admission.

Decode external data at its earliest semantic owner. Keep bounded lexical,
duplicate-key, byte-identity and cryptographic checks that structured decoding
cannot replace. External re-entry and mutable input capture are real boundaries.
Every `unknown`, assertion, predicate or manual shape probe needs an owner;
remove narrowing already guaranteed by the type. No casts across an untrusted
data boundary or broad internal `unknown` error contracts.

Expected failures stay typed; programming defects stay defects. Preserve known
failures using stable tagged contracts where multiple package instances are valid.
Privacy projection at credential/CLI boundaries is deliberate and bounded:
never expose native/provider messages or secret causes to preserve diagnostics.
Interruption remains interruption. Cleanup failure remains observable separately
from remote mutation and visibility, including when the body also fails.

Use `Effect.fn` when an operation benefits from tracing, `fnUntraced` otherwise,
and `Effect.gen` for inline workflows. Suitable zero-argument operations are Effect
values; yield yieldable errors directly. Preserve existing public signatures unless
a compatibility change is explicit. Spans follow caller or committed-operation
ownership, contain safe identities/outcomes, and do not trace each chunk or tick.

Acquire before use and join owned work before disposal. Mask only the necessary
transition or issued non-cancellable native operation; document stuck-native-call
limits. Use Effect clocks for elapsed budgets and recorded wall time for durable
instants. Bound bytes, time and retained work at their owner. Observation retries
never authorize another publication send.

## Selecting proof

Before implementation, name the requested outcomes, cheapest sufficient existing
checks and any concrete proof gaps. Default to existing workflow observation.
New committed automation—including assertions, table rows, fixtures or harnesses—
requires a current uncovered failure or explicit request for that test seam,
plus a justified maintenance cost. More tests or coverage is not a goal.

For necessary isolation, record the relevant failure modes and demonstrate
meaningful failing coverage before the fix. Prefer the strongest real owner
boundary and independent expectations. Do not manufacture retrospective red/green
history or replace an unnecessary unit test with a larger integration suite.
Temporary verification scripts also need a specific question and proportional cost.

Retain only protection for costly failures that escape remaining evidence.
Crash windows, CAS races, no-replay and error/service inference can warrant narrow
checks. Delete type/schema/config mirrors, algorithm copies, incidental internal
ordering and duplicate cases only after checking what protection would remain.
Remove orphaned fixtures with their tests. Existing coverage need not invent
test-first provenance to remain valuable.

Tests have an explicit package or workflow owner. The retained suite currently
lives under `test/reimplementation`; moving files is not proof improvement.
Cross-package scenarios use public entries; owner-private fixtures stay private.
Doubles replace a deliberate external edge and implement exactly the behavior
they claim. Use the real filesystem, journal, process or pinned SDK when that
boundary's semantics are the subject.

Effect-owned timing uses TestClock or an event barrier, not stabilization sleeps.
Propagate runner cancellation into fibers; teardown must work after the runner's
signal has aborted. Real network/process timing is reserved for the native
contract being exercised. Fakes cannot certify live npm/OIDC/Sigstore compatibility.

## Integration and delivery

One integrator owns shared schemas, errors, exports and the combined diff.
Parallel contributors use separate owners or isolated outputs. Serialize builds,
packing and native checks that mutate shared outputs. Select the smallest proof
during development, then run the relevant final profile after its inputs settle.
Do inexpensive static checks before expensive native fixture setup.

For public API changes, qualify actual tarballs from isolated consumers without
workspace fallback: exports, dependency/optional-peer closure, exported declaration
names and strict type inference. Compile affected maintained examples/templates
against installed declarations, or explicitly retire unsupported examples.
Check claimed Node/Bun runtimes; one local runtime does not certify an engine range.

Record source revision and retained dirty patch identity, commands, prerequisites,
raw exits, expected/observed outcomes and useful failure evidence. State unrun
checks and platform limits. Skipped stages cannot become a full-profile pass;
cached task output cannot establish an external side effect. Reuse existing
receipts and acceptance artifacts rather than adding another reporting system.

PRs explain the concrete before/after behavior, affected authority, compatibility
and actual proof. Keep product guides concise; API contracts belong beside code.
Research inventories and temporary plans are task evidence, not shipped runtime
inputs. Dependency changes need importer declarations, licensing/notices and
installed closure proof. Publication promotes exact qualified bytes under separate
authorization; preparation and acceptance never grant that permission.
