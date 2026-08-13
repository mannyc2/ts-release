# Native preparation

Preparation is the local extension boundary. It has no generic lifecycle
hooks and no second command executor.

The installed execution host is Linux. Native preparation requires an external
Bun executable and `libseccomp.so.2`; the standalone CLI still uses them for
network-denied commands and is not a self-contained sandbox. Each generic
command runs under a fail-closed libseccomp syscall filter, and the exact helper,
Bun, loaded library, kernel, architecture, and denied syscall set enter prepared
provenance. An npm package can additionally declare one explicit build command
and absent output roots that are validated before offline `npm pack`.

`CommandCheck` validates declared inputs and returns pass/fail. A successful
check does not create durable evidence. `CommandArtifact` writes one or more declared
regular files; those bytes are captured, hashed, and available to later graph
nodes. `builder: "command"` uses the same lowering for a target-specific
artifact.

```json
{
  "project": { "repository": "owner/fixture" },
  "versionFrom": "manifest",
  "preparations": [
    {
      "kind": "check",
      "id": "release-notes-check",
      "run": ["bun", "run", "scripts/check-notes.ts"]
    },
    {
      "kind": "artifact",
      "id": "release-notes",
      "run": ["bun", "run", "scripts/write-notes.ts", "{output:release-notes}"],
      "outputs": [
        { "id": "release-notes", "path": ".release/notes.md", "mediaType": "text/markdown" }
      ]
    },
    {
      "kind": "artifact",
      "id": "release-notes-transform",
      "inputs": ["release-notes"],
      "run": ["bun", "run", "scripts/transform.ts", "{input:release-notes}", "{output:release-notes-transform}"],
      "outputs": [
        { "id": "release-notes-transform", "path": ".release/notes-public.md", "mediaType": "text/markdown" }
      ]
    }
  ],
  "publish": { "github": { "bodyArtifact": "release-notes-transform" } }
}
```

The example is intentionally about data flow: the generated text artifact is
declared as the GitHub body, and the transform consumes a declared input.
Commands are trusted local code and argv-only. Generic preparation children
receive no authored host environment values: a nonempty `environmentNames`
request is rejected before any subprocess starts, and the runner may retain
only `PATH` to locate the executable. A fresh private staging root is
materialized from the verified Git commit, not copied from ambient workspace
bytes. Staging rejects input mutation and captures no undeclared path. Ignored
or untracked workspace files are not implicit inputs.

This same primitive owns generated release notes, manifests, and the Codex and
Claude agent bundles in the self-release. Remote destinations remain typed npm
or GitHub provider work. Environment protection and human authorization belong
to the workflow host; finalizers and announcements are downstream workflow
steps after a complete report.
