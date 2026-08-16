# Maintainer decision packet

Status: research-only checkpoint. These are the remaining choices. The
recommendations do not select a root production API and must not be implemented
until maintainers choose among the lawful alternatives.

## Decision 1: artifact construction kernel

**Law:** trusted bundles own immutable bytes, derive/check content identity,
reject duplicate logical IDs, use private construction, and return typed load
failures.

**Lawful alternatives:**

1. direct immutable `Bundle.build(allInputs)`;
2. persistent immutable `Draft.add -> Draft` plus deterministic finalization;
3. runtime-closed mutable draft whose aliases share one atomic Open/Finalized
   state.

**Counterexample:** returning a `Bundle` type without `add` while a retained
mutable draft alias can continue changing the same internal maps.

**Recommendation:** start with direct immutable build if all first-cut builders
can enumerate outputs; otherwise use a persistent immutable draft. Do not use a
mutable draft until the alias-closing and crash laws have their own probe.

## Decision 2: durable reference qualification

**Law:** an independently used reference cannot resolve against the wrong
bundle.

**Lawful alternatives:**

1. globally qualified `{ bundleId, artifactId }` durable references; or
2. relative artifact IDs allowed only inside one decoded bundle envelope and
   immediately resolved into privately constructed bundle-bound handles.

**Counterexample:** a plain relative ID copied out of an envelope and later
resolved against whichever Bundle happens to be supplied.

**Recommendation:** use globally qualified refs for independently persisted
provider/run records; consider relative IDs only inside one versioned bundle
format whose load boundary creates bundle-bound values.

## Decision 3: canonical bundle identity

**Law:** bundle identity is deterministic across hosts, changes with every
identity-relevant manifest/content change, and is versioned/domain separated.

**Lawful alternatives:**

- a specified canonical binary encoding;
- a specified canonical JSON-like encoding with exact ordering/number/string
  rules; or
- a Merkle-style manifest whose node encodings and domains are versioned.

**Counterexample:** locale-dependent sorting plus ad hoc `JSON.stringify` and
one undifferentiated `sha256-...` namespace.

**Recommendation:** select and version the simplest canonical encoding before a
persistent bundle is shipped. The current owned-bundle probe is not that
specification.

## Decision 4: resumability promise and progress granularity

**Law:** the documented promise matches the actual durable boundary.

**Lawful alternatives:**

1. no persisted resume;
2. finalized-bundle reuse, with interrupted incomplete builds restarting;
3. per-artifact/build-node journal satisfying "never rebuild completed
   artifacts."

**Counterexample:** promising no rebuild while persisting nothing until artifact
N of M and the final bundle are complete.

**Recommendation:** either fund per-artifact release progress or narrow the
first-cut promise to finalized-bundle reuse. effect-build may produce/cache
artifacts but should not own release-run/provider progress.

## Decision 5: publication write-ahead state

**Law:** durable `Dispatching` is recorded before a request is sent, and an
abandoned `Dispatching` reconciles before repeat dispatch.

**Lawful alternatives:**

- explicit ts-release journal;
- a persistent Workflow/Activity engine with provider recovery Activities;
- a generic durable-run library satisfying the same state law; or
- CI-backed storage that still records the explicit state machine.

**Counterexample:** persisting only `Planned`, dying after provider commit, and
blindly repeating because local state says no dispatch happened.

**Recommendation:** require the write-ahead law independently of mechanism.
Never claim exactly-once at npm/PyPI/GitHub/Git without provider support.

## Decision 6: durable execution mechanism in the first cut

**Law:** the selected mechanism survives the failures and retention window the
product promises, with versioned operation identity and honest unknown states.

**Lawful alternatives:**

1. explicit release journal;
2. Effect Cluster WorkflowEngine with an operated persistent stack;
3. an external durable system such as Temporal or Step Functions; or
4. defer fine-grained durability and ship the narrower bundle-only promise.

**Counterexample:** citing an in-memory WorkflowEngine or a happy-path Activity
replay as process-loss durability.

**Recommendation:** do not begin Workflow/Activity implementation in this PR.
Choose the product promise and operational ownership first; then run the
provider-commit-before-exit fault test against the chosen mechanism.

## Decision 7: aligned Effect version

**Law:** ts-release, platform packages, effect-build, and clean consumers install
and compile against one exact, commit-pinned family; semantic source deltas are
accepted explicitly.

**Lawful alternatives:**

- align on rc.108;
- align on the current pinned rc.109 source/package family; or
- choose a later exact version after repeating the same source and combined-set
  checks.

Remaining on beta.83 while adding effect-build is not lawful because
effect-build's peer lower bound is beta.104.

**Counterexample:** selecting rc.108 only because it is effect-build's
`devDependency`, despite its broader peer range and without testing the combined
set.

**Recommendation:** no version yet. Compare required and informational combined
candidate results, then select the newest candidate whose complete agreed gate
passes without unacceptable semantic deltas.

## Decision 8: provider extension and CLI packaging

**Law:** an independently authored provider can participate at the library level
without modifying core or joining an allowlist. CLI distribution claims match
its actual loader.

**Lawful alternatives:**

1. dynamic Node/TypeScript CLI importing consumer modules;
2. user-built custom entrypoint that statically bundles chosen providers; or
3. a prebuilt executable with a separately specified runtime loader, trust,
   resolution, and reporting contract.

**Counterexample:** a standalone probe computes `loadedUnknownProvider` but the
check passes merely because documentation contains the word "standalone."

**Recommendation:** accept the clean Node module/closed-Layer proof only at its
narrow boundary. Keep the standalone result informational until an explicit
loader outcome is required and asserted.

## Decision 9: provider operation vocabulary

**Law:** each provider exposes coordinates, receipts, conflict, partial-success,
and recovery observations that match its protocol.

**Lawful alternatives:**

- provider-local functions/modules;
- concrete provider services for shared client/config resources; or
- narrower shared services only where at least two implementations satisfy one
  caller-visible operation law.

**Counterexample:** `Publisher.publish(unknown) -> unknown` for npm, PyPI,
GitHub, Git catalogs, and S3.

**Recommendation:** no universal Publisher, `ensurePublished`, or required
`verify` member. Return normal documented success and reconcile only ambiguous
requests.

## Decision 10: public observation and consumer acceptance

**Law:** provider acceptance, fresh public metadata, intended public byte
identity, and clean consumer installation/execution are separate outcomes.

**Lawful alternatives:**

- stop at provider receipt;
- add provider-specific fresh observation;
- add public byte/delivery checks; and/or
- add explicitly supported clean consumer environments.

**Counterexample:** marking a Winget PR created, GitHub asset uploaded, or npm
version visible as "consumer verified."

**Recommendation:** restore provider publication first. Add consumer acceptance
only for named support promises and keep HistoricalReceipt and FreshObservation
separate in data and CLI.

## Decision 11: Homebrew/Scoop host coupling

**Law:** formula/manifest rendering and consumer semantics do not require GitHub;
Git publication uses a conditional ref protocol that can have multiple hosts.

**Lawful alternatives:**

- generic Git transport with host-specific implementations;
- GitHub Git-data implementation plus at least one non-GitHub implementation
  under the same law; or
- explicitly document GitHub-only scope as a product narrowing.

**Counterexample:** treating GitHub release subjects and GitHub Git-data APIs as
Homebrew or Scoop domain identity.

**Recommendation:** restore generic Git-backed catalog outcomes; allow returned
GitHub asset URLs to be ordinary inputs, not mandatory provider coupling.

## Decision 12: artifact handoff as a generic library

**Law:** a generic package excludes release providers/coordinates and has at
least two credible users under the same ownership, identity, load, and failure
laws.

**Lawful alternatives:**

- keep the artifact kernel internal until stable;
- publish a generic bundle/handoff package after a second adopter; or
- contribute only build-specific handoff improvements to effect-build.

**Counterexample:** extracting release-specific manifests and calling them a
universal artifact library without another user.

**Recommendation:** implement internally first after the format decision. Split
only when the public law and a second use case are concrete.

## Decision 13: effect-build integration boundary

**Law:** effect-build remains a build/executable package; ts-release owns release
identity, durable progress, publication, and provider receipts.

**Lawful alternatives:**

- consume effect-build's public compiler services/artifacts directly;
- adapt its outputs once into the selected bundle kernel; or
- upstream a genuinely generic finalized-file handoff law.

**Counterexample:** adding registries, release recovery, tags, or provider
publication to effect-build because ts-release needs them.

**Recommendation:** adapt public build results into release-owned artifacts.
Prove caller-level compiler substitution separately before depending on a
single shared compiler service abstraction.

## Decision 14: acceptance tiers for the rewrite

**Law:** each claim is backed by the tier it names.

Recommended tier order:

1. source and compile proof;
2. deterministic disposable protocol contract test;
3. clean packed library/CLI consumer;
4. approved scratch live provider mutation and response-loss injection;
5. fresh public-byte observation; and
6. clean package-manager installation/import/execution on supported platforms.

**Counterexample:** a passing internal assertion or source search marked as a
live consumer outcome.

**Recommendation:** the first production rewrite checkpoint should require
provider contract tests and clean packed consumers. Live scratch and consumer
install tiers should be provider-specific gates before claiming those outcomes,
not one universal verification stage.

## Decisions intentionally not made

This packet does not choose:

- a root `ReleaseDefinition` type;
- a public Bundle constructor or reference syntax;
- Workflow/Activity;
- an Effect version;
- a stock dynamic provider loader;
- a universal provider interface; or
- automatic consumer verification.

Production implementation remains paused until the remote research checkpoint
and its checks are reviewed.
