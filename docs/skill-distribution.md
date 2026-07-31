# Skill distribution runbook

This runbook covers building, validating, and distributing the ts-release
agent plugin (`ts-release-plugin/`). It distinguishes three states and names
the exact operator actions between them. Nothing in this document is
performed automatically by a release workflow beyond building and verifying
artifacts.

## The three distribution states

### State 1 — Repo marketplace available

The plugin files are on a tagged, public commit of `mannyc2/ts-release`, and
local installation from the repository is smoke-tested.

Users install with:

```sh
codex plugin marketplace add mannyc2/ts-release
codex plugin add ts-release@mannyc2-ts-release --json

claude plugin marketplace add mannyc2/ts-release
claude plugin install ts-release@mannyc2-ts-release
```

The repo catalogs live at `.agents/plugins/marketplace.json` (OpenAI/Codex)
and `.claude-plugin/marketplace.json` (Claude Code); both point at the local
`./ts-release-plugin` tree, so a marketplace checkout is self-contained.

Entry criteria:

- `bun run check:skill-plugin` reports `status: "ready"`.
- `claude plugin validate ./ts-release-plugin --strict` passes.
- The scheduled integration lane's Codex and Claude install jobs pass on a
  fresh runner.

### State 2 — Submission ready

Everything a public-directory submission needs is collected and verified,
but no submission has been made:

- `ts-release-plugin-{version}.zip` and its checksum entry from the dogfood
  release plan (single top-level `ts-release-plugin/` directory).
- Listing metadata from `.codex-plugin/plugin.json` (`interface` display
  name, short/long descriptions, developer name, category, capabilities,
  default prompts).
- The eight behavioral eval cases in `ts-release-plugin/evals/cases.json`.
- Release notes for the version, the exact Git tag and commit, and the
  validation outputs (checker report, strict Claude validation, integration
  lane run links, tool versions).

### State 3 — Published in a first-party public directory

Only after a human operator submits, the host's review passes, and the
operator observes the live listing. Never mark this state from a release
workflow; record the observed listing URL and reviewed commit by hand in
the version table below.

## Manual submission paths

### OpenAI Plugins Directory (skills-only ZIP)

1. Confirm current rules at
   [Plugin submission errors](https://developers.openai.com/plugins/deploy/submission-errors)
   — limits and required fields drift; the values below were checked
   2026-07-31: ZIP ≤ 100 MB compressed / 512 MiB uncompressed, ≤ 5,000
   entries, one plugin root, semver `version`, `description` ≤ 1,024 chars,
   required `author.name` and `interface`
   displayName/shortDescription/longDescription/developerName.
2. A skills-only upload must not contain `mcpServers`/`.mcp.json`,
   `apps`/`.app.json`, or `interface.screenshots`. This package never
   declares them; `check:skill-plugin` enforces that.
3. Upload `ts-release-plugin-{version}.zip` through the developer portal.
   Safety/security scans can take up to two hours. Submission and
   publication are portal actions, not Git pushes.
4. On approval, record the listing URL, version, and reviewed commit below.

### Anthropic community marketplace

1. Third-party public submissions go to Anthropic's reviewed
   `claude-community` marketplace via its published contribution process.
   The Anthropic-curated `claude-plugins-official` catalog has no
   application path; do not claim or attempt it.
2. Before submitting, re-run `claude plugin validate ./ts-release-plugin
   --strict` with the current CLI and re-read
   [Create and distribute a plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces)
   for schema drift and the reserved-name list.
3. On acceptance, record the listing location, version, and reviewed commit
   below.

### Out of scope

Third-party skill registries (for example Skills.sh, Smithery, or `npx
skills`-style installers) are explicitly out of scope for distribution;
do not list this plugin there or add instructions for them.

## Release checklist (per version)

1. Bump the root `package.json` version; `check:skill-plugin` forces both
   plugin manifests, both marketplace entries, and the dogfood release
   config to agree.
2. Update `ts-release-plugin/` references and evals if CLI commands, the
   approval model, plan schema, or run ledger changed in this release.
3. Run the full gates (`bun run check:portable && bun run check:release`).
4. Complete the normal ts-release self-release through its execution and
   publish reviews; the plugin ZIP and checksum ship as release assets.
5. Smoke-test both repo-marketplace installs against the tagged commit.
6. If submitting to a public directory, assemble the State 2 bundle and
   follow the manual path above.

## Rollback / de-listing

- Repo marketplace: revert or re-tag; users receive the corrected version on
  their next marketplace refresh. Yank a broken GitHub release asset by
  deleting the release asset and publishing a fixed patch version.
- OpenAI directory: request removal/de-listing through the portal for the
  affected version and submit a fixed version.
- Anthropic community marketplace: follow the community marketplace's
  removal process; a reserved-name or impersonation report also de-lists.
- Always publish a fixed patch version rather than mutating a released ZIP;
  the checksum table below must stay append-only.

## Support

- Issues: <https://github.com/mannyc2/ts-release/issues>
- Repository: <https://github.com/mannyc2/ts-release>

## Version record

| Package version | Git tag | Plugin ZIP sha256 | Codex CLI validated | Claude CLI validated | Public listing |
|---|---|---|---|---|---|
| 0.2.0 | v0.2.0 (pending) | recorded at release materialization | pending | 2.x strict validate passed 2026-07-31 | not submitted |

Update this table by hand: the ZIP checksum comes from the materialized
release's checksum file; the "Public listing" column changes only when an
operator observes a live listing.
