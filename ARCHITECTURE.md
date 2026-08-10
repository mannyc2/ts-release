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
publication or provider correction
```

Authored intent is human configuration. Verified context binds it to a clean
source tree, package manifest, commit, and repository facts. The graph is a
derived in-process execution plan: it is recomputable, not transported
authority. A `prepared-release/v1` manifest plus content-addressed blobs is the
durable cross-process boundary. Destination observation is the authority for
publication progress.

## Ownership

- `src/resolve` decodes authored intent and resolves observed facts.
- `src/release` compiles the graph, executes native preparation, and stores or
  inspects the prepared release.
- `src/publication` implements typed subject observation, mutation, and
  re-observation for npm, GitHub, and the retained catalog transport.
- `src/correction` implements provider-specific forward correction intents.
- `src/api` exposes the public lifecycle used by CLI, Action, and library users.
- `src/platform` supplies Node or Bun filesystem, process, HTTP, and catalog
  services at the host boundary.
- `apps/release-ts` owns CLI parsing and file I/O.
- `apps/ts-release-action` owns four contained Action commands and reports.
- `apps/ts-release-agents` owns the single tracked agent projection source.

## Preparation

The compiler lowers useful local work to `CommandCheck` and
`CommandArtifact`. Checks validate an existing declared input. Artifacts
generate or transform declared regular files; their bytes are hashed into the
prepared release. `builder: "command"` is authoring sugar for the same artifact
primitive. Graph dependencies use declared artifact references, so independent
node order is not a user contract.

Commands are trusted local argv code with a closed declared environment. They
are not a sandbox, plugin runtime, lifecycle hook system, or remote-effect
escape hatch. Staging copies the source, rejects input mutation, re-observes
source identity after each command, and captures only declared regular-file
outputs.

## Publication and correction

Each destination subject is observed before mutation and again afterward.
Equivalent content is skipped, authoritative absence can mutate, conflicts
and inconclusive results stop, and an unknown response is resolved only by a
later exact observation. The coordinator therefore tolerates reruns and lost
responses without claiming exactly-once behavior or atomic rollback.

Corrections are separate typed intents. npm deprecation and managed catalog
state have provider-specific forward paths. GitHub release correction and
arbitrary PyPI file yank are explicit unsupported outcomes because their
observation and safe remediation contracts are not retained.

## Hosts and targets

ts-release runs on Linux and macOS. The Bun builder can produce Linux, macOS,
and Windows artifact targets recorded in the capability inventory. A target
triple is not evidence that ts-release itself runs on that operating system.
Native-tool hosts are listed only when a vertical test proves the host-only
tool path.

## Host automation

The CLI and Action call the same public operations. The automatic workflow
persists the complete prepared release before the publication job receives
credentials. A host environment can gate that publication job, but identity
and consent remain host records rather than release-engine data.
