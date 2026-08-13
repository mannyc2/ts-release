# Architecture

The release engine has five canonical forms:

```text
authored intent
      ↓ observe and resolve
verified context
      ↓ compile and stage
ephemeral graph
      ↓ execute and capture
prepared release bytes
      ↓ observe destinations
publication status or correction proposal
```

Authored intent is human configuration. Verified context binds it to a clean
source tree, package manifest, commit, tree, and repository facts. Preparation
materializes that exact commit rather than executing against ambient workspace
bytes. The graph is a derived in-process execution form: it is recomputable,
not transported authority. A complete `prepared-release/v2` manifest plus
content-addressed blobs is the durable cross-process boundary. Applications
carry only a content-addressed prepared reference; its host store owns path or
artifact resolution and provenance verification. Destination observation is
the authority for publication progress.

## Ownership

- `src/resolve` decodes authored intent and resolves observed facts.
- `src/release` compiles the graph, executes native preparation, and stores or
  inspects the prepared release.
- `src/publication` owns the provider-neutral fact/decision/attempt/report
  coordinator and provider subjects.
- `src/correction` binds provider-specific correction requests to exact
  prepared subjects; catalog Git installs the sole conditional correction writer.
- `src/api` exposes the public lifecycle used by CLI, Action, and library users.
- `src/platform` supplies Node or Bun filesystem, process, HTTP, durable-store,
  and opaque credential sinks at the host boundary.
- `apps/release-ts` owns CLI parsing and file I/O.
- `apps/ts-release-action` owns three contained Action commands and reports.
- `apps/ts-release-agents` owns the single tracked agent projection source.

## Preparation

The compiler lowers useful local work to `CommandCheck` and
`CommandArtifact`. Checks validate an existing declared input. Artifacts
generate or transform declared regular files; their bytes are hashed into the
prepared release. `builder: "command"` is authoring sugar for the same artifact
primitive. Graph dependencies use declared artifact references, so independent
node order is not a user contract.

Commands are trusted local argv code with no authored host environment values;
the runtime rejects every nonempty `environmentNames` request before starting
a subprocess and may retain only `PATH` to locate the argv executable. They are
not a sandbox, plugin runtime, lifecycle hook system, or remote-effect escape
hatch. Staging materializes the verified commit into a fresh private root,
rejects input mutation, verifies source identity after each command, and
captures only declared regular-file outputs. Partition and merge are reserved
input tags that fail with `PreparationModeUnsupported`; no partial object is
durably committed.

## Publication and correction

Each destination subject is observed before mutation and again afterward.
Equivalent content is skipped; mutation requires a typed provider decision;
conflicts and inconclusive results stop; and an unknown response is resolved
only by a later exact observation. The coordinator therefore tolerates reruns
and lost responses without claiming exactly-once behavior or atomic rollback.

PyPI adds a stricter history boundary because a filename is permanently
consumed and an upload is unsafe to replay after response loss. Every PyPI
token subject is an exact file and must atomically acquire a terminal claim
from a durable store shared by all runners before mutation authority is read.
The stock CLI and Action install no pretend runner-local substitute and fail
closed; external hosts can supply the claim store through the Node, Bun, or
custom host layer constructors. Trusted publishing remains owned by the
official external PyPA Action rather than an undocumented in-process OIDC
exchange.

Corrections are separate typed intents. npm deprecation and GitHub release
amendment requests are bound to exact prepared subjects and produce canonical
external proposals because neither provider exposes a proved conditional
write for the observed generation. Catalog Git installs one
`forward-catalog-state` adapter: a SemVer-newer replacement deterministically
renders new consumer bytes and a corrected state record, then conditionally
updates both against the exact old pair and observed branch commit.

## Hosts and targets

Execution hosts, artifact targets, and native-tool hosts are independent axes.
Linux is the only installed execution host. The Bun builder cross-compiles the
advertised Linux and macOS x64/arm64 artifacts, but a target triple is not
execution-host evidence. The self-release does not distribute a Windows
ts-release binary. WSL is treated as Linux. Preparation and network-denied
commands require the external Bun executable and `libseccomp.so.2`; even a
standalone CLI binary is not a self-contained substitute for those native tools.

## Host automation

The CLI and Action call the same public operations. The automatic workflow
persists and reload-verifies the complete prepared release before the
coordinator can acquire mutation authority. A host environment can gate that
publication job, but identity and consent remain host records rather than
release-engine data. The Action's redacted report is a workflow artifact; the
prepared bundle continues to use the dedicated content-addressed Action store.

External library integrations use the supported `store` structural contract
and the `host` layer constructor. The constructor installs custom source/run,
prepared-store, credential-acquisition, HTTP-authorization, and optional
shared publication-claim values behind
the engine's private service tags. Credential values remain host-owned; the
public seam carries only prepared requests, opaque grants, safe references,
typed acquisition failures, and authorized HTTP results.

## Extension translation

The kernel admits extensions only through an owner with a narrow invariant:

- tests and policy gates become `CommandCheck` nodes;
- generated notes, manifests, and agent bundles become declared
  `CommandArtifact` bytes;
- npm, prebuilt PyPI, GitHub Release, and catalog Git reads/writes remain provider-module operations;
- environment protection and human authorization remain workflow-host state;
- announcements remain downstream workflow steps after a complete report.

Homebrew and Scoop are typed render modules feeding one exact catalog Git
provider module. Custom applications may install full provider subjects through
the library-only SDK; the stock CLI and Action do not discover them from
configuration. Arbitrary catalog templates are not generic hook behavior hidden inside the kernel. Wrapper-wheel generation
is not part of the installed prebuilt PyPI capability.
