# Native preparation

Preparation is the local extension boundary. It has no generic lifecycle
hooks and no second command executor.

`CommandCheck` validates declared inputs and returns pass/fail. A successful
check is not a durable receipt. `CommandArtifact` writes one or more declared
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
Commands are trusted local code, argv-only, and receive only explicitly named
environment values. Staging rejects input mutation and captures no undeclared
path. A remote destination, approval gate, finalizer, or announcement belongs
to its typed host/provider owner.
