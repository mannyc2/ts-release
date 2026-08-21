# Effect-first product and API examples

Status: executable-design sketches derived from the atomic outcomes in
[`launch-scorecard.md`](launch-scorecard.md). Names are placeholders. These
examples constrain product behavior and composition; they do not freeze a
production TypeScript surface.

## Root expression under comparison

Three root shapes remain materially different:

| Shape | Strength | Failure |
| --- | --- | --- |
| executable Effect only | ordinary Effect composition and no DSL | a fresh runner cannot reconstruct lost closures from durable history |
| fully serialized release DSL | easy persistence and remote execution | tends to recreate Effect badly and close extension through a command union |
| Effect-authored durable plan plus ordinary services | ordinary composition at authoring/runtime boundaries; versioned Intents at the durable boundary | requires a deliberate plan/Intent codec and application resolver |

The third shape remains the recommended direction. The application is ordinary
Effect code. Planning produces data. Dispatch occurs only after the plan and
its initial journal facts are durable and execution is explicitly approved.

Conceptually:

```ts
const application = Effect.gen(function*() {
  const bundle = yield* artifacts.finalize()

  return yield* Release.plan({
    bundle,
    operations: [
      Npm.publish({ package: bundle.ref("cli.tgz"), tag: "latest" }),
      GitHub.asset({ artifact: bundle.ref("cli-linux-x64.tar.gz") })
    ]
  })
})

const program = application.pipe(
  Effect.flatMap(Release.execute),
  Effect.provide(ApplicationLayers)
)
```

`Release.plan` above means "validate and encode versioned provider Intents";
it does not dispatch. The CLI/runtime owns execution approval. No Promise
facade is planned.

## Durable versus live values

```text
durable plan
  plan ID
  finalized bundle identity
  provider-definition ID
  Intent codec version
  canonical encoded Intent

live application
  provider definition resolver
  configured clients and credentials
  concrete Layers
  optional prepare/observe/correct operations
```

Operation identity is core-derived from provider-definition ID, Intent codec
version, and canonical Intent bytes. `planId` forms the owning operation key;
it is not copied into the provider-local operation hash.

## 1. Adopt prebuilt artifacts

User outcome: finalized files from any build system participate without a
"prebuilt mode".

```ts
const bundle = yield* ArtifactBundle.fromFiles([
  Artifact.file({ id: "linux-x64", publicName: "tool-linux-x64", path: linux }),
  Artifact.file({ id: "darwin-arm64", publicName: "tool-darwin-arm64", path: mac })
])
```

Adoption copies bytes into immutable ownership, derives content identity, and
returns logical references. Providers receive public names and bytes, never a
private storage path. If this needs a `prebuilt: true` flag, the artifact model
has failed.

The root construction spelling remains open among direct immutable
construction, persistent immutable drafts, and a runtime-closed mutable draft.
TypeScript cannot prove one-shot consumption of an aliased mutable object, so
the API must not claim that guarantee.

## 2. Build with effect-build, then publish

User outcome: concrete producers return finalized outputs that ts-release
adopts; neither repository owns a universal builder.

```ts
const release = Effect.gen(function*() {
  const targets = yield* BunExecutable.buildMatrix({
    entry: "src/cli.ts",
    targets: BunExecutable.pinnedTargets
  })

  const archives = yield* Archive.forEach(targets, { formats: ["zip", "tar.gz"] })
  const bundle = yield* ArtifactBundle.adopt([...targets, ...archives])

  return yield* Release.plan({
    bundle,
    operations: GitHub.assets(bundle.refs(archives))
  })
}).pipe(Effect.provide(EffectBuildLayers))
```

Concrete effects may use scoped temporary directories and processes. Only
finalized caller-selected outputs cross the handoff. Their digests become the
canonical facts used by checksums, catalog renderers, reports, and providers.

## 3. Publish multiple npm and Python coordinates

Multiplicity is data, not a feature switch.

```ts
const operations = [
  ...publicWorkspacePackages.map((pkg) =>
    Npm.publish({ tarball: bundle.ref(pkg.artifactId), name: pkg.name, tag: pkg.tag })
  ),
  ...pythonDistributions.map((dist) =>
    Warehouse.upload({ file: bundle.ref(dist.artifactId), project: dist.project })
  )
]
```

There is no singular `npmPackage`, `multiPackage`, or `multiArtifact` mode.
Private workspaces are structurally omitted from the operation set. Warehouse
progress is per file; a release can retain successful wheels while another
wheel remains unresolved.

The CLI report projects each operation's acceptance, metadata, byte, consumer,
and continuation evidence independently:

```text
@acme/core@2.0.0       accepted   registry observed   install passed
@acme/cli@2.0.0        accepted   registry observed   bin passed
acme-2.0.0.tar.gz       accepted   hash observed       install passed
acme-2.0.0-py3.whl      pending    no blind retry      action required
```

## 4. GitHub assets followed by Homebrew and Scoop

Catalog inputs are views of the finalized release, not copied artifact facts.

```ts
const assets = GitHub.assets(bundle.refs(portableArchives))

const operations = [
  GitHub.createDraft(releaseMetadata),
  ...assets,
  GitHub.publish({ after: assets }),
  Homebrew.publishFormula({
    release: GitHub.publicCoordinates(assets),
    expectedRef: tapBase
  }),
  Scoop.publishManifest({
    release: GitHub.publicCoordinates(assets),
    expectedRef: bucketBase
  })
]
```

The formula and manifest render from canonical public names/digests. Their Git
updates use expected-old/desired-new compare-and-swap. One or many managed
paths are the same operation shape; no `multiDestination` mode appears.

## 5. Two instances of one provider

Provider type does not imply one global service instance. The destination
coordinate and non-secret authorization identity belong in each Intent;
credentials are reacquired through operation-local Layers.

```ts
const operations = [
  Acme.publish({ endpoint: staging, account: "staging", artifact }),
  Acme.publish({ endpoint: production, account: "production", artifact })
]

const clients = Acme.clients({
  staging: Acme.layer(stagingConfig),
  production: Acme.layer(productionConfig)
})
```

The exact Layer spelling is open. The law is not: each prepared request must
be bound to the intended endpoint/account, and a global mutable service lookup
must not collapse the two operations.

## 6. Import a provider unknown to core and CLI

The release application owns its provider set:

```ts
import * as Release from "ts-release"
import * as Acme from "@acme/ts-release-provider"

const definitions = Release.Definitions.from(Acme.definition)
const layers = Layer.mergeAll(Acme.layer(config), Journal.layer, Git.layer)

export default Release.application({ definitions, layers, makePlan })
```

The provider package supplies a service-free, versioned bidirectional Intent
codec and concrete Layers. Optional operations remain provider-local:

```text
prepare without send
observe
correct
opaque Effect dispatch
native receipt/observation/error codecs
```

Core derives identity and folds history. It does not admit the provider through
an allowlist, package-name registry, or universal `Publisher`. A sealed
standalone executable that cannot resolve arbitrary installed ESM packages is
a packaging limitation, not a reason to seal the provider model.

## 7. Continue on a clean runner

Runner B receives only the immutable bundle, durable plan, journal, release
application, and newly acquired credentials.

```ts
const result = Release.continue({ plan, journal }).pipe(
  Effect.provide(FreshRunnerLayers)
)
```

For each operation, core derives one of these actions from canonical history
and current evidence:

```text
send initial request
do not send; already succeeded
observe ambiguous completion
retry only under recorded and trusted protection
stop Pending or Inconclusive
request a scoped RiskAccepted event
```

A provider implementation is not called at resume time to invent historical
replay safety. Frozen dispatch facts establish what was sent and what
protection it carried. A fresh observation establishes what the provider says
now. Those facts are recorded separately.

## 8. Produce an OpenAI plugin release handoff

The AI-native path is an artifact and conditional-Git composition, followed by
a pure submission validator:

```ts
const plugin = yield* OpenAiPlugin.build({ manifest, skills })
const marketplace = OpenAiPlugin.marketplaceEntry(plugin)
const submission = yield* OpenAiPlugin.validateSubmission({
  plugin,
  marketplace,
  listingAssets,
  starterPrompts,
  positiveTests,
  negativeTests,
  releaseNotes,
  attestations
})
```

Repository marketplace publication can be an ordinary conditional Git
operation. The public portal handoff ends with a validated directory and
report. A human review is not represented as an Effect provider receipt.

## CLI experience

The CLI should expose the product state, not internal certification machinery:

```text
Plan 9dd...  bundle 74a...

READY       12 operations
SUCCEEDED    8 operations
PENDING      2 operations (provider observation scheduled)
INCONCLUSIVE 1 operation  (GitHub asset response lost; absence is not a fence)
ACTION       1 operation  (risk acceptance or operator reconciliation required)

Artifacts: 18 finalized, 18 content-addressed, 0 mutable
Public: npm 3/3, PyPI 3/4, GitHub assets 3/3, Formula 1/1, Scoop 1/1
```

The report is machine-readable and the human rendering is a view. No second
status table becomes an authority.

## API review questions

Before production names are selected, every proposed abstraction must answer:

1. Which scorecard leaves require it?
2. What implementations are substitutable under the same laws?
3. What canonical fact does it own rather than mirror?
4. Which invalid state becomes unrepresentable?
5. Which external oracle terminates its claim?
6. Does plurality fall out from ordinary collections?
7. Can a clean fresh runner interpret its durable data without old closures?
8. Can a custom provider participate without core modification?
