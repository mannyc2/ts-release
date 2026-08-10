# Agent distribution

Agent guidance has one tracked source owner: [`apps/ts-release-agents`](../apps/ts-release-agents/).
It describes the current automatic release API and the safe prepared-bundle
boundary; it does not recreate the retired review or run protocol.

Run the executable distribution checks with:

```sh
bun run check:agents
```

The generator reads the root package version and writes only ignored build
output under `.release/agents/`. It produces provider-native Codex and Claude
package layouts plus deterministic ZIP archives. The generated manifests,
skills, references, and eval cases are the release artifacts; the repository
does not maintain a second root marketplace tree or a provider-specific source
copy.

The check typechecks the app, builds twice, compares archive bytes, validates
the generated manifests and safety constraints, and invokes the Claude
validator when that host tool is available. A release preparation declares this
generator as an ordinary `CommandArtifact` and captures every generated file
and archive in the prepared bundle.

Distribution publication remains an explicit release-destination decision. No
agent marketplace publication is implied by this repository-local build.
