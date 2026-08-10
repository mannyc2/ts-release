# Configuration

The authored JSON shape is validated strictly. Unknown keys, absolute paths,
parent traversal, non-JSON values, and raw secret values are rejected.

Minimal configuration:

```json
{
  "project": { "name": "my-tool", "version": "1.2.3", "tag": "v1.2.3" },
  "artifacts": [{ "id": "cli", "path": "dist/cli", "format": "executable" }]
}
```

Use `builds` for Bun or configured native builders, `preparations` for typed
native command artifacts, `archives` and `checksum` for local outputs, and
`publish.npm` or `publish.github` for provider subjects. A preparation declares
every output and its argv; it is trusted local code, not a sandbox.
