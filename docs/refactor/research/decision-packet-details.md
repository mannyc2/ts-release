# Decision packet: provider details, Effect, strategy, and contradictions

Status: continuation of [decision-packet.md](./decision-packet.md). It is part of the same research document and has the same guardrails.

## 5. Provider-specific conclusions

### npmjs

Pinned source proves one package PUT contains version, tarball, and initial tag. The success response is not a rich echo of package facts.

Current recommendation:

```text
one NpmPublishIntent for initial PUT
separate later NpmDistTagIntent
```

### Warehouse

One file per request. HTTP 200 body contains warnings, not file ID/digest/URL. File identity remains Intent and later observation. Yank is a separate mutable fact.

### GitHub

Tag/ref, release resource, and assets are separate provider facts. Asset release ID is late-bound from parent success. Returned asset ID/name/state/size/digest are receipt facts.

### Homebrew/Scoop

Renderer correctness, one conditional Git ref update, public path/ref visibility, byte/hash identity, and clean install are separate outcomes. One ref update can publish several paths without per-path provider partial success.

See [provider-contracts.md](./provider-contracts.md).

## 6. GoReleaser comparison authority

Current structure:

1. [complete evidence census](./goreleaser-evidence-census.md);
2. [material evidence groups](./goreleaser-material-evidence.md);
3. [derived outcome roadmap](./goreleaser-outcomes.md).

This eliminates competing dispositions:

- census preserves cases and per-project columns;
- material groups own current evidence grade;
- roadmap owns product disposition;
- provider docs own protocol facts;
- fixed maintainer scope owns shipping commitments.

Every case maps to one evidence group. An `INDEX` cell does not become demonstrated support.

## 7. Effect target and pattern recommendation

### Target

Published rc.109 is recommended with moderate confidence. It is inside effect-build's peer range, passes the corrected combined gates, and current upstream still reports rc.109. rc.108 has no demonstrated advantage.

This recommendation remains provisional until a behavior-preserving ts-release migration passes the full gate.

### Architecture

Closest analogy:

- Effect SQL for common core plus backend-specific extensions;
- Effect Platform for app-supplied implementation Layers;
- Effect AI for normalization tradeoffs;
- effect-build for one lawful common operation.

No analogy supports one universal release `Publisher`.

See [effect-patterns.md](./effect-patterns.md).

## 8. Implementation strategy

### Alternatives

| Strategy | Main failure mode |
| --- | --- |
| full model-first | wire-blind internal certification |
| provider-first ad hoc | inconsistent bundle/journal laws |
| workflow-engine first | engine identity/retry substitutes for provider correctness |
| hybrid wire-complete slices | planned early refactoring |

### Recommendation

Use hybrid slices:

```text
minimal bundle/plan/history
npm
Warehouse
generalization checkpoint
GitHub
conditional Git + Homebrew + Scoop
custom provider fresh-runner
durable concurrency
self-release
```

Shipping scope remains complete; only implementation order is sequential.

See [implementation-strategy.md](./implementation-strategy.md).

## 9. Acceptance model

Every evidence record names:

```text
outcome
environment
subject
result
limitations
```

Outcomes:

```text
structural law
local runtime
extension
provider acceptance
metadata
bytes
consumer behavior
continuation
self-release
```

Environments:

```text
compile
in-process
clean-consumer
protocol-double
scratch-provider
public-provider
end-user
self-release
```

The decisive gate is a non-manual ts-release self-release with one intentionally interrupted coordinate and clean consumer execution.

## 10. Probe limits

### Artifact probes

Prove local type/runtime counterexamples, copied byte ownership, duplicate rejection, and typed load failures. They do not prove durable CAS, process loss, remote stores, or the production handle API.

### Effect baseline probes

Prove a small surface compiles. They do not prove Activity persistence, retry, or provider safety.

### Alignment harness

Proves dependency/install/test boundaries up to ts-release typecheck. It does not rank runtime semantics or complete migration cost.

### Clean custom-provider probe

Proves dynamic import of a consumer module that supplied and closed its Layer. It does not prove persisted definition resolution or fresh-runner continuation.

### Standalone executable probe

Informational failure. It does not load the consumer-installed unknown provider.

### No new probe in this pass

The current questions were answerable from pinned source and counterexample analysis. The next focused probe should be two-process custom-provider definition resolution without live mutation.

## 11. Unresolved contradictions

1. **Automatic resumability versus weak providers:** arbitrary providers may lack observation and replay safety. The honest product promise must allow `Inconclusive`.
2. **Complete planning versus response-bound coordinates:** GitHub assets need parent references and later release-ID binding.
3. **Composite request versus canonical Intent granularity:** npm initial publish co-establishes version/tag facts, but reporting wants independent facets.
4. **Load-time fail-fast versus remote scalability:** eager hashing every object conflicts with trusted CAS and large remote bundles.
5. **Local zero-infrastructure versus fresh-runner durability:** local files are simple but do not survive arbitrary runner replacement without a durable volume.
6. **Published rc.109 versus unstable source drift:** exact package pinning helps, but Workflow APIs can still change in later releases.
7. **Open provider model versus resolver mechanics:** a resolver is required for persisted type erasure but must not become admission/certification.
8. **Provider-native errors versus coherent CLI:** reporting needs projections without replacing durable native facts.
9. **Adjacent build capabilities versus complete product ambition:** archives/checksums are needed, but do not belong in the provider journal kernel.

## 12. Primary source index

### Effect

- [current Effect pin](https://github.com/Effect-TS/effect/tree/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6)
- [LanguageModel](https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/effect/src/unstable/ai/LanguageModel.ts)
- [AiError](https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/effect/src/unstable/ai/AiError.ts)
- [SqlClient](https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/effect/src/unstable/sql/SqlClient.ts)
- [PgClient](https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/sql/pg/src/PgClient.ts)
- [Activity](https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/effect/src/unstable/workflow/Activity.ts)
- [WorkflowEngine](https://github.com/Effect-TS/effect/blob/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/effect/src/unstable/workflow/WorkflowEngine.ts)

### Provider wires

- [npm libnpmpublish](https://github.com/npm/cli/blob/51c2bf81fa2c31547d0fec44fff2aaac3d9a9862/workspaces/libnpmpublish/lib/publish.js)
- [npm publish command](https://github.com/npm/cli/blob/51c2bf81fa2c31547d0fec44fff2aaac3d9a9862/lib/commands/publish.js)
- [Warehouse legacy upload](https://github.com/pypi/warehouse/blob/4bdd89d85bc522a0d555a871ffe250d644c660dc/warehouse/forklift/legacy.py)
- [GitHub REST description](https://github.com/github/rest-api-description/tree/67c14c7efb01cdeeac0ecd8cee9fae8d7a80e2aa)
- [Homebrew Formula Cookbook](https://github.com/Homebrew/brew/blob/78dc68a15f167a973207437a4454381641a2f82f/docs/Formula-Cookbook.md)
- [Scoop source](https://github.com/ScoopInstaller/Scoop/tree/b588a06e41d920d2123ec70aee682bae14935939)

### Durable execution

- [Effect Workflow source](https://github.com/Effect-TS/effect/tree/397bf1ebd95c0d6d58dc53e4f33c8ad3f34746f6/packages/effect/src/unstable/workflow)
- [Temporal Activity idempotency](https://github.com/temporalio/documentation/blob/7f42b11f9ea68c1b463527fc1c13150a61c5cd16/docs/encyclopedia/activities/activity-definition.mdx)
- [Temporal Activity operations](https://github.com/temporalio/documentation/blob/7f42b11f9ea68c1b463527fc1c13150a61c5cd16/docs/encyclopedia/activities/activity-operations.mdx)

### Build and product comparison

- [effect-build granular branch](https://github.com/mannyc2/effect-build/tree/15c811bb9904142a33d119766b62082f3c689f13)
- [GoReleaser current pin](https://github.com/goreleaser/goreleaser/tree/92453c1dbdf592d227cb236600093a503f2351f3)
- [material evidence groups](./goreleaser-material-evidence.md)

## 13. Recommendation for maintainer discussion

Approve these research directions, not production APIs:

- minimal content bundle kernel;
- canonical plan Intents;
- versioned provider definitions with optional capabilities;
- one physical-dispatch event;
- three explicit replay authorities;
- provider-native receipts/observations;
- hybrid wire-complete implementation order;
- published rc.109 migration target pending full gate;
- complete fixed shipping scope; and
- self-release as decisive evidence.

Keep the contradictions in section 11 open until focused design review or external evidence resolves them.
