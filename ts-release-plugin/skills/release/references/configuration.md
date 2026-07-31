# ts-release configuration

## The strict value boundary

Configuration is a strict JSON-compatible value supplied to `plan` (or read
exactly once by the CLI/Action from `release.config.json`). The decoder
rejects:

- excess or unknown fields at every nesting level,
- non-JSON runtime values (dates, class instances, functions, bigints,
  non-finite or unsafe numbers, sparse arrays, cycles),
- strings where objects are required (a config path is not a config),
- injected preset machinery (`renderer`, `template`, `adapter`, `authority`,
  `profiles`, `adapters`),
- absolute paths, drive-prefixed paths, and any `..` parent traversal,
- raw secret values anywhere in the document.

Fix rejections by removing the offending key or value, not by loosening the
schema. There is no permissive fallback reader.

## Project identity

```json
{
  "project": {
    "name": "my-tool",
    "version": "1.2.3",
    "tag": "v1.2.3",
    "commit": "<40-hex or short commit>",
    "repository": "owner/repo"
  }
}
```

`name`, `version`, and `tag` are required. `{name}`, `{version}`, `{tag}`,
`{target}`, `{os}`, `{arch}`, `{binary}`, and `{ext}` render as value tokens
in templates; they are never evaluated as code.

## Common target sections

- `builds[]` — Bun-compiled executables (`builder: "bun"`), configured
  commands (`builder: "command"`), prebuilt artifacts, or immutable package
  profiles.
- `artifacts[]` — import already-built files by id, path, and format.
- `archives[]` — tar.gz/zip packaging of selected output ids and/or
  workspace file patterns (see below).
- `checksum` — one digest file over the release artifacts.
- `catalogs[]` — generic whole-file catalog rendering with typed content
  facts (see below).
- `publish` — npm, GitHub Releases, Homebrew, Scoop, PyPI, package stores,
  named providers, changelog, and announcements.

## Files-only archives

`archives[].files` packs workspace files directly, without a build step:

```json
{
  "archives": [
    {
      "id": "my-plugin",
      "ids": [],
      "nameTemplate": "my-plugin-{version}",
      "files": ["my-plugin-directory/**"],
      "formats": ["zip"]
    }
  ]
}
```

Rules:

- Patterns are workspace-relative globs. Absolute paths, drive prefixes,
  parent traversal, empty strings, and an explicit empty array are rejected
  at decode time.
- Matched files keep their full relative paths inside the archive, sorted
  and deduplicated, mode `0644`. Selected output ids are added by basename,
  executables keeping mode `0755`.
- Materialization refuses symlinks that escape the workspace, zero matched
  entries, duplicate archive paths, and the archive ever including itself.
- Archives land at `.release/artifacts/<name>.<format>` and flow into the
  checksum file and GitHub release assets through the normal selection
  rules.

## Generic whole-file catalogs

`catalogs[]` renders a complete file for an external repository from literal
strings plus typed facts of materialized artifacts:

```json
{
  "catalogs": [
    {
      "id": "marketplace",
      "repository": "owner/catalog-repo",
      "directory": "catalog-checkout",
      "file": "path/inside/repo.json",
      "submit": "pull-request",
      "content": [
        "{ \"version\": \"{version}\", \"sha256\": \"",
        { "fact": "sha256", "artifact": "my-plugin" },
        "\" }\n"
      ]
    }
  ]
}
```

Available facts: `sha256`, `downloadUrl`, `assetName`. Content is data; no
templates or code run. The catalog file is rendered locally and submitted
through the reviewed publish stage.

## Credentials by name

Credentials appear in configuration and plans only as environment-variable
names (for example `"tokenEnv": "GITHUB_TOKEN"`). The driver resolves names
at apply time. A raw token value anywhere in configuration or plan bytes is
rejected as a secret-like value. Never write one.

## Minimal valid configuration

```json
{
  "project": { "name": "my-tool", "version": "1.2.3", "tag": "v1.2.3" },
  "artifacts": [
    { "id": "cli", "path": "dist/cli", "format": "executable" }
  ],
  "publish": {
    "github": { "repository": "owner/repo", "tokenEnv": "GITHUB_TOKEN" }
  }
}
```
