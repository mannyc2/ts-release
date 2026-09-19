# Plugin distribution

`@mannyc1/ts-release-openai` accepts an existing owned plugin Tree through
`validatePackage` or `packageFiles`. The latter returns the original file bytes
and executable modes. Multiple skills, ordinary YAML frontmatter, MCP/app files,
scripts, assets and manifest metadata are preserved. `files(PluginInput, read)`
remains a convenience generator for a single skill.

Distribution verifies owned content, safe paths, link-free trees, manifest
identity and bundled manifest path references. It accepts the Codex compatibility
manifest and portable Agent Plugins 1.0 root manifest. It does not certify skill
behavior or execute bundled hooks. These layouts follow the official
[packaging documentation](https://developers.openai.com/plugins/build/plugins).

`marketplace` renders `.agents/plugins/marketplace.json`. Choose either the
existing `sourcePath: "./plugins/tool"` input or a pinned Git source:

```ts
source: {
  source: "git-subdir",
  url: "https://github.com/example/tools.git",
  path: "./plugins/tool",
  sha: "0123456789abcdef0123456789abcdef01234567"
}
```

For repository-root plugins use `source: "url"`, `url` and `sha`. New Git entries
require a full 40-character commit SHA; floating branches are not release pins.
Existing entries may retain refs. Rendering retains other entries and the selected
plugin's installation/authentication policy. The source formats are documented in
[OpenAI marketplace management](https://learn.chatgpt.com/docs/enterprise/plugin-management).
The caller must verify that the pinned commit contains the intended plugin; the
renderer does not fetch Git sources.

Publish the returned bytes through the existing `git` subpath: `FileEdit`,
`CommitInput`, `prepare`, and `update`. Capture the current catalog base, include
its expected ref identity, and retain the resulting Plan/content. Conditional
Git publication preserves unrelated files and refuses stale branch updates.
Local sources also require the plugin files to be delivered at the named path.

`submission` is an optional human portal handoff with listing/test information.
Neither packaging nor marketplace Git delivery calls a portal or proves public
acceptance. Portal form validation is not a required release step.
